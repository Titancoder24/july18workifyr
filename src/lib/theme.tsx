"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";
type SidebarStyle = "brand" | "plain";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
  sidebarStyle: SidebarStyle;
  setSidebarStyle: (s: SidebarStyle) => void;
  toggleSidebarStyle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
  sidebarStyle: "plain",
  setSidebarStyle: () => {},
  toggleSidebarStyle: () => {},
});

const STORAGE_KEY = "workifyr-theme";
const SIDEBAR_STYLE_KEY = "workifyr-sidebar-style";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [sidebarStyle, setSidebarStyleState] = useState<SidebarStyle>("plain");

  useEffect(() => {
    const stored = (typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null) as Theme | null;
    const systemDark =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const initial: Theme = stored ?? (systemDark ? "dark" : "light");
    setThemeState(initial);
    applyTheme(initial);

    const storedSb = (typeof window !== "undefined" ? window.localStorage.getItem(SIDEBAR_STYLE_KEY) : null) as SidebarStyle | null;
    if (storedSb === "brand" || storedSb === "plain") {
      setSidebarStyleState(storedSb);
    }
  }, []);

  function applyTheme(t: Theme) {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    root.style.colorScheme = t;
  }

  function setTheme(t: Theme) {
    setThemeState(t);
    applyTheme(t);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, t);
    }
  }

  function toggle() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  function setSidebarStyle(s: SidebarStyle) {
    setSidebarStyleState(s);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDEBAR_STYLE_KEY, s);
    }
  }

  function toggleSidebarStyle() {
    setSidebarStyle(sidebarStyle === "brand" ? "plain" : "brand");
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle, sidebarStyle, setSidebarStyle, toggleSidebarStyle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
