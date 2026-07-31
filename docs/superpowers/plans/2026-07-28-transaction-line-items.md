# Transaction Line Items (Part A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a header/child relationship between `Transaction` and a new `TransactionLineItem` table, with a new transaction detail page (`/transactions/open/[id]`) where line items are added, edited, and deleted — replacing the Open Transactions table's click-to-expand row with real navigation.

**Architecture:** One new Prisma model (`TransactionLineItem`, nullable columns covering both the Visitor Pass variant and the "employee" variant used by every other matrix type — mirroring how `Transaction` itself already stores variant-specific fields). Four new API routes (create/edit/delete a line item, plus an authenticated file-download route). A new detail page and client component render the header info, the line items table, and the Add/Edit Line Item modal. The Open Transactions table's row click changes from expand-in-place to real navigation.

**Tech Stack:** Next.js 16 (App Router), React (client components), Prisma, Zod, Vitest + Testing Library, Node's built-in `fs/promises` for local file storage (no new dependency).

## Global Constraints

- No cloud storage — uploaded files are saved to a new `uploads/line-items/` directory at the project root (gitignored), never under `public/`.
- Uploaded files are served only through an authenticated route (`GET /api/line-items/[lineItemId]/file`) — never a static/public URL.
- Allowed upload types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`. Max size: 5MB (`5 * 1024 * 1024` bytes).
- Required-field enforcement follows the same architecture as the header's per-matrix-type work: Zod schemas stay permissive (shape/format only), and a small dedicated helper function (not Zod's own error messages) produces the specific "`X` is required" message, checked both client- and server-side.
- Job Position, Department, and Business Unit are **never stored** on a line item for a "Mega Employee" — always looked up live through the `employee` relation.
- No `employeeId` field on `User` this round — the Mega Employee dropdown shows "First Last" only.
- Delete uses a native `window.confirm(...)` — no new confirmation modal.
- This plan does **not** touch Post/Delete-transaction buttons, the Check IN/Check OUT log, or the List Approvers panel (Part B, a separate future round).

---

### Task 1: Schema + validation

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `.gitignore`
- Create: `lib/validation/transactionLineItem.ts`
- Test: `lib/validation/transactionLineItem.test.ts`

**Interfaces:**
- Produces: Prisma model `TransactionLineItem` (and back-relations `Transaction.lineItems`, `User.lineItemAssignments`); `visitorPassLineItemSchema`, `employeeLineItemSchema`, `EMPLOYEE_TYPE_OPTIONS`, `VisitorPassLineItemFieldKey`, `EmployeeLineItemFieldKey`, `VISITOR_PASS_LINE_ITEM_LABELS`, `EMPLOYEE_LINE_ITEM_LABELS`, `findMissingVisitorPassLineItemField(values): VisitorPassLineItemFieldKey | null`, `findMissingEmployeeLineItemField(values): EmployeeLineItemFieldKey | null` — all consumed by Tasks 3-5.

- [ ] **Step 1: Add the Prisma model and back-relations**

In `prisma/schema.prisma`, add `lineItems TransactionLineItem[]` to the end of the `Transaction` model (right after `plateNo String?`):

```prisma
model Transaction {
  // ...existing fields unchanged...
  plateNo       String?

  lineItems TransactionLineItem[]
}
```

Add `lineItemAssignments TransactionLineItem[]` to the end of the `User` model (right after `approverAssignments MatrixTypeApprover[]`):

```prisma
model User {
  // ...existing fields unchanged...
  approverAssignments MatrixTypeApprover[]

  lineItemAssignments TransactionLineItem[]
}
```

Add the new model anywhere after `Transaction` (e.g. right after it):

```prisma
model TransactionLineItem {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  transaction   Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  transactionId String

  // Visitor Pass variant
  visitorName    String?
  jobTitle       String?
  company        String?
  contactNumber  String?
  emailAddress   String?
  uploadFileUrl  String?
  uploadFileName String?
  transportType  String?

  // Every other matrix type ("employee" variant)
  employeeType String?
  employee     User?   @relation(fields: [employeeId], references: [id])
  employeeId   String?
  name         String?
  remarks      String?
}
```

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_transaction_line_items`
Expected: a new additive migration file created, applied cleanly to the live dev DB, Prisma Client regenerated. If a dev server is running elsewhere in this session, it will need restarting afterward (stale-Prisma-Client gotcha) — not this task's concern, just don't forget before live-verifying later.

- [ ] **Step 3: Ignore the uploads directory**

Add this line to `.gitignore`, in the "misc" section:

```
/uploads
```

- [ ] **Step 4: Write the failing validation tests**

Create `lib/validation/transactionLineItem.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  visitorPassLineItemSchema,
  employeeLineItemSchema,
  findMissingVisitorPassLineItemField,
  findMissingEmployeeLineItemField,
  VISITOR_PASS_LINE_ITEM_LABELS,
  EMPLOYEE_LINE_ITEM_LABELS,
} from "./transactionLineItem";

describe("visitorPassLineItemSchema", () => {
  it("accepts a fully populated payload", () => {
    const result = visitorPassLineItemSchema.safeParse({
      visitorName: "Analyn Gentizon",
      jobTitle: "Procurement Officer",
      company: "Acme Supplies",
      contactNumber: "0917-000-0000",
      emailAddress: "analyn@example.com",
      transportType: "Car",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty emailAddress (optional field)", () => {
    const result = visitorPassLineItemSchema.safeParse({
      emailAddress: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid emailAddress format", () => {
    const result = visitorPassLineItemSchema.safeParse({
      emailAddress: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a transportType outside the fixed list", () => {
    const result = visitorPassLineItemSchema.safeParse({
      transportType: "Spaceship",
    });
    expect(result.success).toBe(false);
  });
});

describe("findMissingVisitorPassLineItemField", () => {
  it("returns the first missing required field", () => {
    expect(
      findMissingVisitorPassLineItemField({
        visitorName: "Analyn Gentizon",
      })
    ).toBe("jobTitle");
  });

  it("returns null when all required fields are present", () => {
    expect(
      findMissingVisitorPassLineItemField({
        visitorName: "Analyn Gentizon",
        jobTitle: "Procurement Officer",
        company: "Acme Supplies",
        transportType: "Car",
      })
    ).toBeNull();
  });

  it("treats an empty string as missing", () => {
    expect(
      findMissingVisitorPassLineItemField({
        visitorName: "Analyn Gentizon",
        jobTitle: "",
        company: "Acme Supplies",
        transportType: "Car",
      })
    ).toBe("jobTitle");
  });
});

describe("employeeLineItemSchema", () => {
  it("accepts a Mega Employee payload", () => {
    const result = employeeLineItemSchema.safeParse({
      employeeType: "Mega Employee",
      employeeId: "user-1",
      remarks: "Sample remarks",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a Third-Party payload", () => {
    const result = employeeLineItemSchema.safeParse({
      employeeType: "Third-Party",
      name: "Mark Reyes",
      remarks: "Delivery vendor",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an employeeType outside the fixed list", () => {
    const result = employeeLineItemSchema.safeParse({
      employeeType: "Contractor",
    });
    expect(result.success).toBe(false);
  });
});

describe("findMissingEmployeeLineItemField", () => {
  it("requires employeeId (not name) when employeeType is Mega Employee", () => {
    expect(
      findMissingEmployeeLineItemField({
        employeeType: "Mega Employee",
        name: "Should be ignored",
        remarks: "Sample",
      })
    ).toBe("employeeId");
  });

  it("requires name (not employeeId) when employeeType is Third-Party", () => {
    expect(
      findMissingEmployeeLineItemField({
        employeeType: "Third-Party",
        remarks: "Sample",
      })
    ).toBe("name");
  });

  it("requires name when employeeType is Visitor", () => {
    expect(
      findMissingEmployeeLineItemField({
        employeeType: "Visitor",
        remarks: "Sample",
      })
    ).toBe("name");
  });

  it("requires employeeType first, before name/employeeId/remarks", () => {
    expect(findMissingEmployeeLineItemField({})).toBe("employeeType");
  });

  it("requires remarks last", () => {
    expect(
      findMissingEmployeeLineItemField({
        employeeType: "Mega Employee",
        employeeId: "user-1",
      })
    ).toBe("remarks");
  });

  it("returns null when everything required is present (Mega Employee)", () => {
    expect(
      findMissingEmployeeLineItemField({
        employeeType: "Mega Employee",
        employeeId: "user-1",
        remarks: "Sample",
      })
    ).toBeNull();
  });

  it("returns null when everything required is present (Third-Party)", () => {
    expect(
      findMissingEmployeeLineItemField({
        employeeType: "Third-Party",
        name: "Mark Reyes",
        remarks: "Sample",
      })
    ).toBeNull();
  });
});

describe("field labels", () => {
  it("has a label for every Visitor Pass required field key", () => {
    for (const key of ["visitorName", "jobTitle", "company", "transportType"] as const) {
      expect(typeof VISITOR_PASS_LINE_ITEM_LABELS[key]).toBe("string");
    }
  });

  it("has a label for every employee-variant field key", () => {
    for (const key of ["employeeType", "employeeId", "name", "remarks"] as const) {
      expect(typeof EMPLOYEE_LINE_ITEM_LABELS[key]).toBe("string");
    }
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run lib/validation/transactionLineItem.test.ts`
Expected: FAIL — `lib/validation/transactionLineItem.ts` doesn't exist yet.

- [ ] **Step 6: Write the implementation**

Create `lib/validation/transactionLineItem.ts`:

