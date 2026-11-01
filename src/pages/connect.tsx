import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { AppShell } from "@/components/shell";
import { PageHeader, Panel, btn } from "@/components/kit";
import { usePageTitle } from "@/lib/workspace";

const APP_NAME = "Carterhub";
const SLUG = "carterhub";

function CopyBox({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState<boolean | "failed">(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-secondary/40 p-2">
      <code className="flex-1 break-all px-2 font-mono text-sm">{value || "…"}</code>
      <button type="button" className={btn.ghost} aria-label={label} onClick={async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); } catch { setDone("failed"); }
        setTimeout(() => setDone(false), 2000);
      }}>
        {done === true ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {done === true ? "Copied" : done === "failed" ? "Couldn't copy, select it instead" : "Copy"}
      </button>
    </div>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">{items.map((s, i) => <li key={i}>{s}</li>)}</ol>;
}

const A = ({ href, children }: { href: string; children: ReactNode }) => <a href={href} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">{children}</a>;

export default function ConnectPage() {
  usePageTitle("Connect an assistant");
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(new URL("/mcp", window.location.origin).toString()), []);
  const quoted = `'${url.replace(/'/g, "'\\''")}'`;
  const cmd = `claude mcp add --scope user --transport http ${SLUG} ${quoted}`;
  const claudeLink = `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(APP_NAME)}&connectorUrl=${encodeURIComponent(url)}`;
  const desktopConfig = JSON.stringify({ mcpServers: { [SLUG]: { command: "npx", args: ["-y", "mcp-remote", url] } } }, null, 2);

  return (
    <AppShell>
      <PageHeader eyebrow="AI assistants" title="Connect an assistant" lede="Let ChatGPT, Claude or another assistant read where you left off, capture ideas, add tasks and save checkpoints. You'll sign in with your Relay account, and the usual approval rules still apply." />
      <div className="grid gap-6">
        <Panel title="Your Relay address for assistants">
          <div className="p-5"><CopyBox value={url} label="Copy assistant address" /></div>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="ChatGPT">
            <div className="p-5"><Steps items={[
              <>Open <A href="https://chatgpt.com/#settings/Connectors/Advanced">ChatGPT app settings</A> and turn on Developer mode. If you can't, ask your ChatGPT admin.</>,
              <>Open the <A href="https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins">New plugin window</A>.</>,
              <>Enter the name <b>{APP_NAME}</b> and paste the address above.</>,
              <>Tick "I understand and want to continue" (ChatGPT shows this for every custom tool), then click Create.</>,
              <>Sign in to Relay and approve. Turn it on from the chat box, then ask ChatGPT to use Relay.</>,
            ]} /></div>
          </Panel>
          <Panel title="Claude">
            <div className="p-5"><Steps items={[
              <>Open the <A href={claudeLink}>Claude add-connector window</A>. The name and address are filled in.</>,
              <>Check the details and click Add.</>,
              <>If the window doesn't open, go to Claude's Connectors page, choose "Add custom connector", name it and paste the address.</>,
              <>Sign in to Relay and approve. Turn it on from the chat box, then ask Claude to use Relay.</>,
            ]} /></div>
          </Panel>
          <Panel title="Claude Desktop">
            <div className="space-y-3 p-5 text-sm">
              <p className="font-medium">Easiest: add it as a connector</p>
              <Steps items={[
                <>Open Claude Desktop and go to <b>Settings → Connectors</b>.</>,
                <>Click <b>Add custom connector</b>, name it <b>{APP_NAME}</b> and paste the address above. Click Add.</>,
                <>Click <b>Connect</b>, sign in to Relay and approve.</>,
                <>Turn it on from the chat box's tools menu, then ask Claude to use Relay.</>,
              ]} />
              <p className="pt-2 font-medium">Alternative: config file</p>
              <Steps items={[
                <>Install <A href="https://nodejs.org">Node.js</A> if you don't have it.</>,
                <>In Claude Desktop, go to <b>Settings → Developer → Edit Config</b>. This opens <code>claude_desktop_config.json</code>.</>,
                <>Replace its contents with this (or add the <code>{SLUG}</code> entry inside your existing <code>mcpServers</code>):</>,
              ]} />
              <CopyBox value={url ? desktopConfig : ""} label="Copy Claude Desktop config" />
              <Steps items={[<>Save the file and fully quit and reopen Claude Desktop.</>, <>A browser window opens: sign in to Relay and approve.</>, <>Ask Claude to use Relay.</>]} />
            </div>
          </Panel>
          <Panel title="Claude Code">
            <div className="space-y-3 p-5 text-sm">
              <p>Run this once in a terminal:</p>
              <CopyBox value={url ? cmd : ""} label="Copy Claude Code command" />
              <Steps items={[<>Start Claude Code and type <code>/mcp</code>.</>, <>Choose {SLUG} and sign in to Relay.</>, <>Ask Claude Code to use Relay.</>]} />
            </div>
          </Panel>
          <Panel title="Other assistants">
            <div className="p-5"><Steps items={[
              "Open the assistant's MCP server or custom connector settings.",
              "Add a remote MCP server.",
              "Name it and paste the address above.",
              "Sign in to Relay and approve.",
              "Turn it on, then ask the assistant to use Relay.",
            ]} /></div>
          </Panel>
        </div>

        <Panel title="After Relay changes: refresh your assistant">
          <div className="grid gap-6 p-5 md:grid-cols-2">
            <div><h3 className="mb-2 font-semibold">ChatGPT</h3><Steps items={["Open ChatGPT's Plugins page and select this app.", "Scroll to Information and click Refresh.", "If the address changed, delete the app and connect again with the new address.", "Start a new chat and ask ChatGPT to use Relay."]} /></div>
            <div><h3 className="mb-2 font-semibold">Claude</h3><Steps items={["Open Connectors and select this connector.", "Refresh its tools.", "If the address changed, remove it and connect again with the new address.", "Ask Claude to use Relay."]} /></div>
            <div><h3 className="mb-2 font-semibold">Claude Code</h3><Steps items={["Start a new Claude Code session; it loads the latest tools.", <>If the address changed, run <code>claude mcp remove {SLUG}</code>, then the command above again.</>, "Ask Claude Code to use Relay."]} /></div>
            <div><h3 className="mb-2 font-semibold">Other assistants</h3><Steps items={["Open its MCP or connector settings.", "Select the Relay connection.", "Refresh, reload or reconnect it.", "If the address changed, paste the new one.", "Start a new chat and ask it to use Relay."]} /></div>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
