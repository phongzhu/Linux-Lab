# Linux Simulation

A beginner friendly Linux command simulator with a React frontend and an Express API. Terminal commands run against a virtual filesystem and fictional training services; they never execute on the host computer.

## Install and run

```sh
npm --prefix frontend install
npm --prefix backend install
npm start
```

In a second terminal, start the API:

```sh
npm run dev:backend
```

The root `npm start` command delegates to the React app in `frontend/`. Its development proxy forwards `/api` requests to `http://localhost:4000` so the browser session cookie works across the API calls.

## Supabase configuration

The existing root `.env.local` was moved to `frontend/.env.local`, where Create React App reads it. The backend also loads that same file in addition to `backend/.env`, supporting both the existing `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_PUBLISHABLE_KEY` names and the backend's `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` names. Environment files are ignored by Git. Do not use a service-role or secret key in the browser.

Apply the existing SQL migration in `supabase/migrations/` to the configured Supabase project. This is the one authoritative schema migration location and includes the saved progress, attempts, activity, and lesson catalog tables with row-level security.

Email signup uses a six-digit confirmation code. In Supabase, keep email confirmation enabled, set the email OTP length to 6, and update Authentication > Email Templates > Confirm signup with the subject in `supabase/templates/confirm-signup-subject.txt` and the HTML in `supabase/templates/confirm-signup.html`. Custom SMTP must be configured for Supabase Auth to deliver the message to users.

For Gmail SMTP, use `smtp.gmail.com` on port `465`, with the same Gmail address for the sender and SMTP username. The SMTP password must be a Google App Password, created after enabling 2-Step Verification. Disable the Supabase Send Email Auth Hook if switching from a Resend API integration to SMTP; an enabled hook takes over email delivery. Keep SMTP credentials out of the repository.

For a fresh project, also run `backend/database/seeds/001_training_lessons.sql` after the schema migration to populate the 15 lesson records. The seed file is generated from the curriculum and is data only; it is not another schema migration.

## Project structure

- `frontend/src/components`, `pages`, `hooks`, `services`, `context`, and `styles` contain React UI, page-level CSS, frontend state behavior, and API calls.
- `frontend/public` contains the React app's static files.
- `backend/src/config`, `routes`, `controllers`, `services`, `middleware`, and `simulation` contain the Express API and server-side simulation.
- Backend services own Supabase queries and business logic; controllers only handle HTTP request/response mapping.
- `supabase/migrations/` owns Supabase schema changes. `backend/database/seeds/` contains lesson seed SQL and its generator, while `backend/database/` also stores the runtime SQLite session file.

The root `src/` folder has been removed: the React source now lives under `frontend/src/`. `backend/src/` is the Express source tree.

## Verify

```sh
npm run build
npm test
npm run test:backend
```
