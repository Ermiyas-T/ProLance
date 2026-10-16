// Anonymous participant avatar.
// The marketplace/proposal payloads only expose IDs (no names), so this renders a neutral
// person glyph on a colour derived from the UUID instead of inventing names or initials.

import { avatarColorClass } from "@/lib/identity";

const SIZES = {
  sm: { box: "h-8 w-8", icon: "h-4 w-4" },
  md: { box: "h-10 w-10", icon: "h-5 w-5" },
  lg: { box: "h-12 w-12", icon: "h-6 w-6" },
} as const;

export function ParticipantAvatar({
  id,
  size = "md",
  className = "",
}: {
  id: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const dimensions = SIZES[size];

  return (
    <div
      // stable colour per participant keeps the same person recognisable across pages
      className={`${dimensions.box} rounded-full ${avatarColorClass(id)} flex items-center justify-center text-white shrink-0 ${className}`}
      aria-hidden="true"
    >
      <svg className={dimensions.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    </div>
  );
}
