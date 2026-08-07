"use client";

import { useState } from "react";
import { Navbar } from "./Navbar";
import { MobileDrawer } from "./MobileDrawer";

export function AppShell({
  initials,
  fullName,
  canProvisionUsers,
  children,
}: {
  initials: string;
  fullName: string;
  canProvisionUsers: boolean;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[#050505]">
      <Navbar
        initials={initials}
        fullName={fullName}
        canProvisionUsers={canProvisionUsers}
        onMenuClick={() => setDrawerOpen(true)}
      />
      <MobileDrawer
        canProvisionUsers={canProvisionUsers}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
