# Cliffs school app — local starter

This adapts the existing CHS React/PocketBase app for local development. It is the first step toward the shared-codebase, separate-school deployment plan, not a completed redesign or production AWS deployment.

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
Parent: parent@example.test
Password for both: LocalLunch2026!
School registration code: DEMO2026

Use the app's Admin Login for the admin account. On a fresh checkout, PocketBase builds a new local database from schema migrations with demo accounts, a Demo Student, sample teachers, menus, grades and delivery rules. No database file or live school records are included in this repository. These public demo credentials are for loopback-only local testing, never production.

You can open the ordering window in Admin Settings when testing. Semester dates and deadlines from the export may otherwise prevent ordering. Create sample orders through the parent interface and compare them with the admin summary/CSV export.

Outgoing email is suppressed by pb_hooks/local_email.pb.js. Password-reset/email delivery flows cannot be fully tested in this package. Remove that hook and configure email only in a separate deployment when ready.

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

Each new school should use the same source release with its own backend database, environment configuration and domain. This starter does not yet automate new-school provisioning or AWS deployment. Use a separate folder for independent local school tests; stop one before starting another because they use the same ports.

PocketBase is pinned to 0.28.4 as a compatibility baseline for the export. The ZIP does not identify the original backend version. Validate migrations, authorization, backups and a supported PocketBase upgrade before production. Never publish the demo credentials. No AWS resources or live DNS were changed.
