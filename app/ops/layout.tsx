import { LayoutDashboard, Siren, Users, Pill } from "lucide-react";
import { Shell, type NavItem } from "@/components/layout/shell";

const nav: NavItem[] = [
  { href: "/ops", label: "Overview", kanji: "全", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/ops/sos", label: "SOS Dispatch", kanji: "助", icon: <Siren className="h-4 w-4" /> },
  { href: "/ops/doctors", label: "Doctors", kanji: "医", icon: <Users className="h-4 w-4" /> },
  { href: "/ops/orders", label: "AuraMed", kanji: "薬", icon: <Pill className="h-4 w-4" /> },
];

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell role="ops" sectionLabel="COMMAND CENTER" nav={nav}>
      {children}
    </Shell>
  );
}
