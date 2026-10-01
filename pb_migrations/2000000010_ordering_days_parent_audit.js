migrate((app) => {
  const settings = app.findCollectionByNameOrId("settings")
  settings.fields.add(new SelectField({name:"ordering_days",values:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],maxSelect:7}))
  app.save(settings)
  for (const record of app.findAllRecords("settings")) {record.set("ordering_days", ["Thursday", "Friday"]);app.save(record)}
  const students=app.findCollectionByNameOrId("students")
  const users=app.findCollectionByNameOrId("users")
  const menu=app.findCollectionByNameOrId("menu_items")
  const meals=app.findCollectionByNameOrId("meal_selections")
  const schools=app.findCollectionByNameOrId("schools")
  const parentAudit=new Collection({type:"base",name:"parent_audit_log",listRule:'@request.auth.role = "admin"',viewRule:'@request.auth.role = "admin"',createRule:null,updateRule:null,deleteRule:null,fields:[
    {type:"relation",name:"actor",collectionId:users.id,maxSelect:1},
    {type:"relation",name:"student",collectionId:students.id,maxSelect:1},
    {type:"relation",name:"meal_selection",collectionId:meals.id,maxSelect:1},
    {type:"relation",name:"school",collectionId:schools.id,maxSelect:1},
    {type:"relation",name:"previous_meal",collectionId:menu.id,maxSelect:1},
    {type:"relation",name:"new_meal",collectionId:menu.id,maxSelect:1},
    {type:"date",name:"lunch_date"}, {type:"date",name:"previous_lunch_date"},
    {type:"text",name:"actor_name"}, {type:"text",name:"actor_email"},
    {type:"text",name:"student_name"}, {type:"text",name:"previous_meal_name"}, {type:"text",name:"new_meal_name"},
    {type:"text",name:"previous_delivery_time"}, {type:"text",name:"new_delivery_time"},
    {type:"text",name:"action"}, {type:"text",name:"reason"},
    {type:"autodate",name:"created",onCreate:true},
  ]})
  app.save(parentAudit)
  meals.createRule='@request.auth.role = "admin" || (@request.auth.role = "parent" && @request.auth.active = true && @request.body.parent = @request.auth.id && student.parent = @request.auth.id && @request.body.school = @request.auth.school)'
  meals.updateRule='@request.auth.role = "admin" || (@request.auth.role = "parent" && @request.auth.active = true && parent = @request.auth.id && (@request.body.parent:isset = false || @request.body.parent = parent) && (@request.body.school:isset = false || @request.body.school = school) && (@request.body.student:isset = false || @request.body.student = student))'
  app.save(meals)
}, (app) => {
  const settings=app.findCollectionByNameOrId("settings");settings.fields.removeByName("ordering_days");app.save(settings)
  app.delete(app.findCollectionByNameOrId("parent_audit_log"))
})
