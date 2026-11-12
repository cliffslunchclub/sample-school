import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const ts=require('typescript');
const transpile=(file)=>ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const scheduleUri=uri(transpile('../frontend/src/lib/semester.ts'));
const {WEEKDAYS,lunchDates,orderingWindow}=await import(scheduleUri);
const {buildLabels,labelsHtml}=await import(uri(transpile('../frontend/src/lib/labels.ts').replace('"./semester"',JSON.stringify(scheduleUri))));
assert.deepEqual(lunchDates('2026-10-05','2026-10-11').map(d=>d.weekday),[...WEEKDAYS]);
const window=orderingWindow(new Date('2026-10-01T18:00:00Z'));
assert.equal(window.open,true);assert.deepEqual(window.keys,['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09']);
assert.equal(orderingWindow(new Date('2026-10-03T04:00:00Z')).open,false);
assert.equal(orderingWindow(new Date('2026-10-02T03:59:59Z')).open,true);
assert.equal(orderingWindow(new Date('2026-10-01T18:00:00Z'),['Monday']).open,false);
assert.equal(orderingWindow(new Date('2026-10-05T18:00:00Z'),['Monday']).open,true);
assert.equal(orderingWindow(new Date('2026-10-05T18:00:00Z'),['Monday']).keys[0],'2026-10-12');
assert.equal(orderingWindow(new Date('2026-10-04T18:00:00Z'),['Sunday']).keys[0],'2026-10-05');
assert.equal(orderingWindow(new Date('2026-10-01T18:00:00Z'),[]).open,false);
const key='2026-10-05';
const names=['Cheeseburger Sliders + TT','Chicken Nuggets + TT','Grilled Chicken Caesar Wrap','Grilled Chicken Wrap (Plain)',...Array.from({length:11},(_,i)=>`Meal ${i+1}`)];
const menu=names.map((name,i)=>({id:String(i),name,active:true,days:[...WEEKDAYS],description:''}));
const times=[{id:'early',label:'10:45',active:true},{id:'late',label:'11:45',active:true}];
const order=(id,item,time='early',grade='Grade 3')=>({id,student:id,menu_item:String(item),delivery_time:time,lunch_date:key+'T12:00:00Z',expand:{student:{name:'Student '+id,expand:{grade:{name:grade},teacher:{name:'Teacher'}}}}});
const result=buildLabels([order('a',0),order('b',0,'late'),order('c',2),order('d',3),order('e',1,'early','Faculty/Staff')],menu,times,key);
assert.equal(result.studentCount,5);assert.equal(result.slots.filter(Boolean).length,5);
const labels=result.slots.filter(Boolean);
assert.equal(labels[0].lines[0].text,'Student a');assert.equal(labels[0].lines[0].bold,true);assert.equal(labels[0].lines[2].text,'3 - Teacher');
assert.equal(result.slots[3].lines[0].text,'Student b'); // time change starts next row, with no empty separator row
assert.ok(labels.find(l=>l.lines[0].text==='Student e').lines.some(l=>l.text==='FACULTY/STAFF 10:45'));
const wraps=result.slots.flatMap((l,i)=>l?.lines[1]?.text.includes('Wrap')?[i]:[]);assert.equal(wraps[1]-wraps[0],3);
const many=buildLabels(Array.from({length:29},(_,i)=>order(String(i),0)).concat(order('new',1)),menu,times,key);
assert.equal(many.slots[30].lines[0].text,'Student new');assert.equal(many.slots.length,31); // naturally cross sheet at a row boundary
assert.equal(buildLabels([],menu,times,key).slots.length,0);
assert.ok(labelsHtml(buildLabels([order('<script>',0)],menu,times,key),'test').includes('&lt;script&gt;'));
console.log('PASS: five-day calendar and timezone boundaries; label row/page boundaries, separate wrap rows, staff labels, no summaries, escaping and empty dates');

