import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { SiteMenu } from "@/components/site/site-menu";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";

/** Public header for About / Contact pages: brand + hamburger menu. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-espresso/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3 md:px-8">
        <Link href="/">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-2.5">
          <ThemeSwitcher />
          <SiteMenu />
        </div>
      </div>
    </header>
  );
}

