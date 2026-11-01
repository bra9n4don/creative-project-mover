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
  return <Ctx.Provider value={{ session, isLoaded, isSignedIn: !!session }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

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
    signOut: async ({ redirectUrl }: { redirectUrl?: string } = {}) => {
      await supabase.auth.signOut();
      window.location.href = redirectUrl || "/";
    },
  };
}
