migrate((app) => {
  const menu = app.findCollectionByNameOrId("menu_items")
  const field = menu.fields.getByName("days")
  field.values = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  field.maxSelect = 5
  app.save(menu)
  // Existing menus gain the additional days; admins can adjust each item afterward.
  for (const item of app.findAllRecords("menu_items")) {
    const old = item.getStringSlice("days")
    item.set("days", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].filter(d => old.indexOf(d) !== -1 || ["Tuesday", "Thursday", "Friday"].indexOf(d) !== -1))
    app.save(item)
  }
  const users = app.findCollectionByNameOrId("users")
  users.updateRule = '@request.auth.role = "admin" || (@request.auth.id = id && @request.body.role:isset = false && @request.body.active:isset = false && @request.body.school:isset = false && @request.body.verified:isset = false)'
  app.save(users)
}, (app) => {
  const menu = app.findCollectionByNameOrId("menu_items")
  for (const item of app.findAllRecords("menu_items")) {
    item.set("days", item.getStringSlice("days").filter(d => d === "Monday" || d === "Wednesday"))
    app.save(item)
  }
  const field = menu.fields.getByName("days")
  field.values = ["Monday", "Wednesday"]; field.maxSelect = 2
  app.save(menu)
})
