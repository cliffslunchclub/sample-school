migrate((app) => {
  const school = app.findFirstRecordByFilter("schools", "id != ''");
  const users = app.findCollectionByNameOrId("users");
  for (const role of ["admin", "parent"]) {
    // The initial migration already creates the demo admin on a fresh database.
    try { app.findFirstRecordByFilter("users", "email = {:email}", {email: role + "@example.test"}); continue; } catch (e) {}
    const r = new Record(users);
    r.set("email", role + "@example.test");
    r.set("password", "LocalLunch2026!");
    r.set("passwordConfirm", "LocalLunch2026!");
    r.set("role", role); r.set("active", true); r.set("verified", true);
    r.set("first_name", "Demo"); r.set("last_name", role);
    r.set("school", school.id); app.save(r);
  }
  const parent = app.findFirstRecordByFilter("users", "role = 'parent'");
  const grade = app.findFirstRecordByFilter("grades", "id != ''");
  const teacher = app.findFirstRecordByFilter("teachers", "grade = {:grade}", {grade: grade.id});
  const student = new Record(app.findCollectionByNameOrId("students"));
  student.set("name", "Demo Student"); student.set("parent", parent.id);
  student.set("school", school.id); student.set("grade", grade.id);
  student.set("teacher", teacher.id); student.set("active", true); app.save(student);
}, (app) => {});
