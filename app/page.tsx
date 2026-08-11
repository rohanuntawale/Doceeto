"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingStory } from "@/components/landing/landing-story";
import { LandingTwoSides } from "@/components/landing/landing-two-sides";
import { LandingConnection } from "@/components/landing/landing-connection";
import { LandingProductShowcase } from "@/components/landing/landing-product-showcase";
import { LandingFinalCta } from "@/components/landing/landing-final-cta";
import { SiteFooter } from "@/components/site/site-footer";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";

export default function Page() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] relative selection:bg-[var(--accent)] selection:text-white">
      {/* Inline Floating Landing Header (Replaces global SiteHeader for landing only) */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "py-3 bg-[var(--surface)]/85 backdrop-blur-xl border-b border-[var(--border)] shadow-soft"
            : "py-5 bg-transparent"
        }`}
      >
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-between">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <Wordmark />
          </Link>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <a
              href="#story"
              className="hover:text-[var(--text)] transition-colors"
            >
              Manifesto
            </a>
            <a
              href="#patient-doctor"
              className="hover:text-[var(--text)] transition-colors"
            >
              Roles
            </a>
            <a
              href="#how-it-works"
              className="hover:text-[var(--text)] transition-colors"
            >
              How it works
            </a>
            <a
              href="#showcase"
              className="hover:text-[var(--text)] transition-colors"
            >
              Experience
            </a>
          </nav>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Link href="/login" className="hidden sm:inline-block">
              <Button
                variant="ghost"
                size="sm"
                className="font-semibold text-xs"
              >
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button
                size="sm"
                className="font-bold text-xs bg-[var(--accent)] text-[var(--c-on-accent)] shadow-soft border-0"
              >
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Sections */}
      <main>
        <LandingHero />
        <LandingStory />
        <LandingTwoSides />
        <LandingConnection />
        <LandingProductShowcase />
        <LandingFinalCta />
      </main>

      {/* Site Footer */}
      <SiteFooter />
    </div>
  );
}
