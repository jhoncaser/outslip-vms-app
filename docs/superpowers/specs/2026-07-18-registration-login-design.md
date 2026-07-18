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

### Reference data management (Department / Business Unit / Location)

These three dropdowns are not hardcoded. They're backed by manageable
reference lists so new values can be added later without a code change.

Any user registered with Department = "Admin" gets permission to add new
Department, Business Unit, and Location values. This is a role-adjacent
permission tied to department membership, not to the Step-1 role dropdown —
an Admin-department Creator and an Admin-department Approver would both have
it.

## Login Page

Split-screen layout, same branding as registration (left navy panel with
logo + "Outslip Visitor Monitoring System" tagline, right white form panel).

Fields:
- Email
- Password
- "Forgot password?" link
- Sign In button
- "Don't have an account? Register" link to the wizard

Employees and Guard Personnel authenticate with either their company or
personal email — the login form does not distinguish between the two; any
valid registered email works.

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
- Tech stack (frontend framework, backend, database, hosting)
- Password reset flow implementation
- Session/auth mechanism (JWT, cookies, etc.)
