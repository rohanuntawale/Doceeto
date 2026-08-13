import type { CSSProperties, ReactNode } from "react";
import { AvatarImage } from "@/components/ui/avatar-image";
import { initials } from "@/lib/utils/format";

/**
 * A doctor's face wherever patients see one: the profile photo when it exists
 * AND loads, else the initials-on-accent monogram the app has always used.
 * Size, shape and typography stay with the caller via className — this only
 * decides photo-vs-monogram, so every list renders doctors the same way.
 *
 * The photo-vs-monogram decision itself lives in AvatarImage, which also
 * recovers from a photo that is present but unloadable — see the note there.
 */
export function DoctorAvatar({
  doctor,
  className,
  style,
  title,
}: {
  doctor: { fullName: string; avatarColor?: string; avatarUrl?: string };
  className?: string;
  /** Extra styles (e.g. an animation); the monogram background merges in. */
  style?: CSSProperties;
  title?: string;
}): ReactNode {
  return (
    <AvatarImage
      src={doctor.avatarUrl}
      background={doctor.avatarColor ?? "#6B615A"}
      className={className}
      style={style}
      title={title}
      fallback={initials(doctor.fullName.replace("Dr. ", ""))}
    />
  );
}
