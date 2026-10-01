routerAdd("GET", "/api/release", (e) => {
  return e.json(200, require(__hooks + "/release.js"))
})
