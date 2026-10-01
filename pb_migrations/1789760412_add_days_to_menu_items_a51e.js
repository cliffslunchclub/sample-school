migrate((app) => {
  const menuItems = app.findCollectionByNameOrId("menu_items")
  menuItems.fields.add(new SelectField({
    name: "days",
    values: ["Monday", "Wednesday"],
    maxSelect: 2,
  }))
  app.save(menuItems)

  // Backfill: all existing items are available on both days
  const items = app.findRecordsByFilter("menu_items", "id != ''", "", 0, 0)
  for (const r of items) {
    r.set("days", ["Monday", "Wednesday"])
    app.save(r)
  }
}, (app) => {
  const menuItems = app.findCollectionByNameOrId("menu_items")
  menuItems.fields.removeByName("days")
  app.save(menuItems)
})
