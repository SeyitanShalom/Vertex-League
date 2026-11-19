import type { Metadata } from "next";
import { headers } from "next/headers";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { LogoThemeFilter } from "@/components/layout/logo-theme-filter";
import { JadeSkyBackground } from "@/components/layout/jade-sky-background";
import { MotionProvider } from "@/components/motion/motion-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { LIVE_REGISTRATION_PAUSED } from "@/lib/config/competition";
import { deploymentMode, siteUrl } from "@/lib/config/server";
import "./globals.css";
import "./brand-fonts.css";
import "@fontsource-variable/manrope";
import "@fontsource/anton";
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Vertex League — Bring your team. Make your mark.",
    template: "%s | Vertex League",
  },
  description:
    "Register your team for Vertex League. Bank transfer registration, physical screening, and a place to prove yourself on the pitch.",
  robots:
    deploymentMode() === "test" ? { index: false, follow: false } : { index: true, follow: true },
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const mode = deploymentMode();
  const registrationClosed = mode === "live" && LIVE_REGISTRATION_PAUSED;
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <LogoThemeFilter />
        <ThemeProvider nonce={nonce}>
          <JadeSkyBackground />
          <MotionProvider>
            <Header testMode={mode === "test"} registrationClosed={registrationClosed} />
            <main id="main">{children}</main>
            <Footer registrationClosed={registrationClosed} />
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
