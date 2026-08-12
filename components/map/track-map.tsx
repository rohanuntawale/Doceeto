"use client";

import { LiveTripMap, type TripEta } from "@/components/map/live-trip-map";
import type { LatLng } from "@/lib/types/domain";

export type { TripEta };

export interface TrackMapProps {
  /** The viewer. */
  self: LatLng & { label?: string };
  /** The other party on the visit. */
  other: LatLng & { label?: string };
  /**
   * Which side is travelling. The patient watches the provider come to them
   * ("other"); the provider watches themselves approach the address ("self").
   * The map needs to be told — a route drawn from the wrong end runs backwards
   * and the puck points the wrong way down it.
   */
  mover?: "self" | "other";
  /** Draw a road route. Off for video and clinic consults: nobody is driving,
   *  and a route between two pins would invent a journey. */
  routing?: boolean;
  /** The provider is at the door — stop following, stop counting down. */
  arrived?: boolean;
  height?: number;
  onEta?: (eta: TripEta | null) => void;
}

/**
 * The two-party tracker used on a consult card. A thin adapter over
 * LiveTripMap that resolves who is moving and who is being travelled to.
 */
export function TrackMap({
  self,
  other,
  mover = "other",
  routing = true,
  arrived = false,
  height = 300,
  onEta,
}: TrackMapProps) {
  const moving = mover === "self" ? self : other;
  const target = mover === "self" ? other : self;

  return (
    <LiveTripMap
      mover={moving}
      destination={target}
      routing={routing}
      arrived={arrived}
      height={height}
      onEta={onEta}
    />
  );
}
