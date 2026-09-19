// Session store holding active auth token and user state
import type { User } from "@/types/entities";
import { getAuthCookie, setAuthCookie, removeAuthCookie } from "./cookies";

export const session = {
  // read initial token directly from the auth cookie if available
  token: typeof window !== "undefined" ? getAuthCookie() : null,
  user: null as User | null,

  // helper method to update the token and keep the cookie in sync
  setToken(newToken: string | null): void {
    this.token = newToken;
    if (newToken) {
      setAuthCookie(newToken);
    } else {
      removeAuthCookie();
    }
  },
};
