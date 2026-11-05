import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { btn } from "@/components/kit";
import { checkNewPassword } from "@/lib/password-rules";

type Login = { user_id: string; provider: string | null; email: string | null; linked_at: string; is_primary: boolean; is_current: boolean };

const label = (p: string | null) => ({ google: "Google", apple: "Apple", azure: "Microsoft", email: "Email" } as Record<string, string>)[p ?? ""] ?? (p || "Sign-in");

/** Owner-only list of sign-ins that open this workspace, plus one-time link codes. */
export function LinkedLogins() {
  const qc = useQueryClient();
  const [code, setCode] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["hub", "linked-logins"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_hub_logins");
      if (error) throw new Error(error.message);
      return (data ?? []) as Login[];
    },
  });
  const makeCode = async () => {
    const { data, error } = await supabase.rpc("create_link_code");
    if (error) { toast.error(error.message); return; }
    setCode(data as string);
  };
  const remove = async (id: string) => {
    const { error } = await supabase.rpc("unlink_login", { _user_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Sign-in removed");
    void qc.invalidateQueries({ queryKey: ["hub", "linked-logins"] });
  };
  const makePrimary = async (l: Login) => {
    if (!window.confirm(`Make ${l.email ?? label(l.provider)} the main owner sign-in? The current main one stays linked.`)) return;
    const { error } = await supabase.rpc("make_primary_login", { _user_id: l.user_id });
    if (error) { toast.error(error.message); return; }
    toast.success("Main sign-in changed");
    void qc.invalidateQueries();
  };
  return (
    <div className="p-5 text-sm">
      <p className="text-muted-foreground">Every sign-in here opens your same workspace.</p>
      <ul className="mt-4 space-y-2" data-testid="list-linked-logins">
        {q.isLoading && <li className="text-muted-foreground">Loading…</li>}
        {q.error && <li className="text-destructive">Couldn't load sign-ins.</li>}
        {q.data?.map((l) => (
          <li key={l.user_id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <div className="font-medium">{label(l.provider)}{l.is_primary && " · original"}{l.is_current && " · this device"}</div>
              <div className="truncate font-mono text-xs text-muted-foreground">{l.email} · added {new Date(l.linked_at).toLocaleDateString()}</div>
            </div>
            <div className="flex shrink-0 gap-2">
              {!l.is_primary && <button className={btn.ghost} data-testid={`button-make-primary-${l.user_id}`} onClick={() => void makePrimary(l)}>Make main</button>}
              {!l.is_primary && !l.is_current && <button className={btn.ghost} onClick={() => void remove(l.user_id)}>Remove</button>}
            </div>
          </li>
        ))}
      </ul>
      <button className={`${btn.ghost} mt-4`} data-testid="button-link-login" onClick={() => void makeCode()}>Link another sign-in</button>
      {code && (
        <div className="mt-4 rounded-lg bg-accent/10 p-4">
          <div className="font-mono text-2xl tracking-widest" data-testid="text-link-code">{code}</div>
          <p className="mt-2 text-muted-foreground">On any device, sign in with the other account, then enter this code on the screen that says it isn't the owner. Works once, for 10 minutes. New email account? Create it at <span className="font-mono">/sign-up?link=1</span>.</p>
        </div>
      )}
    </div>
  );
}

/** Shown to a signed-in account that isn't the owner yet. */
export function RedeemLinkCode({ onLinked }: { onLinked: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("redeem_link_code", { _code: value });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Sign-in linked to your workspace");
    onLinked();
  };
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <input className="h-10 rounded-lg border border-input bg-background px-3 font-mono uppercase" placeholder="Link code" value={value} onChange={(e) => setValue(e.target.value)} data-testid="input-link-code" />
      <button className={btn.primary} disabled={busy || value.trim().length < 9} onClick={() => void submit()} data-testid="button-redeem-link-code">Link this sign-in</button>
    </div>
  );
}

/** Adds an email + password to the account you're signed in with now — no link code needed. */
export function PasswordSignIn() {
  const [email, setEmail] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);
  useState(() => { void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null)); });
  const save = async () => {
    const bad = checkNewPassword(pw, undefined, current);
    if (bad) { toast.error(bad); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser(current ? { password: pw, current_password: current } as never : { password: pw });
    setBusy(false);
    if (error) { toast.error(/current/i.test(error.message) ? "Enter your current password too." : error.message); return; }
    setPw(""); setCurrent("");
    toast.success("Password saved. You can now sign in with your email and this password.");
  };
  return (
    <div className="p-5 text-sm space-y-3">
      <p className="text-muted-foreground">
        Sign in with <span className="font-medium text-foreground">{email ?? "your email"}</span> and a password. It opens this same account.
      </p>
      <input type="password" autoComplete="new-password" placeholder="New password (12+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2" data-testid="input-new-password" />
      <input type="password" autoComplete="current-password" placeholder="Current password (only if you already have one)" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2" />
      <button className={btn.primary} disabled={busy || !email} onClick={save} data-testid="button-save-password">{busy ? "Saving…" : "Save password"}</button>
    </div>
  );
}
