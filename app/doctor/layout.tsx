import {
  LayoutDashboard,
  Inbox,
  Stethoscope,
  Wallet,
  UserRound,
} from "lucide-react";
import { Shell, type NavItem } from "@/components/layout/shell";

const nav: NavItem[] = [
  { href: "/doctor", label: "Home", kanji: "家", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/doctor/requests", label: "Requests", kanji: "頼", icon: <Inbox className="h-4 w-4" /> },
  { href: "/doctor/consults", label: "Consults", kanji: "診", icon: <Stethoscope className="h-4 w-4" /> },
  { href: "/doctor/earnings", label: "Earnings", kanji: "円", icon: <Wallet className="h-4 w-4" /> },
  { href: "/doctor/profile", label: "Profile", kanji: "私", icon: <UserRound className="h-4 w-4" /> },
];

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell role="doctor" sectionLabel="ZUMI · TASUKE" nav={nav}>
      {children}
    </Shell>
  );
}
