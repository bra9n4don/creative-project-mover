import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = { session: Session | null; isLoaded: boolean; isSignedIn: boolean };
const Ctx = createContext<AuthCtx>({ session: null, isLoaded: false, isSignedIn: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoaded, setLoaded] = useState(false);
  const qc = useQueryClient();
  useEffect(() => {
    let prev: string | null | undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      const uid = s?.user.id ?? null;
      if (prev !== undefined && prev !== uid) qc.clear();
      prev = uid;
      setSession(s);
      setLoaded(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      prev = data.session?.user.id ?? null;
      setSession(data.session);
      setLoaded(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);
  return <Ctx.Provider value={{ session, isLoaded, isSignedIn: !!session }}><MfaGate session={session}>{children}</MfaGate></Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

/** When two-step verification is on, asks for the 6-digit code before the app opens. */
function MfaGate({ session, children }: { session: Session | null; children: ReactNode }) {
  const [need, setNeed] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!session) { setNeed(false); return; }
    void supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) =>
      setNeed(!!data && data.currentLevel !== "aal2" && data.nextLevel === "aal2"));
  }, [session?.access_token]);
  if (!need) return <>{children}</>;
  const verify = async () => {
    setBusy(true); setErr(null);
    const { data: f } = await supabase.auth.mfa.listFactors();
    const factor = f?.totp.find((x) => x.status === "verified");
    if (!factor) { setErr("No authenticator found."); setBusy(false); return; }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    setBusy(false);
    if (error) { setErr("That code didn't work. Try the newest one."); return; }
    setNeed(false);
  };
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background px-4">
      <div className="w-[380px] max-w-full rounded-2xl border bg-card p-7">
        <h1 className="font-display text-2xl font-semibold">Enter your code</h1>
        <p className="mt-1 text-sm text-muted-foreground">Open your authenticator app and type the 6-digit code for CarterHub.</p>
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)}
          className="mt-4 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-lg tracking-widest" data-testid="input-mfa-code" />
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
        <div className="mt-4 flex gap-2">
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" disabled={busy || code.length < 6} onClick={verify}>{busy ? "Checking…" : "Continue"}</button>
          <button className="rounded-md border px-4 py-2 text-sm" onClick={() => void supabase.auth.signOut({ scope: "local" })}>Sign out</button>
        </div>
      </div>
    </div>
  );
}

/** Shapes the signed-in user like the original app expected. */
export function useUser() {
  const { session } = useAuth();
  const u = session?.user;
  const fullName = (u?.user_metadata?.full_name as string | undefined) ?? (u?.user_metadata?.name as string | undefined) ?? null;
  return {
    user: u
      ? { fullName, firstName: fullName?.split(" ")[0] ?? null, primaryEmailAddress: { emailAddress: u.email ?? "" } }
      : null,
  };
}

export function useClerk() {
  return {
    signOut: async ({ redirectUrl, scope = "global" }: { redirectUrl?: string; scope?: "local" | "others" | "global" } = {}) => {
      await supabase.auth.signOut({ scope });
      window.location.href = redirectUrl || "/";
    },
  };
}
