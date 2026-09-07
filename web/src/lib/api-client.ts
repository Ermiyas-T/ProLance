import { session } from "./session";

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
  }
}

type ReauthWaiter = { resolve: () => void; reject: (e: unknown) => void };
let pendingReauth: Promise<void> | null = null;
let reauthWaiters: ReauthWaiter[] = [];

// Called by ReauthModal on successful re-login
export function resolvePendingReauth() {
  reauthWaiters.forEach((w) => w.resolve());
  reauthWaiters = [];
  pendingReauth = null;
}

function triggerReauth(): Promise<void> {
  if (!pendingReauth) {
    pendingReauth = new Promise((resolve, reject) => {
      reauthWaiters.push({ resolve, reject });
    });
    // opens the global <ReauthModal> via a tiny event-bus store
    session.openReauth();
  }
  return pendingReauth;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const run = async (): Promise<Response> =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...init.headers,
      },
    });

  let res = await run();

  if (res.status === 401 && session.token) {
    // Token expired mid-session (no refresh token in V1) — recover, don't log out.
    await triggerReauth(); // resolves once ReauthModal gets a fresh token
    res = await run(); // retry the exact same request
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Unexpected error" }));
    throw new ApiError(res.status, body.detail ?? "Unexpected error");
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
