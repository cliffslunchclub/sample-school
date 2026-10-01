migrate((app) => {
  const ih = app.findCollectionByNameOrId("import_history")
  const f = ih.fields.getByName("import_type")
  f.values = ["roster", "orders", "combined"]
  f.maxSelect = 1
  app.save(ih)
}, (app) => {
  const ih = app.findCollectionByNameOrId("import_history")
  const f = ih.fields.getByName("import_type")
  f.values = ["roster", "orders"]
  f.maxSelect = 1
  app.save(ih)
})
