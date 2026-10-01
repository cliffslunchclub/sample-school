Verified in Linux with Node 24 and PocketBase 0.28.4:

- Frontend production build and TypeScript checks.
- Fresh schema migrations and migration of an existing demo database.
- Admin/parent login; admin-only account creation; password validation; duplicate rejection; new-admin login; server-derived school and role; parent privilege-escalation rejection.
- Parents can read semester dates through a calendar endpoint that excludes the registration code.
- Parent orders accepted for Monday–Friday in the upcoming week; weekends rejected.
- Automated regressions for timezone ordering boundaries, five-day CSV matching/writes/conflict handling, label row/page boundaries, separate chicken wrap types, faculty formatting, student-only output, HTML escaping and empty dates.
- Label geometry modeled on Letter pages and visually inspected.

Full browser workflows could not be executed here because the Chromium download failed. Browser print alignment and the Mac launcher still require local verification. Label output uses an HTML print preview and the browser's Save as PDF. No AWS deployment or live CHS data was changed.

Latest update verified:

- Configurable meal selection days, including no selected days (closed), plus Monday/Sunday following-week targets and Eastern-time boundaries.
- Backend enforcement of saved settings, active parent ownership, semester dates and meal availability.
- Immutable server-generated parent meal history, preserving previous/new meal and time, actor/student snapshots and timestamp; no-op saves produce no extra log. Admin edits remain outside the parent log.
- Parent logs cannot be read or forged by parents, or edited/deleted by admins.
- An intentionally failed audit write rolls back the meal change and returns failure.
- Fresh and existing demo database migrations pass. Existing admin audit history is retained.

Parent audit history starts at installation of this update; historical parent changes cannot be reconstructed.


Deployment preparation verified (2026-10-01):

- Sample and CHS static builds embed separate HTTPS backend URLs and no local backend URL; both include SPA fallback rules and matching source digests.
- Packages exclude databases, environment files, node_modules and runtime binaries.
- Fresh sample migrations create John, Jane and Joe; fresh CHS migrations create schema/school only, with no demo accounts or data. Repeat startup does not duplicate seeds.
- Applying guarded migrations to an existing database preserves users, students, meals and settings.
- Both packaged backends start on UTC hosts and expose matching release metadata.
- Eastern ordering calendar covers midnight and spring/fall DST transitions without depending on host timezone.
- Hosted-style sample API checks pass: configurable ordering days, closed-day enforcement, parent audit create/update/time snapshots, no-op suppression, admin/parent separation and immutable restricted logs.
- Regression tests, TypeScript check and both production builds pass.

No SiteGround/PocketHost account, DNS or live installation was changed. Actual provider version support, hosted migration startup, browser workflows and label alignment remain deployment checks.


Version 1.1.0 verified:

- Fresh sample seed creates four parent families and 11 students, with 473 selections across the default semester's 43 weekday dates. Selected meals match weekday availability and school/parent/student relations; delivery times follow class rules.
- Existing meal records are retained unchanged. Repeated startup does not duplicate students/orders or rerandomize saved menus. Fresh CHS receives no demo users/students/orders.
- Parent/Admin guides now use the current domain and school ordering settings, carry version 1.1.0/update date, and cover five-day meals, current account controls, admin creation, separate audit history and student-only labels.
- Regression tests, TypeScript check and frontend/sample/CHS builds pass. Browser print layout remains a deployment check.
