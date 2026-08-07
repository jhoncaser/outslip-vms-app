"use client";

import { useState } from "react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
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
        onMenuClick={() => setDrawerOpen(true)}
      />
      <div className="flex flex-1">
        <Sidebar canProvisionUsers={canProvisionUsers} />
        <MobileDrawer
          canProvisionUsers={canProvisionUsers}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
