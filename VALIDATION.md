Verified in Linux with Node 24 and PocketBase 0.28.4:

- Frontend production build and TypeScript checks.
- Fresh schema migrations and migration of an existing demo database.
- Admin/parent login; admin-only account creation; password validation; duplicate rejection; new-admin login; server-derived school and role; parent privilege-escalation rejection.
- Parents can read semester dates through a calendar endpoint that excludes the registration code.
- Parent orders accepted for Monday–Friday in the upcoming week; weekends rejected.
- Automated regressions for timezone ordering boundaries, five-day CSV matching/writes/conflict handling, label row/page boundaries, wrap grouping, faculty formatting, two sets of summaries, extra slider/nugget copies, HTML escaping and empty dates.
- Label geometry modeled on Letter pages and visually inspected.

Full browser workflows could not be executed here because the Chromium download failed. Browser print alignment and the Mac launcher still require local verification. Label output uses an HTML print preview and the browser's Save as PDF. No AWS deployment or live CHS data was changed.
