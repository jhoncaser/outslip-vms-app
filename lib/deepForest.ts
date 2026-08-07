// Deep Forest design tokens — the single source of truth for the dark
// redesign's colors/surfaces. Every page/component task imports from here
// instead of hardcoding new hex values.

export const pageBackground =
  "bg-[#050505] bg-[radial-gradient(120%_100%_at_20%_0%,#0f1f0a_0%,#060a06_55%,#050505_100%)] bg-no-repeat";

export const cardSurface =
  "rounded-xl border border-[#4ca71a]/35 bg-[#141e12]/70 backdrop-blur-md shadow-[0_0_40px_rgba(44,112,1,0.25)]";

export const tileSurface =
  "rounded-xl border border-[#4ca71a]/30 bg-[#141e12]/70";

export const headingText = "font-outfit font-extrabold text-white";

export const mutedText = "text-[#9db894]";

export const buttonPrimary =
  "btn-shimmer rounded-full bg-gradient-to-br from-[#3a9d0a] to-[#245c01] px-6 py-2.5 font-outfit text-sm font-bold text-white shadow-[0_6px_20px_rgba(58,157,10,0.35)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_32px_rgba(58,157,10,0.6)] active:translate-y-0 active:shadow-[0_4px_16px_rgba(58,157,10,0.45)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#57e34c]/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 disabled:pointer-events-none disabled:opacity-60";

export const buttonSecondary =
  "rounded-full border border-[#4ca71a]/40 bg-transparent px-5 py-2.5 text-sm font-semibold text-[#cfe9c7] transition-colors duration-150 hover:border-[#57e34c] hover:bg-[#57e34c]/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#57e34c]/35 motion-reduce:transition-none";

export const fieldLabel = "text-[13px] text-[#9db894]";

export const fieldUnderline =
  "w-full border-b border-[#4ca71a]/40 bg-transparent pb-1.5 text-sm text-[#eafbe4] placeholder:text-[#6f8a68] focus:border-[#57e34c] focus:outline-none";

export const fieldBox =
  "w-full rounded border border-[#4ca71a]/40 bg-[#0f1611] px-3 py-2 text-sm text-[#eafbe4] placeholder:text-[#6f8a68] focus:border-[#57e34c] focus:outline-none focus:ring-1 focus:ring-[#57e34c]";

export const tableWrap =
  "overflow-x-auto rounded-xl border border-[#4ca71a]/30 bg-[#141e12]/70 backdrop-blur-md shadow-[0_0_40px_rgba(44,112,1,0.15)]";

export const tableHeaderRow = "bg-gradient-to-r from-[#245c01] to-[#3a9d0a]";

export function tableRow(index: number): string {
  return `border-b border-[#4ca71a]/15 transition-colors ${
    index % 2 === 1 ? "bg-[#0f1611]/50" : "bg-transparent"
  }`;
}

export const modalHeader =
  "relative overflow-hidden bg-gradient-to-br from-[#3a9d0a] to-[#1d4d00] px-6 py-5 text-center";

export const modalCard =
  "w-full overflow-hidden rounded-xl border border-[#4ca71a]/35 bg-[#0c120a] shadow-[0_0_60px_rgba(44,112,1,0.35)]";

type PillHue = "blue" | "green" | "red" | "amber" | "slate";

const PILL_HUES: Record<PillHue, string> = {
  blue: "border-[#60a5fa]/35 bg-[#60a5fa]/18 text-[#93c5fd]",
  green: "border-[#57e34c]/35 bg-[#57e34c]/18 text-[#86efac]",
  red: "border-[#f87171]/35 bg-[#f87171]/18 text-[#fca5a5]",
  amber: "border-[#fbbf24]/35 bg-[#fbbf24]/18 text-[#fcd34d]",
  slate: "border-[#94a3b8]/35 bg-[#94a3b8]/18 text-[#cbd5e1]",
};

export function pillClass(hue: PillHue): string {
  return `inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${PILL_HUES[hue]}`;
}
