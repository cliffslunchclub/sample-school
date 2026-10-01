migrate((app) => {
  // ─── APP SETTINGS ─────────────────────────────────────────────────────────
  const s = app.settings()
  s.meta.appName = "Cliffs Lunch Club"
  app.save(s)

  const adminOnly = '@request.auth.role = "admin"'
  const anyAuth   = "@request.auth.id != ''"

  // ─── SCHOOLS ──────────────────────────────────────────────────────────────
  const schools = new Collection({
    type: "base", name: "schools",
    listRule: anyAuth, viewRule: anyAuth,
    createRule: adminOnly, updateRule: adminOnly, deleteRule: adminOnly,
    fields: [
      { type: "text",     name: "name",    required: true, max: 200 },
      { type: "bool",     name: "active" },
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  })
  app.save(schools)
  const schoolsId = schools.id

  const schoolRec = new Record(schools)
  schoolRec.set("name", $os.getenv("CLIFFS_SCHOOL_NAME") || "Cliffs Elementary")
  schoolRec.set("active", true)
  app.save(schoolRec)
  const schoolId = schoolRec.id

  // ─── USERS (extend built-in auth collection) ───────────────────────────────
  const usersCol = app.findCollectionByNameOrId("users")
  usersCol.fields.add(new SelectField({ name: "role",       values: ["parent","admin"], maxSelect: 1 }))
  usersCol.fields.add(new TextField  ({ name: "first_name", max: 100 }))
  usersCol.fields.add(new TextField  ({ name: "last_name",  max: 100 }))
  usersCol.fields.add(new BoolField  ({ name: "active" }))
  usersCol.fields.add(new RelationField({ name: "school", collectionId: schoolsId, maxSelect: 1 }))
  usersCol.listRule   = '@request.auth.id != "" && (id = @request.auth.id || @request.auth.role = "admin")'
  usersCol.viewRule   = '@request.auth.id != "" && (id = @request.auth.id || @request.auth.role = "admin")'
  usersCol.createRule = null
  usersCol.updateRule = '@request.auth.role = "admin" || (@request.auth.id = id && @request.body.role:isset = false && @request.body.active:isset = false)'
  usersCol.deleteRule = adminOnly
  usersCol.authRule   = "active = true"
  app.save(usersCol)
  const usersId = usersCol.id

  // ─── GRADES ───────────────────────────────────────────────────────────────
  const grades = new Collection({
    type: "base", name: "grades",
    listRule: anyAuth, viewRule: anyAuth,
    createRule: adminOnly, updateRule: adminOnly, deleteRule: adminOnly,
    fields: [
      { type: "text",     name: "name",       required: true, max: 100 },
      { type: "number",   name: "sort_order" },
      { type: "bool",     name: "active" },
      { type: "relation", name: "school",     collectionId: schoolsId, maxSelect: 1 },
      { type: "autodate", name: "created",    onCreate: true },
      { type: "autodate", name: "updated",    onCreate: true, onUpdate: true },
    ],
  })
  app.save(grades)
  const gradesId = grades.id

  // ─── TEACHERS ─────────────────────────────────────────────────────────────
  const teachers = new Collection({
    type: "base", name: "teachers",
    listRule: anyAuth, viewRule: anyAuth,
    createRule: adminOnly, updateRule: adminOnly, deleteRule: adminOnly,
    fields: [
      { type: "text",     name: "name",    required: true, max: 150 },
      { type: "relation", name: "grade",   required: true, collectionId: gradesId, maxSelect: 1 },
      { type: "bool",     name: "active" },
      { type: "relation", name: "school",  collectionId: schoolsId, maxSelect: 1 },
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  })
  app.save(teachers)
  const teachersId = teachers.id

  // ─── MENU ITEMS ───────────────────────────────────────────────────────────
  const menuItems = new Collection({
    type: "base", name: "menu_items",
    listRule: anyAuth, viewRule: anyAuth,
    createRule: adminOnly, updateRule: adminOnly, deleteRule: adminOnly,
    fields: [
      { type: "text",     name: "name",        required: true, max: 200 },
      { type: "text",     name: "description", max: 500 },
      { type: "bool",     name: "active" },
      { type: "relation", name: "school",      collectionId: schoolsId, maxSelect: 1 },
      { type: "autodate", name: "created",     onCreate: true },
      { type: "autodate", name: "updated",     onCreate: true, onUpdate: true },
    ],
  })
  app.save(menuItems)
  const menuItemsId = menuItems.id

  // ─── DELIVERY TIME SLOTS ──────────────────────────────────────────────────
  const deliveryTimes = new Collection({
    type: "base", name: "delivery_time_slots",
    listRule: anyAuth, viewRule: anyAuth,
    createRule: adminOnly, updateRule: adminOnly, deleteRule: adminOnly,
    fields: [
      { type: "text",     name: "label",      required: true, max: 50 },
      { type: "number",   name: "sort_order" },
      { type: "bool",     name: "active" },
      { type: "relation", name: "school",     collectionId: schoolsId, maxSelect: 1 },
      { type: "autodate", name: "created",    onCreate: true },
      { type: "autodate", name: "updated",    onCreate: true, onUpdate: true },
    ],
  })
  app.save(deliveryTimes)
  const deliveryTimesId = deliveryTimes.id

  // ─── DELIVERY RULES ───────────────────────────────────────────────────────
  const deliveryRules = new Collection({
    type: "base", name: "delivery_rules",
    listRule: anyAuth, viewRule: anyAuth,
    createRule: adminOnly, updateRule: adminOnly, deleteRule: adminOnly,
    fields: [
      { type: "relation", name: "grade",         required: true, collectionId: gradesId,       maxSelect: 1 },
      { type: "relation", name: "teacher",                       collectionId: teachersId,      maxSelect: 1 },
      { type: "relation", name: "delivery_time", required: true, collectionId: deliveryTimesId, maxSelect: 1 },
      { type: "relation", name: "school",                        collectionId: schoolsId,       maxSelect: 1 },
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  })
  app.save(deliveryRules)

  // ─── STUDENTS ─────────────────────────────────────────────────────────────
  const students = new Collection({
    type: "base", name: "students",
    listRule:   '@request.auth.id != "" && (parent = @request.auth.id || @request.auth.role = "admin")',
    viewRule:   '@request.auth.id != "" && (parent = @request.auth.id || @request.auth.role = "admin")',
    createRule: '@request.auth.role = "admin" || (@request.auth.id != "" && @request.body.parent = @request.auth.id)',
    updateRule: '@request.auth.role = "admin" || (parent = @request.auth.id && @request.body.parent:isset = false)',
    deleteRule: adminOnly,
    fields: [
      { type: "text",     name: "name",    required: true, max: 150 },
      { type: "relation", name: "grade",   required: true, collectionId: gradesId,   maxSelect: 1 },
      { type: "relation", name: "teacher", required: true, collectionId: teachersId, maxSelect: 1 },
      { type: "relation", name: "parent",                  collectionId: usersId,    maxSelect: 1 },
      { type: "bool",     name: "active" },
      { type: "relation", name: "school",                  collectionId: schoolsId,  maxSelect: 1 },
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  })
  app.save(students)
  const studentsId = students.id

  // ─── MEAL SELECTIONS ──────────────────────────────────────────────────────
  // No unique index — a student may have multiple entries per date (e.g. two lunches).
  // Parent time-window enforcement lives in pb_hooks/meal_window.pb.js.
  const mealSelections = new Collection({
    type: "base", name: "meal_selections",
    listRule:   '@request.auth.id != "" && (parent = @request.auth.id || @request.auth.role = "admin")',
    viewRule:   '@request.auth.id != "" && (parent = @request.auth.id || @request.auth.role = "admin")',
    createRule: '@request.auth.role = "admin" || (@request.auth.id != "" && @request.body.parent = @request.auth.id)',
    updateRule: '@request.auth.role = "admin" || parent = @request.auth.id',
    deleteRule: adminOnly,
    fields: [
      { type: "relation", name: "student",       required: true, collectionId: studentsId,      maxSelect: 1 },
      { type: "relation", name: "menu_item",      required: true, collectionId: menuItemsId,     maxSelect: 1 },
      { type: "relation", name: "delivery_time",               collectionId: deliveryTimesId,   maxSelect: 1 },
      { type: "relation", name: "parent",                       collectionId: usersId,           maxSelect: 1 },
      { type: "relation", name: "school",                       collectionId: schoolsId,         maxSelect: 1 },
      { type: "date",     name: "lunch_date",     required: true },
      { type: "autodate", name: "created",        onCreate: true },
      { type: "autodate", name: "updated",        onCreate: true, onUpdate: true },
    ],
  })
  app.save(mealSelections)

  // ─── AUDIT LOG ────────────────────────────────────────────────────────────
  const auditLog = new Collection({
    type: "base", name: "audit_log",
    listRule: adminOnly, viewRule: adminOnly,
    createRule: '@request.auth.role = "admin" && @request.body.admin = @request.auth.id',
    updateRule: null,
    deleteRule: adminOnly,
    fields: [
      { type: "relation", name: "student",       collectionId: studentsId,  maxSelect: 1 },
      { type: "relation", name: "previous_meal", collectionId: menuItemsId, maxSelect: 1 },
      { type: "relation", name: "new_meal",      collectionId: menuItemsId, maxSelect: 1 },
      { type: "relation", name: "admin", required: true, collectionId: usersId, maxSelect: 1 },
      { type: "text",     name: "action",  max: 100 },
      { type: "text",     name: "reason",  max: 500 },
      { type: "relation", name: "school",        collectionId: schoolsId,   maxSelect: 1 },
      { type: "date",     name: "lunch_date" },
      { type: "autodate", name: "created",       onCreate: true },
    ],
  })
  app.save(auditLog)

  // ─── IMPORT HISTORY ───────────────────────────────────────────────────────
  const importHistory = new Collection({
    type: "base", name: "import_history",
    listRule: adminOnly, viewRule: adminOnly,
    createRule: '@request.auth.role = "admin" && @request.body.admin = @request.auth.id',
    updateRule: null, deleteRule: adminOnly,
    fields: [
      { type: "text",     name: "filename",       required: true, max: 300 },
      { type: "select",   name: "import_type",    required: true, values: ["roster","orders"], maxSelect: 1 },
      { type: "relation", name: "admin",          required: true, collectionId: usersId,   maxSelect: 1 },
      { type: "number",   name: "rows_processed" },
      { type: "number",   name: "rows_imported" },
      { type: "number",   name: "rows_skipped" },
      { type: "number",   name: "rows_errors" },
      { type: "text",     name: "summary",        max: 2000 },
      { type: "relation", name: "school",         collectionId: schoolsId, maxSelect: 1 },
      { type: "autodate", name: "created",        onCreate: true },
    ],
  })
  app.save(importHistory)

  // ─── SETTINGS ─────────────────────────────────────────────────────────────
  const settings = new Collection({
    type: "base", name: "settings",
    listRule: adminOnly, viewRule: adminOnly,
    createRule: adminOnly, updateRule: adminOnly, deleteRule: null,
    fields: [
      { type: "text",     name: "verification_code", required: true, max: 100 },
      { type: "relation", name: "school",             collectionId: schoolsId, maxSelect: 1 },
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  })
  app.save(settings)

  // Deployment packaging fixes this choice per installation. Existing databases
  // never rerun this migration; a clean live school gets no sample records.
  if (!($os.getenv("CLIFFS_SEED_DEMO") !== "false")) return

  // ─── SEED: DELIVERY TIME SLOTS ────────────────────────────────────────────
  const t1045 = new Record(deliveryTimes)
  t1045.set("label", "10:45")
  t1045.set("sort_order", 1)
  t1045.set("active", true)
  t1045.set("school", schoolId)
  app.save(t1045)

  const t1145 = new Record(deliveryTimes)
  t1145.set("label", "11:45")
  t1145.set("sort_order", 2)
  t1145.set("active", true)
  t1145.set("school", schoolId)
  app.save(t1145)

  // ─── SEED: GRADES ─────────────────────────────────────────────────────────
  const gradeNames = ["Kindergarten","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5"]
  const gradeIdMap = new Map()
  gradeNames.forEach(function(gname, i) {
    const r = new Record(grades)
    r.set("name", gname)
    r.set("sort_order", i + 1)
    r.set("active", true)
    r.set("school", schoolId)
    app.save(r)
    gradeIdMap.set(gname, r.id)
  })

  // ─── SEED: TEACHERS ───────────────────────────────────────────────────────
  const teacherDefs = [
    ["Kindergarten","Anderson"],["Kindergarten","Bautista"],
    ["Grade 1","Carter"],["Grade 1","Diaz"],
    ["Grade 2","Evans"],["Grade 2","Flores"],
    ["Grade 3","DelPriore"],["Grade 3","Garcia"],
    ["Grade 4","Harris"],["Grade 4","Ito"],
    ["Grade 5","Johnson"],["Grade 5","Kim"],
  ]
  teacherDefs.forEach(function(pair) {
    const r = new Record(teachers)
    r.set("name", pair[1])
    r.set("grade", gradeIdMap.get(pair[0]))
    r.set("active", true)
    r.set("school", schoolId)
    app.save(r)
  })

  // ─── SEED: DELIVERY RULES (grade → time) ──────────────────────────────────
  const ruleDefs = [
    ["Kindergarten", t1045.id],
    ["Grade 1",      t1045.id],
    ["Grade 2",      t1045.id],
    ["Grade 3",      t1145.id],
    ["Grade 4",      t1145.id],
    ["Grade 5",      t1145.id],
  ]
  ruleDefs.forEach(function(pair) {
    const r = new Record(deliveryRules)
    r.set("grade", gradeIdMap.get(pair[0]))
    r.set("delivery_time", pair[1])
    r.set("school", schoolId)
    app.save(r)
  })

  // ─── SEED: MENU ITEMS ─────────────────────────────────────────────────────
  const menuNames = [
    "Bolognese Pasta","Bowtie & Meatballs","Bulgogi Beef Bowl",
    "Cheeseburger Sliders + TT","Chicken Alfredo Pasta","Chicken Fried Rice",
    "Chicken Katsu Curry Bowl","Chicken Quesadilla","Chicken Nuggets + TT",
    "Chicken Teriyaki Bowl","Grilled Cheese + TT","Grilled Chicken Caesar Wrap",
    "Grilled Chicken Wrap (Plain)","Gyudon","KBBQ Sliders + TT",
  ]
  menuNames.forEach(function(mname) {
    const r = new Record(menuItems)
    r.set("name", mname)
    r.set("active", true)
    r.set("school", schoolId)
    app.save(r)
  })

  // ─── SEED: SETTINGS RECORD ────────────────────────────────────────────────
  const settingsRec = new Record(settings)
  settingsRec.set("verification_code", "DEMO2026")
  settingsRec.set("school", schoolId)
  app.save(settingsRec)

  // ─── SEED: ADMIN USERS ────────────────────────────────────────────────────
  function makeAdmin(email, password, firstName, lastName) {
    const rec = new Record(usersCol)
    rec.set("email", email)
    rec.set("password", password)
    rec.set("passwordConfirm", password)
    rec.set("emailVisibility", true)
    rec.set("verified", true)
    rec.set("role", "admin")
    rec.set("first_name", firstName)
    rec.set("last_name", lastName)
    rec.set("active", true)
    rec.set("school", schoolId)
    app.save(rec)
  }

  makeAdmin("admin@example.test", "LocalLunch2026!", "Demo", "Admin")

}, (app) => {
  const names = [
    "audit_log","meal_selections","students","delivery_rules",
    "delivery_time_slots","menu_items","teachers","grades",
    "import_history","settings","schools",
  ]
  names.forEach(function(n) { try { app.delete(app.findCollectionByNameOrId(n)) } catch(e) {} })
  try {
    const u = app.findCollectionByNameOrId("users")
    ;["role","first_name","last_name","active","school"].forEach(function(f) {
      try { u.fields.removeByName(f) } catch(e) {}
    })
    app.save(u)
  } catch(e) {}
})
