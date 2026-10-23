"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Sun } from "lucide-react";
import Sidebar from "./Sidebar";
import StarButton from "./StarButton";
import { BRAND } from "@/lib/site";

const NAV = [
  { href: "/start", label: "Book", match: (p: string) => p !== "/" && !p.startsWith("/roadmaps") && !p.startsWith("/playground") },
  { href: "/roadmaps", label: "Roadmaps", match: (p: string) => p.startsWith("/roadmaps") },
  { href: "/playground", label: "Playground", match: (p: string) => p.startsWith("/playground") },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isLanding = pathname === "/";

  const toggleTheme = () => {
    const html = document.documentElement;
    const next = html.dataset.theme === "dark" ? "light" : "dark";
    html.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="app-header">
        <div className="app-header-inner">
          {!isLanding && (
            <button
              type="button"
              aria-label="Open chapter menu"
              aria-expanded={open}
              className="icon-btn mobile-only"
              onClick={() => setOpen((o) => !o)}
            >
              <Menu aria-hidden="true" />
            </button>
          )}

          <Link href="/" className="brand" aria-label={`${BRAND} home`}>
            {/* Text wordmark so it can flip for dark mode. */}
            <span className="brand-word" aria-hidden="true">
              MERN<span>prep</span>
            </span>
          </Link>

          <nav className="top-nav" aria-label="Primary">
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`top-nav-link${active ? " is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="header-actions">
            <StarButton variant="header" />
            <button
              type="button"
              aria-label="Toggle dark mode"
              className="icon-btn"
              onClick={toggleTheme}
            >
              <Moon className="icon-moon" aria-hidden="true" />
              <Sun className="icon-sun" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className={isLanding ? "landing-shell" : "shell-grid"}>
        {!isLanding && <Sidebar open={open} onClose={() => setOpen(false)} />}
        <main id="main" className={isLanding ? "landing-main" : "content"}>
          {children}
        </main>
      </div>
    </>
  );
}