```ts
import { z } from "zod";
import { TRANSPORT_TYPE_OPTIONS } from "@/lib/transportTypeOptions";

export const EMPLOYEE_TYPE_OPTIONS = ["Mega Employee", "Third-Party", "Visitor"] as const;

export const visitorPassLineItemSchema = z.object({
  visitorName: z.string().optional(),
  jobTitle: z.string().optional(),
  company: z.string().optional(),
  contactNumber: z.string().optional(),
  emailAddress: z.string().email().optional().or(z.literal("")),
  transportType: z.enum(TRANSPORT_TYPE_OPTIONS).optional(),
});

export const employeeLineItemSchema = z.object({
  employeeType: z.enum(EMPLOYEE_TYPE_OPTIONS).optional(),
  employeeId: z.string().optional(),
  name: z.string().optional(),
  remarks: z.string().optional(),
});

export type VisitorPassLineItemFieldKey =
  | "visitorName"
  | "jobTitle"
  | "company"
  | "transportType";

export const VISITOR_PASS_LINE_ITEM_LABELS: Record<VisitorPassLineItemFieldKey, string> = {
  visitorName: "Visitor Name",
  jobTitle: "Job Title",
  company: "Company",
  transportType: "Transport Type",
};

const VISITOR_PASS_REQUIRED_ORDER: VisitorPassLineItemFieldKey[] = [
  "visitorName",
  "jobTitle",
  "company",
  "transportType",
];

export function findMissingVisitorPassLineItemField(
  values: Partial<Record<VisitorPassLineItemFieldKey, string | undefined>>
): VisitorPassLineItemFieldKey | null {
  for (const key of VISITOR_PASS_REQUIRED_ORDER) {
    const value = values[key];
    if (!value || value.trim() === "") return key;
  }
  return null;
}

export type EmployeeLineItemFieldKey = "employeeType" | "employeeId" | "name" | "remarks";

export const EMPLOYEE_LINE_ITEM_LABELS: Record<EmployeeLineItemFieldKey, string> = {
  employeeType: "Employee Type",
  employeeId: "Name",
  name: "Name",
  remarks: "Remarks",
};

export function findMissingEmployeeLineItemField(values: {
  employeeType?: string;
  employeeId?: string;
  name?: string;
  remarks?: string;
}): EmployeeLineItemFieldKey | null {
  if (!values.employeeType) return "employeeType";

  if (values.employeeType === "Mega Employee") {
    if (!values.employeeId) return "employeeId";
  } else if (!values.name || values.name.trim() === "") {
    return "name";
  }

  if (!values.remarks || values.remarks.trim() === "") return "remarks";

  return null;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run lib/validation/transactionLineItem.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma .gitignore lib/validation/transactionLineItem.ts lib/validation/transactionLineItem.test.ts prisma/migrations
git commit -m "Add TransactionLineItem model and validation"
```

---

### Task 2: File storage utility + authenticated file-serving route

**Files:**
- Create: `lib/lineItemFileStorage.ts`
- Test: `lib/lineItemFileStorage.test.ts`
- Create: `app/api/line-items/[lineItemId]/file/route.ts`
- Test: `app/api/line-items/[lineItemId]/file/route.test.ts`

**Interfaces:**
- Consumes: Prisma model `TransactionLineItem` (Task 1).
- Produces: `saveLineItemFile(file: File): Promise<{ url: string; fileName: string }>`, `deleteLineItemFile(url: string): Promise<void>`, `lineItemFilePath(url: string): string`, `isAllowedFileType(type: string): boolean`, `ALLOWED_FILE_TYPES`, `MAX_FILE_SIZE_BYTES` — all consumed by Task 3. The `GET /api/line-items/[lineItemId]/file` route is consumed by Task 4/5's UI (linked from the line items table).

- [ ] **Step 1: Write the failing storage-utility test**

Create `lib/lineItemFileStorage.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { existsSync } from "fs";
import {
  saveLineItemFile,
  deleteLineItemFile,
  lineItemFilePath,
  isAllowedFileType,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "./lineItemFileStorage";

const savedUrls: string[] = [];

describe("isAllowedFileType", () => {
  it("accepts every type in ALLOWED_FILE_TYPES", () => {
    for (const type of ALLOWED_FILE_TYPES) {
      expect(isAllowedFileType(type)).toBe(true);
    }
  });

  it("rejects an unlisted type", () => {
    expect(isAllowedFileType("application/x-executable")).toBe(false);
  });
});

describe("MAX_FILE_SIZE_BYTES", () => {
  it("is 5MB", () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe("saveLineItemFile / deleteLineItemFile", () => {
  afterEach(async () => {
    while (savedUrls.length > 0) {
      await deleteLineItemFile(savedUrls.pop()!);
    }
  });

  it("saves a file to disk and returns a url and the original file name", async () => {
    const file = new File([Buffer.from("test content")], "id scan.pdf", {
      type: "application/pdf",
    });

    const result = await saveLineItemFile(file);
    savedUrls.push(result.url);

    expect(result.fileName).toBe("id scan.pdf");
    expect(existsSync(lineItemFilePath(result.url))).toBe(true);
  });

  it("sanitizes the stored file name but keeps the original file name for display", async () => {
    const file = new File([Buffer.from("x")], "weird name (final) v2.png", {
      type: "image/png",
    });

    const result = await saveLineItemFile(file);
    savedUrls.push(result.url);

    expect(result.url).not.toContain(" ");
    expect(result.url).not.toContain("(");
    expect(result.fileName).toBe("weird name (final) v2.png");
  });

  it("generates a different url for two files with the same original name", async () => {
    const file1 = new File([Buffer.from("a")], "same.pdf", { type: "application/pdf" });
    const file2 = new File([Buffer.from("b")], "same.pdf", { type: "application/pdf" });

    const result1 = await saveLineItemFile(file1);
    const result2 = await saveLineItemFile(file2);
    savedUrls.push(result1.url, result2.url);

    expect(result1.url).not.toBe(result2.url);
  });

  it("deleteLineItemFile removes the file from disk", async () => {
    const file = new File([Buffer.from("x")], "to-delete.pdf", {
      type: "application/pdf",
    });
    const result = await saveLineItemFile(file);

    await deleteLineItemFile(result.url);
    expect(existsSync(lineItemFilePath(result.url))).toBe(false);
  });

  it("deleteLineItemFile does not throw for a url that doesn't exist on disk", async () => {
    await expect(deleteLineItemFile("nonexistent-file.pdf")).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/lineItemFileStorage.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Write the storage utility**

Create `lib/lineItemFileStorage.ts`:

```ts
import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "line-items");

export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export function isAllowedFileType(type: string): boolean {
  return (ALLOWED_FILE_TYPES as readonly string[]).includes(type);
}

export function lineItemFilePath(url: string): string {
  return path.join(UPLOAD_DIR, url);
}

export async function saveLineItemFile(
  file: File
): Promise<{ url: string; fileName: string }> {
  await mkdir(UPLOAD_DIR, { recursive: true });

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${randomUUID()}-${sanitizedName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(path.join(UPLOAD_DIR, storedName), buffer);

  return { url: storedName, fileName: file.name };
}

export async function deleteLineItemFile(url: string): Promise<void> {
  try {
    await unlink(lineItemFilePath(url));
  } catch {
    // Best-effort: a missing or already-removed file is not worth surfacing.
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/lineItemFileStorage.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Write the failing file-serving route test**

Create `app/api/line-items/[lineItemId]/file/route.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { saveLineItemFile, deleteLineItemFile } from "@/lib/lineItemFileStorage";

let userToken: string;
let matrixTypeId: string;
let transactionId: string;
let lineItemWithFileId: string;
let lineItemWithoutFileId: string;
let savedFileUrl: string;

function requestWithCookie(token: string | undefined) {
  return new NextRequest("http://localhost/api/line-items/x/file", {
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  });
}

describe("GET /api/line-items/[lineItemId]/file", () => {
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
      where: { email: "line-item-file-route-test-user@example.com" },
      update: {},
      create: {
        firstName: "File",
        lastName: "Tester",
        jobTitle: "Tester",
        email: "line-item-file-route-test-user@example.com",
        passwordHash: "unused",
        role: "CREATOR",
        departmentId: department.id,
        businessUnitId: businessUnit.id,
        locationId: location.id,
        mustChangePassword: false,
      },
    });

    userToken = await createSessionToken({
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: "CREATOR",
      department: "ICT",
      mustChangePassword: false,
    });

    await prisma.transactionStatus.upsert({
      where: { name: "Open" },
      update: {},
      create: { name: "Open" },
    });

    const matrixType = await prisma.matrixType.upsert({
      where: { name: "Line Item File Fixture Matrix Type" },
      update: {},
      create: {
        matrixCode: "MT-LIFILEFIXTURE",
        name: "Line Item File Fixture Matrix Type",
        creatorId: user.id,
      },
    });
    matrixTypeId = matrixType.id;

    const openStatus = await prisma.transactionStatus.findUniqueOrThrow({
      where: { name: "Open" },
    });
    const transaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-FILEFIXTURE",
        matrixTypeId,
        statusId: openStatus.id,
        creatorId: user.id,
      },
    });
    transactionId = transaction.id;

    const saved = await saveLineItemFile(
      new File([Buffer.from("%PDF-1.4 test")], "id.pdf", { type: "application/pdf" })
    );
    savedFileUrl = saved.url;

    const withFile = await prisma.transactionLineItem.create({
      data: {
        transactionId,
        visitorName: "Analyn Gentizon",
        uploadFileUrl: saved.url,
        uploadFileName: saved.fileName,
      },
    });
    lineItemWithFileId = withFile.id;

    const withoutFile = await prisma.transactionLineItem.create({
      data: { transactionId, visitorName: "No File Here" },
    });
    lineItemWithoutFileId = withoutFile.id;
  });

  it("returns 401 with no session", async () => {
    const response = await GET(requestWithCookie(undefined), {
      params: Promise.resolve({ lineItemId: lineItemWithFileId }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 for a line item with no uploaded file", async () => {
    const response = await GET(requestWithCookie(userToken), {
      params: Promise.resolve({ lineItemId: lineItemWithoutFileId }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 404 for a nonexistent line item id", async () => {
    const response = await GET(requestWithCookie(userToken), {
      params: Promise.resolve({ lineItemId: "nonexistent-id" }),
    });
    expect(response.status).toBe(404);
  });

  it("streams the file with the correct content-type when authenticated", async () => {
    const response = await GET(requestWithCookie(userToken), {
      params: Promise.resolve({ lineItemId: lineItemWithFileId }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const text = await response.text();
    expect(text).toContain("%PDF-1.4 test");
  });

  afterAll(async () => {
    await prisma.transactionLineItem.deleteMany({ where: { transactionId } });
    await prisma.transaction.deleteMany({ where: { id: transactionId } });
    await prisma.matrixType.deleteMany({ where: { id: matrixTypeId } });
    await deleteLineItemFile(savedFileUrl);
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run app/api/line-items/\[lineItemId\]/file/route.test.ts`
Expected: FAIL — the route module doesn't exist yet.

- [ ] **Step 7: Write the route**

Create `app/api/line-items/[lineItemId]/file/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { lineItemFilePath } from "@/lib/lineItemFileStorage";

function contentTypeFor(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lineItemId: string }> }
) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { lineItemId } = await params;
  const lineItem = await prisma.transactionLineItem.findUnique({
    where: { id: lineItemId },
    select: { uploadFileUrl: true, uploadFileName: true },
  });

  if (!lineItem?.uploadFileUrl) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const buffer = await readFile(lineItemFilePath(lineItem.uploadFileUrl));
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentTypeFor(lineItem.uploadFileName ?? lineItem.uploadFileUrl),
        "Content-Disposition": `inline; filename="${lineItem.uploadFileName ?? "file"}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run app/api/line-items/\[lineItemId\]/file/route.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 9: Run the full suite**

Run: `npx vitest run`
Expected: only the two known pre-existing `prisma/seed.test.ts` baseline failures.

- [ ] **Step 10: Commit**

```bash
git add lib/lineItemFileStorage.ts lib/lineItemFileStorage.test.ts "app/api/line-items"
git commit -m "Add local file storage and authenticated file-serving route for line items"
```

---

### Task 3: POST/PATCH/DELETE line-item API routes

**Files:**
- Create: `app/api/transactions/[id]/line-items/route.ts`
- Test: `app/api/transactions/[id]/line-items/route.test.ts`
- Create: `app/api/transactions/[id]/line-items/[lineItemId]/route.ts`
- Test: `app/api/transactions/[id]/line-items/[lineItemId]/route.test.ts`

**Interfaces:**
- Consumes: `visitorPassLineItemSchema`, `employeeLineItemSchema`, `findMissingVisitorPassLineItemField`, `findMissingEmployeeLineItemField`, `VISITOR_PASS_LINE_ITEM_LABELS`, `EMPLOYEE_LINE_ITEM_LABELS` (Task 1); `saveLineItemFile`, `deleteLineItemFile`, `isAllowedFileType`, `MAX_FILE_SIZE_BYTES` (Task 2).
- Produces: `POST /api/transactions/[id]/line-items` (201 with the created row), `PATCH /api/transactions/[id]/line-items/[lineItemId]` (200 with the updated row), `DELETE /api/transactions/[id]/line-items/[lineItemId]` (204) — all consumed by Task 4/5's client component.

- [ ] **Step 1: Write the failing POST route test**

Create `app/api/transactions/[id]/line-items/route.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { deleteLineItemFile } from "@/lib/lineItemFileStorage";

let userToken: string;
let userId: string;
let visitorPassMatrixTypeId: string;
let employeeMatrixTypeId: string;
let visitorPassTransactionId: string;
let employeeTransactionId: string;
const createdLineItemIds: string[] = [];
const savedFileUrls: string[] = [];

function requestWithCookie(token: string | undefined, transactionId: string, body: FormData) {
  return new NextRequest(`http://localhost/api/transactions/${transactionId}/line-items`, {
    method: "POST",
    body,
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  });
}

