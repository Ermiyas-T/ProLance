// In-memory session store — tokens never touch localStorage (Architecture.md §2).
// TODO: wire the full SessionProvider lifecycle (login, logout, updateUser)
// and the event-bus store that <ReauthModal> listens to for openReauth().
import type { User } from "@/types/entities";

export const session = {
  token: null as string | null,
  user: null as User | null,
  // called by the api-client when a 401 needs a silent re-login; the
  // ReauthModal subscribes to this signal and resolves the pending requests
  openReauth(): void {
    // TODO: signal the global <ReauthModal> to open
  },
};
