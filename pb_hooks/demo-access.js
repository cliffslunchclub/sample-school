const emails = ["demo-parent@example.test", "demo-admin@example.test"];
module.exports.isDemo = function(app, user) {
  if (!user || emails.indexOf(user.getString("email")) === -1) return false;
  return app.findRecordById("schools", user.getString("school")).getString("slug") === "sample";
};
module.exports.guard = function(e) {
  if (e.hasSuperuserAuth()) return;
  if (module.exports.isDemo(e.app, e.auth) || (e.record && module.exports.isDemo(e.app, e.record)))
    throw new ForbiddenError("This is a demo site. Changes cannot be saved.");
};
