"""Real PocketBase isolation and mail regression tests; uses only disposable local data."""
import atexit, datetime, json, os, pathlib, socket, socketserver, sqlite3, subprocess, tempfile, threading, time, urllib.request, urllib.error, shutil
ROOT=pathlib.Path(__file__).resolve().parents[1]
BINARY=pathlib.Path(os.environ.get('POCKETBASE_BINARY',str(ROOT/'.runtime/pocketbase')))
if not BINARY.exists(): raise SystemExit('Run npm start once to download PocketBase, or set POCKETBASE_BINARY.')
PASSWORD='IntegrationOnly2026!'
with tempfile.TemporaryDirectory(prefix='clc-isolation-') as tmp:
 tmp=pathlib.Path(tmp);data=tmp/'data';old=tmp/'old';old.mkdir()
 for f in (ROOT/'pb_migrations').glob('*.js'):
  if f.name not in ['2000000040_shared_schools.js','2000000050_read_only_public_demo.js']:shutil.copy(f,old/f.name)
 def run(*args):subprocess.run([str(BINARY),*args],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
 run('migrate','up','--dir='+str(data),'--migrationsDir='+str(old))
 def snapshot():
  with sqlite3.connect(data/'data.db') as db:
   return {name:db.execute('SELECT * FROM '+name+' ORDER BY id').fetchall() for name in ['users','students','meal_selections','settings','menu_items','audit_log','parent_audit_log']}
 before=snapshot()
 shutil.copy(ROOT/'pb_migrations/2000000040_shared_schools.js',old/'2000000040_shared_schools.js')
 run('migrate','up','--dir='+str(data),'--migrationsDir='+str(old))
 after=snapshot()
 for name in before:
  if name=='settings':assert all(row in after[name] for row in before[name])
  else:assert before[name]==after[name],name+' changed during upgrade'
 run('superuser','upsert','integration@example.test',PASSWORD,'--dir='+str(data))
 sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close()
 base='http://127.0.0.1:'+str(port)
 log=open(tmp/'server.log','w+')
 proc=subprocess.Popen([str(BINARY),'serve','--http=127.0.0.1:'+str(port),'--dir='+str(data),'--hooksDir='+str(ROOT/'pb_hooks'),'--migrationsDir='+str(old)],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,env={**os.environ,'TZ':'UTC'})
 def req(path,body=None,token='',slug='sample',method=None):
  r=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json','Authorization':token,'X-School-Slug':slug},method=method)
  try:
   with urllib.request.urlopen(r,timeout=5) as response:return response.status,json.loads(response.read() or b'{}')
  except urllib.error.HTTPError as e:return e.code,json.loads(e.read() or b'{}')
 def ok(path,body=None,token='',slug='sample',method=None):
  status,result=req(path,body,token,slug,method);assert 200<=status<300,(path,status,result);return result
 def denied(path,body=None,token='',slug='sample',method=None):
  status,result=req(path,body,token,slug,method);assert status in [400,403,404],(path,status,result)
 def rows(name,token,slug='sample'):return ok('/api/collections/'+name+'/records?perPage=500',token=token,slug=slug)['items']
 def create(name,body,token,slug='sample'):return ok('/api/collections/'+name+'/records',body,token,slug)
 def patch(name,id,body,token,slug='sample'):return ok('/api/collections/'+name+'/records/'+id,body,token,slug,'PATCH')
 def login(email,password=PASSWORD,slug='sample'):return ok('/api/collections/users/auth-with-password',{'identity':email,'password':password},slug=slug)
 try:
  for i in range(50):
   try:ok('/api/health');break
   except Exception:time.sleep(.1)
  su=ok('/api/collections/_superusers/auth-with-password',{'identity':'integration@example.test','password':PASSWORD})['token']
  schools={s['slug']:s for s in rows('schools',su)};sample=schools['sample']['id'];chs=schools['chs']['id']
  sa=login('admin@example.test','LocalLunch2026!')['token'];sp=login('parent@example.test','LocalLunch2026!');pt=sp['token']
  ca=create('users',{'email':'chs-admin@example.test','password':PASSWORD,'passwordConfirm':PASSWORD,'role':'admin','active':True,'verified':True,'school':chs},su)
  ct=login(ca['email'],slug='chs')['token']
  ok('/api/settings',{'batch':{'enabled':True,'maxRequests':40,'timeout':5,'maxBodySize':1000000}},su,method='PATCH')
  for email,password,wrong in [('admin@example.test','LocalLunch2026!','chs'),(ca['email'],PASSWORD,'sample')]:denied('/api/collections/users/auth-with-password',{'identity':email,'password':password},slug=wrong)
  denied('/api/collections/users/auth-with-password',{'identity':ca['email'],'password':PASSWORD},slug='')
  config=rows('settings',ct,'chs')[0]
  form={'first_name':'Real','last_name':'Parent','email':'chs-parent@example.test','password':PASSWORD,'code':config['verification_code']}
  denied('/api/register-parent',form,slug='sample');ok('/api/register-parent',form,slug='chs');cp=login(form['email'],slug='chs');cpt=cp['token']
  g=create('grades',{'name':'CHS Grade','school':chs,'active':True},ct,'chs')
  t=create('teachers',{'name':'CHS Teacher','grade':g['id'],'school':chs,'active':True},ct,'chs')
  m=create('menu_items',{'name':'CHS Meal','school':chs,'active':True,'days':['Monday','Tuesday','Wednesday','Thursday','Friday']},ct,'chs')
  menu_batch=ok('/api/batch',{'requests':[
   {'method':'POST','url':'/api/collections/menu_items/records','body':{'name':'CSV Menu Item','description':'Imported in a batch','school':chs,'active':True,'days':['Monday','Wednesday']}},
   {'method':'PATCH','url':'/api/collections/menu_items/records/'+m['id'],'body':{'description':'Updated through menu CSV'}},
  ]},ct,'chs')
  assert len(menu_batch)==2 and all(item['status']==200 for item in menu_batch)
  assert menu_batch[0]['body']['school']==chs and menu_batch[1]['body']['description']=='Updated through menu CSV'
  d=create('delivery_time_slots',{'label':'12:00','school':chs,'active':True},ct,'chs')
  rule=create('delivery_rules',{'grade':g['id'],'teacher':t['id'],'delivery_time':d['id'],'school':chs},ct,'chs')
  batch=ok('/api/batch',{'requests':[
   {'method':'POST','url':'/api/collections/students/records','body':{'name':'Batch Student One','grade':g['id'],'teacher':t['id'],'school':chs,'active':True}},
   {'method':'POST','url':'/api/collections/students/records','body':{'name':'Batch Student Two','grade':g['id'],'teacher':t['id'],'school':chs,'active':True}},
  ]},ct,'chs')
  assert len(batch)==2 and all(item['status']==200 and item['body']['school']==chs for item in batch)
  denied('/api/batch',{'requests':[
   {'method':'POST','url':'/api/collections/students/records','body':{'name':'Must Roll Back','grade':g['id'],'teacher':t['id'],'school':chs,'active':True}},
   {'method':'POST','url':'/api/collections/students/records','body':{'name':'Cross School','school':sample,'grade':g['id'],'teacher':t['id'],'active':True}},
  ]},ct,'chs')
  assert not any(student['name']=='Must Roll Back' for student in rows('students',ct,'chs')),'failed batch should roll back earlier operations'
  deleted=ok('/api/batch',{'requests':[
   {'method':'DELETE','url':'/api/collections/students/records/'+batch[0]['body']['id']},
   {'method':'DELETE','url':'/api/collections/students/records/'+batch[1]['body']['id']},
  ]},ct,'chs')
  assert len(deleted)==2 and all(item['status']==204 for item in deleted)
  assert not any(student['name'] in ('Batch Student One','Batch Student Two') for student in rows('students',ct,'chs')),'batch deletes should remove selected records'
  st=create('students',{'name':'CHS Student','grade':g['id'],'teacher':t['id'],'parent':cp['record']['id'],'school':chs,'active':True},cpt,'chs')
  all_days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  for tok,slug in [(sa,'sample'),(ct,'chs')]:
   cfg=rows('settings',tok,slug)[0];patch('settings',cfg['id'],{'ordering_days':all_days,'semester_start':'','semester_end':''},tok,slug)
  today=datetime.datetime.now(datetime.timezone.utc).astimezone(datetime.timezone(datetime.timedelta(hours=-4))).date();monday=today+datetime.timedelta(days=(7-today.weekday()))
  meal=create('meal_selections',{'student':st['id'],'parent':cp['record']['id'],'menu_item':m['id'],'delivery_time':d['id'],'school':chs,'lunch_date':str(monday)},cpt,'chs')
  recurring=create('meal_selections',{'student':st['id'],'parent':cp['record']['id'],'menu_item':m['id'],'delivery_time':d['id'],'school':chs,'recurring_weekday':'Monday'},cpt,'chs')
  assert recurring['recurring_weekday']=='Monday' and not recurring['lunch_date']
  patch('meal_selections',recurring['id'],{'delivery_time':''},cpt,'chs')
  denied('/api/collections/meal_selections/records',{'student':st['id'],'parent':cp['record']['id'],'menu_item':m['id'],'school':chs,'recurring_weekday':'Tuesday'},cpt,'chs')
  create('audit_log',{'admin':ca['id'],'student':st['id'],'new_meal':m['id'],'school':chs,'action':'test'},ct,'chs')
  create('import_history',{'admin':ca['id'],'school':chs,'filename':'test.csv','import_type':'roster'},ct,'chs')
  own_student=rows('students',pt)[0];own_menu=rows('menu_items',pt)[0]
  create('meal_selections',{'school':sample,'student':own_student['id'],'parent':sp['record']['id'],'menu_item':own_menu['id'],'lunch_date':str(monday)},pt)
  denied('/api/collections/meal_selections/records',{'school':sample,'student':own_student['id'],'parent':sp['record']['id'],'menu_item':own_menu['id'],'recurring_weekday':'Monday'},pt)
  sample_admin=next(u for u in rows('users',sa) if u['role']=='admin')
  create('audit_log',{'school':sample,'admin':sample_admin['id'],'student':own_student['id'],'new_meal':own_menu['id'],'action':'test'},sa)
  create('import_history',{'school':sample,'admin':sample_admin['id'],'filename':'test.csv','import_type':'roster'},sa)
  imported=create('students',{'name':'Imported unclaimed student','school':chs,'grade':g['id'],'teacher':t['id']},ct,'chs')
  create('meal_selections',{'school':chs,'student':imported['id'],'menu_item':m['id'],'lunch_date':str(monday)},ct,'chs')
  names=['users','grades','teachers','menu_items','delivery_time_slots','delivery_rules','students','meal_selections','audit_log','parent_audit_log','import_history','settings']
  for name in names:
   for tok,slug,other in [(sa,'sample',chs),(ct,'chs',sample)]:
    assert all(r['school']!=other for r in rows(name,tok,slug)),name
    for foreign in [r for r in rows(name,su) if r['school']==other][:1]:
     path='/api/collections/'+name+'/records/'+foreign['id'];denied(path,token=tok,slug=slug);denied(path,{},tok,slug,'PATCH');denied(path,token=tok,slug=slug,method='DELETE')
  assert len(rows('parent_audit_log',ct,'chs'))==3
  patch('meal_selections',meal['id'],{'menu_item':m['id']},cpt,'chs');assert len(rows('parent_audit_log',ct,'chs'))==3
  foreign_menu=rows('menu_items',sa)[0];denied('/api/collections/meal_selections/records/'+meal['id'],{'menu_item':foreign_menu['id']},cpt,'chs','PATCH');assert len(rows('parent_audit_log',ct,'chs'))==3
  # The admin may reassign an in-use time slot, then delete it without
  # losing orders or classroom rules. Sample School remains isolated.
  replacement=create('delivery_time_slots',{'label':'13:00','school':chs,'active':True},ct,'chs')
  moved=ok('/api/batch',{'requests':[
    {'method':'PATCH','url':'/api/collections/meal_selections/records/'+meal['id'],'body':{'delivery_time':replacement['id']}},
    {'method':'PATCH','url':'/api/collections/delivery_rules/records/'+rule['id'],'body':{'delivery_time':replacement['id']}},
  ]},ct,'chs')
  assert len(moved)==2 and all(item['status']==200 for item in moved)
  assert not [x for x in rows('meal_selections',ct,'chs') if x['delivery_time']==d['id']]
  assert not [x for x in rows('delivery_rules',ct,'chs') if x['delivery_time']==d['id']]
  ok('/api/collections/delivery_time_slots/records/'+d['id'],token=ct,slug='chs',method='DELETE')
  assert rows('meal_selections',ct,'chs')[0]['school']==chs
  assert any(x['delivery_time']==replacement['id'] for x in rows('delivery_rules',ct,'chs'))

  for tok,slug,user in [(sa,'sample',chs),(ct,'chs',sample)]:denied('/api/collections/grades/records',{'name':'BAD','school':user},tok,slug)
  denied('/api/collections/users/records/'+sp['record']['id'],{'school':chs},pt,method='PATCH')
  denied('/api/collections/users/records/'+sp['record']['id'],{'role':'admin'},pt,method='PATCH')
  denied('/api/collections/schools/records/'+sample,{'email_enabled':True},sa,method='PATCH')
  denied('/api/collections/students/records',{'name':'BAD','school':chs,'grade':rows('grades',sa)[0]['id'],'teacher':t['id'],'parent':cp['record']['id']},ct,'chs')
  denied('/api/collections/meal_selections/records',{'school':chs,'student':st['id'],'parent':cp['record']['id'],'menu_item':foreign_menu['id'],'lunch_date':str(monday)},ct,'chs')
  newadmin=ok('/api/admin/accounts',{'first_name':'New','last_name':'Admin','email':'new-chs@example.test','password':PASSWORD,'school':sample},ct,'chs');assert ok('/api/collections/users/records/'+newadmin['id'],token=ct,slug='chs')['school']==chs
  assert ok('/api/school-calendar',token=ct,slug='chs')['id']==config['id']
  print('PASS existing records preserved; login/registration school selection; both-direction list/view/update/delete isolation across 12 collections; school-scoped batch create and rollback; cross-school create/relations; parent audit transaction/no-op; school and role reassignment blocked; school-specific custom routes')
  # Capture actual SMTP messages locally; never sends mail to real addresses.
  messages=[]
  class SMTP(socketserver.StreamRequestHandler):
   def handle(self):
    self.wfile.write(b'220 localhost test SMTP\r\n')
    while True:
     line=self.rfile.readline()
     if not line:return
     cmd=line.decode().strip().upper()
     if cmd.startswith('EHLO'):self.wfile.write(b'250-localhost\r\n250 OK\r\n')
     elif cmd.startswith('DATA'):
      self.wfile.write(b'354 go\r\n');data=[]
      while True:
       l=self.rfile.readline()
       if l==b'.\r\n':break
       if not l:return
       data.append(l)
      messages.append(b''.join(data).decode());self.wfile.write(b'250 accepted\r\n')
     elif cmd.startswith('QUIT'):self.wfile.write(b'221 bye\r\n');return
     else:self.wfile.write(b'250 OK\r\n')
  smtp=socketserver.ThreadingTCPServer(('127.0.0.1',0),SMTP);threading.Thread(target=smtp.serve_forever,daemon=True).start()
  ok('/api/settings',{'smtp':{'enabled':True,'host':'127.0.0.1','port':smtp.server_address[1],'tls':False,'username':'','password':'','authMethod':'PLAIN'},'meta':{'senderName':'Integration','senderAddress':'test@example.test'}},su,method='PATCH')
  ok('/api/collections/users/request-password-reset',{'email':form['email']},slug='chs');time.sleep(.5);assert not messages,'CHS mail should default off'
  patch('schools',chs,{'email_enabled':True},su)
  create('users',{'email':'mail-chs@example.test','password':PASSWORD,'passwordConfirm':PASSWORD,'role':'parent','active':True,'verified':True,'school':chs},su)
  ok('/api/collections/users/request-password-reset',{'email':'mail-chs@example.test'},slug='sample');time.sleep(.3);assert not messages,'Wrong-school request sent mail'
  ok('/api/collections/users/request-password-reset',{'email':'mail-chs@example.test'},slug='chs')
  for i in range(50):
   if messages:break
   time.sleep(.1)
  if len(messages)!=1:
   log.flush();print((tmp/'server.log').read_text())
  assert len(messages)==1,'CHS reset did not reach SMTP'
  from email import message_from_string
  from email.policy import default
  mail=message_from_string(messages[0],policy=default);html=mail.get_body(preferencelist=('html',)).get_content() if mail.is_multipart() else mail.get_content()
  assert 'https://chs.cliffslunchclub.com/reset-password?token=' in html,html
  import re
  reset_token=re.search(r'reset-password\?token=([^\"<>\s]+)',html).group(1)
  ok('/api/collections/users/confirm-password-reset',{'token':reset_token,'password':'ResetPassword2026!','passwordConfirm':'ResetPassword2026!'},slug='chs')
  login('mail-chs@example.test','ResetPassword2026!',slug='chs')
  patch('schools',sample,{'email_enabled':True},su)
  ok('/api/collections/users/request-password-reset',{'email':'parent@example.test'});time.sleep(.5);assert len(messages)==1,'Demo mail escaped suppression'
  print('PASS real local SMTP: email off by default; enabled CHS reset reaches SMTP with CHS domain; demo mail suppressed even if flag enabled; wrong-school reset sends no email; delivered token completes reset/login')
  smtp.shutdown();smtp.server_close()
 finally:
  proc.terminate();proc.wait(timeout=10);log.close()

