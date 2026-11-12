import { useMemo, useState } from "react";
import pb from "../../lib/pocketbase";
import { buildLabels, labelsHtml, latestWeekdayTemplate, type LabelSheet } from "../../lib/labels";
import { lunchDates, WEEKDAYS, type Weekday } from "../../lib/semester";
import { useSemester } from "../../lib/SemesterContext";
import { isSampleSite } from "../../lib/site";
import type { MealSelection, MenuItem, DeliveryTime } from "../../lib/types";
import { Button, Card, Field, Select, useToast } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";

export default function Labels() {
  const {start,end}=useSemester();
  const recurring=!isSampleSite;
  useMemo(()=>lunchDates(start,end),[start,end]);
  const [weekday,setWeekday]=useState<Weekday|"">(recurring?"Monday":"");
  const [busy,setBusy]=useState(false);
  const [sheet,setSheet]=useState<LabelSheet|null>(null);
  const [templateKey,setTemplateKey]=useState<string|null>(null);
  const toast=useToast();
  const generate=async()=>{
    if(!weekday)return;
    setBusy(true);setSheet(null);setTemplateKey(null);
    try {
      const [menu,times]=await Promise.all([
        pb.collection("menu_items").getFullList<MenuItem>({sort:"name",requestKey:null}),
        pb.collection("delivery_time_slots").getFullList<DeliveryTime>({requestKey:null}),
      ]);
      let orders:MealSelection[]=[];
      if(recurring){
        orders=await pb.collection("meal_selections").getFullList<MealSelection>({
          filter:'recurring_weekday = "Monday"',
          expand:"student,student.grade,student.teacher,menu_item,delivery_time",
          requestKey:null,
        });
        if(orders.length){
          const result=buildLabels(orders,menu,times,"","Monday");
          if(!result.studentCount){toast("No recurring Monday orders found","error");return;}
          setSheet(result);setTemplateKey(null);return;
        }
      }
      // Legacy fallback is a single range query, never an OR per calendar date.
      const all=await pb.collection("meal_selections").getFullList<MealSelection>({
        filter:`lunch_date >= "${start} 00:00:00.000Z" && lunch_date <= "${end} 23:59:59.999Z"`,
        expand:"student,student.grade,student.teacher,menu_item,delivery_time",
        sort:"-lunch_date,created,id",requestKey:null,
      });
      const template=latestWeekdayTemplate(all,weekday);
      if(!template.key){toast(`No saved orders found for ${weekday}`,"error");return;}
      const result=buildLabels(template.orders,menu,times,template.key);
      if(!result.studentCount){toast("No label records found","error");return;}
      setSheet(result);setTemplateKey(template.key);
    }catch{toast("Could not load labels. Please try again.","error");}
    finally{setBusy(false);}
  };
  const preview=()=>{
    if(!sheet)return;
    const html=labelsHtml(sheet,`Cliffs Labels ${weekday}`);
    const url=URL.createObjectURL(new Blob([html],{type:"text/html"}));
    window.open(url,"_blank","noopener,noreferrer");
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  };
  return <div>
    <PageHeader title="Lunch Labels" desc="Print CHS-style student labels" />
    <Card className="space-y-4 p-5">
      <Field label="Lunch day" htmlFor="label-weekday"><Select id="label-weekday" value={weekday} onChange={e=>{setWeekday(e.target.value as Weekday|"");setSheet(null);setTemplateKey(null);}}>
        <option value="">Select a weekday…</option>
        {(recurring?["Monday"]:WEEKDAYS).map(day=><option key={day} value={day}>{day}</option>)}
      </Select></Field>
      <p className="text-sm text-ink-soft">1 × 2⅝ inch labels · 30 per Letter sheet</p>
      <Button onClick={generate} loading={busy} disabled={!weekday}>Generate labels</Button>
    </Card>
    {sheet && <Card className="mt-4 space-y-3 p-5"><p className="font-bold">{sheet.studentCount} student labels · {Math.ceil(sheet.slots.length/30)} sheets</p><p className="text-sm text-ink-soft">Using the latest {weekday} orders{templateKey ? ` from ${new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(`${templateKey}T12:00:00Z`))}` : ""}.</p><Button onClick={preview}>Preview / Print / Save PDF</Button><p className="text-sm text-ink-soft">In the print dialog, choose US Letter and Actual size / 100%, and turn off headers and footers.</p></Card>}
  </div>;
}
