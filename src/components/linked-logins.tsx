import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { btn } from "@/components/kit";

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
            {!l.is_primary && !l.is_current && <button className={btn.ghost} onClick={() => void remove(l.user_id)}>Remove</button>}
          </li>
        ))}
      </ul>
      <button className={`${btn.ghost} mt-4`} data-testid="button-link-login" onClick={() => void makeCode()}>Link another sign-in</button>
      {code && (
        <div className="mt-4 rounded-lg bg-accent/10 p-4">
          <div className="font-mono text-2xl tracking-widest" data-testid="text-link-code">{code}</div>
          <p className="mt-2 text-muted-foreground">On any device, sign in with the other account, then enter this code on the screen that says it isn't the owner. Works once, for 10 minutes.</p>
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
