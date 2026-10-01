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
