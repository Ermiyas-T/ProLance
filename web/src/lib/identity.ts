// Shared helpers for the UUID identities the backend returns for entities and users.
// Entity IDs are uuid.UUID on the wire, so they must never be parsed as numbers.

// Canonical UUID shape used to reject malformed dynamic-route segments before calling the API.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// True when a route segment is a well-formed UUID (guards detail pages against bad URLs).
export function isUuid(value: string | undefined): boolean {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

// Short, scannable form of an ID (first UUID group) used for anonymous participant labels.
export function shortId(id: string): string {
  return id.split("-")[0];
}

// Palette for anonymous participant avatars; colours carry no meaning beyond identity.
const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-violet-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-cyan-600",
  "bg-indigo-600",
  "bg-teal-600",
  "bg-fuchsia-600",
  "bg-orange-600",
];

// Stable colour class for an ID so the same participant looks the same on every page.
// Hashes the UUID instead of doing arithmetic on it (UUIDs are strings, not numbers).
export function avatarColorClass(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 997;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// Shortest honest display label for an anonymous party: "Client #a1b2c3d4".
export function participantLabel(role: string, id: string): string {
  return `${role} #${shortId(id)}`;
}
