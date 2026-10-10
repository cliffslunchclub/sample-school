import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../frontend/src/lib/pocketbase.js', import.meta.url),'utf8')
  .replace(/^import .*;\n/gm,'')
  .replaceAll('import.meta.env', 'env');
for (const isSampleSite of [true,false]) {
  const alerts=[];
  const pb = new Function('isSampleSite','DEMO_MESSAGE','window','env','PocketBase', source.replace('export default pb;','return pb;'))(
    isSampleSite,'This is a demo site. Changes cannot be saved.',{alert:x=>alerts.push(x)},
    {VITE_POCKETBASE_URL:'https://example.test',VITE_SCHOOL_SLUG:isSampleSite?'sample':'chs'}, class PocketBase {});
  for(const path of ['/api/public-menu','/api/collections/students/records']) assert.doesNotThrow(()=>pb.beforeSend('https://example.test'+path,{method:'GET'}));
  for(const path of ['/api/collections/users/auth-with-password','/api/collections/users/auth-refresh?expand=school','/api/import/parse-csv']) assert.doesNotThrow(()=>pb.beforeSend('https://example.test'+path,{method:'POST'}));
  for(const [path,method] of [['/api/collections/students/records','POST'],['/api/collections/users/records/demo','PATCH'],['/api/collections/meal_selections/records/meal','DELETE'],['/api/batch','POST'],['/api/admin/accounts','POST'],['/api/register-parent','POST'],['/api/collections/users/confirm-password-reset','POST']]) {
    if(isSampleSite)assert.throws(()=>pb.beforeSend('https://example.test'+path,{method}),/Changes cannot be saved/);
    else assert.doesNotThrow(()=>pb.beforeSend('https://example.test'+path,{method}));
  }
  assert.equal(alerts.length,isSampleSite?7:0);
}
console.log('PASS demo submission alert, login/refresh/read access, and unrestricted CHS client requests');
