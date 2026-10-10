"""Read-only release checks. Never print tokens or alter hosted records."""
import json, os, time, urllib.request, urllib.error
BASE='https://clc-schools.pockethost.io'
def request(path,body=None,slug='sample',token=''):
    q=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers={'User-Agent':'Mozilla/5.0 (compatible; CliffsLunchClubDeploy/1.0; +https://cliffslunchclub.com)','Content-Type':'application/json','X-School-Slug':slug,'Authorization':token})
    try:
        with urllib.request.urlopen(q,timeout=15) as response:return json.loads(response.read() or b'{}')
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'{path}: HTTP {error.code}') from None
def verify():
    release=request('/api/release').get('version')
    if release!=os.environ['EXPECTED_RELEASE']:raise RuntimeError(f'Release mismatch: expected {os.environ["EXPECTED_RELEASE"]}, received {release}')
    for role in ['parent','admin']:
        result=request('/api/collections/users/auth-with-password',{'identity':'demo-'+role+'@example.test','password':'ExploreLunch2026!'})
        assert result['record']['role']==role and result['record']['active']
        if not request('/api/collections/students/records',token=result['token'])['items']:raise RuntimeError(f'Demo {role} has no visible sample students')
    for slug in ['sample','chs']:
        items=request('/api/public-menu',slug=slug)['items']
        assert all(set(row)=={'id','name','description','days','active'} for row in items)
for attempt in range(3):
    try:
        verify();print('Backend release, public demo accounts, and guest menus verified. Frontend publishing can proceed.');break
    except (AssertionError,KeyError,ValueError,RuntimeError,urllib.error.URLError) as error:
        print(f'Verification detail: {error}',flush=True)
        if attempt==2:raise SystemExit('Backend verification is pending. Restart clc-schools in PocketHost to apply migrations, then rerun this failed job. Frontend publishing remains blocked.')
        print('Waiting for the backend release and demo migration. Restart clc-schools if a new migration was uploaded.',flush=True)
        time.sleep(30)
