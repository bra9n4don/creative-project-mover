import { emptyState, summarize, type HubState } from "./hub-store";

export function demoState(): HubState {
  const s = emptyState();
  const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  s.projects = [
    { id: "demo-personal-site", title: "Personal website", description: "A home for the things I build, write, and want to share.", goal: "Publish a small portfolio I am proud of.", status: "active", priority: "high", repository: "", color: "teal", version: 1, createdAt: ago(3000), updatedAt: ago(45) },
    { id: "demo-reading", title: "Reading companion", description: "Remember the useful parts of everything I read.", goal: "Capture highlights and find them again.", status: "planning", priority: "medium", repository: "", color: "purple", version: 1, createdAt: ago(4500), updatedAt: ago(180) },
    { id: "demo-automation", title: "Local automations", description: "Small scripts that make the everyday a little easier.", goal: "Automate my weekly file organization.", status: "paused", priority: "low", repository: "", color: "amber", version: 1, createdAt: ago(7000), updatedAt: ago(1440) },
  ];
  s.tasks = [
    { id: "demo-t1", projectId: "demo-personal-site", title: "Choose the projects to feature", description: "Pick three projects and write a short summary of each.", status: "done", priority: "high", agent: "You", evidence: "Three project summaries drafted.", dependencies: [], version: 1, createdAt: ago(2800), updatedAt: ago(90) },
    { id: "demo-t2", projectId: "demo-personal-site", title: "Finish the project detail page", description: "The desktop layout is ready. Start with the mobile spacing.", status: "in_progress", priority: "high", agent: "Claude Code", evidence: "", dependencies: ["demo-t1"], version: 1, createdAt: ago(2700), updatedAt: ago(45) },
    { id: "demo-t3", projectId: "demo-personal-site", title: "Review before publishing", description: "Check links, accessibility, and responsive behavior.", status: "todo", priority: "medium", agent: "", evidence: "", dependencies: ["demo-t2"], version: 1, createdAt: ago(2500), updatedAt: ago(2500) },
    { id: "demo-t4", projectId: "demo-reading", title: "Decide how to capture highlights", description: "Compare a browser bookmarklet with a simple paste-in form.", status: "todo", priority: "medium", agent: "Gemini", evidence: "", dependencies: [], version: 1, createdAt: ago(4000), updatedAt: ago(180) },
    { id: "demo-t5", projectId: "demo-automation", title: "Pick the folders to organize", description: "Waiting for a decision on which folders are safe to move.", status: "blocked", priority: "low", agent: "Codex", evidence: "", dependencies: [], version: 1, createdAt: ago(6000), updatedAt: ago(1440) },
  ];
  s.handoffs = [
    { id: "demo-h1", projectId: "demo-personal-site", title: "Project detail page is almost there", summary: "Finished the desktop project layout and drafted the three project descriptions. Mobile spacing still needs a pass. Nothing has been published.", nextAction: "Open the project detail page and fix the mobile spacing.", source: "Claude Code", target: "Next session", createdAt: ago(45) },
    { id: "demo-h2", projectId: "demo-reading", title: "Capture options researched", summary: "A paste-in form is the smallest useful first version. A bookmarklet can come later; no implementation has started.", nextAction: "Decide whether the first version only needs a paste-in form.", source: "Gemini", target: "You", createdAt: ago(180) },
    { id: "demo-h3", projectId: "demo-automation", title: "Paused before touching files", summary: "Listed the weekly file-organization steps. No files have been moved. Waiting to pick safe input and output folders.", nextAction: "Choose a test folder with copies, not your original files.", source: "Codex", target: "You", createdAt: ago(1440) },
  ];
  s.ideas = [
    { id: "demo-i1", title: "A tiny daily reflection", description: "One prompt at the end of the day: what did I move forward?", status: "inbox", source: "You", tags: ["personal"], createdAt: ago(60) },
    { id: "demo-i2", title: "Search my saved snippets", description: "Find the useful commands I keep saving in different places.", status: "exploring", source: "ChatGPT", tags: ["tools", "search"], createdAt: ago(300) },
    { id: "demo-i3", title: "A weekend project list", description: "Keep the fun projects separate from things that feel like work.", status: "inbox", source: "You", tags: ["someday"], createdAt: ago(850) },
  ];
  s.approvals = [
    { id: "demo-a1", projectId: "demo-personal-site", projectTitle: "Personal website", title: "Keep the first release focused", description: "Propose postponing the blog so the portfolio can ship first.", source: "Claude Code", status: "pending", changes: JSON.stringify({ type: "project", expectedVersion: 1, goal: "Publish the three-project portfolio first; add the blog later." }, null, 2), createdAt: ago(50) },
  ];
  s.activity = [
    { id: "demo-e1", title: "Saved a checkpoint", description: s.handoffs[0]!.nextAction, source: "Claude Code", kind: "checkpoint", projectId: "demo-personal-site", url: "", createdAt: ago(45) },
    { id: "demo-e2", title: "Suggested a smaller first release", description: "A plan change is waiting for your approval.", source: "Claude Code", kind: "approval", projectId: "demo-personal-site", url: "", createdAt: ago(50) },
    { id: "demo-e3", title: "Captured a daily reflection idea", description: "Saved for later, without interrupting the current project.", source: "You", kind: "idea", projectId: "", url: "", createdAt: ago(60) },
    { id: "demo-e4", title: "Saved research before switching tools", description: "Reading companion capture options.", source: "Gemini", kind: "checkpoint", projectId: "demo-reading", url: "", createdAt: ago(180) },
  ];
  return summarize(s);
}
