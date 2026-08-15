"use client";

import { useState } from "react";
import { LoaderCircle, MapPin } from "lucide-react";
import { requestDeviceLocation, useDeviceLocation } from "@/lib/geo/device-location";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";

/**
 * The location line under the greeting — and a real control, not a label.
 *
 * It used to be plain text reading "Set your location", which is an
 * instruction with nothing to press. Tapping it now asks the browser for a
 * fresh fix: that is also the only reliable way to raise the permission prompt
 * on iOS Safari, which grants geolocation far more readily from a user gesture
 * than from a background watch on page load.
 */
export function LocationChip({ className }: { className?: string }) {
  const { patient } = useCurrentPatient();
  const geo = useDeviceLocation();
  const [pressed, setPressed] = useState(false);

  const busy =
    pressed ||
    (!patient.located && (geo.status === "locating" || geo.status === "idle"));
  const denied = geo.status === "denied";
  const unsupported = geo.status === "unsupported";
  const { t } = useT();

  const label = busy
    ? t("home.locating")
    : denied
      ? t("home.locationBlocked")
      : unsupported
        ? patient.address || t("home.locationUnsupported")
        : patient.address || t("home.setLocation");

  const locate = async () => {
    setPressed(true);
    await requestDeviceLocation();
    setPressed(false);
  };

  return (
    <button
      type="button"
      onClick={locate}
      disabled={unsupported}
      title={
        denied
          ? t("home.locationBlockedHint")
          : unsupported
            ? t("home.locationUnsupported")
            : t("home.updateLocation")
      }
      aria-label={t("home.updateLocation")}
      className={cn(
        "group -mx-1.5 mt-1.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-white/5 hover:text-cream disabled:cursor-default disabled:hover:bg-transparent",
        denied && "text-[rgb(var(--c-status-warn))]",
        className,
      )}
    >
      {busy ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <MapPin className="h-3.5 w-3.5" />
      )}
      <span className="max-w-[60vw] truncate sm:max-w-none">{label}</span>
      {/* Only nudge when there is something to press for. */}
      {!busy && !unsupported && (
        <span className="text-[11px] font-semibold text-[rgb(var(--c-terracotta))] opacity-0 transition-opacity group-hover:opacity-100">
          {patient.address ? t("home.updateLocation") : t("home.allow")}
        </span>
      )}
    </button>
  );
}