// CHS Order Summary folder labels: matching paired front/tab stickers on Avery 5160.
const {buildFolderLabels, folderLabelsHtml} = await import(uri(transpile('../frontend/src/lib/folderLabels.ts')));
const folderTimes = [{id:'early',label:'10:40'},{id:'late',label:'11:40'}];
const folderData = [
 ['Bolognese Pasta',2,5],
 ['Cheeseburger Sliders + TT',20,52],
 ['Chicken Alfredo Pasta',6,6],
 ['Chicken Fried Rice',11,8],
 ['Chicken Katsu Curry Bowl',5,13],
 ['Chicken Nuggets + TT',24,25],
 ['Chicken Quesadilla',8,8],
 ['Chicken Teriyaki Bowl',9,10],
 ['Grilled Cheese + TT',12,19],
 ['Grilled Chicken Caesar Wrap',5,8],
 ['Grilled Chicken Wrap (Plain)',2,1],
].map(([name,early,late])=>({name,counts:{early,late},total:early+late}));
const folders=buildFolderLabels(folderData,folderTimes);
assert.equal(folders.length,15);
assert.equal(folders.reduce((sum,f)=>sum+f.total,0),259);
assert.equal(folders.filter(f=>f.wraps).length,1);
assert.deepEqual(folders.find(f=>f.wraps).entries.map(e=>[e.count,e.caesar,e.plain]),[[7,5,2],[9,8,1]]);
const folderHtml=folderLabelsHtml(folders);
const folderTitles=[...folderHtml.matchAll(/class="folder-title">([^<]+)/g)].map(x=>x[1]);
assert.equal(folderTitles.length,30);
assert.equal(folderTitles[0],folderTitles[3]); // duplicate front/tab stickers, same column, adjacent rows
assert.equal(folderTitles[1],folderTitles[4]);
assert.ok(folderHtml.includes('C = Caesar / P = Plain'));
assert.ok(folderHtml.includes('Total - 16'));
assert.equal((folderHtml.match(/class="sheet"/g)||[]).length,1);
assert.equal((folderLabelsHtml([...folders,...folders]).match(/class="sheet"/g)||[]).length,2);
assert.equal(buildFolderLabels(folderData,folderTimes,{'Bolognese Pasta':true}).length,16);
assert.ok(folderLabelsHtml(buildFolderLabels([{name:'<Unsafe & Name>',counts:{early:1},total:1}],folderTimes)).includes('&lt;Unsafe &amp; Name&gt;'));
assert.equal(buildFolderLabels([{name:'Test',counts:{early:1,other:2},total:3}],folderTimes)[0].entries.at(-1).time,'Unassigned');
console.log('PASS: CHS folder labels, 259 meals, split/combined folders, wrap quantities, Avery 30-up paired layout, extra pages, escaping, missing slots');