function paramsFor(transactionId: string) {
  return { params: Promise.resolve({ id: transactionId }) };
}

describe("POST /api/transactions/[id]/line-items", () => {
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
      where: { email: "line-items-post-route-test-user@example.com" },
      update: {},
      create: {
        firstName: "Post",
        lastName: "Tester",
        jobTitle: "Tester",
        email: "line-items-post-route-test-user@example.com",
        passwordHash: "unused",
        role: "CREATOR",
        departmentId: department.id,
        businessUnitId: businessUnit.id,
        locationId: location.id,
        mustChangePassword: false,
      },
    });
    userId = user.id;

    userToken = await createSessionToken({
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: "CREATOR",
      department: "ICT",
      mustChangePassword: false,
    });

    await prisma.transactionStatus.upsert({
      where: { name: "Open" },
      update: {},
      create: { name: "Open" },
    });
    const openStatus = await prisma.transactionStatus.findUniqueOrThrow({
      where: { name: "Open" },
    });

    const visitorPassMatrixType = await prisma.matrixType.upsert({
      where: { name: "Visitor Pass" },
      update: {},
      create: {
        matrixCode: "MT-LIVISITORPASSFIXTURE",
        name: "Visitor Pass",
        creatorId: userId,
      },
    });
    visitorPassMatrixTypeId = visitorPassMatrixType.id;

    const employeeMatrixType = await prisma.matrixType.upsert({
      where: { name: "Line Item Employee Fixture Matrix Type" },
      update: {},
      create: {
        matrixCode: "MT-LIEMPLOYEEFIXTURE",
        name: "Line Item Employee Fixture Matrix Type",
        creatorId: userId,
      },
    });
    employeeMatrixTypeId = employeeMatrixType.id;

    const visitorPassTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-LIVISITORPASS",
        matrixTypeId: visitorPassMatrixTypeId,
        statusId: openStatus.id,
        creatorId: userId,
      },
    });
    visitorPassTransactionId = visitorPassTransaction.id;

    const employeeTransaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-LIEMPLOYEE",
        matrixTypeId: employeeMatrixTypeId,
        statusId: openStatus.id,
        creatorId: userId,
      },
    });
    employeeTransactionId = employeeTransaction.id;
  });

  it("returns 401 with no session", async () => {
    const response = await POST(
      requestWithCookie(undefined, visitorPassTransactionId, new FormData()),
      paramsFor(visitorPassTransactionId)
    );
    expect(response.status).toBe(401);
  });

  it("returns 404 for a nonexistent transaction id", async () => {
    const response = await POST(
      requestWithCookie(userToken, "nonexistent-id", new FormData()),
      paramsFor("nonexistent-id")
    );
    expect(response.status).toBe(404);
  });

  it("returns a specific message when a required Visitor Pass field is missing", async () => {
    const body = new FormData();
    body.set("visitorName", "Analyn Gentizon");
    const response = await POST(
      requestWithCookie(userToken, visitorPassTransactionId, body),
      paramsFor(visitorPassTransactionId)
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Job Title is required");
  });

  it("creates a Visitor Pass line item with all required fields, no file", async () => {
    const body = new FormData();
    body.set("visitorName", "Analyn Gentizon");
    body.set("jobTitle", "Procurement Officer");
    body.set("company", "Acme Supplies");
    body.set("transportType", "Car");
    body.set("contactNumber", "0917-000-0000");
    body.set("emailAddress", "analyn@example.com");

    const response = await POST(
      requestWithCookie(userToken, visitorPassTransactionId, body),
      paramsFor(visitorPassTransactionId)
    );
    expect(response.status).toBe(201);
    const created = await response.json();
    createdLineItemIds.push(created.id);

    expect(created.visitorName).toBe("Analyn Gentizon");
    expect(created.jobTitle).toBe("Procurement Officer");
    expect(created.company).toBe("Acme Supplies");
    expect(created.transportType).toBe("Car");
    expect(created.contactNumber).toBe("0917-000-0000");
    expect(created.emailAddress).toBe("analyn@example.com");
    expect(created.uploadFileUrl).toBeNull();
  });

  it("creates a Visitor Pass line item with an uploaded file", async () => {
    const body = new FormData();
    body.set("visitorName", "Mark Reyes");
    body.set("jobTitle", "Driver");
    body.set("company", "Acme Supplies");
    body.set("transportType", "Walk-In");
    body.set(
      "uploadFile",
      new File([Buffer.from("%PDF-1.4 test")], "id.pdf", { type: "application/pdf" })
    );

    const response = await POST(
      requestWithCookie(userToken, visitorPassTransactionId, body),
      paramsFor(visitorPassTransactionId)
    );
    expect(response.status).toBe(201);
    const created = await response.json();
    createdLineItemIds.push(created.id);
    if (created.uploadFileUrl) savedFileUrls.push(created.uploadFileUrl);

    expect(created.uploadFileName).toBe("id.pdf");
    expect(created.uploadFileUrl).toBeTruthy();
  });

  it("rejects an unsupported file type", async () => {
    const body = new FormData();
    body.set("visitorName", "Analyn Gentizon");
    body.set("jobTitle", "Procurement Officer");
    body.set("company", "Acme Supplies");
    body.set("transportType", "Car");
    body.set(
      "uploadFile",
      new File([Buffer.from("bad")], "virus.exe", { type: "application/x-executable" })
    );

    const response = await POST(
      requestWithCookie(userToken, visitorPassTransactionId, body),
      paramsFor(visitorPassTransactionId)
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/unsupported file type/i);
  });

  it("returns a specific message when Name is missing for a Third-Party employee line item", async () => {
    const body = new FormData();
    body.set("employeeType", "Third-Party");
    body.set("remarks", "Delivery vendor");

    const response = await POST(
      requestWithCookie(userToken, employeeTransactionId, body),
      paramsFor(employeeTransactionId)
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Name is required");
  });

  it("creates a Third-Party employee line item", async () => {
    const body = new FormData();
    body.set("employeeType", "Third-Party");
    body.set("name", "Mark Reyes");
    body.set("remarks", "Delivery vendor");

    const response = await POST(
      requestWithCookie(userToken, employeeTransactionId, body),
      paramsFor(employeeTransactionId)
    );
    expect(response.status).toBe(201);
    const created = await response.json();
    createdLineItemIds.push(created.id);

    expect(created.employeeType).toBe("Third-Party");
    expect(created.name).toBe("Mark Reyes");
    expect(created.remarks).toBe("Delivery vendor");
    expect(created.employeeId).toBeNull();
  });

  it("creates a Mega Employee line item and ignores a submitted name", async () => {
    const body = new FormData();
    body.set("employeeType", "Mega Employee");
    body.set("employeeId", userId);
    body.set("name", "Should be ignored");
    body.set("remarks", "Sample remarks");

    const response = await POST(
      requestWithCookie(userToken, employeeTransactionId, body),
      paramsFor(employeeTransactionId)
    );
    expect(response.status).toBe(201);
    const created = await response.json();
    createdLineItemIds.push(created.id);

    expect(created.employeeType).toBe("Mega Employee");
    expect(created.employeeId).toBe(userId);
    expect(created.name).toBeNull();
  });

  it("returns 400 for a Mega Employee line item with a nonexistent employeeId", async () => {
    const body = new FormData();
    body.set("employeeType", "Mega Employee");
    body.set("employeeId", "nonexistent-user-id");
    body.set("remarks", "Sample remarks");

    const response = await POST(
      requestWithCookie(userToken, employeeTransactionId, body),
      paramsFor(employeeTransactionId)
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/invalid employee/i);
  });

  afterAll(async () => {
    await prisma.transactionLineItem.deleteMany({ where: { id: { in: createdLineItemIds } } });
    for (const url of savedFileUrls) {
      await deleteLineItemFile(url);
    }
    await prisma.transaction.deleteMany({
      where: { id: { in: [visitorPassTransactionId, employeeTransactionId] } },
    });
    await prisma.matrixType.deleteMany({ where: { id: employeeMatrixTypeId } });
    await prisma.$disconnect();
  });
});
```

Note: this test reuses the real `"Visitor Pass"` matrix type (upserted, not deleted in `afterAll` — same shared/reused convention as the header's Halfday/Routing fixtures from the required-fields-per-type plan).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/api/transactions/\[id\]/line-items/route.test.ts`
Expected: FAIL — the route module doesn't exist yet.

