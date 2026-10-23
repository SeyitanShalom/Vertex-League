"use client";

// Adapted from Akshay's animated-theme-toggle on 21st.dev.
// https://21st.dev/@axai-kaizoku/components/animated-theme-toggle
import { useSyncExternalStore } from "react";
import { m, useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function AnimatedThemeToggle() {
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const { resolvedTheme, setTheme } = useTheme();
  const reducedMotion = useReducedMotion();
  const isDark = resolvedTheme === "dark";
  const label = mounted && isDark ? "Switch to light mode" : "Switch to dark mode";
  const transition = { duration: reducedMotion ? 0 : 0.3, ease: "easeInOut" as const };

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={label}
      title={label}
      disabled={!mounted}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted && (
        <m.svg
          width="24"
          height="24"
          viewBox="0 0 25 25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <m.g
            initial={false}
            animate={{ scale: isDark ? 0 : 1, opacity: isDark ? 0 : 1, rotate: isDark ? -45 : 0 }}
            transition={transition}
            style={{ transformOrigin: "12.5px 12.5px" }}
          >
            <circle cx="12.4058" cy="12.7625" r="5" />
            <path d="M12.4058 1.76251V3.76251 M12.4058 21.7625V23.7625 M4.62598 4.98248L6.04598 6.40248 M18.7656 19.1225L20.1856 20.5425 M1.40576 12.7625H3.40576 M21.4058 12.7625H23.4058 M4.62598 20.5425L6.04598 19.1225 M18.7656 6.40248L20.1856 4.98248" />
          </m.g>
          <m.path
            initial={false}
            animate={{ scale: isDark ? 1 : 0, opacity: isDark ? 1 : 0, pathLength: isDark ? 1 : 0 }}
            transition={transition}
            style={{ transformOrigin: "12.5px 12.5px" }}
            d="M21.1918 13.2013C21.0345 14.9035 20.3957 16.5257 19.35 17.8781C18.3044 19.2305 16.8953 20.2571 15.2875 20.8379C13.6797 21.4186 11.9398 21.5294 10.2713 21.1574C8.60281 20.7854 7.07479 19.9459 5.86602 18.7371C4.65725 17.5283 3.81774 16.0003 3.4457 14.3318C3.07367 12.6633 3.18451 10.9234 3.76526 9.31561C4.346 7.70783 5.37263 6.29868 6.72501 5.25307C8.07739 4.20746 9.69959 3.56862 11.4018 3.41132C10.4052 4.75958 9.92564 6.42077 10.0503 8.09273C10.175 9.76469 10.8957 11.3364 12.0812 12.5219C13.2667 13.7075 14.8384 14.4281 16.5104 14.5528C18.1823 14.6775 19.8435 14.1979 21.1918 13.2013Z"
          />
        </m.svg>
      )}
    </button>
  );
}
