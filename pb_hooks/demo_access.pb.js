// Request hooks cover ordinary SDK writes and each request inside /api/batch.
onRecordCreateRequest((e)=>{require(__hooks+"/demo-access.js").guard(e);e.next()});
onRecordUpdateRequest((e)=>{require(__hooks+"/demo-access.js").guard(e);e.next()});
onRecordDeleteRequest((e)=>{require(__hooks+"/demo-access.js").guard(e);e.next()});
onRecordConfirmPasswordResetRequest((e)=>{require(__hooks+"/demo-access.js").guard(e);e.next()},"users");
onRecordRequestEmailChangeRequest((e)=>{require(__hooks+"/demo-access.js").guard(e);e.next()},"users");
onRecordConfirmEmailChangeRequest((e)=>{require(__hooks+"/demo-access.js").guard(e);e.next()},"users");
// Display fictional staff contact information to demo visitors without changing
// an existing operator's login address. This also applies to expanded user rows.
onRecordEnrich((e)=>{
  if (require(__hooks+"/demo-access.js").isDemo(e.app,e.requestInfo.auth)) {
    e.record.set("email", "sample-staff-"+e.record.id+"@example.test");
    if (e.record.getString("role")==="admin") {e.record.set("first_name","Sample");e.record.set("last_name","Administrator")}
  }
  e.next();
},"users");
