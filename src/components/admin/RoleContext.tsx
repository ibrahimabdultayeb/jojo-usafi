"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { can, type Capability, type Role } from "@/lib/admin/permissions";

/**
 * Who the admin thinks it is talking to.
 *
 * THERE IS NO AUTHENTICATION IN THIS BUILD. The role is a prototype switch so
 * the permission-aware structure can actually be seen working; it protects
 * nothing. When Supabase Auth lands, the role comes from the session and this
 * provider is the only thing that changes.
 *
 * The real boundary will always be Row Level Security in the database. This is
 * the matching front-end affordance, so staff are never shown a control that
 * would fail.
 */

interface RoleValue {
  role: Role;
  setRole: (role: Role) => void;
  allows: (capability: Capability) => boolean;
}

const RoleContext = createContext<RoleValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("owner");

  const value = useMemo<RoleValue>(
    () => ({ role, setRole, allows: (capability) => can(role, capability) }),
    [role],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleValue {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    // A component rendered outside the provider still has to work.
    return { role: "owner", setRole: () => {}, allows: (c) => can("owner", c) };
  }
  return ctx;
}

/**
 * Renders its children only when the current role allows the capability.
 * `fallback` lets a screen explain the absence instead of leaving a hole.
 */
export function Allowed({
  capability,
  children,
  fallback = null,
}: {
  capability: Capability;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { allows } = useRole();
  return <>{allows(capability) ? children : fallback}</>;
}
