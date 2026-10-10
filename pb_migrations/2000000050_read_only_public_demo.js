migrate((app)=>{
  let school;
  try { school=app.findFirstRecordByFilter("schools","slug = 'sample'") } catch(err) { return }
  const users=app.findCollectionByNameOrId("users");
  // Rules defend the public accounts even if a request hook is accidentally removed.
  const writable=' && @request.auth.email != "demo-parent@example.test" && @request.auth.email != "demo-admin@example.test"';
  for (const name of ["users","grades","teachers","menu_items","delivery_time_slots","delivery_rules","students","meal_selections","audit_log","import_history","settings","parent_audit_log"]) {
    const c=app.findCollectionByNameOrId(name);
    for (const key of ["createRule","updateRule","deleteRule"]) if(c[key]!==null && c[key]!=="") c[key]='('+c[key]+')'+writable;
    if(name==="users") for(const key of ["updateRule","deleteRule"]) if(c[key]!==null) c[key]+=' && email != "demo-parent@example.test" && email != "demo-admin@example.test"';
    app.save(c);
  }
  const parents=app.findRecordsByFilter("users","school = {:school} && role = 'parent'","id",0,0,{school:school.id});
  let n=0;
  for(const row of parents){
    row.set("first_name","Sample Parent");row.set("last_name",String(++n));
    row.set("email","sample-parent-"+row.id+"@example.test");app.save(row);
  }
  for(const name of ["students","teachers"]) {
    const rows=app.findRecordsByFilter(name,"school = {:school}","id",0,0,{school:school.id});let i=0;
    for(const row of rows){row.set("name",(name==="students"?"Sample Student ":"Sample Teacher ")+(++i));app.save(row)}
  }
  // Replace denormalized names/emails and free-text sample history, while retaining
  // every record ID, relationship, date, and meal selection.
  for(const name of ["audit_log","parent_audit_log","import_history"]) {
    for(const row of app.findRecordsByFilter(name,"school = {:school}","",0,0,{school:school.id})) {
      for(const field of ["actor_name","student_name"]) if(row.collection().fields.getByName(field)) row.set(field,"Sample "+(field==="student_name"?"Student":"User"));
      if(row.collection().fields.getByName("actor_email"))row.set("actor_email","sample-user@example.test");
      if(name==="import_history"){row.set("filename","sample-import.csv");row.set("summary","Sample import history")}
      else if(row.collection().fields.getByName("reason"))row.set("reason","Sample activity");
      app.save(row);
    }
  }
  let demoParent;
  for(const role of ["parent","admin"]) {
    const email="demo-"+role+"@example.test";let row;
    try {row=app.findFirstRecordByFilter("users","email = {:email}",{email});if(row.getString("school")!==school.id || row.getString("role")!==role)throw new Error("Demo account collision")}
    catch(err){if(String(err).indexOf("collision")!==-1)throw err;row=new Record(users)}
    row.set("email",email);row.set("password","ExploreLunch2026!");row.set("passwordConfirm","ExploreLunch2026!");
    row.set("first_name","Demo");row.set("last_name",role==="parent"?"Parent":"Administrator");row.set("role",role);row.set("school",school.id);
    row.set("active",true);row.set("verified",true);row.set("emailVisibility",true);app.save(row);
    if(role==="parent")demoParent=row;
  }
  // Reuse a seeded sample family's children and orders, maintaining their IDs.
  if(parents.length) {
    let selected=parents[0],count=-1;
    for(const parent of parents){const children=app.findRecordsByFilter("students","school = {:school} && parent = {:parent} && active = true","",0,0,{school:school.id,parent:parent.id});if(children.length>count){count=children.length;selected=parent}}
    const old=selected.id;
    for(const name of ["students","meal_selections"])for(const row of app.findRecordsByFilter(name,"school = {:school} && parent = {:parent}","",0,0,{school:school.id,parent:old})){row.set("parent",demoParent.id);app.save(row)}
  }
},(app)=>{throw new Error("Restore a tested backup to undo sample anonymization.")});
