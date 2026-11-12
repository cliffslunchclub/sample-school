// CHS weekday-recurring lunches; leave existing dated selections untouched for history.
// The sample school continues to use dated lunches.
migrate((app) => {
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  const orders = app.findCollectionByNameOrId("meal_selections")
  orders.fields.getByName("lunch_date").required = false
  orders.fields.add(new SelectField({ name: "recurring_weekday", values: weekdays, maxSelect: 1 }))
  orders.indexes.push("CREATE INDEX idx_meals_school_recurring ON meal_selections (school, recurring_weekday)")
  app.save(orders)
  for (const name of ["audit_log", "parent_audit_log"]) {
    const collection = app.findCollectionByNameOrId(name)
    collection.fields.add(new SelectField({ name: "recurring_weekday", values: weekdays, maxSelect: 1 }))
    app.save(collection)
  }
}, (app) => {
  // Do not delete records on rollback. Requiring migration rollback to be explicit
  // protects any CHS recurring orders that could otherwise be lost.
  throw new Error("Recurring lunch schema cannot be rolled back while weekly orders may exist.")
})
