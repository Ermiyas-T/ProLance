// Public route group layout — unauthenticated visitors only.
// Authenticated users are redirected to /dashboard by the page-level check.

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
