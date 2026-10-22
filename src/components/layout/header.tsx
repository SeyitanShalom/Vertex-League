"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, m, useIsPresent, useReducedMotion } from "motion/react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Vertex League home">
      <Image
        className="brand-logo"
        src="/LOGO%205.png"
        width={3000}
        height={3000}
        sizes="(max-width: 500px) 130px, 150px"
        alt=""
      />
    </Link>
  );
}
const links = [
  ["/#about", "The competition"],
  ["/#rules", "The rules"],
  ["/#registration", "Registration"],
  ["/#faq", "FAQs"],
];

function MobileNavigation({ onClose }: { onClose: () => void }) {
  const isPresent = useIsPresent();
  const reducedMotion = useReducedMotion();

  return (
    <m.div
      className="mobile-menu"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.22 }}
      aria-hidden={!isPresent}
      inert={!isPresent}
    >
      <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile navigation">
        {links.map(([href, label]) => (
          <Link key={href} href={href} onClick={onClose}>
            {label}
          </Link>
        ))}
        <Link href="/#rules" onClick={onClose}>
          Register your team ↗
        </Link>
        <Link href="/manager/sign-in" onClick={onClose}>
          Team sign-in
        </Link>
      </nav>
    </m.div>
  );
}

export function Header({ testMode }: { testMode: boolean }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
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
      <header
        className="site-header"
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            setOpen(false);
            menuButton.current?.focus();
          }
        }}
      >
        <div className="container nav-inner">
          <Brand />
          <nav aria-label="Main navigation" className="desktop-nav">
            {links.map(([href, label]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
            <Link href="/manager/sign-in">Team sign-in</Link>
          </nav>
          <div className="nav-actions">
            <Button asChild size="sm" className="nav-register">
              <Link href="/#rules">
                Register your team <ArrowUpRight size={16} />
              </Link>
            </Button>
            <button
              ref={menuButton}
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
        <AnimatePresence initial={false}>
          {open && <MobileNavigation key="mobile-menu" onClose={() => setOpen(false)} />}
        </AnimatePresence>
      </header>
    </>
  );
}
