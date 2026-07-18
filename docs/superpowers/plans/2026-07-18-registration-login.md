# Registration & Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the registration wizard and login flow described in
`docs/superpowers/specs/2026-07-18-registration-login-design.md`, including
the seed/bootstrap admin account, so that the very first user can log in,
change their temporary password, and register the next user through the
in-app wizard.

**Architecture:** Next.js App Router serves both UI and API routes from one
codebase. Prisma talks to a Neon Postgres database. Auth is a signed JWT
in an httpOnly cookie (verified with `jose`, which runs in the Edge
runtime Next.js middleware uses); passwords are hashed with `bcryptjs`.
Session claims (email, role, department, mustChangePassword) are embedded
in the JWT itself, so middleware and route handlers never need a database
round-trip just to authorize a request — only to look up or write user
rows.

**Tech Stack:** Next.js (App Router, TypeScript), PostgreSQL via Neon,
Prisma, `jose`, `bcryptjs`, `zod`, Tailwind CSS, Vitest + React Testing
Library.

## Global Constraints

- Corporate Security visual style: navy (`#0b2545`) + white, sharp edges
  (no rounded pill shapes beyond the mockups' 4-8px radii), shield motif.
- Registration wizard fields exactly as specified: Step 1 Role; Step 2
  First/Middle/Last Name, Department, Business Unit, Location, Email,
  Password, Confirm Password; Step 3 read-only summary + submit.
- Role is a fixed list: Creator, 1st Level Approver, 2nd Level Approver,
  3rd Level Approver, Guard Personnel. Not admin-manageable.
- Department, Business Unit, and Location are admin-manageable reference
  lists, not hardcoded — backed by database tables.
- Reference-data permission: any user with Department = "Admin" (any
  role) can add new Department/Business Unit/Location values.
- User-provisioning permission: only Department = "Admin" AND Role in
  {1st, 2nd, 3rd Level Approver} can register new users. Admin-department
  Creators/Guards do not have this access; non-Admin users never do.
- No public sign-up route. The registration wizard is only reachable by
  an authenticated user with the provisioning permission.
- Every account — the seed account and every wizard-created account —
  starts with `mustChangePassword = true`.
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` are read from environment
  variables at seed time only; never hardcoded in source or committed.
- Login accepts any valid registered email (company or personal) — no
  distinction in the form.

---

## File Structure

```
prisma/
  schema.prisma
  seed.ts

lib/
  prisma.ts
  auth/
    password.ts
    password.test.ts
    session.ts
    session.test.ts
    permissions.ts
    permissions.test.ts
    routeGuard.ts
    routeGuard.test.ts
  validation/
    auth.ts
    auth.test.ts
    registration.ts
    registration.test.ts
    referenceData.ts
    referenceData.test.ts

middleware.ts

app/
  login/
    page.tsx
    LoginForm.tsx
    LoginForm.test.tsx
  change-password/
    page.tsx
    ChangePasswordForm.tsx
    ChangePasswordForm.test.tsx
  dashboard/
    page.tsx
  register/
    page.tsx
    RegistrationWizard.tsx
    RegistrationWizard.test.tsx
  api/
    auth/
      login/route.ts
      login/route.test.ts
      logout/route.ts
      logout/route.test.ts
      change-password/route.ts
      change-password/route.test.ts
    register/route.ts
    register/route.test.ts
    reference-data/route.ts
    reference-data/route.test.ts

vitest.config.ts
vitest.setup.ts
.env.example
```

Each `lib/` file has one responsibility (hashing, session tokens,
permission checks, redirect logic, validation) so route handlers and
pages stay thin — they call these, they don't reimplement them. Route
handlers and pages that use the same logic (e.g., both the wizard and
the API validate registration input) share the single `lib/validation`
schema rather than duplicating rules.

---

### Task 1: Project scaffolding & tooling

**Files:**
- Create: entire Next.js project via `create-next-app` (package.json,
  tsconfig.json, app/layout.tsx, app/page.tsx, app/globals.css,
  tailwind.config.ts, postcss.config.js, next.config.ts, .eslintrc.json)
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Produces: a working `npm run dev` and `npm test` command that every
  later task relies on.

- [ ] **Step 1: Scaffold the Next.js app**

Run from the project root (`c:\Users\CDT\Desktop\Personal Project`):

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
```

When prompted about the directory not being empty, choose to continue —
`README.md`, `docs/`, `.git/`, `.claude/`, and `.superpowers/` do not
conflict with anything `create-next-app` generates.

- [ ] **Step 2: Verify existing files were untouched**

```bash
git status
```

Expected: `README.md`, `docs/` are NOT listed as modified or deleted;
new files like `package.json`, `app/`, `public/`, `tailwind.config.ts`
appear as untracked.

- [ ] **Step 3: Install runtime and dev dependencies**

```bash
npm install @prisma/client bcryptjs jose zod
npm install -D prisma @types/bcryptjs vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom tsx
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

Create `vitest.setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Add test scripts to package.json**

Edit `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Write and run a smoke test**

Create `lib/smoke.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("vitest setup", () => {
  it("runs a basic assertion", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npx vitest run lib/smoke.test.ts`
Expected: PASS, 1 test.

Delete `lib/smoke.test.ts` — it was only to confirm the runner works.

- [ ] **Step 7: Set up environment variable files**

Create `.env.example`:

```
DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=require"
JWT_SECRET="replace-with-a-long-random-string"
SEED_ADMIN_EMAIL="admin@example.com"
SEED_ADMIN_PASSWORD="replace-with-a-strong-temporary-password"
```

Create `.env` locally (not committed) with your real Neon connection
string and a real secret/password — this file is for your own machine,
skip this step in the plan's git history.

Confirm `.gitignore` (created by `create-next-app`) already ignores
`.env*.local`. Add a plain `.env` line since we're using bare `.env`,
not `.env.local`:

Edit `.gitignore`, add:

```
.env
```

- [ ] **Step 8: Verify dev server boots**

```bash
npm run dev
```

Expected: server starts on `http://localhost:3000` with the default
Next.js starter page. Stop the server (Ctrl+C) once confirmed.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts tailwind.config.ts postcss.config.js .eslintrc.json app vitest.config.ts vitest.setup.ts .env.example .gitignore
git commit -m "Scaffold Next.js app with Tailwind, Prisma client, and Vitest"
```

---

### Task 2: Prisma schema + Neon migration

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/prisma.ts`
- Test: `lib/prisma.test.ts`

**Interfaces:**
- Produces: `PrismaClient` singleton exported as `prisma` from
  `lib/prisma.ts`; `Role` enum (`CREATOR`, `FIRST_APPROVER`,
  `SECOND_APPROVER`, `THIRD_APPROVER`, `GUARD_PERSONNEL`); `User`,
  `Department`, `BusinessUnit`, `Location` models — all later tasks
  read/write through these.

- [ ] **Step 1: Write the Prisma schema**

Create `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  CREATOR
  FIRST_APPROVER
  SECOND_APPROVER
  THIRD_APPROVER
  GUARD_PERSONNEL
}

model Department {
  id    String @id @default(cuid())
  name  String @unique
  users User[]
}

model BusinessUnit {
  id    String @id @default(cuid())
  name  String @unique
  users User[]
}

model Location {
  id    String @id @default(cuid())
  name  String @unique
  users User[]
}

model User {
  id                 String   @id @default(cuid())
  firstName          String
  middleName         String?
  lastName           String
  email              String   @unique
  passwordHash       String
  role               Role
  mustChangePassword Boolean  @default(true)
  createdAt          DateTime @default(now())

  department   Department @relation(fields: [departmentId], references: [id])
  departmentId String

  businessUnit   BusinessUnit @relation(fields: [businessUnitId], references: [id])
  businessUnitId String

  location   Location @relation(fields: [locationId], references: [id])
  locationId String
}
```

- [ ] **Step 2: Point DATABASE_URL at your Neon database**

Confirm `.env` has a real Neon connection string in `DATABASE_URL`
(from the Neon dashboard's "Connection Details", pooled connection,
`?sslmode=require`).

- [ ] **Step 3: Run the initial migration**

```bash
npx prisma migrate dev --name init
```

Expected: Prisma creates the `Department`, `BusinessUnit`, `Location`,
and `User` tables in your Neon database and generates the Prisma
Client into `node_modules/@prisma/client`.

- [ ] **Step 4: Create the Prisma client singleton**

Create `lib/prisma.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 5: Write an integration test confirming the connection works**

Create `lib/prisma.test.ts`:

```typescript
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "./prisma";

describe("prisma connection", () => {
  it("can query the Department table", async () => {
    const count = await prisma.department.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
```

Run: `npx vitest run lib/prisma.test.ts`
Expected: PASS — confirms Neon is reachable and the schema is applied.

- [ ] **Step 6: Commit**

```bash
git add prisma lib/prisma.ts lib/prisma.test.ts
git commit -m "Add Prisma schema and Neon-backed client singleton"
```

---

### Task 3: Seed script — reference data + bootstrap admin account

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add `prisma.seed` config)
- Test: `prisma/seed.test.ts`

**Interfaces:**
- Consumes: `prisma` from `lib/prisma.ts`; `hashPassword` will exist
  after Task 4 — this task writes its own local hashing call inline
  first, then Task 4's step 6 will note the seed script already covers
  hashing, so no change needed there. (To avoid a forward dependency,
  this task hashes directly with `bcryptjs` rather than importing from
  `lib/auth/password.ts`.)
- Produces: idempotent `main()` function exported from `prisma/seed.ts`
  for the test to call directly.

- [ ] **Step 1: Write the seed script**

Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEPARTMENTS = ["ICT", "HROD", "Accounting", "Treasury", "Admin"];
const BUSINESS_UNITS = ["Cawit", "MSC", "Talisayan", "Prime", "Delta", "Alpha"];
const LOCATIONS = ["Zamboanga", "Manila", "Valenzuela", "Batangas"];

async function seedReferenceData() {
  for (const name of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  for (const name of BUSINESS_UNITS) {
    await prisma.businessUnit.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  for (const name of LOCATIONS) {
    await prisma.location.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in the environment to seed the bootstrap admin account."
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return;
  }

  const adminDepartment = await prisma.department.findUniqueOrThrow({
    where: { name: "Admin" },
  });
  const defaultBusinessUnit = await prisma.businessUnit.findUniqueOrThrow({
    where: { name: BUSINESS_UNITS[0] },
  });
  const defaultLocation = await prisma.location.findUniqueOrThrow({
    where: { name: LOCATIONS[0] },
  });

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      firstName: "Super",
      lastName: "Admin",
      email,
      passwordHash,
      role: "FIRST_APPROVER",
      departmentId: adminDepartment.id,
      businessUnitId: defaultBusinessUnit.id,
      locationId: defaultLocation.id,
      mustChangePassword: true,
    },
  });
}

export async function main() {
  await seedReferenceData();
  await seedAdmin();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Wire up `prisma db seed`**

Edit `package.json`, add a top-level key (sibling of `"scripts"`):

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 3: Run the seed script**

Ensure `.env` has `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` set, then:

```bash
npx prisma db seed
```

Expected: completes without error.

- [ ] **Step 4: Write a test for idempotency and correctness**

Create `prisma/seed.test.ts`:

```typescript
import { describe, it, expect, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { main } from "./seed";

describe("seed script", () => {
  it("creates the bootstrap admin with Admin department and FIRST_APPROVER role", async () => {
    await main();

    const email = process.env.SEED_ADMIN_EMAIL!;
    const admin = await prisma.user.findUnique({
      where: { email },
      include: { department: true },
    });

    expect(admin).not.toBeNull();
    expect(admin!.department.name).toBe("Admin");
    expect(admin!.role).toBe("FIRST_APPROVER");
    expect(admin!.mustChangePassword).toBe(true);

    const passwordMatches = await bcrypt.compare(
      process.env.SEED_ADMIN_PASSWORD!,
      admin!.passwordHash
    );
    expect(passwordMatches).toBe(true);
  });

  it("does not duplicate the admin user when run twice", async () => {
    await main();
    await main();

    const email = process.env.SEED_ADMIN_EMAIL!;
    const admins = await prisma.user.findMany({ where: { email } });
    expect(admins).toHaveLength(1);
  });

  it("seeds all reference data values from the spec", async () => {
    await main();

    const departments = await prisma.department.findMany();
    const businessUnits = await prisma.businessUnit.findMany();
    const locations = await prisma.location.findMany();

    expect(departments.map((d) => d.name).sort()).toEqual(
      ["Accounting", "Admin", "HROD", "ICT", "Treasury"].sort()
    );
    expect(businessUnits.map((b) => b.name).sort()).toEqual(
      ["Alpha", "Cawit", "Delta", "MSC", "Prime", "Talisayan"].sort()
    );
    expect(locations.map((l) => l.name).sort()).toEqual(
      ["Batangas", "Manila", "Valenzuela", "Zamboanga"].sort()
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
```

Run: `npx vitest run prisma/seed.test.ts`
Expected: PASS, 3 tests. (These tests run against your real Neon dev
database — that's intentional for this project's scale; no separate
test database is set up.)

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts prisma/seed.test.ts package.json
git commit -m "Add seed script for reference data and bootstrap admin account"
```

---

### Task 4: Password hashing utility

**Files:**
- Create: `lib/auth/password.ts`
- Test: `lib/auth/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`,
  `verifyPassword(plain: string, hash: string): Promise<boolean>` — used
  by the login route (Task 9), change-password route (Task 11), and
  register route (Task 13).

- [ ] **Step 1: Write the failing test**

Create `lib/auth/password.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hashes a password to something other than the plain value", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(hash).not.toBe("correct-horse-battery-staple");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    const result = await verifyPassword("correct-horse-battery-staple", hash);
    expect(result).toBe(true);
  });

  it("rejects an incorrect password against a hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    const result = await verifyPassword("wrong-password", hash);
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/auth/password.test.ts`
Expected: FAIL — `./password` module does not exist yet.

- [ ] **Step 3: Implement**

Create `lib/auth/password.ts`:

```typescript
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/auth/password.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/password.ts lib/auth/password.test.ts
git commit -m "Add password hashing utility"
```

---

### Task 5: Session JWT utility

**Files:**
- Create: `lib/auth/session.ts`
- Test: `lib/auth/session.test.ts`

**Interfaces:**
- Consumes: `process.env.JWT_SECRET`.
- Produces: `SessionPayload` type `{ sub: string; email: string;
  firstName: string; lastName: string; role: Role; department: string;
  mustChangePassword: boolean }`; `createSessionToken(payload:
  SessionPayload): Promise<string>`; `verifySessionToken(token: string):
  Promise<SessionPayload | null>` (returns `null` instead of throwing on
  an invalid/expired/tampered token); `SESSION_COOKIE_NAME = "session"`.
  Used by the login route (Task 9), change-password route (Task 11),
  route guard (Task 8), and every protected route/page.

- [ ] **Step 1: Write the failing test**

Create `lib/auth/session.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
} from "./session";

const samplePayload = {
  sub: "user_123",
  email: "juan@company.com",
  firstName: "Juan",
  lastName: "Dela Cruz",
  role: "FIRST_APPROVER" as const,
  department: "Admin",
  mustChangePassword: false,
};

describe("session tokens", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
  });

  it("round-trips a payload through create and verify", async () => {
    const token = await createSessionToken(samplePayload);
    const verified = await verifySessionToken(token);

    expect(verified).not.toBeNull();
    expect(verified!.sub).toBe(samplePayload.sub);
    expect(verified!.email).toBe(samplePayload.email);
    expect(verified!.role).toBe(samplePayload.role);
    expect(verified!.department).toBe(samplePayload.department);
    expect(verified!.mustChangePassword).toBe(false);
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken(samplePayload);
    const tampered = token.slice(0, -2) + "xx";
    const verified = await verifySessionToken(tampered);
    expect(verified).toBeNull();
  });

  it("rejects garbage input instead of throwing", async () => {
    const verified = await verifySessionToken("not-a-real-token");
    expect(verified).toBeNull();
  });

  it("exposes a fixed cookie name", () => {
    expect(SESSION_COOKIE_NAME).toBe("session");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/auth/session.test.ts`
Expected: FAIL — `./session` module does not exist yet.

- [ ] **Step 3: Implement**

Create `lib/auth/session.ts`:

```typescript
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE_NAME = "session";
const SESSION_DURATION = "7d";

export interface SessionPayload {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  department: string;
  mustChangePassword: boolean;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  payload: SessionPayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      firstName: payload.firstName as string,
      lastName: payload.lastName as string,
      role: payload.role as Role,
      department: payload.department as string,
      mustChangePassword: payload.mustChangePassword as boolean,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/auth/session.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/session.ts lib/auth/session.test.ts
git commit -m "Add JWT session token creation and verification"
```

---

### Task 6: Permission helpers

**Files:**
- Create: `lib/auth/permissions.ts`
- Test: `lib/auth/permissions.test.ts`

**Interfaces:**
- Consumes: `Role` from `@prisma/client`.
- Produces: `AuthorizedUser = { department: string; role: Role }`;
  `canManageReferenceData(user: AuthorizedUser): boolean`;
  `canProvisionUsers(user: AuthorizedUser): boolean` — used by the
  register route/page (Tasks 13-14) and reference-data route (Task 12).

- [ ] **Step 1: Write the failing test**

Create `lib/auth/permissions.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { canManageReferenceData, canProvisionUsers } from "./permissions";

describe("canManageReferenceData", () => {
  it("allows any Admin-department user regardless of role", () => {
    expect(
      canManageReferenceData({ department: "Admin", role: "CREATOR" })
    ).toBe(true);
    expect(
      canManageReferenceData({ department: "Admin", role: "GUARD_PERSONNEL" })
    ).toBe(true);
  });

  it("denies non-Admin-department users", () => {
    expect(
      canManageReferenceData({ department: "ICT", role: "FIRST_APPROVER" })
    ).toBe(false);
  });
});

describe("canProvisionUsers", () => {
  it("allows Admin department with an approver role", () => {
    expect(
      canProvisionUsers({ department: "Admin", role: "FIRST_APPROVER" })
    ).toBe(true);
    expect(
      canProvisionUsers({ department: "Admin", role: "SECOND_APPROVER" })
    ).toBe(true);
    expect(
      canProvisionUsers({ department: "Admin", role: "THIRD_APPROVER" })
    ).toBe(true);
  });

  it("denies Admin department with Creator or Guard Personnel role", () => {
    expect(canProvisionUsers({ department: "Admin", role: "CREATOR" })).toBe(
      false
    );
    expect(
      canProvisionUsers({ department: "Admin", role: "GUARD_PERSONNEL" })
    ).toBe(false);
  });

  it("denies non-Admin-department users even with an approver role", () => {
    expect(
      canProvisionUsers({ department: "ICT", role: "FIRST_APPROVER" })
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/auth/permissions.test.ts`
Expected: FAIL — `./permissions` module does not exist yet.

- [ ] **Step 3: Implement**

Create `lib/auth/permissions.ts`:

```typescript
import type { Role } from "@prisma/client";

export interface AuthorizedUser {
  department: string;
  role: Role;
}

const PROVISIONING_ROLES: Role[] = [
  "FIRST_APPROVER",
  "SECOND_APPROVER",
  "THIRD_APPROVER",
];

export function canManageReferenceData(user: AuthorizedUser): boolean {
  return user.department === "Admin";
}

export function canProvisionUsers(user: AuthorizedUser): boolean {
  return (
    user.department === "Admin" && PROVISIONING_ROLES.includes(user.role)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/auth/permissions.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/permissions.ts lib/auth/permissions.test.ts
git commit -m "Add reference-data and user-provisioning permission checks"
```

---

### Task 7: Validation schemas

**Files:**
- Create: `lib/validation/auth.ts`
- Test: `lib/validation/auth.test.ts`
- Create: `lib/validation/registration.ts`
- Test: `lib/validation/registration.test.ts`
- Create: `lib/validation/referenceData.ts`
- Test: `lib/validation/referenceData.test.ts`

**Interfaces:**
- Produces: `loginSchema`, `changePasswordSchema`, `registrationSchema`,
  `referenceDataSchema` (all Zod schemas) — consumed by the
  corresponding API routes in Tasks 9, 11, 12, 13.

- [ ] **Step 1: Write the failing tests**

Create `lib/validation/auth.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { loginSchema, changePasswordSchema } from "./auth";

describe("loginSchema", () => {
  it("accepts a valid email and non-empty password", () => {
    const result = loginSchema.safeParse({
      email: "juan@company.com",
      password: "anything",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "anything",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      email: "juan@company.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("accepts matching passwords of at least 8 characters", () => {
    const result = changePasswordSchema.safeParse({
      newPassword: "newpassword123",
      confirmPassword: "newpassword123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = changePasswordSchema.safeParse({
      newPassword: "newpassword123",
      confirmPassword: "different123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects passwords shorter than 8 characters", () => {
    const result = changePasswordSchema.safeParse({
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });
});
```

Create `lib/validation/registration.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { registrationSchema } from "./registration";

const validPayload = {
  role: "CREATOR",
  firstName: "Juan",
  middleName: "",
  lastName: "Dela Cruz",
  departmentId: "dept_123",
  businessUnitId: "bu_123",
  locationId: "loc_123",
  email: "juan.delacruz@company.com",
  password: "supersecure1",
  confirmPassword: "supersecure1",
};

describe("registrationSchema", () => {
  it("accepts a fully valid payload", () => {
    const result = registrationSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("allows middleName to be omitted", () => {
    const { middleName, ...rest } = validPayload;
    const result = registrationSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid role", () => {
    const result = registrationSchema.safeParse({
      ...validPayload,
      role: "SUPER_ADMIN",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched password/confirmPassword", () => {
    const result = registrationSchema.safeParse({
      ...validPayload,
      confirmPassword: "different1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing lastName", () => {
    const { lastName, ...rest } = validPayload;
    const result = registrationSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
```

Create `lib/validation/referenceData.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { referenceDataSchema } from "./referenceData";

describe("referenceDataSchema", () => {
  it("accepts a valid department addition", () => {
    const result = referenceDataSchema.safeParse({
      type: "department",
      name: "Legal",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid type", () => {
    const result = referenceDataSchema.safeParse({
      type: "role",
      name: "Legal",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = referenceDataSchema.safeParse({
      type: "location",
      name: "",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/validation`
Expected: FAIL — none of the three modules exist yet.

- [ ] **Step 3: Implement**

Create `lib/validation/auth.ts`:

```typescript
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const changePasswordSchema = z
  .object({
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
```

Create `lib/validation/registration.ts`:

```typescript
import { z } from "zod";

export const registrationSchema = z
  .object({
    role: z.enum([
      "CREATOR",
      "FIRST_APPROVER",
      "SECOND_APPROVER",
      "THIRD_APPROVER",
      "GUARD_PERSONNEL",
    ]),
    firstName: z.string().min(1),
    middleName: z.string().optional(),
    lastName: z.string().min(1),
    departmentId: z.string().min(1),
    businessUnitId: z.string().min(1),
    locationId: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
```

Create `lib/validation/referenceData.ts`:

```typescript
import { z } from "zod";

export const referenceDataSchema = z.object({
  type: z.enum(["department", "businessUnit", "location"]),
  name: z.string().min(1),
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/validation`
Expected: PASS, 11 tests across 3 files.

- [ ] **Step 5: Commit**

```bash
git add lib/validation
git commit -m "Add Zod validation schemas for auth, registration, and reference data"
```

---

### Task 8: Route guard logic + middleware

**Files:**
- Create: `lib/auth/routeGuard.ts`
- Test: `lib/auth/routeGuard.test.ts`
- Create: `middleware.ts`

**Interfaces:**
- Consumes: `SessionPayload` from `lib/auth/session.ts`.
- Produces: `resolveRedirect(input: { pathname: string; session:
  SessionPayload | null }): string | null` (returns a path to redirect
  to, or `null` to allow the request through) — this pure function is
  what `middleware.ts` wires up to real cookies/requests, and it's what
  the test suite exercises directly.

- [ ] **Step 1: Write the failing test**

Create `lib/auth/routeGuard.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveRedirect } from "./routeGuard";
import type { SessionPayload } from "./session";

const activeSession: SessionPayload = {
  sub: "user_1",
  email: "juan@company.com",
  firstName: "Juan",
  lastName: "Dela Cruz",
  role: "FIRST_APPROVER",
  department: "Admin",
  mustChangePassword: false,
};

const mustChangeSession: SessionPayload = {
  ...activeSession,
  mustChangePassword: true,
};

describe("resolveRedirect", () => {
  it("allows unauthenticated access to /login", () => {
    expect(resolveRedirect({ pathname: "/login", session: null })).toBeNull();
  });

  it("redirects unauthenticated users away from protected pages to /login", () => {
    expect(resolveRedirect({ pathname: "/dashboard", session: null })).toBe(
      "/login"
    );
    expect(resolveRedirect({ pathname: "/register", session: null })).toBe(
      "/login"
    );
  });

  it("redirects authenticated users away from /login to /dashboard", () => {
    expect(
      resolveRedirect({ pathname: "/login", session: activeSession })
    ).toBe("/dashboard");
  });

  it("forces users with mustChangePassword to /change-password", () => {
    expect(
      resolveRedirect({ pathname: "/dashboard", session: mustChangeSession })
    ).toBe("/change-password");
    expect(
      resolveRedirect({ pathname: "/register", session: mustChangeSession })
    ).toBe("/change-password");
  });

  it("allows a mustChangePassword user to reach /change-password", () => {
    expect(
      resolveRedirect({
        pathname: "/change-password",
        session: mustChangeSession,
      })
    ).toBeNull();
  });

  it("allows an authenticated, up-to-date user to reach protected pages", () => {
    expect(
      resolveRedirect({ pathname: "/dashboard", session: activeSession })
    ).toBeNull();
    expect(
      resolveRedirect({ pathname: "/register", session: activeSession })
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/auth/routeGuard.test.ts`
Expected: FAIL — `./routeGuard` module does not exist yet.

- [ ] **Step 3: Implement**

Create `lib/auth/routeGuard.ts`:

```typescript
import type { SessionPayload } from "./session";

const PUBLIC_PATHS = ["/login"];
const CHANGE_PASSWORD_PATH = "/change-password";
const DEFAULT_AUTHENTICATED_PATH = "/dashboard";
const LOGIN_PATH = "/login";

export function resolveRedirect(input: {
  pathname: string;
  session: SessionPayload | null;
}): string | null {
  const { pathname, session } = input;
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  if (!session) {
    return isPublicPath ? null : LOGIN_PATH;
  }

  if (isPublicPath) {
    return DEFAULT_AUTHENTICATED_PATH;
  }

  if (session.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
    return CHANGE_PASSWORD_PATH;
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/auth/routeGuard.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Wire the middleware**

Create `middleware.ts` (project root, alongside `package.json`):

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { resolveRedirect } from "@/lib/auth/routeGuard";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
  const session = token ? await verifySessionToken(token) : null;

  const redirectTo = resolveRedirect({
    pathname: request.nextUrl.pathname,
    session,
  });

  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

Note: API routes are excluded from this matcher — they check
authorization themselves (Tasks 9-13) since each has different rules
(e.g. `/api/auth/login` must stay public).

- [ ] **Step 6: Manual verification**

```bash
npm run dev
```

In a browser, visit `http://localhost:3000/dashboard` with no cookies
set. Expected: redirected to `/login`. Stop the server once confirmed.

- [ ] **Step 7: Commit**

```bash
git add lib/auth/routeGuard.ts lib/auth/routeGuard.test.ts middleware.ts
git commit -m "Add route guard logic and wire it into Next.js middleware"
```

---

### Task 9: Login API route

**Files:**
- Create: `app/api/auth/login/route.ts`
- Test: `app/api/auth/login/route.test.ts`

**Interfaces:**
- Consumes: `loginSchema` (Task 7), `verifyPassword` (Task 4),
  `createSessionToken`, `SESSION_COOKIE_NAME` (Task 5), `prisma`
  (Task 2).
- Produces: `POST` handler returning `{ mustChangePassword: boolean }`
  on success (200) with a `Set-Cookie: session=...` header, or
  `{ error: string }` on failure (400/401).

- [ ] **Step 1: Write the failing test**

Create `app/api/auth/login/route.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

const testEmail = "login-route-test@example.com";

function loginRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/auth/login", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? "test-secret-at-least-32-characters-long";

    const department = await prisma.department.upsert({
      where: { name: "ICT" },
      update: {},
      create: { name: "ICT" },
    });
    const businessUnit = await prisma.businessUnit.upsert({
      where: { name: "Cawit" },
      update: {},
      create: { name: "Cawit" },
    });
    const location = await prisma.location.upsert({
      where: { name: "Zamboanga" },
      update: {},
      create: { name: "Zamboanga" },
    });

    await prisma.user.upsert({
      where: { email: testEmail },
      update: {},
      create: {
        firstName: "Test",
        lastName: "User",
        email: testEmail,
        passwordHash: await hashPassword("correct-password"),
        role: "CREATOR",
        departmentId: department.id,
        businessUnitId: businessUnit.id,
        locationId: location.id,
        mustChangePassword: false,
      },
    });
  });

  it("returns 200 and sets a session cookie for correct credentials", async () => {
    const response = await POST(
      loginRequest({ email: testEmail, password: "correct-password" })
    );

    expect(response.status).toBe(200);
    expect(response.cookies.get("session")).toBeDefined();

    const body = await response.json();
    expect(body.mustChangePassword).toBe(false);
  });

  it("returns 401 for a wrong password", async () => {
    const response = await POST(
      loginRequest({ email: testEmail, password: "wrong-password" })
    );
    expect(response.status).toBe(401);
  });

  it("returns 401 for an unknown email", async () => {
    const response = await POST(
      loginRequest({ email: "nobody@example.com", password: "whatever123" })
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for a malformed payload", async () => {
    const response = await POST(loginRequest({ email: "not-an-email" }));
    expect(response.status).toBe(400);
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { email: testEmail } });
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/auth/login/route.test.ts`
Expected: FAIL — `./route` module does not exist yet.

- [ ] **Step 3: Implement**

Create `app/api/auth/login/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { department: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    department: user.department.name,
    mustChangePassword: user.mustChangePassword,
  });

  const response = NextResponse.json({
    mustChangePassword: user.mustChangePassword,
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/auth/login/route.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/login
git commit -m "Add login API route"
```

---

### Task 10: Login page UI

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/login/LoginForm.tsx`
- Test: `app/login/LoginForm.test.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/login` (Task 9).
- Produces: the login page rendered at `/login`, matching
  `.superpowers/brainstorm/1218-1784345160/content/login-final.html`.

- [ ] **Step 1: Write the failing test**

Create `app/login/LoginForm.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "./LoginForm";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    pushMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("redirects to /dashboard on successful login when password is current", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ mustChangePassword: false }),
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "juan@company.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "correct-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("redirects to /change-password when the account requires it", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ mustChangePassword: true }),
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "juan@company.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "temp-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/change-password")
    );
  });

  it("shows an error message on invalid credentials", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Invalid email or password" }),
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "juan@company.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText(/invalid email or password/i)
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/login/LoginForm.test.tsx`
Expected: FAIL — `./LoginForm` module does not exist yet.

- [ ] **Step 3: Implement the form**

Create `app/login/LoginForm.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const body = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(body.error ?? "Something went wrong");
      return;
    }

    router.push(body.mustChangePassword ? "/change-password" : "/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <label htmlFor="email" className="text-xs text-slate-500">
        Email
      </label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="mb-3 h-9 rounded border border-slate-300 bg-slate-50 px-3 text-sm"
      />

      <label htmlFor="password" className="text-xs text-slate-500">
        Password
      </label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className="mb-2 h-9 rounded border border-slate-300 bg-slate-50 px-3 text-sm"
      />

      <a href="#" className="mb-4 self-end text-xs font-semibold text-[#0b2545]">
        Forgot password?
      </a>

      {error && (
        <p role="alert" className="mb-3 text-xs text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-[#0b2545] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        SIGN IN
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/login/LoginForm.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Build the page shell matching the mockup**

Create `app/login/page.tsx`:

```typescript
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col items-center justify-center bg-[#0b2545] text-[#e8eef7]">
        <div className="text-4xl">⛨</div>
        <div className="mt-3 text-base font-semibold tracking-wide">
          OUTSLIP VMS
        </div>
        <div className="mt-2 max-w-[220px] text-center text-xs text-[#9fb0c9]">
          Outslip Visitor Monitoring System
        </div>
      </div>
      <div className="flex flex-[1.3] flex-col justify-center bg-white p-10">
        <div className="mb-1 text-lg font-bold text-[#0b2545]">
          Welcome back
        </div>
        <div className="mb-6 text-xs text-[#8593a8]">
          Sign in with your company or personal email
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Manual verification**

```bash
npm run dev
```

Visit `http://localhost:3000/login` and confirm it visually matches
`login-final.html` (navy left panel, white right panel, email/password
fields, Sign In button). Stop the server once confirmed.

- [ ] **Step 7: Commit**

```bash
git add app/login
git commit -m "Add login page UI"
```

---

### Task 11: Change-password route + page

**Files:**
- Create: `app/api/auth/change-password/route.ts`
- Test: `app/api/auth/change-password/route.test.ts`
- Create: `app/change-password/page.tsx`
- Create: `app/change-password/ChangePasswordForm.tsx`
- Test: `app/change-password/ChangePasswordForm.test.tsx`

**Interfaces:**
- Consumes: `changePasswordSchema` (Task 7), `hashPassword` (Task 4),
  `verifySessionToken`, `createSessionToken`, `SESSION_COOKIE_NAME`
  (Task 5), `prisma` (Task 2).
- Produces: `POST` handler that re-issues a session cookie with
  `mustChangePassword: false` once the password is changed.

- [ ] **Step 1: Write the failing API test**

Create `app/api/auth/change-password/route.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const testEmail = "change-password-route-test@example.com";
let userId: string;
let validToken: string;

function changePasswordRequest(body: unknown, token?: string) {
  return new NextRequest("http://localhost/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
    },
  });
}

describe("POST /api/auth/change-password", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? "test-secret-at-least-32-characters-long";

    const department = await prisma.department.upsert({
      where: { name: "ICT" },
      update: {},
      create: { name: "ICT" },
    });
    const businessUnit = await prisma.businessUnit.upsert({
      where: { name: "Cawit" },
      update: {},
      create: { name: "Cawit" },
    });
    const location = await prisma.location.upsert({
      where: { name: "Zamboanga" },
      update: {},
      create: { name: "Zamboanga" },
    });

    const user = await prisma.user.upsert({
      where: { email: testEmail },
      update: {},
      create: {
        firstName: "Test",
        lastName: "User",
        email: testEmail,
        passwordHash: await hashPassword("temp-password"),
        role: "CREATOR",
        departmentId: department.id,
        businessUnitId: businessUnit.id,
        locationId: location.id,
        mustChangePassword: true,
      },
    });
    userId = user.id;

    validToken = await createSessionToken({
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      department: "ICT",
      mustChangePassword: true,
    });
  });

  it("returns 401 with no session cookie", async () => {
    const response = await POST(
      changePasswordRequest({
        newPassword: "brand-new-password",
        confirmPassword: "brand-new-password",
      })
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for mismatched passwords", async () => {
    const response = await POST(
      changePasswordRequest(
        { newPassword: "brand-new-password", confirmPassword: "different" },
        validToken
      )
    );
    expect(response.status).toBe(400);
  });

  it("updates the password and clears mustChangePassword", async () => {
    const response = await POST(
      changePasswordRequest(
        {
          newPassword: "brand-new-password",
          confirmPassword: "brand-new-password",
        },
        validToken
      )
    );

    expect(response.status).toBe(200);

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(updated.mustChangePassword).toBe(false);
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/auth/change-password/route.test.ts`
Expected: FAIL — `./route` module does not exist yet.

- [ ] **Step 3: Implement the route**

Create `app/api/auth/change-password/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { changePasswordSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  await prisma.user.update({
    where: { id: session.sub },
    data: { passwordHash, mustChangePassword: false },
  });

  const refreshedToken = await createSessionToken({
    ...session,
    mustChangePassword: false,
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, refreshedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/auth/change-password/route.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the failing component test**

Create `app/change-password/ChangePasswordForm.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChangePasswordForm } from "./ChangePasswordForm";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    pushMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("redirects to /dashboard after a successful change", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<ChangePasswordForm />);
    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: "brand-new-password" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "brand-new-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows an error when the server rejects the change", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Passwords do not match" }),
    });

    render(<ChangePasswordForm />);
    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: "brand-new-password" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "different-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));

    expect(
      await screen.findByText(/passwords do not match/i)
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run app/change-password/ChangePasswordForm.test.tsx`
Expected: FAIL — `./ChangePasswordForm` module does not exist yet.

- [ ] **Step 7: Implement the form and page**

Create `app/change-password/ChangePasswordForm.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChangePasswordForm() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword, confirmPassword }),
    });

    const body = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(body.error ?? "Something went wrong");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <label htmlFor="newPassword" className="text-xs text-slate-500">
        New Password
      </label>
      <input
        id="newPassword"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
        className="mb-3 h-9 rounded border border-slate-300 bg-slate-50 px-3 text-sm"
      />

      <label htmlFor="confirmPassword" className="text-xs text-slate-500">
        Confirm Password
      </label>
      <input
        id="confirmPassword"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        className="mb-4 h-9 rounded border border-slate-300 bg-slate-50 px-3 text-sm"
      />

      {error && (
        <p role="alert" className="mb-3 text-xs text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-[#0b2545] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        UPDATE PASSWORD
      </button>
    </form>
  );
}
```

Create `app/change-password/page.tsx`:

```typescript
import { ChangePasswordForm } from "./ChangePasswordForm";

export default function ChangePasswordPage() {
  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col items-center justify-center bg-[#0b2545] text-[#e8eef7]">
        <div className="text-4xl">⛨</div>
        <div className="mt-3 text-base font-semibold tracking-wide">
          OUTSLIP VMS
        </div>
      </div>
      <div className="flex flex-[1.3] flex-col justify-center bg-white p-10">
        <div className="mb-1 text-lg font-bold text-[#0b2545]">
          Set a new password
        </div>
        <div className="mb-6 text-xs text-[#8593a8]">
          Your account was created with a temporary password. Choose a new
          one to continue.
        </div>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run app/change-password/ChangePasswordForm.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 9: Commit**

```bash
git add app/api/auth/change-password app/change-password
git commit -m "Add forced change-password flow after first login"
```

---

### Task 12: Reference-data API route

**Files:**
- Create: `app/api/reference-data/route.ts`
- Test: `app/api/reference-data/route.test.ts`

**Interfaces:**
- Consumes: `referenceDataSchema` (Task 7), `canManageReferenceData`
  (Task 6), `verifySessionToken`, `SESSION_COOKIE_NAME` (Task 5),
  `prisma` (Task 2).
- Produces: `GET` returning `{ departments, businessUnits, locations }`
  (each `{ id: string; name: string }[]`) for any authenticated user;
  `POST` adding one new value, gated by `canManageReferenceData`. The
  registration wizard (Task 14) reads from `GET` for its dropdowns.

- [ ] **Step 1: Write the failing test**

Create `app/api/reference-data/route.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

let adminToken: string;
let nonAdminToken: string;

function requestWithCookie(url: string, token?: string, init: RequestInit = {}) {
  return new NextRequest(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
    },
  });
}

describe("/api/reference-data", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? "test-secret-at-least-32-characters-long";

    await prisma.department.upsert({
      where: { name: "ICT" },
      update: {},
      create: { name: "ICT" },
    });

    adminToken = await createSessionToken({
      sub: "admin_user",
      email: "admin@company.com",
      firstName: "Admin",
      lastName: "User",
      role: "FIRST_APPROVER",
      department: "Admin",
      mustChangePassword: false,
    });

    nonAdminToken = await createSessionToken({
      sub: "regular_user",
      email: "regular@company.com",
      firstName: "Regular",
      lastName: "User",
      role: "CREATOR",
      department: "ICT",
      mustChangePassword: false,
    });
  });

  it("GET returns reference lists for any authenticated user", async () => {
    const response = await GET(
      requestWithCookie("http://localhost/api/reference-data", nonAdminToken)
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.departments.some((d: { name: string }) => d.name === "ICT")).toBe(
      true
    );
  });

  it("GET returns 401 with no session", async () => {
    const response = await GET(
      requestWithCookie("http://localhost/api/reference-data")
    );
    expect(response.status).toBe(401);
  });

  it("POST returns 403 for a non-Admin-department user", async () => {
    const response = await POST(
      requestWithCookie("http://localhost/api/reference-data", nonAdminToken, {
        method: "POST",
        body: JSON.stringify({ type: "department", name: "Legal" }),
      })
    );
    expect(response.status).toBe(403);
  });

  it("POST adds a new value for an Admin-department user", async () => {
    const response = await POST(
      requestWithCookie("http://localhost/api/reference-data", adminToken, {
        method: "POST",
        body: JSON.stringify({ type: "department", name: "Legal-Test" }),
      })
    );
    expect(response.status).toBe(201);

    const created = await prisma.department.findUnique({
      where: { name: "Legal-Test" },
    });
    expect(created).not.toBeNull();
  });

  afterAll(async () => {
    await prisma.department.deleteMany({ where: { name: "Legal-Test" } });
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/reference-data/route.test.ts`
Expected: FAIL — `./route` module does not exist yet.

- [ ] **Step 3: Implement**

Create `app/api/reference-data/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canManageReferenceData } from "@/lib/auth/permissions";
import { referenceDataSchema } from "@/lib/validation/referenceData";

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [departments, businessUnits, locations] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({ departments, businessUnits, locations });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!canManageReferenceData(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = referenceDataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { type, name } = parsed.data;
  const model =
    type === "department"
      ? prisma.department
      : type === "businessUnit"
        ? prisma.businessUnit
        : prisma.location;

  const created = await model.create({ data: { name } });

  return NextResponse.json(created, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/reference-data/route.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/reference-data
git commit -m "Add reference-data API route for listing and adding Department/Business Unit/Location values"
```

---

### Task 13: Register API route

**Files:**
- Create: `app/api/register/route.ts`
- Test: `app/api/register/route.test.ts`

**Interfaces:**
- Consumes: `registrationSchema` (Task 7), `canProvisionUsers` (Task 6),
  `hashPassword` (Task 4), `verifySessionToken`, `SESSION_COOKIE_NAME`
  (Task 5), `prisma` (Task 2).
- Produces: `POST` handler creating a `mustChangePassword: true` user,
  gated by `canProvisionUsers`, re-checked server-side regardless of
  what the client sends.

- [ ] **Step 1: Write the failing test**

Create `app/api/register/route.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

let provisionerToken: string;
let nonProvisionerToken: string;
let departmentId: string;
let businessUnitId: string;
let locationId: string;
const newUserEmail = "register-route-test@example.com";

function requestWithCookie(token: string | undefined, body: unknown) {
  return new NextRequest("http://localhost/api/register", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
    },
  });
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    role: "CREATOR",
    firstName: "New",
    lastName: "User",
    departmentId,
    businessUnitId,
    locationId,
    email: newUserEmail,
    password: "supersecure1",
    confirmPassword: "supersecure1",
    ...overrides,
  };
}

describe("POST /api/register", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? "test-secret-at-least-32-characters-long";

    const department = await prisma.department.upsert({
      where: { name: "ICT" },
      update: {},
      create: { name: "ICT" },
    });
    const businessUnit = await prisma.businessUnit.upsert({
      where: { name: "Cawit" },
      update: {},
      create: { name: "Cawit" },
    });
    const location = await prisma.location.upsert({
      where: { name: "Zamboanga" },
      update: {},
      create: { name: "Zamboanga" },
    });
    departmentId = department.id;
    businessUnitId = businessUnit.id;
    locationId = location.id;

    provisionerToken = await createSessionToken({
      sub: "provisioner_user",
      email: "provisioner@company.com",
      firstName: "Provisioner",
      lastName: "User",
      role: "FIRST_APPROVER",
      department: "Admin",
      mustChangePassword: false,
    });

    nonProvisionerToken = await createSessionToken({
      sub: "creator_user",
      email: "creator@company.com",
      firstName: "Creator",
      lastName: "User",
      role: "CREATOR",
      department: "Admin",
      mustChangePassword: false,
    });
  });

  it("returns 401 with no session", async () => {
    const response = await POST(requestWithCookie(undefined, validPayload()));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a session without provisioning permission", async () => {
    const response = await POST(
      requestWithCookie(nonProvisionerToken, validPayload())
    );
    expect(response.status).toBe(403);
  });

  it("returns 400 for an invalid payload", async () => {
    const response = await POST(
      requestWithCookie(provisionerToken, validPayload({ email: "bad" }))
    );
    expect(response.status).toBe(400);
  });

  it("creates a user with mustChangePassword true for an authorized provisioner", async () => {
    const response = await POST(
      requestWithCookie(provisionerToken, validPayload())
    );
    expect(response.status).toBe(201);

    const created = await prisma.user.findUniqueOrThrow({
      where: { email: newUserEmail },
    });
    expect(created.mustChangePassword).toBe(true);
    expect(created.role).toBe("CREATOR");
  });

  it("returns 409 when the email is already registered", async () => {
    const response = await POST(
      requestWithCookie(provisionerToken, validPayload())
    );
    expect(response.status).toBe(409);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: newUserEmail } });
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/register/route.test.ts`
Expected: FAIL — `./route` module does not exist yet.

- [ ] **Step 3: Implement**

Create `app/api/register/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canProvisionUsers } from "@/lib/auth/permissions";
import { registrationSchema } from "@/lib/validation/registration";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!canProvisionUsers(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const data = parsed.data;
  const passwordHash = await hashPassword(data.password);

  try {
    const created = await prisma.user.create({
      data: {
        firstName: data.firstName,
        middleName: data.middleName || null,
        lastName: data.lastName,
        email: data.email,
        passwordHash,
        role: data.role,
        departmentId: data.departmentId,
        businessUnitId: data.businessUnitId,
        locationId: data.locationId,
        mustChangePassword: true,
      },
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Email is already registered" },
        { status: 409 }
      );
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/register/route.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/register
git commit -m "Add register API route gated by user-provisioning permission"
```

---

### Task 14: Registration wizard UI

**Files:**
- Create: `app/register/page.tsx`
- Create: `app/register/RegistrationWizard.tsx`
- Test: `app/register/RegistrationWizard.test.tsx`

**Interfaces:**
- Consumes: `GET /api/reference-data` (Task 12), `POST /api/register`
  (Task 13).
- Produces: the 3-step wizard rendered at `/register`, matching
  `.superpowers/brainstorm/1218-1784345160/content/registration-final.html`.
  Server-side permission check happens in `page.tsx`; this is defense
  in depth alongside the route handler's own check (Task 13) and the
  middleware's authentication check (Task 8) — page-level checks are
  not a substitute for the API's own check, since the API can be
  called directly.

- [ ] **Step 1: Write the failing test**

Create `app/register/RegistrationWizard.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RegistrationWizard } from "./RegistrationWizard";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const referenceData = {
  departments: [{ id: "dept_1", name: "ICT" }],
  businessUnits: [{ id: "bu_1", name: "Cawit" }],
  locations: [{ id: "loc_1", name: "Zamboanga" }],
};

describe("RegistrationWizard", () => {
  beforeEach(() => {
    pushMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url === "/api/reference-data") {
          return Promise.resolve({
            ok: true,
            json: async () => referenceData,
          });
        }
        if (url === "/api/register") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: "new_user_1" }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`));
      })
    );
  });

  it("walks through all 3 steps and submits", async () => {
    render(<RegistrationWizard />);

    await screen.findByText(/select a role/i);
    fireEvent.change(screen.getByLabelText(/role/i), {
      target: { value: "CREATOR" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByLabelText(/first name/i);
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "Juan" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Dela Cruz" },
    });
    fireEvent.change(screen.getByLabelText(/^department$/i), {
      target: { value: "dept_1" },
    });
    fireEvent.change(screen.getByLabelText(/business unit/i), {
      target: { value: "bu_1" },
    });
    fireEvent.change(screen.getByLabelText(/^location$/i), {
      target: { value: "loc_1" },
    });
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "juan.delacruz@company.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "supersecure1" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "supersecure1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByText(/review & confirm/i);
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /submit registration/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/register",
        expect.objectContaining({ method: "POST" })
      )
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/register?success=1"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/register/RegistrationWizard.test.tsx`
Expected: FAIL — `./RegistrationWizard` module does not exist yet.

- [ ] **Step 3: Implement the wizard**

Create `app/register/RegistrationWizard.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ReferenceItem = { id: string; name: string };
type ReferenceData = {
  departments: ReferenceItem[];
  businessUnits: ReferenceItem[];
  locations: ReferenceItem[];
};

const ROLES = [
  "CREATOR",
  "FIRST_APPROVER",
  "SECOND_APPROVER",
  "THIRD_APPROVER",
  "GUARD_PERSONNEL",
] as const;

const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  CREATOR: "Creator",
  FIRST_APPROVER: "1st Level Approver",
  SECOND_APPROVER: "2nd Level Approver",
  THIRD_APPROVER: "3rd Level Approver",
  GUARD_PERSONNEL: "Guard Personnel",
};

type FormState = {
  role: (typeof ROLES)[number] | "";
  firstName: string;
  middleName: string;
  lastName: string;
  departmentId: string;
  businessUnitId: string;
  locationId: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const initialState: FormState = {
  role: "",
  firstName: "",
  middleName: "",
  lastName: "",
  departmentId: "",
  businessUnitId: "",
  locationId: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export function RegistrationWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [referenceData, setReferenceData] = useState<ReferenceData | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/reference-data")
      .then((res) => res.json())
      .then(setReferenceData);
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function nameFor(list: ReferenceItem[] | undefined, id: string) {
    return list?.find((item) => item.id === id)?.name ?? "";
  }

  async function submit() {
    setError(null);
    setSubmitting(true);

    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const body = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(body.error ?? "Something went wrong");
      return;
    }

    router.push("/register?success=1");
  }

  if (step === 1) {
    return (
      <div>
        <label htmlFor="role" className="text-xs text-slate-500">
          Role
        </label>
        <select
          id="role"
          aria-label="Role"
          value={form.role}
          onChange={(e) => update("role", e.target.value as FormState["role"])}
          className="mb-4 block h-9 w-full rounded border border-slate-300 bg-slate-50 px-3 text-sm"
        >
          <option value="">Select a role...</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!form.role}
          onClick={() => setStep(2)}
          className="ml-auto block rounded bg-[#0b2545] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          NEXT →
        </button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div>
        <label htmlFor="firstName" className="text-xs text-slate-500">
          First Name
        </label>
        <input
          id="firstName"
          value={form.firstName}
          onChange={(e) => update("firstName", e.target.value)}
          className="mb-3 h-9 w-full rounded border border-slate-300 bg-slate-50 px-3 text-sm"
        />

        <label htmlFor="middleName" className="text-xs text-slate-500">
          Middle Name
        </label>
        <input
          id="middleName"
          value={form.middleName}
          onChange={(e) => update("middleName", e.target.value)}
          className="mb-3 h-9 w-full rounded border border-slate-300 bg-slate-50 px-3 text-sm"
        />

        <label htmlFor="lastName" className="text-xs text-slate-500">
          Last Name
        </label>
        <input
          id="lastName"
          value={form.lastName}
          onChange={(e) => update("lastName", e.target.value)}
          className="mb-3 h-9 w-full rounded border border-slate-300 bg-slate-50 px-3 text-sm"
        />

        <label htmlFor="department" className="text-xs text-slate-500">
          Department
        </label>
        <select
          id="department"
          aria-label="Department"
          value={form.departmentId}
          onChange={(e) => update("departmentId", e.target.value)}
          className="mb-3 h-9 w-full rounded border border-slate-300 bg-slate-50 px-3 text-sm"
        >
          <option value="">Select...</option>
          {referenceData?.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <label htmlFor="businessUnit" className="text-xs text-slate-500">
          Business Unit
        </label>
        <select
          id="businessUnit"
          aria-label="Business Unit"
          value={form.businessUnitId}
          onChange={(e) => update("businessUnitId", e.target.value)}
          className="mb-3 h-9 w-full rounded border border-slate-300 bg-slate-50 px-3 text-sm"
        >
          <option value="">Select...</option>
          {referenceData?.businessUnits.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <label htmlFor="location" className="text-xs text-slate-500">
          Location
        </label>
        <select
          id="location"
          aria-label="Location"
          value={form.locationId}
          onChange={(e) => update("locationId", e.target.value)}
          className="mb-3 h-9 w-full rounded border border-slate-300 bg-slate-50 px-3 text-sm"
        >
          <option value="">Select...</option>
          {referenceData?.locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <label htmlFor="email" className="text-xs text-slate-500">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          className="mb-3 h-9 w-full rounded border border-slate-300 bg-slate-50 px-3 text-sm"
        />

        <label htmlFor="password" className="text-xs text-slate-500">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          className="mb-3 h-9 w-full rounded border border-slate-300 bg-slate-50 px-3 text-sm"
        />

        <label htmlFor="confirmPassword" className="text-xs text-slate-500">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => update("confirmPassword", e.target.value)}
          className="mb-4 h-9 w-full rounded border border-slate-300 bg-slate-50 px-3 text-sm"
        />

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="rounded border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600"
          >
            ← BACK
          </button>
          <button
            type="button"
            onClick={() => setStep(3)}
            className="rounded bg-[#0b2545] px-5 py-2.5 text-sm font-semibold text-white"
          >
            NEXT →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 text-sm font-bold text-[#0b2545]">
        Review &amp; confirm
      </div>
      <div className="mb-4 rounded border border-slate-100 bg-slate-50 p-4 text-xs leading-loose text-slate-600">
        <div className="flex justify-between">
          <span>Role</span>
          <span>{form.role ? ROLE_LABELS[form.role] : ""}</span>
        </div>
        <div className="flex justify-between">
          <span>Name</span>
          <span>
            {[form.firstName, form.middleName, form.lastName]
              .filter(Boolean)
              .join(" ")}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Department</span>
          <span>{nameFor(referenceData?.departments, form.departmentId)}</span>
        </div>
        <div className="flex justify-between">
          <span>Business Unit</span>
          <span>
            {nameFor(referenceData?.businessUnits, form.businessUnitId)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Location</span>
          <span>{nameFor(referenceData?.locations, form.locationId)}</span>
        </div>
        <div className="flex justify-between">
          <span>Email</span>
          <span>{form.email}</span>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="rounded border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600"
        >
          ← BACK
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={submit}
          className="rounded bg-[#0b2545] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          SUBMIT REGISTRATION
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/register/RegistrationWizard.test.tsx`
Expected: PASS, 1 test.

- [ ] **Step 5: Build the protected page shell**

Create `app/register/page.tsx`:

```typescript
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canProvisionUsers } from "@/lib/auth/permissions";
import { RegistrationWizard } from "./RegistrationWizard";

export default async function RegisterPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session || !canProvisionUsers(session)) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col items-center justify-center bg-[#0b2545] text-[#e8eef7]">
        <div className="text-4xl">⛨</div>
        <div className="mt-3 text-base font-semibold tracking-wide">
          OUTSLIP VMS
        </div>
      </div>
      <div className="flex flex-[1.3] flex-col justify-center bg-white p-10">
        <RegistrationWizard />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Manual verification**

```bash
npm run dev
```

Log in as the seed admin (after completing the forced password change),
visit `http://localhost:3000/register`, and confirm all 3 steps render
and match `registration-final.html`. Then log in as a non-Admin-department
user and confirm visiting `/register` redirects to `/dashboard`. Stop the
server once confirmed.

- [ ] **Step 7: Commit**

```bash
git add app/register
git commit -m "Add registration wizard UI"
```

---

### Task 15: Dashboard placeholder + logout

**Files:**
- Create: `app/dashboard/page.tsx`
- Create: `app/api/auth/logout/route.ts`
- Test: `app/api/auth/logout/route.test.ts`
- Modify: `app/page.tsx` (replace the `create-next-app` starter content)
- Modify: `app/layout.tsx` (replace the default `metadata` export)

**Interfaces:**
- Consumes: `verifySessionToken`, `SESSION_COOKIE_NAME` (Task 5).
- Produces: a minimal authenticated landing page (role-specific
  behavior is explicitly out of scope per the spec) and a `POST` logout
  handler that clears the session cookie.

- [ ] **Step 1: Write the failing test**

Create `app/api/auth/logout/route.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

describe("POST /api/auth/logout", () => {
  it("clears the session cookie", async () => {
    const request = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=some-token` },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const cookie = response.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/auth/logout/route.test.ts`
Expected: FAIL — `./route` module does not exist yet.

- [ ] **Step 3: Implement the logout route**

Create `app/api/auth/logout/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/auth/logout/route.test.ts`
Expected: PASS, 1 test.

- [ ] **Step 5: Build the dashboard placeholder**

Create `app/dashboard/page.tsx`:

```typescript
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="text-center">
        <p className="text-sm text-slate-500">Logged in as</p>
        <p className="mt-1 text-lg font-bold text-[#0b2545]">
          {session.firstName} {session.lastName} ({session.role})
        </p>
        <form action="/api/auth/logout" method="post" className="mt-4">
          <button
            type="submit"
            className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Replace the default Next.js starter homepage**

`create-next-app` left the default template at `app/page.tsx` (Task 1).
Replace it with a redirect so visiting `/` sends users to `/dashboard`
(middleware then redirects further to `/login` or `/change-password` if
needed, per Task 8's rules) instead of showing the Next.js boilerplate.

Overwrite `app/page.tsx`:

```typescript
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");
}
```

- [ ] **Step 7: Update the site metadata**

Edit `app/layout.tsx` — replace the default `metadata` export (currently
`title: "Create Next App"`) with:

```typescript
export const metadata: Metadata = {
  title: "Outslip VMS",
  description: "Outslip Visitor Monitoring System",
};
```

- [ ] **Step 8: Manual verification**

```bash
npm run dev
```

Visit `http://localhost:3000/` while logged out — confirm it redirects
to `/login` (via `/dashboard`) rather than showing the Next.js starter
page. Confirm the browser tab title reads "Outslip VMS". Stop the
server once confirmed.

- [ ] **Step 9: Commit**

```bash
git add app/dashboard app/api/auth/logout app/page.tsx app/layout.tsx
git commit -m "Add dashboard placeholder, logout route, and replace starter homepage"
```

---

### Task 16: End-to-end manual verification

**Files:** none — this task exercises the whole system as built.

- [ ] **Step 1: Run the full automated test suite**

```bash
npx vitest run
```

Expected: all tests across every task pass.

- [ ] **Step 2: Reset and re-seed for a clean walkthrough**

```bash
npx prisma db seed
```

- [ ] **Step 3: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 4: Walk through the bootstrap flow in a browser**

1. Visit `http://localhost:3000/dashboard` while logged out — confirm
   redirect to `/login`.
2. Log in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — confirm
   redirect to `/change-password` (not `/dashboard`).
3. Submit a new password — confirm redirect to `/dashboard`, showing
   "Super Admin (FIRST_APPROVER)".
4. Visit `/register` — confirm all 3 wizard steps render, dropdowns are
   populated with the seeded reference data, and submitting creates a
   new user (check the confirmation/success state).
5. Sign out. Log in as the newly created user (the temporary password
   set during registration) — confirm forced redirect to
   `/change-password` again, then successful login after changing it.
6. While logged in as the new user (assuming a non-Admin role/department
   was chosen), visit `/register` directly — confirm redirect to
   `/dashboard` rather than the wizard rendering.

- [ ] **Step 5: Confirm no secrets are committed**

```bash
git status
git log --all -- .env
```

Expected: `.env` does not appear in `git status` as trackable, and no
commit in history touches `.env`.

- [ ] **Step 6: Final commit**

If step 4 surfaced any fixes, commit them individually per the tasks
above. If everything passed as-is, no commit is needed for this task.
