// API rules scope records. This guard also validates every relation on writes,
// including admin imports, so cross-school IDs cannot be attached to own-school data.
onRecordCreateRequest((e)=>{require(__hooks+"/school-isolation.js").validate(e);e.next()},"users","grades","teachers","menu_items","delivery_time_slots","delivery_rules","students","meal_selections","audit_log","import_history","settings")
onRecordUpdateRequest((e)=>{require(__hooks+"/school-isolation.js").validate(e);e.next()},"users","grades","teachers","menu_items","delivery_time_slots","delivery_rules","students","meal_selections","audit_log","import_history","settings")
