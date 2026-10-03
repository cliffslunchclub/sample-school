module.exports.recordAllowed=function(app,user){
  try {
    const school=app.findRecordById("schools",user.getString("school"))
    return user.getBool("active") && school.getBool("active") && school.getString("slug")!=="sample" && school.getBool("email_enabled")
  }catch(err){return false}
}
module.exports.allowed=function(app,recipients){
  if(!recipients || !recipients.length) return false
  for(const recipient of recipients){
    let user
    try{user=app.findFirstRecordByFilter("users","email = {:email}",{email:recipient.address})}
    catch(err){continue} // SMTP test messages and PocketBase superuser mail.
    if(!module.exports.recordAllowed(app,user))return false
  }
  return true
}
