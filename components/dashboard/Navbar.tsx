import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  return (
    <header className="flex items-center justify-between bg-[#0b2545] px-6 py-3 text-white">
      <div className="flex items-center gap-2 text-sm font-bold tracking-wide">
        <span aria-hidden>⛨</span>
        OUTSLIP VMS
      </div>
      <ThemeToggle />
    </header>
  );
}