// Import regression: each added day matches, resolves conflicts, and writes the correct date.
const csvUri=uri(transpile('../frontend/src/lib/csv.ts'));
const {toCsv}=await import(csvUri);
const analyzeCode=transpile('../frontend/src/lib/importAnalyze.ts').replace('import pb from "./pocketbase";','const pb = {};').replace('"./csv"',JSON.stringify(csvUri));
const {analyzeCombined}=await import(uri(analyzeCode));
const ref={grades:[{id:'grade',name:'Grade 3',sort_order:1}],teachers:[{id:'teacher',name:'Teacher',grade:'grade'}],students:[{id:'student',name:'Demo Student',grade:'grade',teacher:'teacher',parent:'parent'}],menu,times:[],rules:[],selections:[]};
const mapping={student_name:0,grade:1,teacher:2,tuesday_meal:3,thursday_meal:4,friday_meal:5};
const extraKeys={tuesday:'2026-10-06',thursday:'2026-10-08',friday:'2026-10-09'};
const analysis=analyzeCombined([['Demo Student','3','Teacher',names[0],names[1],names[0]]],mapping,ref,key,'2026-10-07',extraKeys);
assert.equal(analysis.stats.tuesdayOrders,1);assert.equal(analysis.stats.thursdayOrders,1);assert.equal(analysis.stats.fridayOrders,1);assert.equal(analysis.rows[0].status,'matched');
const invalid=analyzeCombined([['Demo Student','3','Teacher',names[0]]],mapping,ref,key,'2026-10-07',{});assert.equal(invalid.rows[0].status,'error');
const writes=[];let batchCalls=0;const batchSizes=[];let failNextBatch=false;globalThis.__importMock={send:async(path,{body})=>{assert.equal(path,'/api/batch');batchCalls++;batchSizes.push(body.requests.length);if(failNextBatch){failNextBatch=false;throw Object.assign(new Error('rate limited'),{status:429});}return body.requests.map((request)=>{writes.push(request);return {status:200,body:{...(request.body||{}),id:'created'+writes.length}};});}};
const batchCode=transpile('../frontend/src/lib/pocketbaseBatch.ts').replace('import pb from "./pocketbase";','const pb = globalThis.__importMock;');
const {sendBatchRequests,BatchWriteError}=await import(uri(batchCode));
globalThis.sendBatchRequests=sendBatchRequests;globalThis.BatchWriteError=BatchWriteError;
const executeCode=transpile('../frontend/src/lib/importExecute.ts').replace('import pb from "./pocketbase";','').replace('import { sendBatchRequests, BatchWriteError } from "./pocketbaseBatch";','const {sendBatchRequests, BatchWriteError} = globalThis;').replace('export { BatchWriteError as ImportExecutionError } from "./pocketbaseBatch";','').replace('"./csv"',JSON.stringify(csvUri));
const {executeCombined}=await import(uri(executeCode));
const executed=await executeCombined(analysis.rows,ref,key,'2026-10-07',{schoolId:'school'},extraKeys);
assert.equal(executed.createdMeals,3);assert.deepEqual(writes.map(p=>p.body.lunch_date.slice(0,10)),Object.values(extraKeys));assert.equal(batchCalls,1);assert.ok(writes.every(p=>p.url==='/api/collections/meal_selections/records'));
const conflictRef={...ref,selections:[{id:'old',student:'student',menu_item:'0',lunch_date:'2026-10-06T12:00:00Z'}]};
const conflict=analyzeCombined([['Demo Student','3','Teacher',names[1]]],mapping,conflictRef,key,'2026-10-07',extraKeys);assert.equal(conflict.stats.tuesdayConflicts,1);assert.equal(conflict.rows[0].status,'conflict');
conflict.rows[0].tuesdayResolution='keep';assert.equal((await executeCombined(conflict.rows,conflictRef,key,'2026-10-07',{schoolId:'school'},extraKeys)).skipped,2);
conflict.rows[0].tuesdayResolution='replace';writes.length=0;await executeCombined(conflict.rows,conflictRef,key,'2026-10-07',{schoolId:'school'},extraKeys);assert.equal(writes[0].method,'PATCH');assert.match(writes[0].url,/records\/old$/);
const emptyRef={grades:[],teachers:[],students:[],menu,times:[],rules:[],selections:[]};
const bulkRows=Array.from({length:41},(_,i)=>[`Bulk Student ${i+1}`,'Grade 4','Bulk Teacher','11:30',names[0]]);
const bulkAnalysis=analyzeCombined(bulkRows,{student_name:0,grade:1,teacher:2,delivery_time:3,monday_meal:4},emptyRef,key,'2026-10-07',{});
writes.length=0;batchCalls=0;batchSizes.length=0;
const bulkResult=await executeCombined(bulkAnalysis.rows,emptyRef,key,'2026-10-07',{schoolId:'school'});
assert.equal(bulkResult.createdStudents,41);assert.equal(bulkResult.createdMeals,41);assert.equal(batchCalls,8);assert.deepEqual(batchSizes,[1,1,1,1,40,1,40,1]);
const menuImportCode=transpile('../frontend/src/lib/menuImport.ts').replace('"./csv"',JSON.stringify(csvUri)).replace('"./semester"',JSON.stringify(scheduleUri)).replace('import { sendBatchRequests } from "./pocketbaseBatch";','const {sendBatchRequests} = globalThis;');
const {MENU_CSV_HEADERS,parseCsvText,analyzeMenuCsv,executeMenuImport}=await import(uri(menuImportCode));
const menuCsv=toCsv([MENU_CSV_HEADERS,['Soup, Tomato','Soup, "classic"', 'Yes','No','Yes','No','No','Yes'],['Existing Meal','unchanged','Yes','No','Yes','No','No','Yes'],['Updated Meal','new detail','No','No','No','No','Yes','Yes']]);
const menuMatrix=parseCsvText('\uFEFF'+menuCsv);assert.equal(menuMatrix[1][0],'Soup, Tomato');assert.equal(menuMatrix[1][1],'Soup, "classic"');
const currentMenu=[{id:'same',name:'Existing Meal',description:'unchanged',active:true,days:['Monday','Wednesday']},{id:'update',name:'Updated Meal',description:'old detail',active:true,days:['Monday']}];
const menuRows=analyzeMenuCsv(menuMatrix,currentMenu);assert.deepEqual(menuRows.map(r=>r.status),['new','same','conflict']);menuRows[2].resolution='update';
writes.length=0;batchCalls=0;batchSizes.length=0;const menuProgress={count:0,records:0};
const menuImportResult=await executeMenuImport(menuRows,'school',menuProgress);
assert.deepEqual(menuImportResult,{added:1,updated:1,unchanged:1});assert.equal(writes.length,2);assert.deepEqual(writes.map(r=>r.method),['POST','PATCH']);assert.equal(writes[0].body.school,'school');assert.match(writes[1].url,/menu_items\/records\/update$/);
const menuBad=analyzeMenuCsv(parseCsvText(toCsv([MENU_CSV_HEADERS,['Bad Meal','','maybe','No','No','No','No','Yes']])),[]);assert.equal(menuBad[0].status,'error');
const purgeProgress={count:0,records:0};writes.length=0;batchCalls=0;batchSizes.length=0;failNextBatch=true;
await sendBatchRequests(Array.from({length:85},(_,i)=>({method:'DELETE',url:`/api/collections/meal_selections/records/${i}`})),'Meal selections',purgeProgress);
assert.equal(purgeProgress.count,3);assert.equal(purgeProgress.records,85);assert.equal(batchCalls,4);assert.deepEqual(batchSizes,[40,40,40,5]);
// CHS recurring Monday: importing two different lunches for one student must
// preserve both while ignoring an exactly repeated CSV line.
const recurringRef={...ref,times:[{id:'late',label:'11:40',active:true}],selections:[]};
const recRows=[
  ['Demo Student','Grade 3','Teacher','11:40',names[0]],
  ['Demo Student','Grade 3','Teacher','11:40',names[1]],
  ['Demo Student','Grade 3','Teacher','11:40',names[0]],
];
const recMap={student_name:0,grade:1,teacher:2,delivery_time:3,monday_meal:4};
const recAnalysis=analyzeCombined(recRows,recMap,recurringRef,'__recurring_monday__','',{});
assert.equal(recAnalysis.stats.valid,2);
assert.equal(recAnalysis.stats.duplicates,1);
assert.equal(recAnalysis.stats.mondayOrders,2);
writes.length=0;
const recExecuted=await executeCombined(recAnalysis.rows,recurringRef,'__recurring_monday__','',{schoolId:'school'},{});
assert.equal(recExecuted.createdMeals,2);
const recWrites=writes.filter(p=>p.url==='/api/collections/meal_selections/records');
assert.equal(recWrites.length,2);
assert.ok(recWrites.every(p=>p.body.recurring_weekday==='Monday' && p.body.lunch_date===''));
const recLabels=buildLabels(recWrites.map((p,i)=>({
  ...order(String(i),i),
  lunch_date:'',
  recurring_weekday:'Monday',
})),menu,recurringRef.times,'','Monday');
assert.equal(recLabels.studentCount,2);
assert.ok(recLabels.slots.filter(Boolean).every(l=>l.lines.some(x=>x.text.startsWith('Monday'))));
console.log('PASS: recurring Monday import, two distinct meals, duplicate prevention, undated labels');

