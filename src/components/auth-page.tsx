import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import "@lovable.dev/cloud-auth-js/styles.css";
import { useAuth } from "@/lib/auth";
import { btn, field } from "@/components/kit";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import { MIN_PASSWORD } from "@/lib/password-rules";
import { takePendingLink } from "@/lib/pending-link";
import { toast } from "sonner";

function AuthFrame({ children, mode }: { children: ReactNode; mode: "in" | "up" }) {
  return (
    <div className="grid min-h-[100dvh] bg-background lg:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-primary/40 blur-3xl" />
        <Link to="/" className="relative flex items-center gap-2.5">
          <img src="/logo.svg" alt="" className="h-9 w-9 rounded-lg" />
          <span className="font-display text-2xl font-semibold">CarterHub</span>
        </Link>
        <div className="relative mt-auto max-w-md">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">Where you left off</div>
          <p className="mt-3 font-display text-4xl font-semibold leading-tight">
            {mode === "in" ? "Welcome back. Your last checkpoint is waiting." : "One quiet place that remembers every project for you."}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-sidebar-foreground/70">
            Single owner, private by default. The first account to sign in with a verified email claims this workspace.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-10">{children}</div>
    </div>
  );
}

export function AuthPage({ mode }: { mode: "in" | "up" | "forgot" | "reset" }) {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  // Validated same-origin return path (e.g. the AI connection consent page); "/" means none.
  const [next, setNext] = useState("/");
  useEffect(() => setNext(oauthReturnPath(new URLSearchParams(window.location.search).get("next"))), []);
  const dest = next === "/" ? "/overview" : next;
  const goDest = () => void navigate({ href: dest });
  const nextSearch = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;

  useEffect(() => {
    if (!isSignedIn || (mode !== "in" && mode !== "up")) return;
    // Returning from "Link Google/Microsoft" in Settings: redeem the saved code first.
    const pending = takePendingLink(window.sessionStorage);
    if (!pending) { goDest(); return; }
    void supabase.rpc("redeem_link_code", { _code: pending.code }).then(async ({ data, error: rpcError }) => {
      const error = rpcError ?? (data === false ? { message: "That code is wrong, expired or already used" } : null);
      if (!error) { toast.success("Sign-in linked to your workspace"); void navigate({ to: "/settings" }); return; }
      if (/already|owner/i.test(error.message)) { toast.info("That sign-in is already linked."); void navigate({ to: "/settings" }); return; }
      await supabase.auth.signOut({ scope: "local" });
      setMsg({ kind: "err", text: `Couldn't link that account (${error.message}). Sign in with your main account and try again.` });
    });
  }, [isSignedIn, mode, dest]);

  // Once the owner has claimed CarterHub, new sign-ups are hidden (linked sign-ins still work).
  const [claimed, setClaimed] = useState(false);
  useEffect(() => {
    void supabase.rpc("hub_is_claimed").then(({ data }) => {
      const c = data === true;
      setClaimed(c);
      if (c && mode === "up" && !new URLSearchParams(window.location.search).has("link")) void navigate({ href: `/sign-in${nextSearch}` });
    });
  }, [mode]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        goDest();
      } else if (mode === "up") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: new URL(dest, window.location.origin).href } });
        if (error) throw error;
        setMsg({ kind: "ok", text: "Check your email to confirm your address, then come back to sign in." });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMsg({ kind: "ok", text: "If that email has an account, a link to choose a new password is on its way." });
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMsg({ kind: "ok", text: "Password saved." });
        setTimeout(() => void navigate({ to: "/overview" }), 800);
      }
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally { setBusy(false); }
  };

  const social = async (provider: "google" | "lovable" | "microsoft" | "apple") => {
    setMsg(null);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: new URL(dest, window.location.origin).href });
    if (result.error) { setMsg({ kind: "err", text: result.error.message ?? "Sign-in failed." }); return; }
    if (result.redirected) return;
    goDest();
  };

  const titles = {
    in: ["Pick up where you left off", "Sign in to your CarterHub workspace"],
    up: ["Start your CarterHub", "Your private project memory, empty and ready"],
    forgot: ["Reset your password", "We'll email you a link to choose a new one"],
    reset: ["Choose a new password", "You'll be signed in right after"],
  }[mode];

  return (
    <AuthFrame mode={mode === "up" ? "up" : "in"}>
      <div className="w-[420px] max-w-full rounded-2xl border bg-card p-7 shadow-2xl">
        <h1 className="font-display text-2xl font-semibold">{titles[0]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{titles[1]}</p>
        {(mode === "in" || mode === "up") && (
          <div className="mt-6 grid gap-2">
            <button type="button" className={btn.ghost} onClick={() => social("google")} data-testid="button-google">Continue with Google</button>
            <button type="button" className={btn.ghost} onClick={() => social("microsoft")} data-testid="button-microsoft">Continue with Microsoft</button>
            <button type="button" className={btn.ghost} onClick={() => social("apple")} data-testid="button-apple">Continue with Apple</button>
            <button type="button" className="lovable-auth-button" onClick={() => social("lovable")} data-testid="button-lovable">Continue with Lovable</button>
            <div className="my-2 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
          </div>
        )}
        <form onSubmit={submit} className="grid gap-3">
          {mode !== "reset" && (
            <label className="grid gap-1.5 text-sm font-medium">Email
              <input type="email" required autoComplete="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-email" />
            </label>
          )}
          {mode !== "forgot" && (
            <label className="grid gap-1.5 text-sm font-medium">{mode === "reset" ? "New password" : "Password"}
              <input type="password" required minLength={mode === "in" ? undefined : MIN_PASSWORD} autoComplete={mode === "in" ? "current-password" : "new-password"} className={field} value={password} onChange={(e) => setPassword(e.target.value)} data-testid="input-password" />
            </label>
          )}
          {msg && <p className={msg.kind === "ok" ? "text-sm text-accent" : "text-sm text-destructive"} role="status">{msg.text}</p>}
          <button type="submit" disabled={busy} className={`${btn.primary} mt-1`} data-testid="button-submit">
            {mode === "in" ? "Sign in" : mode === "up" ? "Create my workspace" : mode === "forgot" ? "Send reset link" : "Save password"}
          </button>
        </form>
        <div className="mt-5 flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
          {mode === "in" && <><Link to="/forgot-password" className="text-primary">Forgot password?</Link>{claimed ? <span>Private app. Only the owner can sign in.</span> : <span>New here? <Link to={`/sign-up${nextSearch}` as "/sign-up"} className="font-semibold text-primary">Create account</Link></span>}</>}
          {mode === "up" && <span>Already have one? <Link to={`/sign-in${nextSearch}` as "/sign-in"} className="font-semibold text-primary">Sign in</Link></span>}
          {(mode === "forgot" || mode === "reset") && <Link to="/sign-in" className="text-primary">Back to sign in</Link>}
        </div>
      </div>
    </AuthFrame>
  );
}
