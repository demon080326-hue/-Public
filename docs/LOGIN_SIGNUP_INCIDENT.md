# Production Login / Signup Incident

## Incident

Production `/login` remained available and all login, registration, and password recovery controls were interactive. Browser checks found no JavaScript runtime or hydration errors.

Supabase Auth accepted the owner password login with HTTP 200, but `/api/auth/login` returned HTTP 503 and immediately signed the new session out. The request did not reach the `record_login_success` RPC, which showed that the server-side security recording client was unavailable before the database call.

## Fix

- The server-only Supabase admin client accepts either the current `SUPABASE_SECRET_KEY` name or the legacy `SUPABASE_SERVICE_ROLE_KEY` name.
- No environment variable value is logged or returned.
- If the administrative security write is unavailable, login may continue only when the authenticated user can read an existing security row showing all of the following:
  - `failed_login_count = 0`
  - `requires_reverification = false`
  - `locked_until is null`
- Missing, unreadable, locked, or reverification-required states remain fail-closed and the session is signed out.

This fallback does not grant member, admin, or owner roles. Existing middleware, profile roles, admin access checks, and database RLS remain unchanged.

## Signup Finding

The registration form submits successfully and Supabase Auth returns HTTP 200. Delivery to an email address other than the Resend account address is still limited by the unverified Resend sending domain. This is an email-delivery acceptance item for Stage 7 B-4, not a broken registration form.

## Verification

- `/login` returns HTTP 200.
- Login, registration, and forgot-password modes can be selected.
- Email and password controls are enabled.
- Supabase Auth logs distinguish successful password authentication from the application security-layer failure.
- Build, TypeScript, lint, Production deployment, and owner login are rechecked after this fix.

## Protected Systems

This incident fix does not change Supabase schema or data, owner role, points/tier tables, AI news collection, GitHub Actions, SMTP, Resend configuration, Vercel environment variables, or local environment files.
