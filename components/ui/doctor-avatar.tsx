import type { CSSProperties, ReactNode } from "react";
import { initials } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * A doctor's face wherever patients see one: the profile photo when it exists,
 * else the initials-on-accent monogram the app has always used. Size, shape
 * and typography stay with the caller via className — this only decides
 * photo-vs-monogram, so every list renders doctors the same way.
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
  const photo = doctor.avatarUrl;
  return (
    <span
      className={cn("grid shrink-0 place-items-center overflow-hidden", className)}
      style={{ ...(photo ? {} : { background: doctor.avatarColor ?? "#6B615A" }), ...style }}
      title={title}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(doctor.fullName.replace("Dr. ", ""))
      )}
    </span>
  );
}
