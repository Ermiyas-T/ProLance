// Placeholder until shadcn/ui primitives are added via the CLI
// (npx shadcn@latest add toast) — swap this file for the real hook then.
// TODO: replace with the real shadcn/ui toast implementation.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- keeps the real shadcn toast signature so call sites compile
export function toast(_options: {
  variant?: "default" | "destructive";
  title?: string;
  description?: string;
}): void {
  // no-op placeholder so the global mutation error handler compiles
}
