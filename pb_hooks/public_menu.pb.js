// No student, account, settings, or ordering data is exposed to guests.
routerAdd("GET", "/api/public-menu", (e)=>{
  const slug=String(e.requestInfo().headers.x_school_slug || "");
  if (["sample","chs"].indexOf(slug)===-1) return e.json(404,{message:"School not found."});
  let school;
  try {school=e.app.findFirstRecordByFilter("schools","slug = {:slug} && active = true",{slug})}
  catch(err){return e.json(404,{message:"School not found."})}
  const items=e.app.findRecordsByFilter("menu_items","school = {:school} && active = true","name",0,0,{school:school.id});
  return e.json(200,{items:items.map(item=>({id:item.id,name:item.getString("name"),description:item.getString("description"),days:item.getStringSlice("days"),active:true}))});
});
