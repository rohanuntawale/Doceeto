"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import MacOSDock, { type DockApp } from "@/components/ui/mac-os-dock";
import { cn } from "@/lib/utils/cn";

export interface DockItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  /** App-icon tint (an iOS system colour). */
  color: string;
}

/**
 * Desktop navigation as a macOS-style magnifying dock (replaces the sidebar
 * on the web). Each nav item becomes a glossy app squircle; the current
 * section shows the running-app indicator dot.
 */
export function AppDock({ items, activeId }: { items: DockItem[]; activeId: string }) {
  const router = useRouter();
  const [hover, setHover] = useState(false);

  const apps: DockApp[] = items.map((it) => ({
    id: it.id,
    name: it.label,
    icon: <Squircle icon={it.icon} color={it.color} />,
  }));

  return (
    // Recedes behind content at rest (z-0) so magnified icons never cover
    // cards; lifts above everything only while hovered.
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-6 z-40 hidden justify-center transition-opacity duration-300 lg:flex",
        hover ? "opacity-100" : "opacity-50",
      )}
    >
      <div
        className="pointer-events-auto"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <MacOSDock
          apps={apps}
          openApps={[activeId]}
          onAppClick={(id) => {
            const it = items.find((x) => x.id === id);
            if (it) router.push(it.href);
          }}
        />
      </div>
    </div>
  );
}

function Squircle({ icon: Icon, color }: { icon: LucideIcon; color: string }) {
  // Colourful glossy app tile (macOS-style) with a white icon.
  return (
    <div
      className="grid h-full w-full place-items-center rounded-[24%] border border-white/15"
      style={{
        background: `linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0) 45%), ${color}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -3px 8px rgba(0,0,0,0.28)",
      }}
    >
      <Icon className="h-1/2 w-1/2 text-white" strokeWidth={2.2} />
    </div>
  );
}
