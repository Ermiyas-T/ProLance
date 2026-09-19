// Cookie helper utilities for managing the authentication token cookie.
const TOKEN_COOKIE_NAME = "prolance_token";
const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

// Read the authentication token cookie from document.cookie in browser context
export function getAuthCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${TOKEN_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Store the authentication token in a 7-day cookie with SameSite=Lax security
export function setAuthCookie(token: string): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + SEVEN_DAYS_IN_SECONDS * 1000).toUTCString();
  document.cookie = `${TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}; expires=${expires}; max-age=${SEVEN_DAYS_IN_SECONDS}; path=/; SameSite=Lax`;
}

// Remove the authentication token cookie on user logout or session termination
export function removeAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/; SameSite=Lax`;
}