// Delivery time deletion plans must preserve references until replacement succeeds.
// Linked historical orders should be included in the explicit reassign-and-delete path.
const deletionCode=transpile('../frontend/src/lib/deleteDeliveryTime.ts')
  .replace('import pb from "./pocketbase";','const pb = globalThis.__deliveryDeletionMock;')
  .replace('import { sendBatchRequests } from "./pocketbaseBatch";','const {sendBatchRequests} = globalThis;');
const delMock={
  orders:[
    {id:'dated',delivery_time:'old',lunch_date:'2026-10-12T12:00:00Z'},
    {id:'weekly',delivery_time:'old',lunch_date:'',recurring_weekday:'Monday'},
  ],
  rules:[{id:'classrule',delivery_time:'old'}],
  deleted:[],
  collection(name){
    if(name==='delivery_time_slots') return {
      getOne:async(id)=>({id,active:id==='new'}),
      delete:async(id)=>{assert.equal(this.orders.filter(o=>o.delivery_time===id).length,0);assert.equal(this.rules.filter(o=>o.delivery_time===id).length,0);this.deleted.push(id)},
    };
    const records=name==='meal_selections'?this.orders:this.rules;
    return {getFullList:async({filter})=>{
      const id=filter.match(/delivery_time = "([^"]+)"/)?.[1];
      return records.filter(row=>row.delivery_time===id);
    }};
  },
};
globalThis.__deliveryDeletionMock=delMock;
const {buildTimeReassignmentRequests,removeDeliveryTime}=await import(uri(deletionCode));
const built=buildTimeReassignmentRequests({orders:delMock.orders,rules:delMock.rules},'new');
assert.equal(built.length,3);
assert.deepEqual(built.map(x=>x.url.split('/').slice(-3).join('/')),[
  'meal_selections/records/dated','meal_selections/records/weekly','delivery_rules/records/classrule',
]);
assert.ok(built.every(x=>x.method==='PATCH' && x.body.delivery_time==='new'));
await assert.rejects(()=>removeDeliveryTime('old',''),/replacement or deactivate/);
assert.deepEqual(delMock.deleted,[]);
const previousSend=globalThis.__importMock.send;
globalThis.__importMock.send=async(_path,{body})=>body.requests.map(request=>{
  const id=request.url.split('/').at(-1);
  const records=request.url.includes('meal_selections')?delMock.orders:delMock.rules;
  const target=records.find(row=>row.id===id);
  assert.ok(target);
  target.delivery_time=request.body.delivery_time;
  return {status:200,body:target};
});
const removed=await removeDeliveryTime('old','new');
assert.deepEqual(removed,{reassignedOrders:2,reassignedRules:1});
assert.deepEqual(delMock.deleted,['old']);
globalThis.__importMock.send=previousSend;
console.log('PASS: time slot deletion requires replacement, migrates both historical and recurring references, and deletes only after verifying no links');

console.log('PASS: five-day order CSV; menu CSV template parsing, safe matching, explicit update; transactional batch writes/deletes; 40-record chunking; 429 retry; conflict keep/replace behavior');
