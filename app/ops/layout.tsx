import { LayoutDashboard, Users, Pill } from "lucide-react";
import { Shell, type NavItem } from "@/components/layout/shell";
import { OpsGuard } from "@/components/ops/ops-guard";
import { requireSurface } from "@/lib/auth/guard";

const nav: NavItem[] = [
  {
    href: "/ops",
    label: "Overview",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    href: "/ops/doctors",
    label: "Doctors",
    icon: <Users className="h-4 w-4" />,
  },
  { href: "/ops/orders", label: "Doceeto", icon: <Pill className="h-4 w-4" /> },
];

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ops session only. OpsGuard stays for demo mode, where there are no accounts.
  await requireSurface("ops");

  return (
    <OpsGuard>
      <Shell role="ops" sectionLabel="COMMAND CENTER" nav={nav}>
        {children}
      </Shell>
    </OpsGuard>
  );
}
