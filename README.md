# Cliffs school app

One codebase for separate school installations, with local development and deployment packages for SiteGround frontends and PocketHost backends. See [DEPLOYMENT.md](DEPLOYMENT.md) for sample-first releases and later Cherry Hill promotion. The interface is the same on both domains; databases and school settings stay separate.

## Current version — 1.1.0 (October 1, 2026)

This version supports Monday–Friday meals, configurable meal selection days, creating school admins, separate admin/parent audit logs and student-only lunch labels. Built-in Parent Guide and Admin Guide are updated for these workflows, use the current site address and ordering settings, and can be printed or saved as PDF.

Deployment packages support the sample site on SiteGround + PocketHost and a separate Cherry Hill template. No hosting account or live domain is deployed by updating this repository. Test each release on the sample before promoting the same source version to Cherry Hill.

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

All demo parent accounts use `LocalLunch2026!`. There are four demo families and 11 students. New sample/local installs seed a randomly selected available meal for every active demo student on each Monday–Friday date in the configured semester, with delivery times based on class rules. For the default September 14–November 11, 2026 semester, this is 43 service dates and 473 orders. Existing saved selections are preserved, and this migration runs once rather than rerandomizing on startup. Seed orders do not fabricate parent audit entries. Cherry Hill deployment packages disable all demo seeds.

These guides are built into the admin sidebar as Parent Guide and Admin Guide; use their Print / Save as PDF button when distributing instructions.

Use the app's Admin Login for the admin account. On a fresh checkout, PocketBase builds a new local database from schema migrations with demo accounts, four demo families and 11 students, sample teachers, menus, grades and delivery rules. Existing demo databases receive the same family update on startup, preserving Jane's original student record and meal selections. No database file or live school records are included in this repository. These public demo credentials are for sample data only, never a live school installation.

You can open the ordering window in Admin Settings when testing. Semester dates and deadlines from the export may otherwise prevent ordering. Create sample orders through the parent interface and compare them with the admin summary/CSV export.

Outgoing email is suppressed by pb_hooks/local_email.pb.js. Password-reset/email delivery flows cannot be fully tested in this package. The sample deployment keeps this hook; the CHS package omits it and requires SMTP setup.

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

Each new school should use the same source release with its own backend database, environment configuration and domain. Deployment packaging supports sample and CHS profiles; hosting uploads remain manual. Use a separate folder for independent local school tests; stop one before starting another because they use the same ports.

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
