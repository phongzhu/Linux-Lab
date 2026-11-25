# Linux Simulation

A beginner friendly Linux command simulator with a React frontend and an Express API. Terminal commands run against a virtual filesystem and fictional training services; they never execute on the host computer.

## Install and run

```sh
npm install
npm --prefix frontend install
npm --prefix backend install
npm start
```

The root `npm start` command starts both the Express API and React app. The frontend development proxy forwards `/api` requests to `http://localhost:4000` so the browser session cookie works across the API calls. Press Ctrl+C to stop both.

## Supabase configuration

The existing root `.env.local` was moved to `frontend/.env.local`, where Create React App reads it. The backend also loads that same file in addition to `backend/.env`, supporting both the existing `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_PUBLISHABLE_KEY` names and the backend's `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` names. Environment files are ignored by Git. Do not use a service-role or secret key in the browser.

Apply the existing SQL migration in `supabase/migrations/` to the configured Supabase project. This is the one authoritative schema migration location and includes the saved progress, attempts, activity, and lesson catalog tables with row-level security.

Email signup uses a six-digit confirmation code. In Supabase, keep email confirmation enabled, set the email OTP length to 6, and update Authentication > Email Templates > Confirm signup with the subject in `supabase/templates/confirm-signup-subject.txt` and the HTML in `supabase/templates/confirm-signup.html`. Custom SMTP must be configured for Supabase Auth to deliver the message to users.

For Gmail SMTP, use `smtp.gmail.com` on port `465`, with the same Gmail address for the sender and SMTP username. The SMTP password must be a Google App Password, created after enabling 2-Step Verification. Disable the Supabase Send Email Auth Hook if switching from a Resend API integration to SMTP; an enabled hook takes over email delivery. Keep SMTP credentials out of the repository.

For a fresh project, also run `backend/database/seeds/001_training_lessons.sql` after the schema migration to populate the 15 lesson records. The seed file is generated from the curriculum and is data only; it is not another schema migration.

## Vercel deployment

The root `vercel.json` routes `/api/*` to Express and all other paths to React. In Vercel, keep the project root at `./` and the framework preset at **Services**. Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SESSION_SECRET`, and `DATABASE_URL` for Production and Preview. `DATABASE_URL` must be the Supabase **Transaction pooler** connection string for serverless use; it contains the database password, so keep it as a server-side Vercel variable and never use a `REACT_APP_` prefix.

Before deploying, apply `supabase/migrations/20261122132610_vercel_session_store.sql` to the configured Supabase project. Vercel's read-only function filesystem cannot store the SQLite sessions used for local development, so production uses the `public.linuxlab_sessions` Postgres table instead. The migration enables RLS and denies Data API roles access to session data. Redeploy after adding or changing Vercel environment variables.

## Project structure

- `frontend/src/components`, `pages`, `hooks`, `services`, `context`, and `styles` contain React UI, page-level CSS, frontend state behavior, and API calls.
- `frontend/public` contains the React app's static files.
- `backend/src/config`, `routes`, `controllers`, `services`, `middleware`, and `simulation` contain the Express API and server-side simulation.
- Backend services own Supabase queries and business logic; controllers only handle HTTP request/response mapping.
- `supabase/migrations/` owns Supabase schema changes. `backend/database/seeds/` contains lesson seed SQL and its generator. Local development uses SQLite for sessions; Vercel uses the protected Supabase Postgres session table.

The root `src/` folder has been removed: the React source now lives under `frontend/src/`. `backend/src/` is the Express source tree.

## Applied curriculum implementation

The original 15 Linux Fundamentals lessons remain unchanged. All 45 applied lessons now have implemented, scenario-backed behavior and task validation. Every lesson is independently startable without prerequisite gates.

B01 uses attempt-scoped fictional monitoring data and a dashboard workspace. B02 uses attempt-scoped alarm datapoints, notice records, service evidence and an incident report editor. The training `incident` actions calculate alarm state from the configured datapoints and missing-data policy, group notices by incident ID, derive a sorted evidence timeline, and produce CSV from the saved report fields. None of these actions call a cloud monitoring service.

B03 uses an attempt-scoped request trace, ordered route behaviors, DNS/TLS/proxy records, and a controlled restart timeline. Trace gaps remain gaps, behavior selection follows the configured order, the training repair changes only that attempt's route, and a QR response does not imply cash-in completion.

B04 uses attempt-scoped vulnerability records, one raw authentication event with separately extracted decoder/rule fields, and a filtered sign-in timeline. Partial scan coverage remains visible; findings do not establish exploitation, and sign-in assessments retain confidence and follow-up rather than automatically labeling an account compromised.

B05 uses attempt-scoped image/configuration layers, a prepared ECS request batch and partner rate ceiling, plus rollout, health, log, metric and event-rule records. Publishing an image does not rewrite running tasks; request counts derive from IDs in the supplied arrays; incomplete rollout adoption remains visible.

A04.3 includes the constrained training views `openssl s_client -connect api.training.test:443 -servername api.training.test` and `waf inspect`. They expose fictional certificate and WAF evidence; whether the proxy-forwarded address is trusted remains unconfirmed by design.

## Verify

```sh
npm run build
npm test
npm run test:backend
```
