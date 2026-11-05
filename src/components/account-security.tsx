import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useClerk } from "@/lib/auth";
import { btn } from "@/components/kit";

const input = "w-full rounded-md border border-border bg-background px-3 py-2";

export function ChangeEmail() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: `${window.location.origin}/settings` });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setEmail("");
    toast.success("Check your inbox. Your email changes only after you click the link.");
  };
  return (
    <div className="space-y-3 p-5 text-sm">
      <p className="text-muted-foreground">Your email stays the same until you click the confirmation link we send.</p>
      <input type="email" autoComplete="email" placeholder="New email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} data-testid="input-new-email" />
      <button className={btn.primary} disabled={busy || !email.includes("@")} onClick={save}>{busy ? "Sending…" : "Change email"}</button>
    </div>
  );
}

export function SignOutOptions() {
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  const others = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Signed out on all your other devices.");
  };
  return (
    <div className="space-y-3 p-5 text-sm">
      <div className="flex flex-wrap gap-2">
        <button className={btn.ghost} onClick={() => void signOut({ redirectUrl: "/sign-in", scope: "local" })} data-testid="button-sign-out">This device</button>
        <button className={btn.ghost} disabled={busy} onClick={others} data-testid="button-sign-out-others">All other devices</button>
        <button className={btn.ghost} onClick={() => void signOut({ redirectUrl: "/sign-in", scope: "global" })} data-testid="button-sign-out-everywhere">Everywhere</button>
      </div>
      <p className="text-muted-foreground">Lost a device? Use "All other devices". Signing out does not disconnect Claude or ChatGPT; revoke them under Connected assistants.</p>
    </div>
  );
}

type Factor = { id: string; friendly_name?: string; status: string };

export function TwoStep() {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const load = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) { setUnavailable(true); return; }
    setFactors((data?.totp ?? []) as Factor[]);
  };
  useEffect(() => { void load(); }, []);
  const verified = (factors ?? []).filter((f) => f.status === "verified");

  const start = async () => {
    setBusy(true);
    // Drop any half-finished setup first.
    for (const f of (factors ?? []).filter((x) => x.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "CarterHub", friendlyName: `Phone ${Date.now().toString(36)}` });
    setBusy(false);
    if (error || !data) { setUnavailable(/disabled|not enabled/i.test(error?.message ?? "")); toast.error(error?.message ?? "Couldn't start setup."); return; }
    setSetup({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };
  const confirm = async (factorId: string, then: () => Promise<void>) => {
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (error) { setBusy(false); toast.error("That code didn't work. Try the newest one."); return; }
    await then();
    setBusy(false); setCode("");
  };
  const finishSetup = () => setup && confirm(setup.id, async () => {
    await supabase.auth.refreshSession();
    setSetup(null); await load();
    toast.success("Two-step verification is on.");
  });
  const turnOff = (id: string) => confirm(verified[0].id, async () => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) toast.error(error.message); else toast.success("Device removed.");
    await load();
  });

  if (unavailable) return <div className="p-5 text-sm text-muted-foreground">Two-step verification isn't switched on for this app's sign-in settings yet.</div>;
  if (!factors) return <div className="p-5 text-sm text-muted-foreground">Loading…</div>;
  const codeBox = <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} className={`${input} font-mono tracking-widest`} data-testid="input-2fa-code" />;

  return (
    <div className="space-y-3 p-5 text-sm">
      <p><span className="font-medium">{verified.length ? "On" : "Off"}</span>
        <span className="text-muted-foreground"> — {verified.length ? "you'll enter a code from your authenticator app when you sign in." : "add a code from an authenticator app when you sign in."}</span></p>
      {setup ? (
        <div className="space-y-3">
          <p className="text-muted-foreground">Scan this with your authenticator app, then type the code it shows.</p>
          <img src={setup.qr} alt="Code to scan with your authenticator app" className="h-44 w-44 rounded bg-card" />
          <p className="text-xs text-muted-foreground">Can't scan? Enter this key: <span className="font-mono break-all text-foreground">{setup.secret}</span></p>
          {codeBox}
          <div className="flex gap-2">
            <button className={btn.primary} disabled={busy || code.length < 6} onClick={finishSetup}>Turn on</button>
            <button className={btn.ghost} onClick={() => setSetup(null)}>Cancel</button>
          </div>
        </div>
      ) : verified.length ? (
        <div className="space-y-3">
          <ul className="space-y-1">{verified.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2"><span>{f.friendly_name || "Authenticator"}</span>
              <button className="text-destructive" disabled={busy || code.length < 6} onClick={() => void turnOff(f.id)}>Remove</button></li>
          ))}</ul>
          {codeBox}
          <p className="text-xs text-muted-foreground">Enter a current code to remove a device. Removing the last one turns two-step off.</p>
          <button className={btn.ghost} disabled={busy} onClick={start}>Add another device</button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="rounded-md border border-border p-3 text-muted-foreground">Before turning this on, link a second sign-in above. If you lose your phone without one, you could get locked out.</p>
          <button className={btn.primary} disabled={busy} onClick={start} data-testid="button-2fa-start">Turn on</button>
        </div>
      )}
    </div>
  );
}

export function ConnectedAssistants() {
  return (
    <div className="space-y-3 p-5 text-sm">
      <p className="text-muted-foreground">Claude and ChatGPT can read where you left off and save ideas, tasks and notes. They can't delete anything or change settings.</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/connect" className={btn.ghost}>Connect an assistant</Link>
        <Link href="/usage" className={btn.ghost}>See what they've saved</Link>
      </div>
      <p className="text-xs text-muted-foreground">Signing out everywhere does not disconnect assistants. Remove them in the assistant's own connector settings, or revoke their access key.</p>
    </div>
  );
}
