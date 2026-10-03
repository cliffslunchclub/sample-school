// Deny outgoing mail by default. A superuser explicitly enables a real school's
// email_enabled flag after SMTP and its trusted frontend_origin are configured.
onMailerSend((e) => {
  const allowed=require(__hooks+"/school-email.js").allowed(e.app,e.message.to)
  if(allowed) e.next()
  else e.app.logger().info("Outgoing school email suppressed")
})
onMailerRecordPasswordResetSend((e)=>{
  if(e.record.collection().name==="users") {
    const school=e.app.findRecordById("schools",e.record.getString("school"))
    if(school.getString("slug")==="sample" || !school.getBool("email_enabled") || !school.getBool("active")) return
    const origin=school.getString("frontend_origin")
    if(!/^https:\/\/[a-zA-Z0-9.-]+(:[0-9]+)?$/.test(origin)) throw new Error("Configure the school HTTPS frontend origin.")
    const url=origin+"/reset-password?token="+encodeURIComponent(e.meta.token)
    e.message.subject="Reset your Cliffs Lunch Club password"
    e.message.html='<p>Use the link below to reset your password.</p><p><a href="'+url+'">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>'
  }
  e.next()
},"users")

// These events carry the original user, including email-change messages whose
// recipient address is not yet saved on the account.
onMailerRecordVerificationSend((e)=>{if(require(__hooks+"/school-email.js").recordAllowed(e.app,e.record))e.next()},"users")
onMailerRecordEmailChangeSend((e)=>{if(require(__hooks+"/school-email.js").recordAllowed(e.app,e.record))e.next()},"users")
onMailerRecordAuthAlertSend((e)=>{if(require(__hooks+"/school-email.js").recordAllowed(e.app,e.record))e.next()},"users")
onMailerRecordOTPSend((e)=>{if(require(__hooks+"/school-email.js").recordAllowed(e.app,e.record))e.next()},"users")
// School-specific reset requests keep the same generic response for wrong-school
// and unknown emails. The school header is a selector, never an authorization grant.
onRecordRequestPasswordResetRequest((e)=>{
  try {
    const info=e.requestInfo()
    const user=e.app.findFirstRecordByFilter("users","email = {:email}",{email:String(info.body.email||"").trim().toLowerCase()})
    const school=e.app.findRecordById("schools",user.getString("school"))
    if(school.getString("slug")!==String(info.headers.x_school_slug||""))return e.noContent(204)
  }catch(err){return e.noContent(204)}
  e.next()
},"users")
