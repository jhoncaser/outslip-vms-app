# Dashboard Tile Hover Effect — Design

**Date:** 2026-07-19
**Branch:** `green-rebrand`
**Status:** Approved by user (brainstormed via visual companion, session `1341-1784454868`, screens `tile-hover-effects.html` + `tile-hover-combo.html`)

## Goal

Give the four dashboard module tiles (Open / Approved / Canceled Transaction, My Approvals) a professional hover treatment. The user reviewed four individual effects (lift & shadow, accent sweep, icon pop, green ring), asked for a combination of the first three, compared a full-strength vs. a refined intensity live, and chose the **refined combo** on recommendation.

## Chosen design: refined A+B+C combo

On hover, simultaneously (~200ms ease-out transitions):

1. **Lift:** tile rises 2px with a soft green-tinted shadow.
2. **Accent sweep:** green left border thickens 4px → 6px; tile background takes a faint green wash (`#fbfdf9`); the uppercase label turns brand green `#2C7001`.
3. **Icon pop:** the colored icon badge scales to 1.08 with a soft glow shadow matching its own color.

Deliberately dialed back from the full-strength variant (3px lift, 8px border, 1.14 scale) so the three effects read as one cohesive motion — consistent with the login button's 2px-lift convention.

## Implementation

All changes in `components/dashboard/ModuleGrid.tsx` — classNames only. No logic, markup structure, `globals.css`, or dependency changes.

**Tile `<Link>`** — current:

```
flex items-start justify-between gap-3 rounded border border-l-4 border-slate-200 border-l-[#2C7001] bg-white p-4 shadow-sm hover:shadow-md
```

becomes:

```
group flex items-start justify-between gap-3 rounded border border-l-4 border-slate-200 border-l-[#2C7001] bg-white p-4 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-l-[6px] hover:bg-[#fbfdf9] hover:shadow-[0_8px_18px_rgba(44,112,1,0.13),0_2px_6px_rgba(0,0,0,0.05)] motion-reduce:transition-none motion-reduce:hover:translate-y-0
```

(`hover:shadow-md` is replaced by the custom green-tinted shadow.)

**Label `<div>`** — append:

```
transition-colors duration-200 group-hover:text-[#2C7001] motion-reduce:transition-none
```

**Icon badge `<span>`** — append (before `${module.badgeClass}`):

```
transition-all duration-200 group-hover:scale-[1.08] motion-reduce:transition-none motion-reduce:group-hover:scale-100
```

**Per-module glow** — each module's `badgeClass` gains a `group-hover:shadow-[...]` in its own color at 0.20 alpha (600-shade RGB values):

| Module | Appended to `badgeClass` |
|---|---|
| Open (sky) | `group-hover:shadow-[0_2px_6px_rgba(2,132,199,0.20)]` |
| Approved (green) | `group-hover:shadow-[0_2px_6px_rgba(22,163,74,0.20)]` |
| Canceled (red) | `group-hover:shadow-[0_2px_6px_rgba(220,38,38,0.20)]` |
| My Approvals (amber) | `group-hover:shadow-[0_2px_6px_rgba(217,119,6,0.20)]` |

## Accessibility

- **Reduced motion:** movement (lift, icon scale) is disabled via `motion-reduce:` variants using the Tailwind-documented `motion-reduce:hover:translate-y-0` / `motion-reduce:group-hover:scale-100` neutralizer pattern (same convention as `Sidebar.tsx`); transitions are dropped entirely (`motion-reduce:transition-none`), so color/border/shadow changes apply instantly but still apply — they are not motion.
- **Keyboard focus:** out of scope; tiles keep the browser's default focus outline (unchanged from today).

## Note on layout shift

The 4px → 6px border-left growth shifts tile content 2px right on hover. This is intentional — it is part of the "sweep" feel, was visible in both mockups the user compared, and was accepted in the chosen option.

## Testing

No new tests. The hover treatment is decorative CSS; existing `ModuleGrid.test.tsx` behavior tests (tile presence + approvals gating) still cover the component — same reasoning as the icon-badge round (`ef4a275`).

## Explicitly declined

- Full-strength combo (3px lift, 8px border, 1.14 icon scale) — too busy stacked together.
- Green ring effect (option D) — not selected.
- Focus-visible styling changes, mobile/touch-specific behavior — out of scope.
