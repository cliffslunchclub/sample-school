import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const name = process.argv[i];
  if (!['--target', '--api-url', '--release'].includes(name) || !process.argv[i + 1] || name in options) {
    throw new Error('Usage: npm run deploy:prepare -- --target sample|chs --api-url https://INSTANCE.pockethost.io --release v1.0.0');
  }
  options[name] = process.argv[i + 1];
}
const target = options['--target'];
const version = options['--release'];
if (!['sample', 'chs'].includes(target)) throw new Error('Choose --target sample or chs.');
if (!version || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(version)) throw new Error('A release tag or commit SHA is required.');
const api = new URL(options['--api-url']);
if (api.protocol !== 'https:' || api.username || api.password || api.search || api.hash || api.pathname !== '/' || ['localhost', '127.0.0.1', '::1', '[::1]'].includes(api.hostname)) {
  throw new Error('Use the public HTTPS backend origin, without credentials, paths or query parameters.');
}
const profiles = {
  sample: { domain: 'sampleschool.cliffslunchclub.com', school: 'Sample Elementary School', title: 'Sample School Lunch Dashboard via Cliffs Lunch Club' },
  chs: { domain: 'chs.cliffslunchclub.com', school: 'Cherry Hill Elementary', title: 'Cherry Hill School Lunch via Cliffs Lunch Club' },
};
const profile = profiles[target];
const base = path.join(root, '.deploy');
const destination = path.join(base, target, version);
if (existsSync(destination)) throw new Error('This release package already exists. Keep it immutable; choose a new release identifier after changing code.');
mkdirSync(base, { recursive: true });
const staging = mkdtempSync(path.join(base, '.staging-'));
try {
  const site = path.join(staging, 'siteground');
  const backend = path.join(staging, 'pockethost');
  mkdirSync(backend);
  for (const folder of ['pb_hooks', 'pb_migrations']) cpSync(path.join(root, folder), path.join(backend, folder), { recursive: true });
  // Both frontend targets use exactly the same shared backend. Fresh instances
  // contain sample data and an empty CHS school; existing migrations stay applied.
  for (const filename of readdirSync(path.join(backend, 'pb_migrations'))) {
    const file = path.join(backend, 'pb_migrations', filename);
    let source = readFileSync(file, 'utf8');
    source = source.replaceAll('$os.getenv("CLIFFS_SEED_DEMO") !== "false"', "true");
    source = source.replace('$os.getenv("CLIFFS_SCHOOL_NAME") || "Cliffs Elementary"', JSON.stringify(profiles.sample.school));
    writeFileSync(file, source);
  }
  // School-aware mail is off by default; CHS must configure SMTP before launch.
  // School-aware mail policy is included in every target package.
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: path.join(root, 'frontend'), stdio: 'inherit',
    env: { ...process.env, VITE_POCKETBASE_URL: api.origin, VITE_BRAND_NAME: 'Cliffs Lunch Club', VITE_SCHOOL_SLUG: target },
  });
  if (result.error || result.status !== 0) throw new Error('Frontend build failed; install dependencies with npm ci in frontend first.');
  cpSync(path.join(root, 'frontend/dist'), site, { recursive: true });
  const indexFile = path.join(site, 'index.html');
  writeFileSync(indexFile, readFileSync(indexFile, 'utf8').replace(/<title>[^<]*<\/title>/, `<title>${profile.title}</title>`));
  // Revalidate HTML on every visit so browsers/CDN pick up new entry points.
  // Vite's fingerprinted JS/CSS can stay cached for a year because their names
  // change whenever their contents change.
  writeFileSync(path.join(site, '.htaccess'), '<IfModule mod_headers.c>\nHeader set Cache-Control "no-cache"\n<FilesMatch "^.*-[A-Za-z0-9_-]{8,}\\.(js|css)$">\n  Header set Cache-Control "public, max-age=31536000, immutable"\n</FilesMatch>\n</IfModule>\n\n<IfModule mod_rewrite.c>\nRewriteEngine On\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule ^ index.html [L]\n</IfModule>\n');
  // Same source digest across target packages proves both were prepared from the
  // same code, even though their public API URLs and installation profiles differ.
  const hash = createHash('sha256');
  function digest(relative) {
    const location = path.join(root, relative);
    for (const item of readdirSync(location, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (['node_modules', 'dist'].includes(item.name) || (item.name.startsWith('.env') && item.name !== '.env.example')) continue;
      const name = path.join(relative, item.name);
      if (item.isDirectory()) digest(name);
      else if (item.isFile()) { hash.update(name); hash.update(readFileSync(path.join(root, name))); }
    }
  }
  for (const folder of ['frontend', 'pb_hooks', 'pb_migrations', 'scripts']) digest(folder);
  hash.update(readFileSync(path.join(root, 'package.json')));
  const manifest = { target, version, source_sha256: hash.digest('hex'), frontend_domain: profile.domain, backend_url: api.origin, school_slug: target, backend_mode: "shared", seed_demo: true, pocketbase_tested_version: '0.28.4' };
  writeFileSync(path.join(staging, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(path.join(site, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(path.join(backend, 'pb_hooks/release.js'), 'module.exports = ' + JSON.stringify({ target: "shared", version, source_sha256: manifest.source_sha256 }) + '\n');
  mkdirSync(path.dirname(destination), { recursive: true });
  renameSync(staging, destination);
  console.log(`\nPrepared ${destination}\nUpload siteground contents to the frontend document root (including .htaccess).\nUpload pockethost/pb_hooks and pockethost/pb_migrations to the matching backend.\nNo database, passwords or hosting keys are included. See DEPLOYMENT.md.`);
} catch (error) {
  rmSync(staging, { recursive: true, force: true });
  throw error;
}
