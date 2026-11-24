# Assess

A working assessment platform with a React/TypeScript/Vite frontend and an Express/TypeScript API. Data lives in SQLite through Prisma. The application starts empty; it contains no demo accounts, seeded assessments, or substitute backend data.

## Run locally

Use Node 22.12+ (Node 22 LTS recommended) and npm. Run from this directory:

```bash
npm ci
npm run setup
npm run db:migrate
npm run dev
```

Open **http://localhost:5173**. The API runs at **http://localhost:4000/api**. Development uses Vite's `/api` proxy; no client environment file is necessary. `npm run setup` creates `server/.env` with unique secrets and preserves an existing file.

Register a learner through **Create an account**. To register the administrator, use **disujt@gmail.com** and enter `ADMIN_REGISTRATION_SECRET` from your local `server/.env`. The field appears for that email. Choose your own name and password. There is no default password.

The admin key is deliberately required: without email verification, trusting an email string alone lets anyone claim the administrator account. The backend assigns the role; role fields sent by clients are ignored. Keep the registration key on the server and share it only with the administrator.

## Daily workflows

- **Admin:** Create a test, enter instructions and duration, add questions individually or paste a batch, preview, correct errors, and save. Check **Publish assessment** to make it available. Edit, unpublish, reorder, or delete tests from the library. Deletion preserves attempt history.
- **Learner:** Choose an available test and confirm starting it. Answers save after a short pause and on tab visibility changes. Navigate freely among questions. **Save & leave** saves first; the timer continues. Refresh or return from another browser session to resume using the original server deadline.
- **Submission:** **Review & submit** asks for confirmation and saves outstanding edits before submitting. An expired attempt is submitted using only the answers already saved on the server. Closing the browser does not stop expiry.
- **Grading:** Open a submission, review automatically awarded marks, grade essays and written questions without accepted answers, add per-question comments and overall feedback, then **Save grading** or **Release results**. Partial marks are supported for every type. Every question needs a mark before release.
- **Results:** Learners see their own answers immediately after submission. Scores, correct answers, grading guidelines, and comments remain private until release. Results include percentages, configured pass/fail outcomes, time spent, and feedback. A grading save without release also withholds previously released results.
- **People:** Search by name or email, open each person's attempt history to compare performance across tests, and disable/reactivate learner accounts. Disabled accounts are rejected on every authenticated request, including existing sessions.

## Bulk question format

```text
QUESTION: What is the capital of Nigeria?
TYPE: MCQ
A. Lagos
B. Abuja
C. Kano
D. Kaduna
ANSWER: B
POINTS: 5

QUESTION: Select all even numbers.
TYPE: MULTI
A. 2
B. 3
C. 4
ANSWER: A, C
POINTS: 5

QUESTION: Nigeria gained independence in 1960.
TYPE: TF
ANSWER: TRUE
POINTS: 2

QUESTION: Nigeria gained independence in which year?
TYPE: SHORT
ANSWER: 1960 | October 1960
POINTS: 5

QUESTION: Explain the importance of database indexing.
TYPE: ESSAY
GUIDELINES: Discuss read performance and the cost to writes and storage.
POINTS: 10
```

Use one line per field. Blank lines separate blocks for readability. `POINTS` defaults to 1. Supported types: `MCQ`, `MULTI` / `MULTIPLE_SELECT`, `TF` / `TRUE_FALSE`, `SHORT`, and `ESSAY`. Multiple selections use comma-separated option keys. Short-answer alternatives use `|`. Short answers trim leading/trailing whitespace and normalize repeated whitespace; matching ignores case unless configured otherwise. Multi-select grading requires the exact set of correct choices; admins can award partial credit during review. Essays and short answers without an answer key require manual grading.

Preview errors must be corrected in the text before adding the batch. Added questions can then be edited individually before saving the test. Only **Save draft** / **Save & publish** commits editor changes.

## Architecture

