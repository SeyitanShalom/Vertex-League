import type { Metadata } from "next";
import { headers } from "next/headers";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
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
  await headers();
  return (
    <html lang="en">
      <body>
        <Header testMode={deploymentMode() === "test"} />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
