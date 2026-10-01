# SiteGround + PocketHost

One repository, two independent installations of the same interface. No banner or visual changes. Deploy the sample school first; Cherry Hill is a later deployment.

| Target | Frontend on SiteGround | Separate PocketHost backend | Fresh-install data |
| --- | --- | --- | --- |
| `sample` | `sampleschool.cliffslunchclub.com` | Sample instance URL | Demo admin, John Smith with Jane and Joe, sample menus and teachers |
| `chs` | `chs.cliffslunchclub.com` | Different CHS instance URL | School record and schema only; no sample accounts or school data |

School settings, accounts, students, orders and backups remain separate. Hosting keys, passwords and databases never go into GitHub. Do not overwrite the current CHS installation or DNS until its data and schema have been reviewed and backed up.

## First sample deployment

1. Create a PocketHost account and one sample instance. Record its public HTTPS URL. This repo is tested with PocketBase **0.28.4**; PocketHost may offer a later 0.28 patch. Select the closest compatible version and verify the actual hosted version. If 0.28 is unavailable, test an upgrade before publishing. Create a private, strong PocketBase superuser credential; this is separate from the demo app admin.
2. Add an Ed25519 SSH public key under PocketHost Account → Keys, restricted to the sample instance. Keep its private key on your Mac. Connect using an SFTP client: host `ftp.pockethost.io`, port `2222`, username your PocketHost email, SSH key authentication. There is no SSH shell, rsync or scp.
3. In your Mac checkout, install dependencies with `cd frontend`, `npm ci`, then `cd ..`. Check out the intended GitHub release tag or commit before preparing packages. Run:

```bash
npm test
npx --prefix frontend tsc --noEmit -p frontend/tsconfig.app.json
npm run deploy:prepare -- --target sample --api-url https://YOUR-SAMPLE-INSTANCE.pockethost.io --release v1.0.0
```

Replace the URL and release identifier with the actual instance URL and source tag/commit. The build overrides the Mac's local API endpoint. It creates `.deploy/sample/v1.0.0/` with:

- `siteground/`: static website, `.htaccess` for nested-route refreshes, and `release.json`.
- `pockethost/pb_hooks/` and `pockethost/pb_migrations/`: backend source and all required helper modules.
- `release.json`: target, API URL, frontend domain, source digest and release identifier.

No database, credentials, environment files, binaries or node_modules are packaged. Packages are immutable: a target/version directory cannot be overwritten. Use a new release identifier when code changes. This command prepares files only; no hosts or DNS are changed.

4. In SiteGround, create the sample subdomain with its own document root and SSL. Upload the **contents** of `siteground/`, including `.htaccess`, into that document root. Serve this React build as static files; a Node.js project is unnecessary. Keep other websites in their own document roots.
5. Power off the sample instance in PocketHost before uploading the complete backend release. In SFTP open the correct sample instance directory, and upload the package's hooks and migrations into its `pb_hooks` and `pb_migrations` directories. Include helper `.js` files as well as `.pb.js`. Do not touch `pb_data`. Review starter hooks before removing any on a first install; on updates remove obsolete hooks required by the code change, while preserving migration history.
6. Start/restart PocketHost and inspect logs for migration failures. Verify schema in its superuser dashboard. If uploaded migrations do not apply at startup, stop and resolve this with PocketHost; do not manually create collections with different IDs.
7. Visit the backend `/api/release` and frontend `/release.json`. Both must show the same target, version and source digest. The frontend manifest must name the correct backend URL. These manifests contain no credentials.
8. Test on the actual HTTPS website: parent/admin login, Jane/Joe under John, student management, saving/changing meals, ordering days, separate audit logs, CSV workflow, labels and refresh of a nested route such as `/admin/audit`. PocketBase's default CORS permits cross-origin requests; if customized, allow the correct frontend origin and verify OPTIONS/auth calls.

Sample login: `parent@example.test` or `admin@example.test`; password `LocalLunch2026!`; registration code `DEMO2026`. Mail stays suppressed on the sample. This is an editable demonstration; anyone given admin access can change its records. Share admin access separately and use invented records only. Adjust semester dates and ordering days in Settings before a demo because seed dates are fixed. Never copy CHS records into the sample.

## Cherry Hill later

Create its own PocketHost instance and prepare from the exact code version that passed on the sample:

```bash
npm run deploy:prepare -- --target chs --api-url https://YOUR-CHS-INSTANCE.pockethost.io --release v1.0.0
```

Sample-data guards are baked into the generated migrations: CHS gets no demo accounts even if a host environment variable is missing. Source migrations default to demo mode for `npm start`; `CLIFFS_SEED_DEMO=false npm start` creates a clean local template instead. Changing profiles does not remove data from existing databases because applied migrations do not rerun.

For a **new empty CHS database**, use its private superuser dashboard to set the school name, create the first application user (`role=admin`, `active=true`, `verified=true`, matching school, real email/name and private password), and create a school settings record with private registration code, semester dates and ordering days. Populate grades, teachers, delivery slots/rules and menus through the app before inviting parents.

The CHS package omits the local email-suppression hook. Configure and test SMTP/password reset before launch; if an older installation has `pb_hooks/local_email.pb.js`, remove it explicitly while the backend is off.

For **existing CHS data**, migration is a separate task. Validate the existing PocketBase version and schema, test on a backup, and review historical data-changing migrations (including menu availability and semester dates). Do not upload a sample/fresh database, overwrite `pb_data`, run rollback commands or assume the existing export matches this schema. This preparation does not migrate or replace the current CHS website.

## Releasing updates to both sites

1. Commit code to GitHub and use a fixed tag/commit for the release. Future schema changes use new forward migrations. The initial seed guards only affect fresh installs; existing records stay attached to their IDs.
2. Prepare and upload that release to the sample backend first, then frontend. Retain the previous packages and any sample backup you need. Verify manifests and actual hosted workflows.
3. From the same unchanged checkout prepare CHS with its own API URL. Compare the two `source_sha256` values: they must match. A mismatch requires retesting or restoring the correct source checkout.
4. Before CHS updates, create and download a PocketBase database backup and retain the last code packages. Apply compatible backend migrations first, then frontend. Schedule maintenance if the new backend cannot support the old frontend during that interval.
5. Check the CHS manifests, parent/admin login, orders and audit history. Upload success is not sufficient verification.

Each site retains its own settings and data. Migrations may intentionally change data; review the release notes before promotion. Initially releases are manual. A future GitHub Actions workflow can automate sample releases and provide an explicit CHS promotion using a protected environment. No automatic live deployment or hosting secrets are configured yet.

Frontend rollback is reuploading the prior package **only if it works with the current backend schema**. For incompatible backend changes prefer a forward fix; otherwise restore a tested backup with matching backend/frontend during maintenance. Backup restoration loses changes made since that backup. Do not assume reversing migrations is safe.

## Provider references

- https://www.siteground.com/kb/what-is-node-js-project
- https://pockethost.io/docs/ftp
- https://pockethost.io/docs/versions
- https://pockethost.io/docs/backup-restore

Verify actual hosted version, migration startup, DNS/SSL, browser workflows and physical label printing during deployment. Local checks do not replace these checks.
