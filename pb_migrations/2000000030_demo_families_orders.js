migrate((app) => {
  // Deployment packaging disables every demo seed for a fresh CHS installation.
  if (!($os.getenv("CLIFFS_SEED_DEMO") !== "false")) return;
  let john;
  try { john = app.findFirstRecordByFilter("users", "email = 'parent@example.test' && role = 'parent'"); }
  catch (e) { return; }
  const school = john.getString("school");
  const users = app.findCollectionByNameOrId("users");
  const students = app.findCollectionByNameOrId("students");
  const meals = app.findCollectionByNameOrId("meal_selections");
  const grades = app.findRecordsByFilter("grades", "school = {:school} && active = true", "sort_order", 0, 0, {school});
  const teachers = app.findRecordsByFilter("teachers", "school = {:school} && active = true", "name", 0, 0, {school});
  const rules = app.findRecordsByFilter("delivery_rules", "school = {:school}", "", 0, 0, {school});
  const times = app.findRecordsByFilter("delivery_time_slots", "school = {:school} && active = true", "sort_order", 0, 0, {school});
  const menu = app.findRecordsByFilter("menu_items", "school = {:school} && active = true", "name", 0, 0, {school});
  if (!grades.length || !teachers.length || !times.length || !menu.length) throw new Error("Demo families need active grades, teachers, delivery times and meals.");
  const families = [
    {email: "parent2@example.test", first: "Emily", last: "Johnson", children: ["Ava Johnson", "Oliver Johnson", "Noah Johnson"]},
    {email: "parent3@example.test", first: "Michael", last: "Davis", children: ["Sophia Davis", "Lucas Davis", "Mia Davis"]},
    {email: "parent4@example.test", first: "Sarah", last: "Wilson", children: ["Ella Wilson", "Ethan Wilson", "Liam Wilson"]},
  ];
  const parents = [john];
  let index = 0;
  for (const family of families) {
    let parent;
    try { parent = app.findFirstRecordByFilter("users", "email = {:email}", {email: family.email}); }
    catch (e) {
      parent = new Record(users);
      parent.set("email", family.email);
      parent.set("password", "LocalLunch2026!");
      parent.set("passwordConfirm", "LocalLunch2026!");
      parent.set("first_name", family.first); parent.set("last_name", family.last);
      parent.set("role", "parent"); parent.set("active", true); parent.set("verified", true);
      parent.set("emailVisibility", true);
      parent.set("school", school); app.save(parent);
    }
    if (parent.getString("role") !== "parent" || parent.getString("school") !== school) throw new Error("Demo email is already assigned to another role or school.");
    parents.push(parent);
    for (const name of family.children) {
      const grade = grades[index++ % grades.length];
      const teacher = teachers.find(t => t.getString("grade") === grade.id);
      if (!teacher) throw new Error("Demo grade has no active teacher.");
      try { app.findFirstRecordByFilter("students", "parent = {:parent} && name = {:name}", {parent: parent.id, name}); continue; }
      catch (e) {}
      const student = new Record(students);
      student.set("name", name); student.set("parent", parent.id); student.set("school", school);
      student.set("grade", grade.id); student.set("teacher", teacher.id); student.set("active", true);
      app.save(student);
    }
  }
  const settings = app.findFirstRecordByFilter("settings", "school = {:school}", {school});
  const start = settings.getString("semester_start").slice(0, 10);
  const end = settings.getString("semester_end").slice(0, 10);
  let cursor = new Date(start + "T12:00:00Z").getTime();
  const finish = new Date(end + "T12:00:00Z").getTime();
  if (!Number.isFinite(cursor) || !Number.isFinite(finish) || cursor > finish) throw new Error("Set valid demo semester dates before seeding orders.");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dates = [];
  for (; cursor <= finish; cursor += 86400000) {
    const date = new Date(cursor); const day = date.getUTCDay();
    if (day >= 1 && day <= 5) dates.push({key: date.toISOString().slice(0, 10), weekday: days[day]});
  }
  for (const parent of parents) {
    const children = app.findRecordsByFilter("students", "parent = {:parent} && school = {:school} && active = true", "name", 0, 0, {parent: parent.id, school});
    for (const student of children) {
      const existing = app.findRecordsByFilter("meal_selections", "student = {:student}", "", 0, 0, {student: student.id});
      const savedDates = existing.map(record => record.getString("lunch_date").slice(0, 10));
      const matchingRules = rules.filter(rule => rule.getString("grade") === student.getString("grade"));
      const rule = matchingRules.find(rule => rule.getString("teacher") === student.getString("teacher")) || matchingRules.find(rule => !rule.getString("teacher"));
      const time = rule && times.find(time => time.id === rule.getString("delivery_time")) || times[0];
      for (const date of dates) {
        if (savedDates.indexOf(date.key) !== -1) continue; // Never overwrite an existing selection.
        const available = menu.filter(item => item.getStringSlice("days").indexOf(date.weekday) !== -1);
        if (!available.length) throw new Error("No demo meals available on " + date.weekday);
        const meal = new Record(meals);
        meal.set("student", student.id); meal.set("parent", parent.id); meal.set("school", school);
        meal.set("lunch_date", date.key + "T12:00:00.000Z");
        meal.set("menu_item", available[Math.floor(Math.random() * available.length)].id);
        meal.set("delivery_time", time.id); app.save(meal);
      }
    }
  }
  // These are seeded sample orders, not parent actions: do not fabricate audit entries.
}, (app) => {});
