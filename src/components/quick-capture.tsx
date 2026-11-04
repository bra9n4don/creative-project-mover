import { useState } from "react";
import { Plus } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useCreateIdea } from "@/lib/hub-api";
import { useHubResult } from "@/lib/workspace";
import { btn } from "@/components/kit";

/** Mobile-only "+" button that saves an idea to the Ideas inbox from any screen. */
export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const createIdea = useCreateIdea();
  const result = useHubResult();
  const save = () => {
    if (!title.trim()) return;
    const r = result("Saved to your Ideas inbox");
    createIdea.mutate({ data: { title: title.trim().slice(0, 150), description: details.trim().slice(0, 2000), tags: ["quick-capture"] } }, {
      onSuccess: (v) => { r.onSuccess(v); setTitle(""); setDetails(""); setOpen(false); },
      onError: r.onError,
    });
  };
  return (
    <>
      <button
        data-testid="button-quick-capture"
        aria-label="Capture an idea"
        onClick={() => setOpen(true)}
        className="fixed right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
        style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
      >
        <Plus className="h-6 w-6" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetTitle>Capture an idea</SheetTitle>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} placeholder="What's the idea?" aria-label="Idea" data-testid="input-quick-idea" className="mt-4 w-full rounded-lg border bg-background px-3 py-2.5 text-base" />
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} rows={3} placeholder="Details (optional)" aria-label="Details" className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 text-base" />
          <button onClick={save} disabled={!title.trim() || createIdea.isPending} data-testid="button-save-quick-idea" className={`${btn.primary} mt-3 w-full justify-center`}>
            {createIdea.isPending ? "Saving…" : "Save to Ideas"}
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}