- [ ] **Step 3: Write the POST route**

Create `app/api/transactions/[id]/line-items/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import {
  visitorPassLineItemSchema,
  employeeLineItemSchema,
  findMissingVisitorPassLineItemField,
  findMissingEmployeeLineItemField,
  VISITOR_PASS_LINE_ITEM_LABELS,
  EMPLOYEE_LINE_ITEM_LABELS,
} from "@/lib/validation/transactionLineItem";
import {
  saveLineItemFile,
  isAllowedFileType,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/lineItemFileStorage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: transactionId } = await params;
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { matrixType: { select: { name: true } } },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const isVisitorPass = transaction.matrixType.name === "Visitor Pass";

  if (isVisitorPass) {
    const raw = {
      visitorName: formData.get("visitorName")?.toString() ?? "",
      jobTitle: formData.get("jobTitle")?.toString() ?? "",
      company: formData.get("company")?.toString() ?? "",
      contactNumber: formData.get("contactNumber")?.toString() || undefined,
      emailAddress: formData.get("emailAddress")?.toString() || undefined,
      transportType: formData.get("transportType")?.toString() || undefined,
    };

    const parsed = visitorPassLineItemSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const missingField = findMissingVisitorPassLineItemField(raw);
    if (missingField) {
      return NextResponse.json(
        { error: `${VISITOR_PASS_LINE_ITEM_LABELS[missingField]} is required` },
        { status: 400 }
      );
    }

    let uploadFileUrl: string | undefined;
    let uploadFileName: string | undefined;
    const file = formData.get("uploadFile");
    if (file instanceof File && file.size > 0) {
      if (!isAllowedFileType(file.type)) {
        return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: "File is too large" }, { status: 400 });
      }
      const saved = await saveLineItemFile(file);
      uploadFileUrl = saved.url;
      uploadFileName = saved.fileName;
    }

    const created = await prisma.transactionLineItem.create({
      data: {
        transactionId,
        visitorName: parsed.data.visitorName,
        jobTitle: parsed.data.jobTitle,
        company: parsed.data.company,
        contactNumber: parsed.data.contactNumber,
        emailAddress: parsed.data.emailAddress,
        transportType: parsed.data.transportType,
        uploadFileUrl,
        uploadFileName,
      },
    });
    return NextResponse.json(created, { status: 201 });
  }

  const raw = {
    employeeType: formData.get("employeeType")?.toString() || undefined,
    employeeId: formData.get("employeeId")?.toString() || undefined,
    name: formData.get("name")?.toString() || undefined,
    remarks: formData.get("remarks")?.toString() ?? "",
  };

  const parsed = employeeLineItemSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const missingField = findMissingEmployeeLineItemField(raw);
  if (missingField) {
    return NextResponse.json(
      { error: `${EMPLOYEE_LINE_ITEM_LABELS[missingField]} is required` },
      { status: 400 }
    );
  }

  try {
    const created = await prisma.transactionLineItem.create({
      data: {
        transactionId,
        employeeType: parsed.data.employeeType,
        employeeId:
          parsed.data.employeeType === "Mega Employee" ? parsed.data.employeeId : undefined,
        name: parsed.data.employeeType !== "Mega Employee" ? parsed.data.name : undefined,
        remarks: parsed.data.remarks,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return NextResponse.json({ error: "Invalid employee selected" }, { status: 400 });
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/api/transactions/\[id\]/line-items/route.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Write the failing PATCH/DELETE route test**

Create `app/api/transactions/[id]/line-items/[lineItemId]/route.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "fs";
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { deleteLineItemFile, lineItemFilePath } from "@/lib/lineItemFileStorage";

let userToken: string;
let userId: string;
let matrixTypeId: string;
let transactionId: string;
const createdLineItemIds: string[] = [];
const savedFileUrls: string[] = [];

function requestWithCookie(method: string, token: string | undefined, body: FormData) {
  return new NextRequest("http://localhost/api/transactions/x/line-items/y", {
    method,
    body,
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  });
}

function paramsFor(transactionId: string, lineItemId: string) {
  return { params: Promise.resolve({ id: transactionId, lineItemId }) };
}

