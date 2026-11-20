"use client";

import * as React from "react";
import { can, type Permission } from "@/lib/role-access";
import type { SessionUser } from "@/lib/portal-types";

export type Theme = "light" | "dark";

type PortalContextValue = {
  user: SessionUser;
  can: (permission: Permission) => boolean;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const PortalContext = React.createContext<PortalContextValue | null>(null);

export function PortalProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("light");

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("apthex_theme") as Theme | null;
      if (stored === "dark" || stored === "light") {
        setThemeState(stored);
        applyTheme(stored);
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const initial = prefersDark ? "dark" : "light";
        setThemeState(initial);
        applyTheme(initial);
      }
    } catch (_) {}

    function handleStorage(event: StorageEvent) {
      if (event.key === "apthex_theme" && (event.newValue === "light" || event.newValue === "dark")) {
        setThemeState(event.newValue);
        applyTheme(event.newValue);
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const applyTheme = (t: Theme) => {
    if (t === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    }
  };

  const setTheme = React.useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    try {
      localStorage.setItem("apthex_theme", newTheme);
    } catch (_) {}
  }, []);

  const toggleTheme = React.useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      applyTheme(next);
      try {
        localStorage.setItem("apthex_theme", next);
      } catch (_) {}
      return next;
    });
  }, []);

  const value = React.useMemo<PortalContextValue>(
    () => ({
      user,
      can: (permission) => can(user.accessLevel, permission),
      theme,
      setTheme,
      toggleTheme,
    }),
    [user, theme, setTheme, toggleTheme],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal(): PortalContextValue {
  const context = React.useContext(PortalContext);
  if (!context) throw new Error("usePortal must be used inside the portal shell");
  return context;
}
