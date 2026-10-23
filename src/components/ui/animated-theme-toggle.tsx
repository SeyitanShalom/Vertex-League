"use client";

// Adapted from Ayushmaan Singh's Theme Toggle on 21st.dev (MIT).
// https://21st.dev/@ayushmxxn/components/theme-toggle
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function AnimatedThemeToggle() {
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const label = mounted && isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={label}
      title={label}
      disabled={!mounted}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <span className="theme-toggle-thumb" aria-hidden="true" />
      <Moon className="theme-toggle-moon" size={16} strokeWidth={1.7} aria-hidden="true" />
      <Sun className="theme-toggle-sun" size={16} strokeWidth={1.7} aria-hidden="true" />
    </button>
  );
}