describe("PATCH/DELETE /api/transactions/[id]/line-items/[lineItemId]", () => {
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
      where: { email: "line-item-id-route-test-user@example.com" },
      update: {},
      create: {
        firstName: "Patch",
        lastName: "Tester",
        jobTitle: "Tester",
        email: "line-item-id-route-test-user@example.com",
        passwordHash: "unused",
        role: "CREATOR",
        departmentId: department.id,
        businessUnitId: businessUnit.id,
        locationId: location.id,
        mustChangePassword: false,
      },
    });
    userId = user.id;

    userToken = await createSessionToken({
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: "CREATOR",
      department: "ICT",
      mustChangePassword: false,
    });

    await prisma.transactionStatus.upsert({
      where: { name: "Open" },
      update: {},
      create: { name: "Open" },
    });
    const openStatus = await prisma.transactionStatus.findUniqueOrThrow({
      where: { name: "Open" },
    });

    const matrixType = await prisma.matrixType.upsert({
      where: { name: "Line Item ID Route Fixture Matrix Type" },
      update: {},
      create: {
        matrixCode: "MT-LIIDROUTEFIXTURE",
        name: "Line Item ID Route Fixture Matrix Type",
        creatorId: userId,
      },
    });
    matrixTypeId = matrixType.id;

    const transaction = await prisma.transaction.create({
      data: {
        transactionCode: "OT-LIIDROUTE",
        matrixTypeId,
        statusId: openStatus.id,
        creatorId: userId,
      },
    });
    transactionId = transaction.id;
  });

  it("returns 401 with no session on PATCH", async () => {
    const lineItem = await prisma.transactionLineItem.create({
      data: { transactionId, employeeType: "Third-Party", name: "X", remarks: "X" },
    });
    createdLineItemIds.push(lineItem.id);

    const response = await PATCH(
      requestWithCookie("PATCH", undefined, new FormData()),
      paramsFor(transactionId, lineItem.id)
    );
    expect(response.status).toBe(401);
  });

  it("edits an employee-variant line item's fields", async () => {
    const lineItem = await prisma.transactionLineItem.create({
      data: { transactionId, employeeType: "Third-Party", name: "Old Name", remarks: "Old" },
    });
    createdLineItemIds.push(lineItem.id);

    const body = new FormData();
    body.set("employeeType", "Third-Party");
    body.set("name", "New Name");
    body.set("remarks", "New remarks");

    const response = await PATCH(
      requestWithCookie("PATCH", userToken, body),
      paramsFor(transactionId, lineItem.id)
    );
    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.name).toBe("New Name");
    expect(updated.remarks).toBe("New remarks");
  });

  it("returns a specific message when a required field is missing on PATCH", async () => {
    const lineItem = await prisma.transactionLineItem.create({
      data: { transactionId, employeeType: "Third-Party", name: "X", remarks: "X" },
    });
    createdLineItemIds.push(lineItem.id);

    const body = new FormData();
    body.set("employeeType", "Third-Party");
    body.set("remarks", "New remarks");

    const response = await PATCH(
      requestWithCookie("PATCH", userToken, body),
      paramsFor(transactionId, lineItem.id)
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Name is required");
  });

  it("returns 404 when editing a nonexistent line item", async () => {
    const body = new FormData();
    body.set("employeeType", "Third-Party");
    body.set("name", "X");
    body.set("remarks", "X");

    const response = await PATCH(
      requestWithCookie("PATCH", userToken, body),
      paramsFor(transactionId, "nonexistent-id")
    );
    expect(response.status).toBe(404);
  });

  it("replaces an uploaded file and deletes the old one", async () => {
    const oldSaved = await (
      await import("@/lib/lineItemFileStorage")
    ).saveLineItemFile(new File([Buffer.from("old")], "old.pdf", { type: "application/pdf" }));
    const lineItem = await prisma.transactionLineItem.create({
      data: {
        transactionId,
        visitorName: "V",
        jobTitle: "J",
        company: "C",
        transportType: "Car",
        uploadFileUrl: oldSaved.url,
        uploadFileName: oldSaved.fileName,
      },
    });
    createdLineItemIds.push(lineItem.id);

    const body = new FormData();
    body.set("visitorName", "V");
    body.set("jobTitle", "J");
    body.set("company", "C");
    body.set("transportType", "Car");
    body.set(
      "uploadFile",
      new File([Buffer.from("new")], "new.pdf", { type: "application/pdf" })
    );

    const response = await PATCH(
      requestWithCookie("PATCH", userToken, body),
      paramsFor(transactionId, lineItem.id)
    );
    expect(response.status).toBe(200);
    const updated = await response.json();
    savedFileUrls.push(updated.uploadFileUrl);

    expect(updated.uploadFileName).toBe("new.pdf");
    expect(existsSync(lineItemFilePath(oldSaved.url))).toBe(false);
  });

  it("deletes a line item and its file", async () => {
    const saved = await (
      await import("@/lib/lineItemFileStorage")
    ).saveLineItemFile(new File([Buffer.from("x")], "x.pdf", { type: "application/pdf" }));
    const lineItem = await prisma.transactionLineItem.create({
      data: {
        transactionId,
        visitorName: "V",
        jobTitle: "J",
        company: "C",
        transportType: "Car",
        uploadFileUrl: saved.url,
        uploadFileName: saved.fileName,
      },
    });

    const response = await DELETE(
      requestWithCookie("DELETE", userToken, new FormData()),
      paramsFor(transactionId, lineItem.id)
    );
    expect(response.status).toBe(204);

    const stillThere = await prisma.transactionLineItem.findUnique({
      where: { id: lineItem.id },
    });
    expect(stillThere).toBeNull();
    expect(existsSync(lineItemFilePath(saved.url))).toBe(false);
  });

  it("returns 401 with no session on DELETE", async () => {
    const lineItem = await prisma.transactionLineItem.create({
      data: { transactionId, employeeType: "Third-Party", name: "X", remarks: "X" },
    });
    createdLineItemIds.push(lineItem.id);

    const response = await DELETE(
      requestWithCookie("DELETE", undefined, new FormData()),
      paramsFor(transactionId, lineItem.id)
    );
    expect(response.status).toBe(401);
  });

  afterAll(async () => {
    await prisma.transactionLineItem.deleteMany({ where: { id: { in: createdLineItemIds } } });
    for (const url of savedFileUrls) {
      await deleteLineItemFile(url);
    }
    await prisma.transaction.deleteMany({ where: { id: transactionId } });
    await prisma.matrixType.deleteMany({ where: { id: matrixTypeId } });
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run app/api/transactions/\[id\]/line-items/\[lineItemId\]/route.test.ts`
Expected: FAIL — the route module doesn't exist yet.

- [ ] **Step 7: Write the PATCH/DELETE route**

Create `app/api/transactions/[id]/line-items/[lineItemId]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import {
  visitorPassLineItemSchema,
  employeeLineItemSchema,
  findMissingVisitorPassLineItemField,
  findMissingEmployeeLineItemField,
  VISITOR_PASS_LINE_ITEM_LABELS,
  EMPLOYEE_LINE_ITEM_LABELS,
} from "@/lib/validation/transactionLineItem";
import {
  saveLineItemFile,
  deleteLineItemFile,
  isAllowedFileType,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/lineItemFileStorage";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineItemId: string }> }
) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { lineItemId } = await params;
  const existing = await prisma.transactionLineItem.findUnique({
    where: { id: lineItemId },
    include: { transaction: { include: { matrixType: { select: { name: true } } } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const isVisitorPass = existing.transaction.matrixType.name === "Visitor Pass";

  if (isVisitorPass) {
    const raw = {
      visitorName: formData.get("visitorName")?.toString() ?? "",
      jobTitle: formData.get("jobTitle")?.toString() ?? "",
      company: formData.get("company")?.toString() ?? "",
      contactNumber: formData.get("contactNumber")?.toString() || undefined,
      emailAddress: formData.get("emailAddress")?.toString() || undefined,
      transportType: formData.get("transportType")?.toString() || undefined,
    };

    const parsed = visitorPassLineItemSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const missingField = findMissingVisitorPassLineItemField(raw);
    if (missingField) {
      return NextResponse.json(
        { error: `${VISITOR_PASS_LINE_ITEM_LABELS[missingField]} is required` },
        { status: 400 }
      );
    }

    let uploadFileUrl = existing.uploadFileUrl;
    let uploadFileName = existing.uploadFileName;
    const file = formData.get("uploadFile");
    if (file instanceof File && file.size > 0) {
      if (!isAllowedFileType(file.type)) {
        return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: "File is too large" }, { status: 400 });
      }
      const saved = await saveLineItemFile(file);
      const oldUrl = existing.uploadFileUrl;
      uploadFileUrl = saved.url;
      uploadFileName = saved.fileName;
      if (oldUrl) await deleteLineItemFile(oldUrl);
    }

    const updated = await prisma.transactionLineItem.update({
      where: { id: lineItemId },
      data: {
        visitorName: parsed.data.visitorName,
        jobTitle: parsed.data.jobTitle,
        company: parsed.data.company,
        contactNumber: parsed.data.contactNumber,
        emailAddress: parsed.data.emailAddress,
        transportType: parsed.data.transportType,
        uploadFileUrl,
        uploadFileName,
      },
    });
    return NextResponse.json(updated, { status: 200 });
  }

  const raw = {
    employeeType: formData.get("employeeType")?.toString() || undefined,
    employeeId: formData.get("employeeId")?.toString() || undefined,
    name: formData.get("name")?.toString() || undefined,
    remarks: formData.get("remarks")?.toString() ?? "",
  };

  const parsed = employeeLineItemSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const missingField = findMissingEmployeeLineItemField(raw);
  if (missingField) {
    return NextResponse.json(
      { error: `${EMPLOYEE_LINE_ITEM_LABELS[missingField]} is required` },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.transactionLineItem.update({
      where: { id: lineItemId },
      data: {
        employeeType: parsed.data.employeeType,
        employeeId:
          parsed.data.employeeType === "Mega Employee" ? parsed.data.employeeId : null,
        name: parsed.data.employeeType !== "Mega Employee" ? parsed.data.name : null,
        remarks: parsed.data.remarks,
      },
    });
    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return NextResponse.json({ error: "Invalid employee selected" }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineItemId: string }> }
) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { lineItemId } = await params;
  const existing = await prisma.transactionLineItem.findUnique({
    where: { id: lineItemId },
    select: { uploadFileUrl: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  await prisma.transactionLineItem.delete({ where: { id: lineItemId } });
  if (existing.uploadFileUrl) await deleteLineItemFile(existing.uploadFileUrl);

  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run app/api/transactions/\[id\]/line-items/\[lineItemId\]/route.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 9: Run the full suite**

Run: `npx vitest run`
Expected: only the two known pre-existing `prisma/seed.test.ts` baseline failures.

- [ ] **Step 10: Commit**

```bash
git add "app/api/transactions/[id]/line-items"
git commit -m "Add create/edit/delete API routes for transaction line items"
```

---

### Task 4: Transaction detail page + read-only view with delete

**Files:**
- Create: `app/(authenticated)/transactions/open/[id]/page.tsx`
- Create: `app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx`
- Test: `app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx`

**Interfaces:**
- Consumes: `DELETE /api/transactions/[id]/line-items/[lineItemId]` (Task 3); reuses the existing `transactionDetailFields`-style formatting convention from `TransactionsView.tsx` (read, don't import — this is a new small local copy scoped to the single transaction being viewed, since `TransactionsView.tsx`'s version formats an array of rows for a table, not one transaction's own fields).
- Produces: `TransactionDetailView` component with props `{ transaction: TransactionDetailData; lineItems: LineItemRow[] }` (types defined in this task), consumed and extended by Task 5 (adds the Add/Edit modal) and referenced by Task 6 (the table links here).

- [ ] **Step 1: Write the failing component test**

Create `app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TransactionDetailView } from "./TransactionDetailView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const visitorPassTransaction = {
  id: "t1",
  transactionCode: "OT-001",
  qrDataUrl: "data:image/png;base64,mockqrdata",
  matrixTypeName: "Visitor Pass",
  statusName: "Open",
  createdBy: "Jhon Caser",
  createdAt: "Jul 28, 2026",
  detailFields: [{ label: "Reason", value: "Client meeting" }],
};

const otherTransaction = {
  ...visitorPassTransaction,
  id: "t2",
  transactionCode: "OT-002",
  matrixTypeName: "Halfday",
};

const visitorPassLineItems = [
  {
    id: "li1",
    variant: "visitor-pass" as const,
    visitorName: "Analyn Gentizon",
    jobTitle: "Procurement Officer",
    company: "Acme Supplies",
    contactNumber: "0917-000-0000",
    emailAddress: "analyn@example.com",
    transportType: "Car",
    uploadFileName: "id.pdf",
    hasFile: true,
    employeeType: "",
    employeeId: "",
    employeeName: "",
    jobPosition: "",
    department: "",
    businessUnit: "",
    remarks: "",
  },
];

const employeeLineItems = [
  {
    id: "li2",
    variant: "employee" as const,
    visitorName: "",
    jobTitle: "",
    company: "",
    contactNumber: "",
    emailAddress: "",
    transportType: "",
    uploadFileName: "",
    hasFile: false,
    employeeType: "Third-Party",
    employeeId: "",
    employeeName: "Mark Reyes",
    jobPosition: "—",
    department: "—",
    businessUnit: "—",
    remarks: "Delivery vendor",
  },
];

const megaEmployeeLineItems = [
  {
    id: "li3",
    variant: "employee" as const,
    visitorName: "",
    jobTitle: "",
    company: "",
    contactNumber: "",
    emailAddress: "",
    transportType: "",
    uploadFileName: "",
    hasFile: false,
    employeeType: "Mega Employee",
    employeeId: "u1",
    employeeName: "Jhon Niño Caser",
    jobPosition: "Business Analyst and Developer",
    department: "Digital Transformation and Business Systems",
    businessUnit: "MFC",
    remarks: "Sample remarks",
  },
];

describe("TransactionDetailView", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  it("renders the header card with QR, code, and populated detail fields", () => {
    render(<TransactionDetailView transaction={visitorPassTransaction} lineItems={[]} />);
    expect(screen.getByText("OT-001")).toBeInTheDocument();
    expect(screen.getByText("Visitor Pass")).toBeInTheDocument();
    expect(screen.getByText("Client meeting")).toBeInTheDocument();
    expect(screen.getByAltText(/qr code/i)).toHaveAttribute(
      "src",
      "data:image/png;base64,mockqrdata"
    );
  });

  it("renders the Visitor Pass line items table with its columns", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={visitorPassLineItems}
      />
    );
    expect(screen.getByText("Analyn Gentizon")).toBeInTheDocument();
    expect(screen.getByText("Procurement Officer")).toBeInTheDocument();
    expect(screen.getByText("Acme Supplies")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Visitor Name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Transport Type" })).toBeInTheDocument();
  });

  it("renders the employee-variant line items table with its columns", () => {
    render(
      <TransactionDetailView transaction={otherTransaction} lineItems={employeeLineItems} />
    );
    expect(screen.getByText("Mark Reyes")).toBeInTheDocument();
    expect(screen.getByText("Delivery vendor")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Type" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Remarks" })).toBeInTheDocument();
  });

  it("shows an empty state when there are no line items yet", () => {
    render(<TransactionDetailView transaction={visitorPassTransaction} lineItems={[]} />);
    expect(screen.getByText(/no line items yet/i)).toBeInTheDocument();
  });

  it("deletes a line item after confirming, and not when the confirm is declined", async () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={visitorPassLineItems}
      />
    );

    vi.stubGlobal("confirm", vi.fn(() => false));
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(fetch).not.toHaveBeenCalled();

    vi.stubGlobal("confirm", vi.fn(() => true));
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1/line-items/li1",
        expect.objectContaining({ method: "DELETE" })
      )
    );
  });

  it("links the file thumbnail to the authenticated file route", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={visitorPassLineItems}
      />
    );
    expect(screen.getByRole("link", { name: /id\.pdf/i })).toHaveAttribute(
      "href",
      "/api/line-items/li1/file"
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "app/(authenticated)/transactions/open/\[id\]/TransactionDetailView.test.tsx"`
Expected: FAIL — the component doesn't exist yet.

- [ ] **Step 3: Write the component**

Create `app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export type TransactionDetailData = {
  id: string;
  transactionCode: string;
  qrDataUrl: string;
  matrixTypeName: string;
  statusName: string;
  createdBy: string;
  createdAt: string;
  detailFields: { label: string; value: string }[];
};

export type LineItemRow = {
  id: string;
  variant: "visitor-pass" | "employee";
  visitorName: string;
  jobTitle: string;
  company: string;
  contactNumber: string;
  emailAddress: string;
  transportType: string;
  uploadFileName: string;
  hasFile: boolean;
  employeeType: string;
  employeeId: string;
  employeeName: string;
  jobPosition: string;
  department: string;
  businessUnit: string;
  remarks: string;
};

const VISITOR_PASS_COLUMNS = [
  "Visitor Name",
  "Job Title",
  "Company",
  "Contact #",
  "Transport Type",
  "File",
  "Actions",
];

const EMPLOYEE_COLUMNS = [
  "Type",
  "Name",
  "Job Position",
  "Department",
  "Business Unit",
  "Remarks",
  "Actions",
];

export function TransactionDetailView({
  transaction,
  lineItems,
}: {
  transaction: TransactionDetailData;
  lineItems: LineItemRow[];
}) {
  const router = useRouter();
  const isVisitorPass = transaction.matrixTypeName === "Visitor Pass";
  const columns = isVisitorPass ? VISITOR_PASS_COLUMNS : EMPLOYEE_COLUMNS;

  async function handleDelete(lineItemId: string) {
    if (!confirm("Delete this line item?")) return;
    await fetch(`/api/transactions/${transaction.id}/line-items/${lineItemId}`, {
      method: "DELETE",
    });
    router.refresh();
  }

  return (
    <div className="w-full">
      <Link
        href="/transactions/open"
        className="mb-4 inline-block text-xs font-semibold text-[#2C7001] hover:underline"
      >
        ← Back to Open Transactions
      </Link>

      <div className="mb-6 flex flex-col gap-4 rounded-xl bg-white p-6 shadow sm:flex-row sm:items-start">
        <img
          src={transaction.qrDataUrl}
          alt={`QR code for transaction ${transaction.transactionCode}`}
          className="h-28 w-28 shrink-0 rounded border border-slate-200"
        />
        <div className="grid flex-1 grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Code</p>
            <p className="text-sm text-slate-800">{transaction.transactionCode}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Transaction Type
            </p>
            <p className="text-sm text-slate-800">{transaction.matrixTypeName}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Status
            </p>
            <p className="text-sm text-slate-800">{transaction.statusName}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Created By
            </p>
            <p className="text-sm text-slate-800">{transaction.createdBy}</p>
          </div>
          {transaction.detailFields.map((field) => (
            <div key={field.label}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {field.label}
              </p>
              <p className="text-sm text-slate-800">{field.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700">
          {isVisitorPass ? "Visitor Lists" : "Employee/Visitor Lists"}{" "}
          <span className="font-normal text-slate-400">({lineItems.length})</span>
        </h2>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow">
        <table className="w-full border-collapse text-left text-sm text-slate-600">
          <thead>
            <tr className="bg-[#2C7001]">
              {columns.map((column) => (
                <th
                  key={column}
                  className="whitespace-nowrap px-4 py-3 text-xs font-bold text-white"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                  No line items yet.
                </td>
              </tr>
            ) : (
              lineItems.map((item, index) => (
                <tr
                  key={item.id}
                  className={`border-b border-slate-100 ${index % 2 === 1 ? "bg-[#fbfdf9]" : "bg-white"}`}
                >
                  {isVisitorPass ? (
                    <>
                      <td className="whitespace-nowrap px-4 py-3">{item.visitorName}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.jobTitle}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.company}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.contactNumber || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.transportType}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {item.hasFile ? (
                          <a
                            href={`/api/line-items/${item.id}/file`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#2C7001] hover:underline"
                          >
                            📎 {item.uploadFileName}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                          {item.employeeType}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{item.employeeName}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.jobPosition}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.department}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.businessUnit}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.remarks}</td>
                    </>
                  )}
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      aria-label={`Delete ${isVisitorPass ? item.visitorName : item.employeeName}`}
                      onClick={() => handleDelete(item.id)}
                      className="text-slate-400 hover:text-red-600"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

Note the delete button's accessible name in the test is matched with `/delete/i` — the `aria-label` above (`` `Delete ${name}` ``) satisfies that since it contains "Delete".

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "app/(authenticated)/transactions/open/\[id\]/TransactionDetailView.test.tsx"`
Expected: PASS, all tests green.

- [ ] **Step 5: Write the page**

Create `app/(authenticated)/transactions/open/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { TransactionDetailView, type LineItemRow } from "./TransactionDetailView";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      matrixType: { select: { name: true } },
      status: { select: { name: true } },
      creator: { select: { firstName: true, lastName: true } },
      lineItems: {
        orderBy: { createdAt: "asc" },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              jobTitle: true,
              department: { select: { name: true } },
              businessUnit: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!transaction) notFound();

  const isVisitorPass = transaction.matrixType.name === "Visitor Pass";

  const detailFieldCandidates: { label: string; value: string }[] = [
    {
      label: "Planned Date",
      value: transaction.plannedDate
        ? transaction.plannedDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })
        : "—",
    },
    {
      label: "Planned Time",
      value: transaction.plannedTime
        ? transaction.plannedTime.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "UTC",
          })
        : "—",
    },
    { label: "Reason", value: transaction.reason ?? "—" },
  ];

  const transactionDetail = {
    id: transaction.id,
    transactionCode: transaction.transactionCode,
    qrDataUrl: await QRCode.toDataURL(transaction.transactionCode, { width: 240, margin: 1 }),
    matrixTypeName: transaction.matrixType.name,
    statusName: transaction.status.name,
    createdBy: `${transaction.creator.firstName} ${transaction.creator.lastName}`,
    createdAt: transaction.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    detailFields: detailFieldCandidates.filter((field) => field.value !== "—"),
  };

  const lineItems: LineItemRow[] = transaction.lineItems.map((item) => ({
    id: item.id,
    variant: isVisitorPass ? "visitor-pass" : "employee",
    visitorName: item.visitorName ?? "",
    jobTitle: item.jobTitle ?? "",
    company: item.company ?? "",
    contactNumber: item.contactNumber ?? "",
    emailAddress: item.emailAddress ?? "",
    transportType: item.transportType ?? "",
    uploadFileName: item.uploadFileName ?? "",
    hasFile: Boolean(item.uploadFileUrl),
    employeeType: item.employeeType ?? "",
    employeeId: item.employeeId ?? "",
    employeeName: item.employee
      ? `${item.employee.firstName} ${item.employee.lastName}`
      : (item.name ?? ""),
    jobPosition: item.employee?.jobTitle ?? "—",
    department: item.employee?.department.name ?? "—",
    businessUnit: item.employee?.businessUnit.name ?? "—",
    remarks: item.remarks ?? "",
  }));

  return (
    <div className="relative flex flex-1 items-start justify-center overflow-hidden bg-[#eef1ee] p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/mfc-logo.png')] bg-cover bg-center bg-no-repeat opacity-[0.18]"
      />
      <div className="relative z-10 w-full">
        <TransactionDetailView transaction={transactionDetail} lineItems={lineItems} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run the full suite and build**

Run: `npx vitest run`
Expected: only the two known pre-existing `prisma/seed.test.ts` baseline failures.

Run: `npm run build`
Expected: clean, no TypeScript errors. Confirm the new route `/transactions/open/[id]` appears in the route list.

- [ ] **Step 7: Commit**

```bash
git add "app/(authenticated)/transactions/open/[id]"
git commit -m "Add transaction detail page with read-only line items view and delete"
```

---

### Task 5: Add/Edit Line Item modal

**Files:**
- Modify: `app/(authenticated)/transactions/open/[id]/TransactionDetailView.tsx`
- Modify: `app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx`
- Modify: `app/(authenticated)/transactions/open/[id]/page.tsx`

**Interfaces:**
- Consumes: `POST /api/transactions/[id]/line-items`, `PATCH /api/transactions/[id]/line-items/[lineItemId]` (Task 3); `EMPLOYEE_TYPE_OPTIONS` (Task 1); `TRANSPORT_TYPE_OPTIONS` (already exists, from the header work).
- Produces: `TransactionDetailView` gains a new required prop, `employees: EmployeeOption[]` (only used for the Mega Employee dropdown), and a new `remarksDefault: string` prop (the header's `reason`, used to pre-fill a new line item's Remarks) — both consumed by `page.tsx`.

- [ ] **Step 1: Add the new test cases**

In `app/(authenticated)/transactions/open/[id]/TransactionDetailView.test.tsx`, add this constant near the top (after `employeeLineItems`):

```ts
const employees = [
  {
    id: "u1",
    name: "Jhon Niño Caser",
    jobPosition: "Business Analyst and Developer",
    department: "Digital Transformation and Business Systems",
    businessUnit: "MFC",
  },
];
```

Update every existing `render(<TransactionDetailView ... />)` call in the file to also pass `employees={employees}` and `remarksDefault="Sample reason"` (both required props from this point on).

Add these new test cases at the end of the `describe` block, before the closing `});`:

```tsx
  it("opens the Add Line Item modal showing the Visitor Pass fields when the transaction is Visitor Pass", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /\+ add line item/i }));

    expect(screen.getByLabelText(/visitor name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/job title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^company$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contact #/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/upload file/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/transport type/i)).toBeInTheDocument();
  });

  it("opens the Add Line Item modal showing the Employee Type buttons when the transaction is not Visitor Pass", () => {
    render(
      <TransactionDetailView
        transaction={otherTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /\+ add line item/i }));

    expect(screen.getByRole("button", { name: "Mega Employee" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Third-Party" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visitor" })).toBeInTheDocument();
    // Mega Employee is the default selection: Name dropdown + auto-filled display fields
    expect(screen.getByLabelText(/^name$/i).tagName).toBe("SELECT");
    expect(screen.getByText("Business Analyst and Developer")).toBeInTheDocument();
    expect(screen.getByText("MFC")).toBeInTheDocument();
  });

  it("switches to a free-text Name field and hides the auto-filled fields when Third-Party is selected", () => {
    render(
      <TransactionDetailView
        transaction={otherTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /\+ add line item/i }));
    fireEvent.click(screen.getByRole("button", { name: "Third-Party" }));

    expect(screen.getByLabelText(/^name$/i).tagName).toBe("INPUT");
    expect(screen.queryByText("Business Analyst and Developer")).not.toBeInTheDocument();
    expect(screen.queryByText("MFC")).not.toBeInTheDocument();
  });

  it("pre-fills Remarks from remarksDefault and allows editing it", () => {
    render(
      <TransactionDetailView
        transaction={otherTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /\+ add line item/i }));
    expect((screen.getByLabelText(/^remarks$/i) as HTMLInputElement).value).toBe(
      "Sample reason"
    );
  });

  it("shows a specific error and does not submit when a required field is missing", () => {
    render(
      <TransactionDetailView
        transaction={otherTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /\+ add line item/i }));
    fireEvent.click(screen.getByRole("button", { name: "Third-Party" }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Name is required");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("submits a new Visitor Pass line item as multipart form data", async () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /\+ add line item/i }));
    fireEvent.change(screen.getByLabelText(/visitor name/i), {
      target: { value: "Analyn Gentizon" },
    });
    fireEvent.change(screen.getByLabelText(/job title/i), {
      target: { value: "Procurement Officer" },
    });
    fireEvent.change(screen.getByLabelText(/^company$/i), {
      target: { value: "Acme Supplies" },
    });
    fireEvent.change(screen.getByLabelText(/transport type/i), {
      target: { value: "Car" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/transactions/t1/line-items");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get("visitorName")).toBe("Analyn Gentizon");
  });

  it("opens the Edit modal pre-filled with the line item's current values", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={visitorPassLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect((screen.getByLabelText(/visitor name/i) as HTMLInputElement).value).toBe(
      "Analyn Gentizon"
    );
  });

  it("opens the Edit modal for a Mega Employee line item with the correct employee pre-selected", () => {
    render(
      <TransactionDetailView
        transaction={otherTransaction}
        lineItems={megaEmployeeLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect((screen.getByLabelText(/^name$/i) as HTMLSelectElement).value).toBe("u1");
    expect(screen.getByText("Business Analyst and Developer")).toBeInTheDocument();
    expect((screen.getByLabelText(/^remarks$/i) as HTMLInputElement).value).toBe(
      "Sample remarks"
    );
  });

  it("submits an edit as a PATCH request to the line item's own url", async () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={visitorPassLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1/line-items/li1",
        expect.objectContaining({ method: "PATCH" })
      )
    );
  });
```

- [ ] **Step 2: Run the test to verify the new cases fail**

Run: `npx vitest run "app/(authenticated)/transactions/open/\[id\]/TransactionDetailView.test.tsx"`
Expected: FAIL — no Add Line Item button/modal exists yet, and the existing tests now fail too since they're missing the new required props.

- [ ] **Step 3: Add the modal to the component**

In `TransactionDetailView.tsx`, add these imports at the top:

```tsx
import { useState } from "react";
import { EMPLOYEE_TYPE_OPTIONS } from "@/lib/validation/transactionLineItem";
import { TRANSPORT_TYPE_OPTIONS } from "@/lib/transportTypeOptions";
```

Add these new types near the existing `LineItemRow` type:

```tsx
export type EmployeeOption = {
  id: string;
  name: string;
  jobPosition: string;
  department: string;
  businessUnit: string;
};

type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; lineItem: LineItemRow };
```

Change the component's signature and add the modal state, right after `const isVisitorPass = ...` line:

```tsx
export function TransactionDetailView({
  transaction,
  lineItems,
  employees,
  remarksDefault,
}: {
  transaction: TransactionDetailData;
  lineItems: LineItemRow[];
  employees: EmployeeOption[];
  remarksDefault: string;
}) {
  const router = useRouter();
  const isVisitorPass = transaction.matrixTypeName === "Visitor Pass";
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });

  // Visitor Pass fields
  const [visitorName, setVisitorName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [transportType, setTransportType] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Employee-variant fields
  const [employeeType, setEmployeeType] = useState<(typeof EMPLOYEE_TYPE_OPTIONS)[number]>(
    "Mega Employee"
  );
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [remarks, setRemarks] = useState(remarksDefault);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function openCreateModal() {
    setVisitorName("");
    setJobTitle("");
    setCompany("");
    setContactNumber("");
    setEmailAddress("");
    setTransportType("");
    setUploadFile(null);
    setEmployeeType("Mega Employee");
    setEmployeeId("");
    setName("");
    setRemarks(remarksDefault);
    setError("");
    setModal({ mode: "create" });
  }

  function openEditModal(item: LineItemRow) {
    setVisitorName(item.visitorName);
    setJobTitle(item.jobTitle);
    setCompany(item.company);
    setContactNumber(item.contactNumber);
    setEmailAddress(item.emailAddress);
    setTransportType(item.transportType);
    setUploadFile(null);
    setEmployeeType(
      (item.employeeType as (typeof EMPLOYEE_TYPE_OPTIONS)[number]) || "Mega Employee"
    );
    setEmployeeId(item.employeeId);
    setName(item.employeeType && item.employeeType !== "Mega Employee" ? item.employeeName : "");
    setRemarks(item.remarks);
    setError("");
    setModal({ mode: "edit", lineItem: item });
  }

  const selectedEmployee = employees.find((option) => option.id === employeeId);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (isVisitorPass) {
      if (!visitorName) return setError("Visitor Name is required");
      if (!jobTitle) return setError("Job Title is required");
      if (!company) return setError("Company is required");
      if (!transportType) return setError("Transport Type is required");
    } else {
      if (employeeType === "Mega Employee" && !employeeId) return setError("Name is required");
      if (employeeType !== "Mega Employee" && !name.trim()) return setError("Name is required");
      if (!remarks.trim()) return setError("Remarks is required");
    }

    setSubmitting(true);
    const body = new FormData();
    if (isVisitorPass) {
      body.set("visitorName", visitorName);
      body.set("jobTitle", jobTitle);
      body.set("company", company);
      if (contactNumber) body.set("contactNumber", contactNumber);
      if (emailAddress) body.set("emailAddress", emailAddress);
      body.set("transportType", transportType);
      if (uploadFile) body.set("uploadFile", uploadFile);
    } else {
      body.set("employeeType", employeeType);
      if (employeeType === "Mega Employee") body.set("employeeId", employeeId);
      else body.set("name", name);
      body.set("remarks", remarks);
    }

    const url =
      modal.mode === "edit"
        ? `/api/transactions/${transaction.id}/line-items/${modal.lineItem.id}`
        : `/api/transactions/${transaction.id}/line-items`;
    const response = await fetch(url, {
      method: modal.mode === "edit" ? "PATCH" : "POST",
      body,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setModal({ mode: "closed" });
    router.refresh();
  }
```

Add the "+ Add Line Item" button next to the existing line-items heading (replace the current heading block):

```tsx
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700">
          {isVisitorPass ? "Visitor Lists" : "Employee/Visitor Lists"}{" "}
          <span className="font-normal text-slate-400">({lineItems.length})</span>
        </h2>
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-full bg-[#2C7001] px-5 py-2 text-xs font-semibold text-white transition-all duration-150 ease-out hover:bg-[#256000] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(44,112,1,0.35)] active:translate-y-0 active:bg-[#1d4d00] active:shadow-[0_3px_8px_rgba(44,112,1,0.3)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35"
        >
          + Add Line Item
        </button>
      </div>
```

Add an Edit button next to the existing Delete button in each row (replace the Actions `<td>`):

```tsx
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      aria-label={`Edit ${isVisitorPass ? item.visitorName : item.employeeName}`}
                      onClick={() => openEditModal(item)}
                      className="mr-2 text-slate-400 hover:text-[#2C7001]"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${isVisitorPass ? item.visitorName : item.employeeName}`}
                      onClick={() => handleDelete(item.id)}
                      className="text-slate-400 hover:text-red-600"
                    >
                      🗑️
                    </button>
                  </td>
```

Add the modal JSX right before the component's closing `</div>` (the outermost wrapper):

```tsx
      {modal.mode !== "closed" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="line-item-modal-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35"
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <div className="w-full max-w-[420px] overflow-hidden rounded-xl bg-white shadow-xl">
              <div className="relative overflow-hidden bg-gradient-to-br from-[#2C7001] to-[#1d4d00] px-6 py-5 text-center">
                <h2
                  id="line-item-modal-title"
                  className="text-lg font-extrabold tracking-widest text-white"
                >
                  {modal.mode === "edit" ? "EDIT LINE ITEM" : "ADD LINE ITEM"}
                </h2>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setModal({ mode: "closed" })}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <form
                onSubmit={handleSubmit}
                className="max-h-[70vh] space-y-4 overflow-y-auto px-8 py-7"
              >
                {isVisitorPass ? (
                  <>
                    <div>
                      <label htmlFor="visitor-name" className="mb-1 block text-xs font-semibold text-slate-600">
                        Visitor Name
                      </label>
                      <input
                        id="visitor-name"
                        type="text"
                        value={visitorName}
                        onChange={(e) => setVisitorName(e.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="job-title" className="mb-1 block text-xs font-semibold text-slate-600">
                        Job Title
                      </label>
                      <input
                        id="job-title"
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="company" className="mb-1 block text-xs font-semibold text-slate-600">
                        Company
                      </label>
                      <input
                        id="company"
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-number" className="mb-1 block text-xs font-semibold text-slate-600">
                        Contact #
                      </label>
                      <input
                        id="contact-number"
                        type="text"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="email-address" className="mb-1 block text-xs font-semibold text-slate-600">
                        Email Address
                      </label>
                      <input
                        id="email-address"
                        type="email"
                        value={emailAddress}
                        onChange={(e) => setEmailAddress(e.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="upload-file" className="mb-1 block text-xs font-semibold text-slate-600">
                        Upload File
                      </label>
                      <input
                        id="upload-file"
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="transport-type" className="mb-1 block text-xs font-semibold text-slate-600">
                        Transport Type
                      </label>
                      <select
                        id="transport-type"
                        value={transportType}
                        onChange={(e) => setTransportType(e.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="" disabled>
                          Select a transport type
                        </option>
                        {TRANSPORT_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">
                        Employee Type
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {EMPLOYEE_TYPE_OPTIONS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setEmployeeType(option)}
                            className={`rounded border px-3 py-2 text-xs font-semibold ${
                              employeeType === option
                                ? "border-[#2C7001] bg-[#2C7001] text-white"
                                : "border-slate-300 text-slate-600"
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    {employeeType === "Mega Employee" ? (
                      <>
                        <div>
                          <label htmlFor="name" className="mb-1 block text-xs font-semibold text-slate-600">
                            Name
                          </label>
                          <select
                            id="name"
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                          >
                            <option value="" disabled>
                              Select an employee
                            </option>
                            {employees.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">
                            Job Position
                          </label>
                          <div className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                            {selectedEmployee?.jobPosition ?? ""}
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">
                            Department
                          </label>
                          <div className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                            {selectedEmployee?.department ?? ""}
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">
                            Business Unit
                          </label>
                          {selectedEmployee && (
                            <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                              {selectedEmployee.businessUnit}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div>
                        <label htmlFor="name" className="mb-1 block text-xs font-semibold text-slate-600">
                          Name
                        </label>
                        <input
                          id="name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                    )}

                    <div>
                      <label htmlFor="remarks" className="mb-1 block text-xs font-semibold text-slate-600">
                        Remarks
                      </label>
                      <input
                        id="remarks"
                        type="text"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </>
                )}

                {error && (
                  <p role="alert" className="text-xs text-red-600">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-[#2C7001] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "app/(authenticated)/transactions/open/\[id\]/TransactionDetailView.test.tsx"`
Expected: PASS, all tests green.

- [ ] **Step 5: Wire the new props into the page**

Replace the full contents of `app/(authenticated)/transactions/open/[id]/page.tsx` with:

```tsx
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { TransactionDetailView, type LineItemRow } from "./TransactionDetailView";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [transaction, users] = await Promise.all([
    prisma.transaction.findUnique({
      where: { id },
      include: {
        matrixType: { select: { name: true } },
        status: { select: { name: true } },
        creator: { select: { firstName: true, lastName: true } },
        lineItems: {
          orderBy: { createdAt: "asc" },
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
                jobTitle: true,
                department: { select: { name: true } },
                businessUnit: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        department: { select: { name: true } },
        businessUnit: { select: { name: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  if (!transaction) notFound();

  const isVisitorPass = transaction.matrixType.name === "Visitor Pass";

  const detailFieldCandidates: { label: string; value: string }[] = [
    {
      label: "Planned Date",
      value: transaction.plannedDate
        ? transaction.plannedDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })
        : "—",
    },
    {
      label: "Planned Time",
      value: transaction.plannedTime
        ? transaction.plannedTime.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "UTC",
          })
        : "—",
    },
    { label: "Reason", value: transaction.reason ?? "—" },
  ];

  const transactionDetail = {
    id: transaction.id,
    transactionCode: transaction.transactionCode,
    qrDataUrl: await QRCode.toDataURL(transaction.transactionCode, { width: 240, margin: 1 }),
    matrixTypeName: transaction.matrixType.name,
    statusName: transaction.status.name,
    createdBy: `${transaction.creator.firstName} ${transaction.creator.lastName}`,
    createdAt: transaction.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    detailFields: detailFieldCandidates.filter((field) => field.value !== "—"),
  };

  const lineItems: LineItemRow[] = transaction.lineItems.map((item) => ({
    id: item.id,
    variant: isVisitorPass ? "visitor-pass" : "employee",
    visitorName: item.visitorName ?? "",
    jobTitle: item.jobTitle ?? "",
    company: item.company ?? "",
    contactNumber: item.contactNumber ?? "",
    emailAddress: item.emailAddress ?? "",
    transportType: item.transportType ?? "",
    uploadFileName: item.uploadFileName ?? "",
    hasFile: Boolean(item.uploadFileUrl),
    employeeType: item.employeeType ?? "",
    employeeId: item.employeeId ?? "",
    employeeName: item.employee
      ? `${item.employee.firstName} ${item.employee.lastName}`
      : (item.name ?? ""),
    jobPosition: item.employee?.jobTitle ?? "—",
    department: item.employee?.department.name ?? "—",
    businessUnit: item.employee?.businessUnit.name ?? "—",
    remarks: item.remarks ?? "",
  }));

  const employees = users.map((user) => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    jobPosition: user.jobTitle,
    department: user.department.name,
    businessUnit: user.businessUnit.name,
  }));

  return (
    <div className="relative flex flex-1 items-start justify-center overflow-hidden bg-[#eef1ee] p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/mfc-logo.png')] bg-cover bg-center bg-no-repeat opacity-[0.18]"
      />
      <div className="relative z-10 w-full">
        <TransactionDetailView
          transaction={transactionDetail}
          lineItems={lineItems}
          employees={employees}
          remarksDefault={transaction.reason ?? ""}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run the full suite and build**

Run: `npx vitest run`
Expected: only the two known pre-existing `prisma/seed.test.ts` baseline failures.

Run: `npm run build`
Expected: clean, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add "app/(authenticated)/transactions/open/[id]"
git commit -m "Add Add/Edit Line Item modal to the transaction detail page"
```

---

### Task 6: Open Transactions table — row click navigates to the detail page

**Files:**
- Modify: `app/(authenticated)/transactions/open/TransactionsView.tsx`
- Modify: `app/(authenticated)/transactions/open/TransactionsView.test.tsx`

**Interfaces:**
- Consumes: the `/transactions/open/[id]` route (Task 4).
- Produces: no new exports — `TransactionsTable`'s row click behavior changes from expand-in-place to `router.push`.

- [ ] **Step 1: Update the tests**

In `app/(authenticated)/transactions/open/TransactionsView.test.tsx`:

Replace the `vi.mock("next/navigation", ...)` at the top with one that also exposes a spy-able `push`:

```tsx
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: pushMock }),
}));
```

Delete these now-obsolete tests entirely (they test the removed expand-in-place behavior):
- `"does not show detail fields until a row is expanded"`
- `"expands a row to reveal its populated detail fields, skipping dash-only ones, and collapses again on second click"`
- `"expanding a Visitor Pass row shows its populated visitor fields and skips its dash-only generic fields"`

Replace them with:

```tsx
  it("navigates to the transaction's detail page when a row is clicked", () => {
    renderView();
    fireEvent.click(rowFor("OT-001"));
    expect(pushMock).toHaveBeenCalledWith("/transactions/open/t1");
  });

  it("does not navigate when the QR thumbnail is clicked", () => {
    renderView();
    fireEvent.click(
      screen.getByRole("button", { name: "QR code for transaction OT-001" })
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
```

Add `beforeEach(() => { pushMock.mockClear(); });` inside the top-level `describe("TransactionsView", ...)` block, alongside the existing `beforeEach` that stubs `fetch` (either add a second `beforeEach` or fold the `pushMock.mockClear()` line into the existing one).

- [ ] **Step 2: Run the tests to verify the changes fail appropriately**

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx"`
Expected: the two new tests FAIL (row click still expands, doesn't navigate); the rest of the suite still passes since the component hasn't changed yet.

- [ ] **Step 3: Update the component**

In `app/(authenticated)/transactions/open/TransactionsView.tsx`, inside `TransactionsTable`:

Remove the `expandedCode` state and its two usages (the `setExpandedCode` calls, the chevron span, and the entire `{isExpanded && (...)}` detail-row block) — the row no longer expands.

Remove the now-unused `transactionDetailFields` function entirely (its logic moved to the new detail page's `page.tsx` in Task 4).

Add `useRouter` to the imports already present in this file (it's already imported for `TransactionsView`, but `TransactionsTable` is a separate function in the same file — pass `router` down as a prop, or call `useRouter()` again inside `TransactionsTable` directly, since hooks are cheap and this avoids threading a prop through). Add at the top of `TransactionsTable`:

```tsx
function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  const router = useRouter();
  const columns = ["QR", "Code", "Transaction Type", "Created By", "Status", "Date Filed"];
  const [enlargedCode, setEnlargedCode] = useState<string | null>(null);
  const enlargedRow = rows.find((row) => row.transactionCode === enlargedCode) ?? null;
```

Change the row's `onClick`/`onKeyDown` (previously toggling `expandedCode`) to navigate instead:

```tsx
                    <tr
                      onClick={() => router.push(`/transactions/open/${row.id}`)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(`/transactions/open/${row.id}`);
                        }
                      }}
                      tabIndex={0}
                      className={`cursor-pointer border-b border-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2C7001]/40 ${index % 2 === 1 ? "bg-[#fbfdf9]" : "bg-white"}`}
                    >
```

(Drop the `aria-expanded` attribute and the chevron `<td>` — there's no expand state left to reflect. Reduce `colSpan={columns.length + 1}` references that referred to the chevron column back to `colSpan={columns.length}` in the empty-state row.)

The QR thumbnail button's existing `event.stopPropagation()` in its own `onClick` already prevents the row's navigation from firing when the thumbnail itself is clicked — confirm this still reads correctly with the new row `onClick`, no change needed there.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run "app/(authenticated)/transactions/open/TransactionsView.test.tsx"`
Expected: PASS, all tests green.

- [ ] **Step 5: Run the full suite and build**

Run: `npx vitest run`
Expected: only the two known pre-existing `prisma/seed.test.ts` baseline failures.

Run: `npm run build`
Expected: clean, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(authenticated)/transactions/open/TransactionsView.tsx" "app/(authenticated)/transactions/open/TransactionsView.test.tsx"
git commit -m "Navigate to the transaction detail page on row click instead of expanding in place"
```

---

## Post-plan verification (not a task — do after Task 6)

- Live-verify in the dev server: file a Visitor Pass transaction, click into its detail page, add a line item with a file upload, confirm the file link opens/downloads correctly, edit the line item, delete it, and confirm the empty state returns. Repeat for a non-Visitor-Pass transaction (Halfday, say), testing all three Employee Type choices (Mega Employee via the dropdown, Third-Party, Visitor).
- Restart the dev server after Task 1's migration runs, per the branch's documented stale-Prisma-Client gotcha.
- Confirm `uploads/` is genuinely gitignored (`git status` shows no untracked files under it after a live file upload).
