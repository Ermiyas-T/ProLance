// ReauthModal — now integrated into SessionProvider (providers.tsx).
// This file is kept as a no-op export so existing imports don't break.
// The actual re-auth UI renders inside the SessionProvider when session.openReauth() fires.

export function ReauthModal() {
  return null;
}
