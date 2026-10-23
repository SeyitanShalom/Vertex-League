"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return (
    <NextThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      storageKey="vertex-theme"
      enableSystem
      nonce={nonce}
    >
      {children}
    </NextThemeProvider>
  );
}