```text
client/src/
  api.ts, auth.tsx, types.ts   Typed API client and cookie-backed session state
  components/                 Shared navigation, forms, dialogs, tables
  pages/                      Auth, dashboards, tests, editor, exam, grading, people
server/src/
  app.ts, index.ts             Middleware and server lifecycle / expiration sweep
  auth.ts, config.ts           JWT verification, authorization, validated environment
  validation.ts               Runtime schemas and question invariants
  routes/                     Auth, tests, attempts, administration
  services/                   Bulk parsing, grading, snapshots, public projections
  db.ts                       Prisma data access
server/prisma/
  schema.prisma               Relational schema
  migrations/                 Versioned SQL migrations
server/test/                  Integration tests against a separate SQLite database
```

The relational entities are User, Test, Question, QuestionOption, TestAttempt, Answer, Grade, and Feedback. Foreign keys protect ownership and history. Unique constraints cover email, option keys, question positions, per-user attempt numbers, and per-attempt answers/grades. Indexes cover availability, user history, and expiration queries.

The brief requests both SQLite and PostgreSQL. This implementation chooses **SQLite**, following the explicit backend technology stack. It does not claim PostgreSQL compatibility without migration work. A move to PostgreSQL needs a provider change, regenerated migrations, data migration, and concurrency testing.

### Attempt integrity

Starting a test runs in a database transaction, verifies publication/availability and attempt limits, and snapshots the title, description, duration, pass mark, questions, options, answer keys, and grading guidelines. The deadline is the earlier of the duration limit and the test's availability end. Editing or removing a test cannot change an attempt's snapshot.

Answers, submission checks, grading, and grade releases run in database transactions. Client-supplied scores, roles, deadlines, and snapshot content are never trusted. Late saves and late manual submissions return HTTP 409. The automatic expiration path is the only path that finalizes overdue attempts, and cannot accept new answers.

The server sweeps every 10 seconds, on startup, and before relevant reads/start operations. During downtime, no answers can be saved; on restart, overdue attempts are finalized at their recorded deadline. The timer is a display of server time, not the authority. Browser clock changes cannot extend an attempt.

### Authentication and security

JWTs use HS256 with explicit issuer/audience verification and 12-hour lifetimes. They live in HttpOnly cookies, never localStorage. Production cookies are Secure with a `__Host-` prefix. All mutations require the exact configured `Origin`, including login and signup; command-line API clients must send that header. Helmet, strict CORS, bcrypt (cost 12), Zod validation, auth/API rate limits, and no-store API responses are enabled. Every session checks the current account state. Result responses are built using explicit projections, rather than serializing internal attempt records.

SQLite is intended for a **single API instance with a persistent disk**. WAL mode and a busy timeout are configured. Do not horizontally scale this configuration or store its database on an ephemeral filesystem. Back up the disk using SQLite's backup API or `sqlite3 /var/data/assessment.db '.backup /path/to/backup.db'`; use regular off-machine backups and verify restores.

## Configuration

Copy examples only when manually configuring a deployment; local setup generates a ready-to-use environment.

| Variable                    | Where        | Purpose                                                                                                  |
| --------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | API          | SQLite URI. Local: `file:./dev.db` (relative to `server/prisma`); Render: `file:/var/data/assessment.db` |
| `JWT_SECRET`                | API          | Independent random secret, at least 32 characters                                                        |
| `ADMIN_REGISTRATION_SECRET` | API          | Separate random secret, at least 20 characters; required to claim the reserved admin email               |
| `CLIENT_ORIGIN`             | API          | Exact frontend origin, no path; HTTPS required in production                                             |
| `PORT`                      | API          | Port, defaults to 4000; Render supplies this                                                             |
| `NODE_ENV`                  | API          | `development`, `test`, or `production`                                                                   |
| `TRUST_PROXY`               | API          | `true` behind Render's one trusted proxy; otherwise `false`                                              |
| `COOKIE_SAME_SITE`          | API          | `lax` locally / with same-site domains; `none` for cross-site deployment                                 |
| `VITE_API_URL`              | Client build | Full API base, including `/api`; empty uses the same-origin development proxy                            |

