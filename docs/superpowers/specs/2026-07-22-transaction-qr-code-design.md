# Transaction QR Code Column — Design

**Date:** 2026-07-22
**Branch:** `green-rebrand`
**Status:** Approved by user (brainstormed via `superpowers:brainstorming`, text-only)

## Goal

Every Open Transaction row gets a QR code encoding its `transactionCode`, shown as a new table column, with click-to-enlarge for readability. Display only — no scan/lookup functionality yet.

## Background / scope note

This was originally proposed as a full "generate QR at creation, guard scans it to pull up Approved transaction details" feature. That's blocked: no approval workflow exists yet (only `"Open"` status is seeded, `TransactionStatus` has no other rows, and `transactions/approved/page.tsx` is still an unbuilt `PagePlaceholder`) — see `docs/superpowers/2026-07-19-green-rebrand-handoff.md` §3w. The user chose to build **just the generation + display piece now** (this spec), leaving the guard scan-and-verify flow for later, once the approval workflow exists.

Scope is `app/(authenticated)/transactions/open` only — the only transaction list page that's actually built.

## Design

### 1. QR generation — server-side, one image per row

New dependency: `qrcode` (npm) — generates a QR code as a PNG data URL. Used **only** in the server component (`page.tsx`); never imported by a client component, so it adds zero bytes to the client bundle.

`page.tsx`'s existing per-row `.map()` becomes an async map (`Promise.all`) that adds one field:

```ts
qrDataUrl: await QRCode.toDataURL(row.transactionCode, { width: 240, margin: 1 }),
```

240px is generated once and reused at two display sizes (table thumbnail, enlarged view) via CSS — not two separate images. Downscaling a raster image in the browser stays crisp; the enlarged view is close enough to native resolution that it won't blur.

`TransactionRow` (`TransactionsView.tsx`) gains `qrDataUrl: string`.

### 2. Table column

New "QR" column, **first column, before "Code"**. Each cell is a `<button>` (not a bare `<img>`, so it's keyboard-reachable) wrapping a 48px thumbnail (`h-12 w-12`):

```tsx
<button
  type="button"
  onClick={() => setEnlargedCode(row.transactionCode)}
  aria-label={`View larger QR code for transaction ${row.transactionCode}`}
  className="h-12 w-12 overflow-hidden rounded border border-slate-200 transition-colors hover:border-[#2C7001] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35"
>
  <img src={row.qrDataUrl} alt="" className="h-full w-full" />
</button>
```

The `<img>` itself is `alt=""` (decorative) since the button's `aria-label` already carries the accessible name — avoids double-announcing the same information to screen readers.

### 3. Enlarge modal

Clicking the thumbnail opens a centered dialog reusing this app's established modal chrome (same overlay/card treatment as the Add Transaction modal in the same file): `role="dialog"`, `aria-modal="true"`, green-gradient header with the transaction code as the title, ✕ close button, larger rendering of the *same* `qrDataUrl` (`~224px`, i.e. `h-56 w-56`).

**Close behavior: ✕ only.** No backdrop-click or Escape-key dismissal — matches this branch's existing modal convention (already the de facto behavior of this same file's Add Transaction modal, and explicitly regression-tested for the Register Users edit modal).

State: a local `useState<string | null>` in `TransactionsTable` (the transaction code currently enlarged, or `null`). Self-contained — this has nothing to do with the Add Transaction form's state, so it doesn't need to be lifted to `TransactionsView`.

### 4. Testing

- `TransactionsView.test.tsx`: update the column-header-order assertion to include "QR" as the first column.
- New case: clicking a row's QR thumbnail opens the enlarge dialog showing that row's transaction code; clicking ✕ closes it.
- New case (regression, matching the Register Users edit-modal precedent): backdrop click and Escape do **not** close the enlarge dialog.
- No change needed to `app/api/transactions/route.test.ts` or the POST route itself — QR generation only happens on the read/render path.

## Out of scope

- Guard scan-and-lookup flow, and the "must be Approved" gate — deferred per §3w until the approval workflow exists.
- Download/print/copy actions on the QR image.
- QR codes on Approved/Canceled/My Approvals pages (not built yet).
- Any change to `transactionCode` generation or the `Transaction` schema.
