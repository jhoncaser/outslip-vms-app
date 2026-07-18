# Outslip VMS — Registration & Login Design

## Status

Covers the registration and login flows only. The broader system behavior
(what Creators/Approvers/Guards actually do once inside the app, how visitor
entries are logged, the approval workflow itself) is explicitly deferred —
the user will provide those details in a later design pass. This spec should
not be read as covering anything beyond account creation and sign-in.

## Overview

Outslip VMS ("Outslip Visitor Monitoring System") requires every user to
register before they can access the app. Registration is a 3-step wizard;
login is a single split-screen form. Both use a "Corporate Security" visual
style: navy (#0b2545) + white, sharp edges, shield motif.

## Roles

Selected at Step 1 of registration, from a fixed dropdown:

- Creator
- 1st Level Approver
- 2nd Level Approver
- 3rd Level Approver
- Guard Personnel

Note: this role list does not include a "Visitor" role — visitor handling is
part of the deferred system-behavior design and is out of scope here.

## Registration Wizard

Not publicly reachable. Only opens for a logged-in user who has the User
Provisioning permission (see Access Control below) — i.e. an authorized
Approver registering someone else, not a self-service signup flow.

**Step 1 — Select Role**
- Role (dropdown, fixed list above)

**Step 2 — Details**
- First Name, Middle Name, Last Name
- Department (dropdown: ICT, HROD, Accounting, Treasury, Admin — admin-manageable, see below)
- Business Unit (dropdown: Cawit, MSC, Talisayan, Prime, Delta, Alpha — admin-manageable)
- Location (dropdown: Zamboanga, Manila, Valenzuela, Batangas — admin-manageable)
- Email
- Password / Confirm Password

**Step 3 — Confirm**
- Read-only summary of Steps 1–2
- Submit Registration

### Access control

Two distinct permissions, gated on different combinations of Department and
Role:

**Reference data management (Department / Business Unit / Location)**
These three dropdowns are not hardcoded. They're backed by manageable
reference lists so new values can be added later without a code change.
Any user registered with Department = "Admin" gets permission to add new
Department, Business Unit, and Location values, regardless of their Step-1
role.

**User provisioning (registering new users)**
Only a user whose Department = "Admin" AND Role is one of "1st Level
Approver", "2nd Level Approver", or "3rd Level Approver" has access to
register new users in the app. This is a narrower gate than the
reference-data permission above — it requires both conditions together, not
Admin department alone. Admin-department users with Role = "Creator" or
"Guard Personnel" do NOT have this access, and non-Admin-department users
never have it regardless of role.

This implies user accounts are provisioned by this one gatekeeper role
rather than created via fully open public self-registration — see the open
question below about the login page's public "Register" link.

## Bootstrap / Seed Admin Account

Registration requires an existing user with the User Provisioning permission
(Department = Admin, Role = 1st/2nd/3rd Level Approver). Since that
permission can't exist until at least one such user does, the very first
account is created outside the wizard rather than via a new "Super Admin"
role.

- A seed script creates exactly one user directly in the database:
  Department = "Admin", Role = "1st Level Approver".
- Email and password come from environment variables (`SEED_ADMIN_EMAIL`,
  `SEED_ADMIN_PASSWORD`) read at seed time — never hardcoded in source or
  committed to the repo. `.env` holds the real values locally and is
  gitignored; `.env.example` documents the variable names with placeholder
  values.
- The seed script is idempotent: if a user with `SEED_ADMIN_EMAIL` already
  exists, it skips creation instead of erroring or duplicating.
- The seeded account (and every account created through the registration
  wizard) is flagged `mustChangePassword = true`. On first successful
  login, the user is routed to a mandatory change-password screen before
  reaching the rest of the app. This applies uniformly — not just to the
  seed account — since an Approver choosing someone else's initial
  password is the same trust situation as a temporary seed password.
- The same seed script also populates the initial Department, Business
  Unit, and Location reference data (the values shown in the Step 2
  mockup: ICT/HROD/Accounting/Treasury/Admin, Cawit/MSC/Talisayan/
  Prime/Delta/Alpha, Zamboanga/Manila/Valenzuela/Batangas) so the
  registration wizard's dropdowns are populated on a fresh database.

## Tech Stack

- **Framework:** Next.js (App Router, TypeScript) — serves both the UI
  (login, registration wizard) and the API routes from one codebase.
- **Database:** PostgreSQL, hosted on Neon.
- **ORM:** Prisma.
- **Auth:** Custom JWT session stored in an httpOnly cookie, verified via
  `jose` (Edge-runtime compatible, required for Next.js middleware).
  Password hashing via `bcryptjs` (pure JS — avoids native build tooling).
- **Validation:** Zod schemas for all API route input.
- **Styling:** Tailwind CSS, themed to the navy (#0b2545) / white
  "Corporate Security" palette from the mockups.
- **Testing:** Vitest + React Testing Library.

Hosting/deployment platform for the running app is still undecided and
out of scope for this plan — Neon is reachable from local dev via a
connection string, so no deployment decision blocks development.

## Login Page

Split-screen layout, same branding as registration (left navy panel with
logo + "Outslip Visitor Monitoring System" tagline, right white form panel).

Fields:
- Email
- Password
- "Forgot password?" link
- Sign In button

No public sign-up link — see User Provisioning below. Employees and Guard
Personnel authenticate with either their company or personal email — the
login form does not distinguish between the two; any valid registered email
works.

## Visual Design Reference

Style and layout were selected interactively via mockups (Corporate
Security visual style, split-screen shell for both pages, multi-step wizard
for registration). Final reviewed mockups:
`.superpowers/brainstorm/1218-1784345160/content/registration-final.html`
and `.../login-final.html`.

## Out of Scope (deferred by user)

- What each role can do once logged in
- The approval workflow across the 3 approver levels
- How visitors are registered/logged (no Visitor role exists in the current
  field list)
- Guard Personnel's in-app duties
- Hosting/deployment platform for the running app
- "Forgot password?" self-service reset flow (link is present in the UI
  per the mockup but is not wired to any backend flow yet — only the
  admin-forced change-on-first-login path is implemented)
