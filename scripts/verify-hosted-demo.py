"""Read-only release checks. Never print tokens or alter hosted records."""
import json, os, time, urllib.request, urllib.error
BASE='https://clc-schools.pockethost.io'
def request(path,body=None,slug='sample',token=''):
    q=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json','X-School-Slug':slug,'Authorization':token})
    with urllib.request.urlopen(q,timeout=15) as response:return json.loads(response.read() or b'{}')
def verify():
    assert request('/api/release')['version']==os.environ['EXPECTED_RELEASE']
    for role in ['parent','admin']:
        result=request('/api/collections/users/auth-with-password',{'identity':'demo-'+role+'@example.test','password':'ExploreLunch2026!'})
        assert result['record']['role']==role and result['record']['active']
        assert request('/api/collections/students/records',token=result['token'])['items']
    for slug in ['sample','chs']:
        items=request('/api/public-menu',slug=slug)['items']
        assert all(set(row)=={'id','name','description','days','active'} for row in items)
for attempt in range(10):
    try:
        verify();print('Backend release, public demo accounts, and guest menus verified. Frontend publishing can proceed.');break
    except (AssertionError,KeyError,ValueError,urllib.error.URLError):
        if attempt==9:raise SystemExit('Backend verification is pending. Restart clc-schools in PocketHost to apply migrations, then rerun this failed job. Frontend publishing remains blocked.')
        print('Waiting for the backend release and demo migration. Restart clc-schools if a new migration was uploaded.',flush=True)
        time.sleep(30)
