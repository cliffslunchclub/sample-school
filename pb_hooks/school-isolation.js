module.exports.validate=function(e){
  if(e.hasSuperuserAuth()) return
  if(!e.auth || !e.auth.getBool("active")) throw new ForbiddenError("Please sign in.")
  const school=e.auth.getString("school")
  if(!school || !e.app.findRecordById("schools",school).getBool("active") || e.record.getString("school")!==school) throw new ForbiddenError("School access denied.")
  if(!e.record.isNew() && e.record.original().getString("school")!==school) throw new ForbiddenError("School access denied.")
  const relations={grade:"grades",teacher:"teachers",parent:"users",student:"students",menu_item:"menu_items",delivery_time:"delivery_time_slots",previous_meal:"menu_items",new_meal:"menu_items",admin:"users"}
  for(const field in relations){
    const id=e.record.getString(field)
    if(!id) continue
    const related=e.app.findRecordById(relations[field],id)
    if(related.getString("school")!==school) throw new BadRequestError("Related records must belong to your school.")
    if(field==="parent" && related.getString("role")!=="parent") throw new BadRequestError("Select a parent account.")
  }
  if(e.record.collection().name==="students"){
    const teacher=e.app.findRecordById("teachers",e.record.getString("teacher"))
    if(teacher.getString("grade")!==e.record.getString("grade")) throw new BadRequestError("Teacher must belong to the selected grade.")
  }
  if(e.record.collection().name==="meal_selections") {
    const student=e.app.findRecordById("students",e.record.getString("student"))
    if(student.getString("parent")!==e.record.getString("parent")) throw new BadRequestError("Meal parent must match the student.")
    if(e.auth.getString("role")==="parent" && !e.record.isNew() && e.record.getString("student")!==e.record.original().getString("student")) throw new ForbiddenError("Meal student cannot be changed.")
  }
}
