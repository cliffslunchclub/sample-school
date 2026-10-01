import type { MealSelection, MenuItem, DeliveryTime } from "./types";
import { weekdayOf } from "./semester";

export interface LabelLine { text: string; bold?: boolean; right?: boolean }
export interface LunchLabel { lines: LabelLine[]; kind: "student" | "summary" }
export interface LabelSheet { slots: (LunchLabel | null)[]; studentCount: number; summaryCount: number }
const wrapGroup = (name: string) => /(?:grilled|plain).*chicken.*wrap|plain chicken wrap/i.test(name) ? "Grilled Chicken Wraps" : name;
const duplicateSummary = (name: string) => /cheeseburger.*slider|chicken nuggets/i.test(name);
export function timeValue(label: string): number {
  const m = label.match(/(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?/i);
  if (!m) return Number.MAX_SAFE_INTEGER;
  let hour = Number(m[1]); if (m[3]) hour = hour % 12 + (m[3].toLowerCase() === "pm" ? 12 : 0);
  return hour * 60 + Number(m[2] || 0);
}
const displayDate = (key: string) => new Intl.DateTimeFormat("en-US", {weekday:"short",month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(key + "T12:00:00Z"));
export function buildLabels(orders: MealSelection[], menu: MenuItem[], times: DeliveryTime[], key: string, summaries = true): LabelSheet {
  const slots: (LunchLabel | null)[] = [];
  const menuMap = new Map(menu.map(m => [m.id, m.name]));
  const timeMap = new Map(times.map(t => [t.id, t.label]));
  const rows = orders.filter(o => o.lunch_date.slice(0,10) === key).map((o, index) => ({o,index, name:o.expand?.menu_item?.name || menuMap.get(o.menu_item) || "Unknown menu item",time:o.expand?.delivery_time?.label || timeMap.get(o.delivery_time) || "Time not set"}));
  rows.sort((a,b) => wrapGroup(a.name).localeCompare(wrapGroup(b.name)) || a.name.localeCompare(b.name) || timeValue(a.time)-timeValue(b.time) || a.time.localeCompare(b.time) || a.index-b.index);
  const newRow = () => {while(slots.length % 3) slots.push(null);};
  let prev = "";
  for (const {o,name,time} of rows) {
    const group = wrapGroup(name)+"|"+time;
    if (prev && prev !== group) newRow();
    prev = group;
    const student = o.expand?.student;
    const grade = (student?.expand?.grade?.name || "").replace(/^Grade\s*/i, "");
    const teacher = student?.expand?.teacher?.name || "";
    const staff = /faculty|staff/i.test(grade + " " + teacher);
    slots.push({kind:"student",lines:[
      {text:student?.name || "Unknown student",bold:true},
      {text:name},
      {text:staff ? `FACULTY/STAFF ${time}` : [grade,teacher].filter(Boolean).join(" - ")},
      {text:staff ? displayDate(key) : `${displayDate(key)} - ${time}`},
    ]});
  }
  const studentCount = rows.length;
  let summaryCount = 0;
  if (summaries && studentCount) {
    // Summary section begins on a fresh sheet, without an empty separator row.
    while (slots.length % 30) slots.push(null);
    const summaryItems = menu.filter(m => (m.active && m.days?.includes(weekdayOf(key))) || rows.some(r => r.o.menu_item === m.id));
    for (const name of [...new Set(rows.filter(r => !menuMap.has(r.o.menu_item)).map(r=>r.name))]) summaryItems.push({id:name,name,active:true,days:[],description:""});
    summaryItems.sort((a,b)=>a.name.localeCompare(b.name));
    const timeLabels = [...new Set([...times.filter(t=>t.active).map(t=>t.label),...rows.map(r=>r.time)])].sort((a,b)=>timeValue(a)-timeValue(b)||a.localeCompare(b));
    for(let set=0;set<2;set++) {
      newRow();
      for(const item of summaryItems) {
        newRow();
        const meals = rows.filter(r => r.o.menu_item === item.id || (!menuMap.has(r.o.menu_item) && r.name === item.name));
        const lines: LabelLine[] = [{text:item.name,bold:true},...timeLabels.map(time=>({text:`${time} - ${meals.filter(r=>r.time === time).length} meals`})),{text:`Total - ${meals.length} meals`,bold:true},{text:weekdayOf(key).toUpperCase(),bold:true,right:true}];
        for(let copy=0;copy<(duplicateSummary(item.name)?2:1);copy++) {slots.push({kind:"summary",lines});summaryCount++;}
      }
    }
  }
  return {slots,studentCount,summaryCount};
}
const escape = (s:string) => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function labelsHtml(sheet: LabelSheet, title: string): string {
  const pages=[];
  for(let i=0;i<sheet.slots.length;i+=30) {
    const cells=Array.from({length:30},(_,j)=>sheet.slots[i+j]);
    pages.push(`<section class="sheet">${cells.map(l=>`<div class="label ${l?.kind || 'blank'}">${l?.lines.map(line=>`<div class="line${line.bold?' bold':''}${line.right?' right':''}">${escape(line.text)}</div>`).join('') || ''}</div>`).join('')}</section>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title><style>
@page{size:letter portrait;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#000;background:#e9e9e9}.sheet{width:8.5in;height:11in;padding:.5in .1875in;display:grid;grid-template-columns:repeat(3,2.625in);grid-template-rows:repeat(10,1in);column-gap:.125in;background:#fff;margin:16px auto;break-after:page}.sheet:last-child{break-after:auto}.label{width:2.625in;height:1in;padding:.07in .08in;display:flex;flex-direction:column;justify-content:center;overflow:hidden}.line{font-size:10pt;line-height:1.13;white-space:nowrap;flex-shrink:0}.summary .line{font-size:9pt}.bold{font-weight:700}.right{text-align:right}.toolbar{padding:16px;text-align:center}.toolbar button{padding:10px 20px;font-size:16px;cursor:pointer}.toolbar p{font-size:14px}@media print{body{background:white}.toolbar{display:none}.sheet{margin:0}}@media screen{.label{outline:1px dashed #ddd}}
</style></head><body><div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button><p>US Letter · 100% / Actual size · No headers or footers. Test on plain paper first.</p></div>${pages.join('')}<script>
for(const cell of document.querySelectorAll('.label')){for(const line of cell.querySelectorAll('.line')){let size=parseFloat(getComputedStyle(line).fontSize);while(line.scrollWidth>line.clientWidth+1 && size>6){size-=.25;line.style.fontSize=size+'px';}}let size=1;while(cell.scrollHeight>cell.clientHeight && size>.6){size-=.03;for(const line of cell.querySelectorAll('.line'))line.style.lineHeight=String(size);}}
</script></body></html>`;
}
