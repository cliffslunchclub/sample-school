// Authoritative, configurable ordering days and automatic parent audit history.
onRecordCreateRequest((e) => {
  require(__hooks + "/ordering.js").process(e, "meal_create")
}, "meal_selections")
onRecordUpdateRequest((e) => {
  require(__hooks + "/ordering.js").process(e, "meal_update")
}, "meal_selections")
