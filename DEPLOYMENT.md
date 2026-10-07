# SiteGround + one shared PocketHost backend

Version 1.2.3 uses one PocketBase instance for both school sites. Keep the existing shared PocketHost instance at `https://clc-schools.pockethost.io`.

| Frontend | Build target / school slug | Backend |
| --- | --- | --- |
| https://sampleschool.cliffslunchclub.com | sample | https://clc-schools.pockethost.io |
| https://chs.cliffslunchclub.com | chs | Same instance |

Backend rules scope all school records to the authenticated account. Write hooks check linked records, including admin imports. School slugs select login and registration; knowing another slug does not grant access. Ordinary school admins cannot change school identity or email policy. User emails are globally unique: one email currently belongs to one school. Backups, SMTP settings and backend downtime are shared.

## Prepare the upgrade

Use the exact GitHub commit intended for deployment. PocketBase compatibility baseline remains **0.28.4**; verify the hosted version. Install frontend dependencies with `npm ci` inside frontend, then run from the repository root:

```bash
npm test
npm run test:integration
npx --prefix frontend tsc --noEmit -p frontend/tsconfig.app.json
npm run deploy:prepare -- --target sample --api-url https://clc-schools.pockethost.io --release RELEASE
npm run deploy:prepare -- --target chs --api-url https://clc-schools.pockethost.io --release RELEASE
```

Replace RELEASE with the actual commit/tag. Integration tests require Python 3 and the local PocketBase binary (run npm start once to download, or set POCKETBASE_BINARY). They use disposable local databases and local SMTP only.

Each target produces a static `siteground/` folder and the **same common backend code** under `pockethost/`. Backend `/api/release` reports target `shared`; frontend `/release.json` reports its target/school_slug. All must agree on version and source_sha256. The shared fresh backend seeds sample data plus an empty Cherry Hill school/settings record; no Cherry Hill demo users or orders. Packaging never includes databases, passwords, private keys or environment files. Packages are immutable.

## Upgrade the existing sample instance

1. Create and download a **full PocketBase backup** before uploading. CSV is a useful data export but does not preserve passwords, schema and complete application state.
2. Plan a short maintenance window. The new auth rule requires a school header from the new frontend, so the old frontend cannot log in against the new backend.
3. Turn the instance off. Using the existing scoped SFTP key, upload **all** common pb_hooks and pb_migrations from one target package into the existing matching directories. Keep `local_email.pb.js`: it now contains the shared school email policy. Do not touch pb_data. Include all helper .js files.
4. Start the instance and check logs. The new forward migration preserves existing sample accounts, students, meals and settings, assigns the existing school slug `sample`, and adds an empty `chs` school with a private generated registration code and email disabled. The migration refuses ambiguous databases with more than one existing school; review manually rather than relabeling data.
5. Upload the sample frontend contents into its SiteGround public_html, directly at the document root. Include .htaccess; avoid an extra enclosing folder. Check HTTPS, frontend/backend manifests, admin/parent login and nested-route refreshes.
6. Before importing real data, test both school accounts against the hosted backend. A sample admin must see only sample records and a Cherry Hill admin only Cherry Hill records.

PocketHost SFTP: ftp.pockethost.io, port 2222, account email username, existing SSH key. No shell access is required. Never copy the sample database onto an old Cherry Hill installation.

## Provision Cherry Hill

In the PocketBase superuser dashboard:

1. Locate the school with slug `chs`. Its name is Cherry Hill Elementary, active=true, frontend_origin=`https://chs.cliffslunchclub.com`, email_enabled=false. Do not change the existing sample school identity.
2. Create the first real app admin in users: role=admin, active=true, verified=true, school=that CHS school, real name/email and a private strong password. This is separate from the PocketBase superuser account. Do not use demo credentials.
3. Log into the CHS frontend to set its registration code, semester dates and ordering days; populate/import grades, teachers, delivery times/rules, menus, students and orders. Existing Coderick CSV exports need review/mapping; they are not a complete database migration. Parent passwords will not be restored from CSV.
4. Recreate the CHS SiteGround subdomain/document root and upload the CHS frontend contents there. Enable HTTPS. Keep the old Coderick site until exports are reviewed and the replacement is tested; switch DNS only when ready.

## Enable outgoing Cherry Hill email

1. Configure SMTP in PocketBase Settings with the chosen mailbox/provider's host, port, encryption, username/password and verified sender. Enter secrets only in the provider dashboard, never GitHub. Set PocketBase's global application URL to the CHS frontend for other standard email templates.
2. Confirm the CHS school frontend_origin above, then set **only CHS email_enabled=true** as a PocketBase superuser. Sample user emails stay blocked even if their flag is changed.
3. Request a password reset for a real CHS test account from the CHS frontend. Check inbox/spam and the actual reset link: it must open `https://chs.cliffslunchclub.com/reset-password?token=...`. Finish reset and log in with the new password. PocketBase throttles repeated reset requests; use a fresh test account or wait before retrying.
4. Verify sample reset requests send no email, and that a reset request from the wrong school site has the same generic response without sending mail. Built-in verification/email-change/OTP/auth-alert user messages also obey the school email policy. No new meal-confirmation or scheduled notification feature is added.

