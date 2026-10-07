-- Required by the better-auth `anonymous` plugin (anonymous sign-in on the login page).
-- Run once on the production Postgres database.
alter table "user" add column if not exists "isAnonymous" boolean;
