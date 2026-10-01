import { useMemo, useState } from "react";
import pb from "../../lib/pocketbase";
import { buildLabels, labelsHtml, type LabelSheet } from "../../lib/labels";
import { dayFilter, lunchDates } from "../../lib/semester";
import { useSemester } from "../../lib/SemesterContext";
import type { MealSelection, MenuItem, DeliveryTime } from "../../lib/types";
import { Button, Card, Field, Input, useToast } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";

export default function Labels() {
  const {start,end}=useSemester();
  const days=useMemo(()=>lunchDates(start,end),[start,end]);
  const [key,setKey]=useState("");
  const date=key || days.find(d=>d.key>=new Date().toISOString().slice(0,10))?.key || days[0]?.key || "";
  const [summaries,setSummaries]=useState(true);
  const [busy,setBusy]=useState(false);
  const [sheet,setSheet]=useState<LabelSheet|null>(null);
  const toast=useToast();
  const generate=async()=>{
    setBusy(true);setSheet(null);
    try {
      const [orders,menu,times]=await Promise.all([
        pb.collection("meal_selections").getFullList<MealSelection>({filter:dayFilter("lunch_date",date),expand:"student,student.grade,student.teacher,menu_item,delivery_time",sort:"created,id",requestKey:null}),
        pb.collection("menu_items").getFullList<MenuItem>({sort:"name",requestKey:null}),
        pb.collection("delivery_time_slots").getFullList<DeliveryTime>({requestKey:null}),
      ]);
      const result=buildLabels(orders,menu,times,date,summaries);
      if(!result.studentCount){toast("No orders for this date","error");return;}
      setSheet(result);
    }catch{toast("Could not load labels. Please try again.","error");}
    finally{setBusy(false);}
  };
  const preview=()=>{
    if(!sheet)return;
    const html=labelsHtml(sheet,`Cliffs Labels ${date}`);
    const url=URL.createObjectURL(new Blob([html],{type:"text/html"}));
    window.open(url,"_blank","noopener,noreferrer");
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  };
  return <div>
    <PageHeader title="Lunch Labels" desc="Print CHS-style student and menu summary labels" />
    <Card className="space-y-4 p-5">
      <Field label="Lunch date" htmlFor="label-date"><Input id="label-date" type="date" value={date} onChange={e=>{setKey(e.target.value);setSheet(null);}} /></Field>
      <label className="flex gap-2 text-sm font-bold"><input type="checkbox" checked={summaries} onChange={e=>{setSummaries(e.target.checked);setSheet(null);}} /> Include two sets of menu summaries (extra sliders and nuggets copies)</label>
      <p className="text-sm text-ink-soft">1 × 2⅝ inch labels · 30 per Letter sheet. New rows for menu or time changes, with no blank separator rows. Chicken wraps stay together.</p>
      <Button onClick={generate} loading={busy} disabled={!date}>Generate labels</Button>
    </Card>
    {sheet && <Card className="mt-4 space-y-3 p-5"><p className="font-bold">{sheet.studentCount} student labels · {sheet.summaryCount} summary labels · {Math.ceil(sheet.slots.length/30)} sheets</p><Button onClick={preview}>Preview / Print / Save PDF</Button><p className="text-sm text-ink-soft">In the print dialog, choose US Letter and Actual size / 100%, and turn off headers and footers.</p></Card>}
  </div>;
}
