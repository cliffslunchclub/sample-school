"""Public demo security checks against disposable PocketBase 0.28.4 data."""
import json, os, pathlib, shutil, socket, sqlite3, subprocess, tempfile, time, urllib.request, urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[1]
BINARY=pathlib.Path(os.environ.get('POCKETBASE_BINARY',str(ROOT/'.runtime/pocketbase'))).resolve()
PASSWORD='IntegrationOnly2026!'
with tempfile.TemporaryDirectory(prefix='clc-demo-') as tmp:
 tmp=pathlib.Path(tmp);data=tmp/'data';old=tmp/'old';old.mkdir()
 for f in (ROOT/'pb_migrations').glob('*.js'):
  if f.name!='2000000050_read_only_public_demo.js':shutil.copy(f,old/f.name)
 def run(*args):subprocess.run([str(BINARY),*args],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
 run('migrate','up','--dir='+str(data),'--migrationsDir='+str(old))
 run('superuser','upsert','integration@example.test',PASSWORD,'--dir='+str(data))
 # Seed CHS sentinel data before upgrading, then assert every CHS row is unchanged.
 with sqlite3.connect(data/'data.db') as db:
  chs=db.execute("SELECT id FROM schools WHERE slug='chs'").fetchone()[0]
  db.execute("INSERT INTO teachers(id,name,school,grade,active) SELECT 'chsteachers0001','Actual CHS Teacher',?,id,1 FROM grades LIMIT 1",(chs,))
  db.commit()
  sentinel=db.execute('SELECT * FROM teachers WHERE school=?',(chs,)).fetchall()
 run('migrate','up','--dir='+str(data),'--migrationsDir='+str(ROOT/'pb_migrations'))
 with sqlite3.connect(data/'data.db') as db:
  assert sentinel==db.execute('SELECT * FROM teachers WHERE school=?',(chs,)).fetchall()
  sample=db.execute("SELECT id FROM schools WHERE slug='sample'").fetchone()[0]
  assert all(x[0].startswith('Sample Student ') for x in db.execute('SELECT name FROM students WHERE school=?',(sample,)))
  assert all(x[0].startswith('Sample Teacher ') for x in db.execute('SELECT name FROM teachers WHERE school=?',(sample,)))
 sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close()
 hooks=tmp/'hooks';shutil.copytree(ROOT/'pb_hooks',hooks)
 (hooks/'qa_tokens.pb.js').write_text('routerAdd("GET","/api/qa/reset-token/{id}",(e)=>{if(!e.hasSuperuserAuth())throw new ForbiddenError();return e.json(200,{token:e.app.findRecordById("users",e.request.pathValue("id")).newPasswordResetToken()})})')
 log=open(tmp/'server.log','w+')
 proc=subprocess.Popen([str(BINARY),'serve','--http=127.0.0.1:'+str(port),'--dir='+str(data),'--hooksDir='+str(hooks),'--migrationsDir='+str(ROOT/'pb_migrations')],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
 base='http://127.0.0.1:'+str(port)
 def req(path,body=None,token='',slug='sample',method=None):
  q=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json','Authorization':token,'X-School-Slug':slug},method=method)
  try:
   with urllib.request.urlopen(q,timeout=5) as res:return res.status,json.loads(res.read() or b'{}')
  except urllib.error.HTTPError as e:return e.code,json.loads(e.read() or b'{}')
 def ok(*args,**kw):
  code,body=req(*args,**kw);assert 200<=code<300,(args[0],code,body);return body
 def denied(*args,**kw):
  code,body=req(*args,**kw);assert code in [400,403,404],(args[0],code,body)
 def rows(name,token):return ok('/api/collections/'+name+'/records?perPage=500',token=token)['items']
 try:
  for i in range(50):
   try:ok('/api/health');break
   except Exception:time.sleep(.1)
  su=ok('/api/collections/_superusers/auth-with-password',{'identity':'integration@example.test','password':PASSWORD})['token']
  ok('/api/settings',{'batch':{'enabled':True,'maxRequests':40,'timeout':5,'maxBodySize':1000000}},token=su,method='PATCH')
  original=rows('students',su)
  # Demo accounts can authenticate, refresh, and read their own school only.
  for role in ['parent','admin']:
   form={'identity':'demo-'+role+'@example.test','password':'ExploreLunch2026!'}
   auth=ok('/api/collections/users/auth-with-password',form);token=auth['token'];uid=auth['record']['id']
   ok('/api/collections/users/auth-refresh',{},token=token)
   denied('/api/collections/users/auth-with-password',form,slug='chs')
   children=rows('students',token);assert children and all(x['school']==sample for x in children)
   assert rows('meal_selections',token)
   denied('/api/collections/teachers/records/chsteachers0001',token=token)
   child=children[0]
   denied('/api/collections/students/records/'+child['id'],{'name':'Must not save'},token=token,method='PATCH')
   denied('/api/collections/students/records/'+child['id'],token=token,method='DELETE')
   denied('/api/collections/students/records',{'name':'Must not create','school':sample,'grade':child['grade'],'teacher':child['teacher'],'parent':uid},token=token)
   denied('/api/collections/users/records/'+uid,{'password':'ChangedLunch2026!','passwordConfirm':'ChangedLunch2026!','oldPassword':'ExploreLunch2026!'},token=token,method='PATCH')
   denied('/api/collections/users/records/'+uid,{'email':'changed@example.test','oldPassword':'ExploreLunch2026!'},token=token,method='PATCH')
   denied('/api/admin/accounts',{'email':'created@example.test','password':PASSWORD,'first_name':'New','last_name':'User'},token=token)
   denied('/api/batch',{'requests':[{'method':'PATCH','url':'/api/collections/students/records/'+child['id'],'body':{'name':'Batch mutation'}}]},token=token)
   # Confirm-reset is anonymous and must also protect public accounts.
   reset=ok('/api/qa/reset-token/'+uid,token=su)['token']
   denied('/api/collections/users/confirm-password-reset',{'token':reset,'password':'ChangedLunch2026!','passwordConfirm':'ChangedLunch2026!'})
   ok('/api/collections/users/auth-with-password',form)

  denied('/api/register-parent',{'first_name':'X','last_name':'Y','email':'created@example.test','password':PASSWORD,'code':'anything'})
  assert original==rows('students',su),'demo write attempts changed data'
  # Guest endpoint exposes only allowlisted active menu fields for selected school.
  sample_menu=ok('/api/public-menu')['items'];assert sample_menu
  assert all(set(item)=={'id','name','description','days','active'} for item in sample_menu)
  assert ok('/api/public-menu',slug='chs')['items']==[]
  denied('/api/public-menu',slug='unknown');assert ok('/api/collections/students/records')['items']==[]
  # Normal CHS admins retain writes, regardless of UI parent-login visibility.
  admin=ok('/api/collections/users/records',{'email':'chs-admin@example.test','password':PASSWORD,'passwordConfirm':PASSWORD,'role':'admin','school':chs,'active':True},token=su)
  ct=ok('/api/collections/users/auth-with-password',{'identity':admin['email'],'password':PASSWORD},slug='chs')['token']
  ok('/api/collections/menu_items/records',{'name':'CHS Lunch','school':chs,'active':True,'days':['Monday']},token=ct,slug='chs')
  assert [x['name'] for x in ok('/api/public-menu',slug='chs')['items']]==['CHS Lunch']
  assert all(x['name']!='CHS Lunch' for x in ok('/api/public-menu')['items'])
  print('PASS demo login/refresh, single-school reads, direct/batch/custom write denial, fictional names, guest isolation, unchanged CHS data and writes')
 finally:
  proc.terminate();proc.wait(timeout=10)
  log.seek(0);text=log.read();log.close()
  if 'failed to execute' in text or 'ReferenceError' in text or 'TypeError' in text:print(text)