Actual SMTP credentials and inbox delivery must be tested before inviting parents. Mail support in code does not configure a provider account.

## Enable batch operations for imports and purge

The combined CSV importer and Settings purge send PocketBase transactional batches of up to 40 record changes. Enable the Batch API once on the shared PocketBase instance before using either feature:

1. Sign in to the PocketBase superuser dashboard.
2. Open **Settings → Application → Batch API** and enable it.
3. Set **Max requests** to at least `40`. Keep the configured body-size and processing-time limits as low as the host allows; each request contains ordinary school records, not files.

Each batch is transactional. If a batch fails, that batch rolls back. Imports and purges use several batches for record dependencies, so earlier completed batches can remain saved. The import screen reports this and advises refreshing before retrying. Purge reports how many records were deleted in completed batches; refresh counts and inspect the selected records before trying again.

Menu CSV uploads are separate from roster/order imports. The Menu page downloads the menu template, previews additions and existing-item matches, and requires confirmation. Existing matches default to Keep Existing; updating a match is an explicit choice. Rows omitted from the file are left alone. Menu uploads use the same PocketBase Batch API setting.

## Automatic SiteGround frontend deployment

The GitHub Actions workflow at `.github/workflows/deploy-siteground.yml` tests and packages both frontends when code is pushed to `main`. It creates versioned Sample and Cherry Hill ZIPs as workflow artifacts, retained for 90 days. After setup, a successful frontend-only update can publish to both SiteGround document roots over FTPS. The workflow does not upload PocketBase hooks or migrations.

The generated `.htaccess` sets `Cache-Control: no-cache` by default so page requests revalidate and pick up new entry files. Fingerprinted JS and CSS files receive a one-year immutable cache lifetime; their filenames change when their contents change. SiteGround CDN honors these standard `Cache-Control` headers when enabled. When first introducing this policy, purge the CDN cache once to clear any entry page stored under the old policy. Already-open tabs still need to reload.

Before enabling production uploads:

1. In the repository, open **Settings → Environments** and create an environment named `production`.
2. Add these **environment secrets** using SiteGround FTP accounts scoped to the matching site's document root. Use the FTPS server name and credentials from Site Tools → Site → FTP Accounts:
   - `SAMPLE_SG_FTP_SERVER`, `SAMPLE_SG_FTP_USERNAME`, `SAMPLE_SG_FTP_PASSWORD`
   - `CHS_SG_FTP_SERVER`, `CHS_SG_FTP_USERNAME`, `CHS_SG_FTP_PASSWORD`
3. Add these **environment variables**:
   - `SAMPLE_SG_FTP_DIR`: Sample site's document root as seen by its FTP account, ending in `/`
   - `CHS_SG_FTP_DIR`: Cherry Hill site's document root as seen by its FTP account, ending in `/`
   - `SITEGROUND_FTP_PORT`: `21` (optional; this is the default)
4. Add the repository variable `ENABLE_SITEGROUND_DEPLOY` with value `true`.

The upload job is skipped until the repository variable is set. Never put FTP passwords in workflow files or share them in chat. Check that each account and remote directory point only to the intended site's document root before enabling the variable. The workflow checks that credentials and destination paths are present and requires FTPS certificate validation.

After setup, pushes to `main` that change app, deployment, or backend source run tests and create ZIP artifacts. Pushes that change PocketBase hooks or migrations skip automatic live frontend uploads; deploy those backend changes separately using the maintenance and backup steps above, then use **Actions → Build and deploy school sites → Run workflow** if the matching frontend packages should be published. The workflow only uploads static frontend files. It never changes DNS, PocketBase data, SMTP, hooks, or migrations.

## Updates and recovery

Test the backend locally first; a shared backend update affects both schools immediately. Back up the whole database and use maintenance for incompatible backend updates. For manual recovery, build both frontends from the same fixed commit, with the same backend URL and different target slugs; upload the common backend once, then upload both frontends. Verify release manifests and both school workflows.

Rollback only with compatible code/schema; for this isolation upgrade restore a full tested backup with its matching old hooks/frontends if necessary. Restoring a shared backup restores both schools and loses writes since that backup. Do not reverse the isolation migration or rerun historical migrations. Never deploy the sample seed scripts into the old Coderick database.

Rollback only with compatible code/schema; for this isolation upgrade restore a full tested backup with its matching old hooks/frontends if necessary. Restoring a shared backup restores both schools and loses writes since that backup. Do not reverse the isolation migration or rerun historical migrations. Never deploy the sample seed scripts into the old Coderick database.