No real `.env`, database, credentials, or build output is committed. Rotating `JWT_SECRET` signs out all sessions. Frontend `VITE_` variables are public; never place secrets there.

## Deployment

Commit this entire folder as your repository root, including `package-lock.json`. Install and run workspace commands from the root. The Prisma migration CLI is a root dependency so security overrides apply consistently across npm workspaces.

### Render API

1. Create a Render Blueprint using `render.yaml`. The paid Starter instance and persistent disk are intentional; an ephemeral free service loses SQLite data.
2. Set `CLIENT_ORIGIN` to your actual Netlify frontend origin. The blueprint generates independent JWT/admin secrets and sets the database to the persistent mount.
3. Build: `npm ci --include=dev && npm run build -w server`.
4. Start: `npm run db:migrate -w server && npm start -w server`. Versioned migrations run before accepting requests; the wrapper initializes a new SQLite file before invoking Prisma.
5. Health check: `/api/health`. It checks database connectivity.
6. Retrieve the admin registration key from Render's environment panel and register your administrator through the frontend.

Do not run destructive `prisma migrate reset` in production. Maintain exactly one instance with this SQLite deployment.

### Netlify frontend

1. Import the same repository. `netlify.toml` sets the build, `client/dist` publish directory, SPA fallback, and security headers.
2. Set `VITE_API_URL=https://your-api.onrender.com/api` in Netlify before building.
3. Set the Render `CLIENT_ORIGIN` to the exact Netlify URL; set `COOKIE_SAME_SITE=none` for unrelated domains.
4. Build and deploy. Client routes such as `/tests/…/edit` fall back to `index.html`.

For manual drag-and-drop deployment, set `VITE_API_URL` in a local `client/.env` before running `npm run build -w client` from the workspace root, then upload the entire `client/dist` folder. `client/public/_redirects` is copied into `dist/_redirects` during the build so refreshing or opening a React route directly works without `netlify.toml`. Keep `_redirects` alongside `index.html` in the uploaded folder. Netlify dashboard environment variables do not modify JavaScript that was already built locally.

For reliable authentication in browsers that block third-party cookies, use same-site custom domains (for example, `assess.example.com` on Netlify and `api.example.com` on Render), set `COOKIE_SAME_SITE=lax`, and update both URL variables. Cross-site cookies on unrelated `netlify.app` / `onrender.com` domains can be blocked by browser privacy settings. Keep HTTPS enabled on both services. Narrow the Netlify CSP `connect-src` to your API origin if you want a stricter deployment policy.

Deployment files are supplied; no external deployment has been created by this task.

## Verification

```bash
npm run build
npm test
npm audit
```

`npm test` applies migrations to the dedicated ignored `server/prisma/test.db`, clears **only that database**, and exercises real HTTP requests against Express. Test safety assertions reject any other database URI. It covers admin enrollment, role injection, bcrypt hashing, authentication, origin protection, authorization, bulk parsing, publication, server deadlines, resumption, ownership, answer validation/persistence, snapshots, automatic grading, manual grading, release visibility, expiration, availability, account disabling, and preserved history.

The browser workflow was also exercised with Chromium against the real API: admin sign-in, creating/publishing a test through bulk preview, learner signup, taking a test, refresh persistence, submission, manual essay grading, result release, and mobile navigation/results. These browser checks use the isolated test database, not the real development database.

Prisma 6 is pinned for its established SQLite migration support. Patched `effect` and `deepmerge-ts` versions are overridden at the workspace root. Keep the lockfile and rerun builds, migrations, tests, and the audit when upgrading these tools. The versioned migration workflow follows [Prisma 6's deployment guidance](https://www.prisma.io/docs/orm/v6/prisma-client/deployment/deploy-database-changes-with-prisma-migrate).

## Scope and operations

This is a single-organization platform: published tests are available to every active registered learner. There is no email verification, password reset, invitation system, file attachment support, or proctoring. Backups, TLS, log retention, domain configuration, and production monitoring are deployment responsibilities. Review these operational settings with your real hosting environment before accepting high-stakes assessments.
