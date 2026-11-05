import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { useGithubSyncStatus } from "@/lib/hub-api";
import { onboardingProgress, onboardingSteps } from "@/lib/hub/onboarding";

export function useOnboarding() {
  const { session, isLoaded } = useAuth();
  const user = session?.user;
  const qc = useQueryClient();
  const [host, setHost] = useState("");
  useEffect(() => setHost(window.location.host), []);

  const claim = useQuery({
    queryKey: ["hub", "claim-status", user?.id ?? "anon"],
    enabled: isLoaded && !!user,
    queryFn: async () => {
      // refetch() bypasses enabled; never send the check without a signed-in user.
      if (!user) return { claimed: false, isOwner: false };
      const { data: claimed, error } = await supabase.rpc("hub_is_claimed");
      if (error) throw new Error("Couldn't check who owns this workspace.");
      let isOwner = false;
      if (user) {
        const owner = await supabase.rpc("is_hub_owner", { _uid: user.id });
        if (owner.error) throw new Error("Couldn't check who owns this workspace.");
        isOwner = !!owner.data;
      }
      return { claimed: !!claimed, isOwner };
    },
  });
  const isOwner = !!claim.data?.isOwner;
  const { state } = useWorkspace();
  const sync = useGithubSyncStatus({ query: { enabled: isOwner } });

  const steps = onboardingSteps({
    signedIn: !!user,
    emailConfirmed: !!user?.email_confirmed_at,
    claimed: !!claim.data?.claimed,
    isOwner,
    host,
    tokens: isOwner && state ? state.connections.map((c) => ({ status: c.status, lastSeen: c.lastSeen })) : [],
    githubSynced: !!sync.data?.lastSyncOk,
  });

  const claimNow = async () => {
    const { data, error } = await supabase.rpc("claim_hub");
    await qc.invalidateQueries({ queryKey: ["hub"] });
    if (error) throw new Error(error.message);
    return !!data;
  };

  return { claimError: claim.error, retryClaim: () => { if (user) void claim.refetch(); }, steps, progress: onboardingProgress(steps), isLoading: !isLoaded || (!!user && claim.isLoading), host, claimNow, connections: isOwner ? state?.connections ?? [] : [] };
}
