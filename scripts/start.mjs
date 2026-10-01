import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const binary = path.join(root, '.runtime', 'pocketbase');
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {cwd, stdio:'inherit'});
  if (result.error || result.status !== 0) throw new Error(`${command} failed. ${result.error || ''}`);
}
const version = '0.28.4'; // Compatibility baseline; validate an upgrade before production.
if (!existsSync(binary)) {
  if (!['darwin','linux'].includes(process.platform)) throw new Error('This starter supports Mac and Linux.');
  const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'amd64' : null;
  if (!arch) throw new Error('Unsupported CPU architecture');
  mkdirSync('.runtime', {recursive:true});
  console.log('Downloading PocketBase from its official release...');
  run('curl', ['-fL','--retry','2','--max-time','120','-o','.runtime/pocketbase.zip',`https://github.com/pocketbase/pocketbase/releases/download/v${version}/pocketbase_${version}_${process.platform}_${arch}.zip`]);
  run('unzip',['-o','.runtime/pocketbase.zip','pocketbase','-d','.runtime']);
  run('chmod',['+x',binary]);
}
// PocketBase creates a fresh database from migrations. Never copy a school database.
mkdirSync('pb_data',{recursive:true});
if (!existsSync('frontend/.env.local')) copyFileSync('frontend/.env.example','frontend/.env.local');
if (!existsSync('frontend/node_modules')) run('npm',['install'],path.join(root,'frontend'));
const children = [];
let stopping = false;
function stop(code=0) {
  if(stopping) return; stopping=true;
  for(const c of children) c.kill('SIGTERM');
  setTimeout(()=>process.exit(code),300);
}
for(const [command,args,cwd] of [
  [binary,['serve','--http=127.0.0.1:8090','--dir='+path.join(root,'pb_data'),'--hooksDir='+path.join(root,'pb_hooks'),'--migrationsDir='+path.join(root,'pb_migrations')],root],
  ['npm',['run','dev'],path.join(root,'frontend')]
]) {
 const child=spawn(command,args,{cwd,stdio:'inherit'}); children.push(child);
 child.on('error',e=>{console.error(e.message);stop(1)});
 child.on('exit',code=>{if(!stopping)stop(code || 1)});
}
process.on('SIGINT',()=>stop()); process.on('SIGTERM',()=>stop());
console.log('\nOpen http://127.0.0.1:5173 — Ctrl+C stops both servers.\n');
