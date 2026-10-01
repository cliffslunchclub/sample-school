routerAdd("POST", "/api/register-parent", (e) => {
  const info = e.requestInfo()
  const body = info.body || {}

  const firstName = (body.first_name || "").toString().trim()
  const lastName = (body.last_name || "").toString().trim()
  const email = (body.email || "").toString().trim().toLowerCase()
  const password = (body.password || "").toString()
  const code = (body.code || "").toString().trim()

  if (!firstName || !lastName || !email || !password || !code) {
    return e.json(400, { message: "All fields are required." })
  }

  if (password.length < 8) {
    return e.json(400, { message: "Password must be at least 8 characters." })
  }

  // Validate the school verification code
  let settings
  try {
    settings = $app.findFirstRecordByFilter("settings", "id != ''")
  } catch (err) {
    return e.json(500, { message: "Registration is not available yet. Please contact the school." })
  }

  if (settings.getString("verification_code") !== code) {
    return e.json(400, { message: "Invalid school verification code." })
  }

  // Ensure email is not already used
  try {
    const existing = $app.findFirstRecordByFilter("users", "email = {:email}", { email: email })
    if (existing) {
      return e.json(400, { message: "An account with this email already exists." })
    }
  } catch (err) {
    // not found -> good
  }

  const schoolId = settings.get("school")

  try {
    const collection = $app.findCollectionByNameOrId("users")
    const record = new Record(collection)
    record.set("email", email)
    record.set("password", password)
    record.set("passwordConfirm", password)
    record.set("emailVisibility", true)
    record.set("verified", true)
    record.set("role", "parent")
    record.set("first_name", firstName)
    record.set("last_name", lastName)
    record.set("active", true)
    if (schoolId) record.set("school", schoolId)
    $app.save(record)

    return e.json(200, { success: true, message: "Account created successfully." })
  } catch (err) {
    $app.logger().error("Parent registration failed", "error", String(err))
    return e.json(500, { message: "Could not create account. Please try again." })
  }
})
