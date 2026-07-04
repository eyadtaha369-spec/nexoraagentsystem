import { createFileRoute, redirect } from "@tanstack/react-router";
// Root redirect. The AuthContext hydrates client-side; we defer routing to /login
// which itself bounces to /dashboard when a session exists.
export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => { throw redirect({ to: "/login" }); },
});
