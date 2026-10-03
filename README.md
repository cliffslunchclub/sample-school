# Cliffs school app

One codebase, two SiteGround frontends and one shared PocketHost backend. Each school has separate accounts, students, orders, menus, settings and audit history, enforced by backend permissions and relation validation. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Current version — 1.2.2 (October 3, 2026)

This version supports Monday–Friday meals, configurable meal selection days, creating school admins, separate admin/parent audit logs and student-only lunch labels. Built-in Parent Guide and Admin Guide are updated for these workflows, use the current site address and ordering settings, and can be printed or saved as PDF.

Version 1.2.0 adds school-scoped login/registration, backend school isolation, and school-aware email. Both frontend builds use the same backend URL with different school slugs. No hosting account or live domain is changed by updating this repository. Shared backend upgrades affect both schools; use maintenance and test before uploading.

Version 1.2.1 uses paced, transactional PocketBase batches for large roster-and-meal CSV imports and admin purges. Version 1.2.2 adds a separate menu CSV upload with a downloadable template, preview, safe default handling for existing items, and explicit confirmation. The PocketBase Batch API must be enabled for menu uploads, imports and purge.

## Start on your Mac

1. Install Node.js 24 LTS from https://nodejs.org (choose the macOS installer).
2. Unzip this folder into Downloads or another folder you own.
3. Open Terminal, type `cd ` (with a space), drag the unzipped `cliffs-local` folder into Terminal, then press Return.
4. Run `npm start`.
5. Open http://127.0.0.1:5173 in your browser. The first start downloads PocketBase and installs frontend dependencies, so internet access is required.

Alternatively, double-click Start-Mac.command. If macOS prevents it opening, use Terminal as above.

Stop with Control+C. Restart with `npm start`. It keeps your local changes.

## Demo logins

Admin: admin@example.test
Parent: parent@example.test (John Smith)
Password for both: LocalLunch2026!
School registration code: DEMO2026

| Parent | Login | Students |
| --- | --- | --- |
| John Smith | parent@example.test | Jane Smith, Joe Smith |
| Emily Johnson | parent2@example.test | Ava Johnson, Oliver Johnson, Noah Johnson |
| Michael Davis | parent3@example.test | Sophia Davis, Lucas Davis, Mia Davis |
| Sarah Wilson | parent4@example.test | Ella Wilson, Ethan Wilson, Liam Wilson |

All demo parent accounts use `LocalLunch2026!`. There are four demo families and 11 students. New sample/local installs seed a randomly selected available meal for every active demo student on each Monday–Friday date in the configured semester, with delivery times based on class rules. For the default September 14–November 11, 2026 semester, this is 43 service dates and 473 orders. Existing saved selections are preserved, and this migration runs once rather than rerandomizing on startup. Seed orders do not fabricate parent audit entries. The shared backend keeps this sample data and adds an empty Cherry Hill school/settings record. It creates no Cherry Hill demo accounts, students or orders.

These guides are built into the admin sidebar as Parent Guide and Admin Guide; use their Print / Save as PDF button when distributing instructions.

Use the app's Admin Login for the admin account. On a fresh checkout, PocketBase builds a new local database from schema migrations with demo accounts, four demo families and 11 students, sample teachers, menus, grades and delivery rules. Existing demo databases receive the same family update on startup, preserving Jane's original student record and meal selections. No database file or live school records are included in this repository. These public demo credentials are for sample data only, never a live school installation.

You can open the ordering window in Admin Settings when testing. Semester dates and deadlines from the export may otherwise prevent ordering. Create sample orders through the parent interface and compare them with the admin summary/CSV export.

Outgoing user email is disabled by default. Sample user email stays blocked. A PocketBase superuser can enable Cherry Hill email after SMTP setup; password-reset links use the trusted school frontend origin. A local SMTP integration test verifies delivery and demo suppression. Real provider credentials and inbox delivery still need deployment testing.

## Local addresses

Website: http://127.0.0.1:5173
Backend: http://127.0.0.1:8090
PocketBase management: http://127.0.0.1:8090/_/

The app admin account is not a PocketBase superuser. If you need database management, follow PocketBase's initial setup link in the backend terminal. Do not use real school passwords in this test environment.

## Reset demo data

Stop the app. Rename the pb_data folder to pb_data-backup, then start again. A clean demo database will be generated from migrations. This resets all local accounts and changes while preserving the backup.

## Development

Frontend code: frontend/src
Backend rules/schema: pb_migrations
Backend hooks: pb_hooks
Brand text and API endpoint: frontend/.env.local

`cd frontend` then `npm run build` builds the frontend. Run from the project root again for `npm start`.

Sample and Cherry Hill share one backend/database, with separate frontend builds and school records. Deployment packaging supports sample and CHS profiles; upload the common backend once. Emails are globally unique in the users collection: one email currently belongs to one school. PocketBase superuser access, SMTP configuration, backups and downtime are shared. Additional schools require explicit provisioning and frontend configuration; ordinary school admins cannot create schools or enable email.

PocketBase is pinned to 0.28.4 as a compatibility baseline for the export. The ZIP does not identify the original backend version. Validate migrations, authorization, backups and a supported PocketBase upgrade before production. Never use the demo credentials for real school records. No AWS resources or live DNS were changed.

## New admin features

- **Administrators**: create another school admin with a name, email and password of at least 12 characters. Parents cannot use the creation endpoint or promote their accounts.
- **Lunch Labels**: choose an exact lunch date and generate student labels only. Print or use the browser's Save as PDF. Label stock is 1 × 2⅝ inch, 30 per Letter sheet. Menu and delivery time changes start separate rows; chicken wrap types are separate menu sections.
- **Monday–Friday**: parent menus, selections, admin filters/overrides, summaries and CSV imports support five weekdays. The migration adds Tuesday, Thursday and Friday to existing menu availability; adjust each item in Menu if needed. Admins choose the allowed meal selection days in Settings (Thursday and Friday by default), using America/New_York. Select no days to close parent ordering. Each selected day allows orders for the following week's Monday–Friday, including next week when Monday itself is selected.

## Updating a downloaded copy

Stop the old app with Control+C and keep its folder as a backup. Download Code → Download ZIP from this private repository and extract it into a new folder. To keep your local accounts, students and orders, copy the old folder's `pb_data` folder into the new project root **before starting it**. Do not copy `.runtime`, `frontend/node_modules`, or old source files. Run `npm start` in the new folder. The database migration applies automatically; a new empty folder instead starts with fresh demo data. Never upload `pb_data` to GitHub.

## Checks

After frontend dependencies are installed, run `npm test` from the project root for schedule, import and label regressions. In `frontend`, run `npx tsc --noEmit -p tsconfig.app.json` and `npm run build`. Print one plain-paper label sheet at 100% with browser headers and footers disabled before using label stock.

- **Audit logs**: Admin Audit Logs retains the existing administrative history. Parent Audit Log is recorded automatically on the server for new parent meal selections and changes, with immutable snapshots of parent, student, meal and delivery time. Parent history begins when this update is installed; past changes cannot be reconstructed.

School isolation integration checks: `npm run test:integration` (Python 3 and the PocketBase binary downloaded by `npm start`, or `POCKETBASE_BINARY`). Uses disposable local data and a local SMTP capture server, never live school data.
