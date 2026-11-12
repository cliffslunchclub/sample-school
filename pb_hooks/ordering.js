// Shared by create/update hooks; audits are committed in the same transaction as the meal.
module.exports = {
  process: (e, action) => {
    require(__hooks + "/school-isolation.js").validate(e)
    // Enforce the CHS-only recurring schedule for administrators as well as parents.
    const requestedWeekday=e.record.getString("recurring_weekday")
    if (requestedWeekday) {
      const school=e.app.findRecordById("schools",e.record.getString("school"))
      if (school.getString("slug")!=="chs" || requestedWeekday!=="Monday" || e.record.getString("lunch_date")) {
        throw new BadRequestError("Recurring lunches are Monday-only at CHS and must not include a calendar date.")
      }
    }
    if (!e.auth || e.auth.getString("role") !== "parent") return e.next()
    if (!e.auth.getBool("active")) throw new ForbiddenError("Your account is inactive.")
    const app=e.app
    const settings=app.findFirstRecordByFilter("settings", "school = {:school}", {school:e.auth.getString("school")})
    const selected=settings.getStringSlice("ordering_days")
    const names=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
    const calendar=require(__hooks + "/school-calendar.js").orderingCalendar(new Date())
    const dow=calendar.day
    if (selected.indexOf(names[dow]) === -1) throw new BadRequestError("Ordering is currently closed. Check the school's meal selection days.")
    const keys=calendar.keys
    const recurring=e.record.getString("recurring_weekday")
    const school=app.findRecordById("schools",e.auth.getString("school"))
    const isRecurring=!!recurring
    const key=e.record.getString("lunch_date").slice(0,10)
    if (isRecurring) {
      if (school.getString("slug")!=="chs" || recurring!=="Monday") throw new BadRequestError("Recurring lunch is currently available only on Monday at CHS.")
      if (key) throw new BadRequestError("Recurring lunch orders must not include a calendar date.")
    } else {
      if (keys.indexOf(key)===-1) throw new BadRequestError("Parents can only order for the following week's Monday through Friday.")
      const start=settings.getString("semester_start").slice(0,10),end=settings.getString("semester_end").slice(0,10)
      if ((start && key<start)||(end && key>end)) throw new BadRequestError("Lunch date is outside the school semester.")
    }
    const previous=action==="meal_update" ? app.findRecordById("meal_selections",e.record.id) : null
    if (previous && (isRecurring
      ? previous.getString("recurring_weekday")!==recurring
      : keys.indexOf(previous.getString("lunch_date").slice(0,10))===-1)) throw new BadRequestError("This order is locked.")
    const student=app.findRecordById("students",e.record.getString("student"))
    if (student.getString("parent")!==e.auth.id || e.record.getString("parent")!==e.auth.id || e.record.getString("school")!==e.auth.getString("school")) throw new ForbiddenError("You may only change your own student's meals.")
    const menu=app.findRecordById("menu_items",e.record.getString("menu_item"))
    const weekday=isRecurring ? recurring : names[new Date(key+"T12:00:00Z").getUTCDay()]
    if (!menu.getBool("active") || menu.getStringSlice("days").indexOf(weekday)===-1) throw new BadRequestError("This meal is not available on the selected lunch day.")
    const fields=["menu_item","lunch_date","recurring_weekday","delivery_time","student"]
    if (previous && fields.every(f=>previous.getString(f)===e.record.getString(f))) return e.next()
    const previousName=previous ? app.findRecordById("menu_items",previous.getString("menu_item")).getString("name") : ""
    const timeName=(id)=>id ? app.findRecordById("delivery_time_slots",id).getString("label") : ""
    const beforeTime=previous ? timeName(previous.getString("delivery_time")) : ""
    const afterTime=timeName(e.record.getString("delivery_time"))
    app.runInTransaction(txApp=>{
        txApp.save(e.record)
        const log=new Record(txApp.findCollectionByNameOrId("parent_audit_log"))
        log.set("actor",e.auth.id);log.set("actor_name",(e.auth.getString("first_name")+" "+e.auth.getString("last_name")).trim());log.set("actor_email",e.auth.getString("email"))
        log.set("student",student.id);log.set("student_name",student.getString("name"));log.set("school",e.auth.getString("school"));log.set("meal_selection",e.record.id)
        log.set("previous_meal",previous ? previous.getString("menu_item") : "");log.set("new_meal",e.record.getString("menu_item"))
        log.set("previous_meal_name",previousName);log.set("new_meal_name",menu.getString("name"))
        log.set("previous_delivery_time",beforeTime);log.set("new_delivery_time",afterTime)
        log.set("previous_lunch_date",previous ? previous.getString("lunch_date") : "");log.set("lunch_date",e.record.getString("lunch_date"));log.set("recurring_weekday",recurring);log.set("action",action)
        txApp.save(log)
    })
    // Respond only after BOTH writes commit, so failed audits cannot produce successful meal responses.
    return e.json(200, e.record.publicExport())
  }
}
