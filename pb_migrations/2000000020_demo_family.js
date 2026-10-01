migrate((app) => {
  let parent;
  try {
    parent = app.findFirstRecordByFilter("users", "email = 'parent@example.test' && role = 'parent'");
  } catch (e) {
    return;
  }
  parent.set("first_name", "John");
  parent.set("last_name", "Smith");
  app.save(parent);

  const students = app.findCollectionByNameOrId("students");
  function findStudent(name) {
    try {
      return app.findFirstRecordByFilter("students", "parent = {:parent} && name = {:name}", { parent: parent.id, name });
    } catch (e) {
      return null;
    }
  }
  // Rename the original record so its existing meal selections stay attached.
  let jane = findStudent("Demo Student") || findStudent("Jane Smith");
  if (!jane) {
    const grade = app.findFirstRecordByFilter("grades", "school = {:school}", { school: parent.getString("school") });
    const teacher = app.findFirstRecordByFilter("teachers", "grade = {:grade}", { grade: grade.id });
    jane = new Record(students);
    jane.set("parent", parent.id);
    jane.set("school", parent.getString("school"));
    jane.set("grade", grade.id);
    jane.set("teacher", teacher.id);
    jane.set("active", true);
  }
  jane.set("name", "Jane Smith");
  app.save(jane);

  if (!findStudent("Joe Smith")) {
    const joe = new Record(students);
    joe.set("name", "Joe Smith");
    joe.set("parent", parent.id);
    for (const field of ["school", "grade", "teacher"]) {
      joe.set(field, jane.getString(field));
    }
    joe.set("active", true);
    app.save(joe);
  }
}, (app) => {});
