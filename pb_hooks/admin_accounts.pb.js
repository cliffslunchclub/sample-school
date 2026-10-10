// Create admins only through an authenticated school admin. Never accept role/school from the client.
routerAdd("POST", "/api/admin/accounts", (e) => {
  require(__hooks+"/demo-access.js").guard(e)

  if (!e.auth || e.auth.getString("role") !== "admin" || !e.auth.getBool("active")) {
    return e.json(403, {message: "An active administrator account is required."})
  }
  if (!$app.findRecordById("schools", e.auth.getString("school")).getBool("active")) return e.json(403, {message:"School access denied."})
  const body = e.requestInfo().body || {}
  const firstName = String(body.first_name || "").trim()
  const lastName = String(body.last_name || "").trim()
  const email = String(body.email || "").trim().toLowerCase()
  const password = String(body.password || "")
  const school = e.auth.getString("school")
  if (!school || !firstName || !lastName || !email || password.length < 12) {
    return e.json(400, {message: "Name, email and a password of at least 12 characters are required."})
  }
  try {
    $app.findFirstRecordByFilter("users", "email = {:email}", {email: email})
    return e.json(400, {message: "An account with this email already exists."})
  } catch (err) {}
  try {
    const record = new Record($app.findCollectionByNameOrId("users"))
    record.set("email", email)
    record.set("password", password)
    record.set("passwordConfirm", password)
    record.set("role", "admin")
    record.set("school", school)
    record.set("first_name", firstName)
    record.set("last_name", lastName)
    record.set("verified", true)
    record.set("active", true)
    record.set("emailVisibility", true)
    $app.save(record)
    return e.json(201, {id: record.id, message: "Admin account created."})
  } catch (err) {
    return e.json(400, {message: "Could not create the account. Check the email and password."})
  }
})

// Share dates with parents without exposing the school's registration code.
routerAdd("GET", "/api/school-calendar", (e) => {
  if (!e.auth || !e.auth.getBool("active")) return e.json(403, {message:"Please sign in."})
  const school = e.auth.getString("school")
  try {
    if (!$app.findRecordById("schools",school).getBool("active")) return e.json(403,{message:"School access denied."})
    const settings = $app.findFirstRecordByFilter("settings", "school = {:school}", {school:school})
    return e.json(200, {id:settings.id, semester_start:settings.getString("semester_start"), semester_end:settings.getString("semester_end"), ordering_days:settings.getStringSlice("ordering_days")})
  } catch (err) {return e.json(404, {message:"School calendar not found."})}
})

