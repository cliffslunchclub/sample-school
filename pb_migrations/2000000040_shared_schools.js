migrate((app) => {
  const schools = app.findCollectionByNameOrId("schools")
  schools.fields.add(new TextField({name:"slug",required:true,max:80}))
  schools.fields.add(new URLField({name:"frontend_origin"}))
  schools.fields.add(new BoolField({name:"email_enabled"}))
  schools.indexes.push('CREATE UNIQUE INDEX idx_school_slug ON schools (slug)')
  // Existing deployment has one school. Refuse ambiguous assignment rather than relabel data.
  const existing=app.findAllRecords("schools")
  if (existing.length !== 1) throw new Error("Shared-school upgrade expects one existing school; review the database first.")
  app.save(schools)
  const first=app.findRecordById("schools",existing[0].id)
  const sample=$os.getenv("CLIFFS_SEED_DEMO") !== "false"
  first.set("slug",sample?"sample":"chs")
  first.set("frontend_origin",sample?"https://sampleschool.cliffslunchclub.com":"https://chs.cliffslunchclub.com")
  first.set("email_enabled",false)
  // Schema and data remain within the migration transaction.
  app.save(first)
  if(sample) {
    const chs=new Record(schools);chs.set("name","Cherry Hill Elementary");chs.set("slug","chs");chs.set("active",true);chs.set("frontend_origin","https://chs.cliffslunchclub.com");chs.set("email_enabled",false);app.save(chs)
    const config=new Record(app.findCollectionByNameOrId("settings"));config.set("school",chs.id);config.set("verification_code",$security.randomString(24));config.set("ordering_days",["Thursday","Friday"]);app.save(config)
  }
  const active='@request.auth.id != "" && @request.auth.active = true && @request.auth.school != "" && @request.auth.school.active = true'
  const own=active+' && school = @request.auth.school'
  const admin=own+' && @request.auth.role = "admin"'
  const createAdmin=active+' && @request.auth.role = "admin" && @request.body.school = @request.auth.school'
  const stable=' && (@request.body.school:isset = false || @request.body.school = school)'
  for(const name of ["grades","teachers","menu_items","delivery_time_slots","delivery_rules","students","meal_selections","audit_log","import_history","settings","parent_audit_log","users"]) {
    const c=app.findCollectionByNameOrId(name)
    c.listRule=own;c.viewRule=own;c.createRule=createAdmin;c.updateRule=admin+stable;c.deleteRule=admin
    if(["settings","audit_log","import_history","parent_audit_log"].indexOf(name)>=0){c.listRule=admin;c.viewRule=admin}
    if(name==="students" || name==="meal_selections") {
      c.listRule=own+' && (@request.auth.role = "admin" || parent = @request.auth.id)';c.viewRule=c.listRule
      c.createRule=active+' && @request.body.school = @request.auth.school && (@request.auth.role = "admin" || (@request.auth.role = "parent" && @request.body.parent = @request.auth.id))'
      c.updateRule=own+stable+' && (@request.auth.role = "admin" || (@request.auth.role = "parent" && parent = @request.auth.id && (@request.body.parent:isset = false || @request.body.parent = parent)))'
    }
    if(name==="users") {
      c.listRule=own+' && (id = @request.auth.id || @request.auth.role = "admin")';c.viewRule=c.listRule;c.createRule=null
      c.updateRule=own+stable+' && (@request.auth.role = "admin" || (id = @request.auth.id && @request.body.role:isset = false && @request.body.active:isset = false && @request.body.verified:isset = false && @request.body.emailVisibility:isset = false))'
      c.authRule='active = true && school.active = true && school.slug = @request.headers.x_school_slug'
    }
    if(name==="audit_log" || name==="import_history") {c.createRule=createAdmin+' && @request.body.admin = @request.auth.id';c.updateRule=null}
    if(name==="parent_audit_log"){c.createRule=null;c.updateRule=null;c.deleteRule=null}
    if(name==="settings") c.deleteRule=null
    app.save(c)
  }
  schools.listRule=active+' && id = @request.auth.school';schools.viewRule=schools.listRule
  schools.createRule=null;schools.updateRule=null;schools.deleteRule=null;app.save(schools)
}, (app) => {throw new Error("School isolation cannot be safely rolled back. Restore a tested full backup with matching code.")})
