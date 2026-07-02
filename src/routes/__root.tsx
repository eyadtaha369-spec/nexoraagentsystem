import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-card p-10 text-center max-w-md">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">404</p>
        <h1 className="mt-3 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This screen doesn't exist in the CRM.</p>
        <div className="mt-6">
          <Link to="/" className="btn-brand hover:btn-brand-hover inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const isAuthError = /unauthorized|no authorization header/i.test(error?.message || "");
  useEffect(() => {
    if (isAuthError) {
      // Session missing/expired — bounce to sign-in instead of showing a blank error.
      supabase.auth.signOut().finally(() => {
        router.navigate({ to: "/auth", replace: true });
        reset();
      });
      return;
    }
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error, isAuthError, router, reset]);
  if (isAuthError) return null;
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-card p-10 text-center max-w-md">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message || "Please try again."}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="btn-brand hover:btn-brand-hover rounded-lg px-4 py-2 text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Nexora CRM — Internal Operating System" },
      { name: "description", content: "Internal agency CRM: track, assign, and convert leads in real time." },
      { name: "theme-color", content: "#0b0e1a" },
      { property: "og:title", content: "Nexora CRM — Internal Operating System" },
      { property: "og:description", content: "Internal agency CRM: track, assign, and convert leads in real time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Nexora CRM — Internal Operating System" },
      { name: "twitter:description", content: "Internal agency CRM: track, assign, and convert leads in real time." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/ekMMnjHLwddY0pzGI5ofeadV7lO2/social-images/social-1782970686514-NEXORA.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/ekMMnjHLwddY0pzGI5ofeadV7lO2/social-images/social-1782970686514-NEXORA.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="dark" richColors position="top-right" />
    </QueryClientProvider>
  );
}
