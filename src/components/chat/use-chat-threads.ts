import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createChatThreadFn, deleteChatThreadFn, getChatMessagesFn, listChatThreadsFn, renameChatThreadFn } from "@/lib/ai/chat.functions";

export const chatThreadsKey = ["chat", "threads"] as const;

export function useChatThreads() {
  const list = useServerFn(listChatThreadsFn);
  return useQuery({ queryKey: chatThreadsKey, queryFn: () => list() });
}

export function useChatThreadMessages(id: string) {
  const get = useServerFn(getChatMessagesFn);
  return useQuery({ queryKey: ["chat", "thread", id], queryFn: () => get({ data: { id } }), staleTime: Infinity, gcTime: 0 });
}

export function useChatThreadActions() {
  const qc = useQueryClient();
  const create = useServerFn(createChatThreadFn);
  const rename = useServerFn(renameChatThreadFn);
  const remove = useServerFn(deleteChatThreadFn);
  const refresh = () => qc.invalidateQueries({ queryKey: chatThreadsKey });
  return {
    refresh,
    create: async () => { const t = await create(); await refresh(); return t; },
    rename: async (id: string, title: string) => { await rename({ data: { id, title } }); await refresh(); },
    remove: async (id: string) => { await remove({ data: { id } }); await refresh(); },
  };
}
