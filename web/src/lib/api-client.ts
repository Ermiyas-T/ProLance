export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  // share a single refresh request so simultaneous expired requests do not rotate twice
  refreshPromise ??= fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

function notifySessionExpired(): void {
  // let the session provider own the UI transition instead of redirecting from fetch code
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("prolance:session-expired"));
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  // JSON requests need a content type while multipart requests must keep their browser boundary
  const headers = new Headers(init.headers);
  if (!(typeof FormData !== "undefined" && init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  // recover once from a short-lived access cookie unless this is itself an auth action
  if (
    response.status === 401 &&
    allowRefresh &&
    !["/auth/login", "/auth/refresh", "/auth/logout"].includes(path)
  ) {
    if (await refreshSession()) {
      return apiFetch<T>(path, init, false);
    }
    // /auth/me drives public and protected route initialization, so its caller handles redirects
    if (path !== "/auth/me") {
      notifySessionExpired();
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: "Unexpected error" }));
    throw new ApiError(response.status, body.detail ?? "Unexpected error");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
