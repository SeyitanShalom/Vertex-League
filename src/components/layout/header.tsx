"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Vertex League home">
      <span className="brand-mark" aria-hidden="true">
        V<span />
      </span>
      <span>
        VERTEX<span className="brand-secondary">LEAGUE</span>
      </span>
    </Link>
  );
}
const links = [
  ["/#about", "The competition"],
  ["/#registration", "Registration"],
  ["/#rules", "The rules"],
  ["/#faq", "FAQs"],
];
export function Header({ testMode }: { testMode: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {testMode && (
        <div className="test-banner">
          <span className="status-dot" /> TEST MODE{" "}
          <span className="test-banner-copy">
            Registration and payment details are for testing.
          </span>
        </div>
      )}
      <header className="site-header">
        <div className="container nav-inner">
          <Brand />
          <nav aria-label="Main navigation" className="desktop-nav">
            {links.map(([href, label]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="nav-actions">
            <Button asChild size="sm" className="nav-register">
              <Link href="/register">
                Register your team <ArrowUpRight size={16} />
              </Link>
            </Button>
            <button
              className="menu-button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {open && (
          <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile navigation">
            {links.map(([href, label]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}>
                {label}
              </Link>
            ))}
            <Link href="/register" onClick={() => setOpen(false)}>
              Register your team ↗
            </Link>
            <Link href="/access" onClick={() => setOpen(false)}>
              Find your registration
            </Link>
          </nav>
        )}
      </header>
    </>
  );
}
