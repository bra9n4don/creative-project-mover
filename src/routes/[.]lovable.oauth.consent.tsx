import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Plug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUser, useClerk } from "@/lib/auth";
import { btn } from "@/components/kit";

type OAuthDetails = { client?: { name?: string; client_name?: string; redirect_uri?: string } | null; redirect_uri?: string; scope?: string; redirect_url?: string; redirect_to?: string };
type OAuthResult = { data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // SSR has no localStorage session and would redirect signed-in users.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Connect an assistant · Relay" },
      { name: "description", content: "Approve or deny an AI assistant's access to your Relay workspace." },
      { property: "og:title", content: "Connect an assistant · Relay" },
      { property: "og:description", content: "Approve or deny an AI assistant's access to your Relay workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("This connection link is missing its authorization ID. Start the connection again from your assistant.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ href: `/sign-in?next=${encodeURIComponent(location.pathname + location.searchStr)}` });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.searchStr).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-4">
      <div className="max-w-md rounded-2xl border bg-card p-6 text-sm">
        <h1 className="font-display text-xl font-semibold">This connection request can't be opened</h1>
        <p className="mt-2 text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
        <p className="mt-2 text-muted-foreground">It may have expired. Start the connection again from your assistant.</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = details?.client?.name ?? details?.client?.client_name ?? "An assistant";
  const redirectUri = details?.client?.redirect_uri ?? details?.redirect_uri;
  const scopes = (details?.scope ?? "").split(/\s+/).filter(Boolean);
  const label = (s: string) => s === "openid" ? "Confirm who you are" : s === "email" ? "Share your email address" : s === "profile" ? "Share your basic profile" : `Additional permission requested: ${s}`;

  async function decide(approve: boolean) {
    setBusy(true); setError(null);
    const { data, error } = approve ? await oauth().approveAuthorization(authorization_id) : await oauth().denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(`${approve ? "Couldn't approve" : "Couldn't cancel"}: ${error.message}`); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("No redirect came back from sign-in. Try again from your assistant."); return; }
    window.location.href = target;
  }

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6">
        <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Plug className="h-5 w-5" /></div>
        <h1 className="font-display text-2xl font-semibold">Connect {name} to Relay</h1>
        <p className="mt-2 text-sm text-muted-foreground">{name} will be able to read where you left off, capture ideas, draft tasks, report progress and save checkpoints as you. It can't verify tasks, delete anything or approve plan changes.</p>
        {redirectUri && <p className="mt-3 break-all font-mono text-xs text-muted-foreground">Returns to {redirectUri}</p>}
        {scopes.length > 0 && <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">{scopes.map((s) => <li key={s}>{label(s)}</li>)}</ul>}
        <p className="mt-4 text-xs text-muted-foreground">Signed in as {user?.primaryEmailAddress.emailAddress}. <button className="underline" onClick={() => signOut({ redirectUrl: `/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}` })}>Switch account</button></p>
        <p className="mt-1 text-xs text-muted-foreground">This doesn't bypass Relay's owner-only rules.</p>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-5 flex gap-2">
          <button className={btn.primary + " flex-1"} disabled={busy} onClick={() => decide(true)}>Approve</button>
          <button className={btn.ghost + " flex-1"} disabled={busy} onClick={() => decide(false)}>Cancel connection</button>
        </div>
      </div>
    </main>
  );
}
