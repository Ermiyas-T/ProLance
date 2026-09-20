import { session } from "./session";

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  // Let the browser set multipart boundaries for file uploads; JSON requests need an explicit content type.
  const headers = new Headers(init.headers);
  if (!(typeof FormData !== "undefined" && init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (session.token) headers.set("Authorization", `Bearer ${session.token}`);

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers,
  });

  // 401 = the token is invalid or expired. There is no recovery in-page
  // (V1 has no refresh token): clear the dead session and let the user
  // sign in again. A full navigation (not router.push) is deliberate — it
  // also clears the React Query cache from the dead session; replace() keeps
  // the expired page out of browser history.
  if (res.status === 401 && session.token && path !== "/auth/login") {
    session.setToken(null);
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Unexpected error" }));
    throw new ApiError(res.status, body.detail ?? "Unexpected error");
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
