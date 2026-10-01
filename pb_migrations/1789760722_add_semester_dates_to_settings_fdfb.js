migrate((app) => {
  const settings = app.findCollectionByNameOrId("settings")
  settings.fields.add(new DateField({ name: "semester_start" }))
  settings.fields.add(new DateField({ name: "semester_end" }))
  app.save(settings)

  // Seed current semester dates into existing settings records
  const recs = app.findRecordsByFilter("settings", "id != ''", "", 0, 0)
  for (const r of recs) {
    r.set("semester_start", "2026-09-14 12:00:00.000Z")
    r.set("semester_end",   "2026-11-11 12:00:00.000Z")
    app.save(r)
  }
}, (app) => {
  const settings = app.findCollectionByNameOrId("settings")
  settings.fields.removeByName("semester_start")
  settings.fields.removeByName("semester_end")
  app.save(settings)
})
