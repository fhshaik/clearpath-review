"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleHelp,
  Clock3,
  FileCheck2,
  FileText,
  GitCompareArrows,
  History,
  Inbox,
  KeyRound,
  Layers3,
  LoaderCircle,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { Dialog } from "radix-ui";
import {
  CHANNELS,
  POLICIES,
  POLICY_VERSION,
  PRODUCTS,
  activeFindings,
  actorName,
  currentVersion,
  riskLevel,
  statusLabel,
  type Action,
  type AuditEvent,
  type Campaign,
  type Envelope,
  type Finding,
  type Product,
  type Role,
  type Status,
} from "@/lib/domain";
import { csvCell, wordDiff } from "@/lib/presentation";

type View = "queue" | "policies" | "activity";
type Modal =
  | "connect"
  | "submit"
  | "revise"
  | "request"
  | "approve"
  | "dismiss"
  | "guide"
  | "reset"
  | null;
const date = (value: string, time = false) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(value));
const colors: Record<string, string> = {
  "Jamie Chen": "peach",
  "Sam Rivera": "lilac",
  "Priya Shah": "mint",
  "Alex Morgan": "blue",
};
function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span className={`avatar ${colors[name] || "blue"} ${small ? "small" : ""}`} aria-hidden="true">
      {name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`status-badge ${status}`}>
      {status === "approved" ? (
        <CheckCircle2 size={12} />
      ) : status === "changes_requested" ? (
        <RotateCcw size={12} />
      ) : (
        <Circle size={10} />
      )}
      {statusLabel(status)}
    </span>
  );
}
function RiskBadge({ campaign }: { campaign: Campaign }) {
  const risk = riskLevel(campaign);
  return (
    <span className={`risk-badge ${risk}`}>
      <span />
      {risk === "high" ? "High" : risk === "medium" ? "Medium" : "Low"}
    </span>
  );
}
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Empty({
  icon = <Inbox size={26} />,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Diff({ before, after }: { before: string; after: string }) {
  const pieces = useMemo(() => wordDiff(before, after), [before, after]);
  return (
    <div className="diff-columns">
      <div>
        <h4>Earlier copy</h4>
        <div className="diff-copy">
          {pieces
            .filter((p) => p.kind !== "add")
            .map((p, i) =>
              p.kind === "remove" ? <del key={i}>{p.text}</del> : <span key={i}>{p.text}</span>,
            )}
        </div>
      </div>
      <div>
        <h4>Revised copy</h4>
        <div className="diff-copy">
          {pieces
            .filter((p) => p.kind !== "remove")
            .map((p, i) =>
              p.kind === "add" ? <ins key={i}>{p.text}</ins> : <span key={i}>{p.text}</span>,
            )}
        </div>
      </div>
    </div>
  );
}
function Highlighted({
  text,
  findings,
  active,
  onSelect,
}: {
  text: string;
  findings: Finding[];
  active: string;
  onSelect: (id: string) => void;
}) {
  const ranges = findings
    .filter((f) => f.quote && f.disposition !== "dismissed")
    .map((f) => ({
      start: text.indexOf(f.quote),
      end: text.indexOf(f.quote) + f.quote.length,
      finding: f,
    }))
    .filter((r) => r.start >= 0)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  let cursor = 0;
  const elements: ReactNode[] = [];
  for (const r of ranges) {
    if (r.start < cursor) continue;
    elements.push(text.slice(cursor, r.start));
    elements.push(
      <button
        key={r.finding.id}
        type="button"
        className={`copy-highlight ${r.finding.severity} ${active === r.finding.id ? "active" : ""}`}
        onClick={() => onSelect(r.finding.id)}
        aria-label={`Review finding: ${r.finding.title}`}
      >
        {text.slice(r.start, r.end)}
      </button>,
    );
    cursor = r.end;
  }
  elements.push(text.slice(cursor));
  return <>{elements}</>;
}
function Stat({
  icon,
  label,
  value,
  detail,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div>
        <span>{label}</span>
        <span className={`stat-icon ${color}`}>{icon}</span>
      </div>
      <strong>{String(value).padStart(2, "0")}</strong>
      <p>{detail}</p>
    </div>
  );
}
function Activity({ events, onOpen }: { events: AuditEvent[]; onOpen?: (id: string) => void }) {
  return (
    <div className="activity-list">
      {events.length ? (
        events.map((e) => (
          <article className="activity-event" key={e.id}>
            <span
              className={`event-icon ${e.action.includes("approved") ? "green" : e.action.includes("AI") ? "purple" : ""}`}
            >
              {e.action.includes("approved") ? (
                <Check size={14} />
              ) : e.action.includes("AI") ? (
                <Sparkles size={14} />
              ) : e.action.includes("Changes") || e.action.includes("Comment") ? (
                <MessageSquare size={14} />
              ) : (
                <FileText size={14} />
              )}
            </span>
            <div>
              <div className="event-heading">
                <strong>{e.action}</strong>
                <time dateTime={e.at}>{date(e.at, true)}</time>
              </div>
              <p>
                {onOpen ? (
                  <button className="text-button" onClick={() => onOpen(e.campaignId)}>
                    {e.campaignName}
                  </button>
                ) : (
                  e.campaignName
                )}
                <span>
                  {" "}
                  · v{e.version} · {e.actor}
                </span>
              </p>
              <div className="event-detail">{e.detail}</div>
            </div>
          </article>
        ))
      ) : (
        <Empty title="The record starts here">
          Submissions, review notes, and decisions will appear here.
        </Empty>
      )}
    </div>
  );
}

export default function ReviewApp() {
  const [data, setData] = useState<Envelope | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const [view, setView] = useState<View>("queue"),
    [selectedId, setSelectedId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("reviewer"),
    [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false),
    [analyzing, setAnalyzing] = useState(false);
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState<"all" | Status>("all");
  const [product, setProduct] = useState("all"),
    [risk, setRisk] = useState("all"),
    [sort, setSort] = useState("newest");
  const [tab, setTab] = useState("creative"),
    [activeFinding, setActiveFinding] = useState("");
  const [connection, setConnection] = useState<{
    connected: boolean;
    expiresAt?: number;
    manageUrl?: string;
  }>({ connected: false });
  const [sponsored, setSponsored] = useState<{
    available: boolean;
    remaining: number;
    nextAvailableAt?: number;
  }>({ available: false, remaining: 0 });
  const [connecting, setConnecting] = useState(false);
  const model = "openai/gpt-4.1-mini";
  const [formError, setFormError] = useState(""),
    [note, setNote] = useState(""),
    [attested, setAttested] = useState(false);
  const [draftCopy, setDraftCopy] = useState(""),
    [draftName, setDraftName] = useState("");
  const [draftProduct, setDraftProduct] = useState<Product>("Personal loan"),
    [draftChannel, setDraftChannel] = useState<(typeof CHANNELS)[number]>("Email"),
    [draftPartner, setDraftPartner] = useState(""),
    [draftDue, setDraftDue] = useState("");
  const [comment, setComment] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locked = busy || analyzing || connecting;
  const campaigns = data?.workspace.campaigns || [];
  const selected = campaigns.find((c) => c.id === selectedId);
  const version = selected ? currentVersion(selected) : undefined;

  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }
  async function refresh() {
    setError("");
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      const payload = (await response.json()) as Envelope & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not load your workspace.");
      setData(payload);
      await refreshConnection();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your workspace.");
    } finally {
      setLoading(false);
    }
  }
  async function refreshConnection() {
    try {
      const [response, included] = await Promise.all([
        fetch("/api/auth/openrouter", { cache: "no-store" }),
        fetch("/api/ai/status", { cache: "no-store" }),
      ]);
      if (response.ok) setConnection(await response.json());
      if (included.ok) setSponsored(await included.json());
    } catch {
      /* The sample workspace remains available if connection status fails. */
    }
  }
  async function connectOpenRouter() {
    if (locked) return;
    setConnecting(true);
    setFormError("");
    try {
      const response = await fetch("/api/auth/openrouter/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: selectedId }),
      });
      const payload = (await response.json()) as { url: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not start OpenRouter sign-in.");
      const target = new URL(payload.url);
      if (target.origin !== "https://openrouter.ai" || target.pathname !== "/auth")
        throw new Error("The connection could not be started safely.");
      window.location.assign(target.toString());
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not connect OpenRouter.");
      setConnecting(false);
    }
  }
  async function disconnectOpenRouter() {
    if (locked) return;
    setConnecting(true);
    setFormError("");
    try {
      const response = await fetch("/api/auth/openrouter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not disconnect.");
      setConnection({ connected: false });
      notify("OpenRouter disconnected from this demo. You can also revoke its key in OpenRouter.");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not disconnect.");
    } finally {
      setConnecting(false);
    }
  }
  useEffect(() => {
    void refresh();
    const callback = new URLSearchParams(window.location.search);
    const result = callback.get("ai_connection");
    if (result) {
      callback.delete("ai_connection");
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${callback.size ? `?${callback}` : ""}`,
      );
      if (result === "connected")
        notify("OpenRouter connected. Open a campaign and choose Run live AI review.");
      else if (result === "cancelled")
        notify("Connection cancelled. The sample workflow is still available.");
      else setError("OpenRouter connection could not be completed. Open Connect AI and try again.");
    }
    const readLocation = () => {
      const q = new URLSearchParams(window.location.search);
      setSelectedId(q.get("campaign"));
      const v = q.get("view");
      setView(v === "policies" || v === "activity" ? v : "queue");
      setTab("creative");
      setActiveFinding("");
    };
    readLocation();
    window.addEventListener("popstate", readLocation);
    return () => {
      window.removeEventListener("popstate", readLocation);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);
  function navigate(next: View, id: string | null = null) {
    setView(next);
    setSelectedId(id);
    setTab("creative");
    setActiveFinding("");
    setAttested(false);
    setNote("");
    setComment("");
    const q = new URLSearchParams();
    if (id) q.set("campaign", id);
    else if (next !== "queue") q.set("view", next);
    window.history.pushState({}, "", `${window.location.pathname}${q.size ? `?${q}` : ""}`);
    window.scrollTo({ top: 0 });
  }
  function openModal(next: Modal) {
    setFormError("");
    setNote("");
    setAttested(false);
    setModal(next);

    if (next === "submit") {
      setDraftName("");
      setDraftCopy("");
      setDraftProduct("Personal loan");
      setDraftChannel("Email");
      setDraftPartner("");
      setDraftDue(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
    }
    if (next === "revise" && version) setDraftCopy(version.copy);
    if (next === "request" && version)
      setNote(
        activeFindings(version)
          .map((f, i) => `${i + 1}. ${f.title}: ${f.suggestion}`)
          .join("\n\n")
          .slice(0, 2000),
      );
  }
  async function mutate(action: Action, message: string): Promise<boolean> {
    if (!data || locked) return false;
    setBusy(true);
    setFormError("");
    setError("");
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: data.revision, action }),
      });
      const payload = (await response.json()) as Envelope & { error?: string };
      if (!response.ok) {
        if (response.status === 409) await refresh();
        throw new Error(payload.error || "This action could not be saved.");
      }
      setData(payload);
      setModal(null);
      setAttested(false);
      notify(message);
      if (action.type === "submit") {
        setRole("marketer");
        navigate("queue", payload.workspace.campaigns[0].id);
      }
      if (action.type === "revise") {
        setTab("comparison");
        setActiveFinding("");
      }
      if (action.type === "reset") navigate("queue");
      if (action.type === "comment") setComment("");
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "This action could not be saved.";
      setFormError(message);
      setError(message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function analyze() {
    if (!data || !selected || !version || locked) return;
    if (!connection.connected && !sponsored.available) {
      openModal("connect");
      return;
    }
    const provider = connection.connected ? "openrouter" : "sponsored";
    const selectedModel = provider === "sponsored" ? "claude-haiku-5-5" : model;
    setAnalyzing(true);
    setError("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: data.revision,
          campaignId: selected.id,
          version: version.number,
          model: selectedModel,
          role,
          provider,
        }),
      });
      const payload = (await response.json()) as Envelope & { error?: string };
      if (!response.ok) {
        if (response.status === 409) await refresh();
        if (response.status === 401) setConnection({ connected: false });
        throw new Error(payload.error || "AI review could not be completed.");
      }
      setData(payload);
      setActiveFinding("");
      notify("Live AI review saved. Review each finding before deciding.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI review could not be completed.");
    } finally {
      setAnalyzing(false);
      void refreshConnection();
    }
  }
  function selectFinding(id: string) {
    setActiveFinding(id);
    document
      .getElementById(`finding-${id}`)
      ?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }
  const filtered = useMemo(
    () =>
      campaigns
        .filter(
          (c) =>
            (status === "all" || c.status === status) &&
            (product === "all" || c.product === product) &&
            (risk === "all" || riskLevel(c) === risk) &&
            `${c.name} ${c.id} ${c.partner} ${c.owner} ${c.product}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "due" ? a.dueAt.localeCompare(b.dueAt) : b.createdAt.localeCompare(a.createdAt),
        ),
    [campaigns, status, product, risk, query, sort],
  );
  const stats = {
    review: campaigns.filter((c) => c.status === "in_review").length,
    changes: campaigns.filter((c) => c.status === "changes_requested").length,
    approved: campaigns.filter((c) => c.status === "approved").length,
    ready: campaigns.filter(
      (c) => c.status === "in_review" && !activeFindings(currentVersion(c)).length,
    ).length,
  };
  function exportQueue() {
    const rows = [
      [
        "Campaign",
        "ID",
        "Product",
        "Channel",
        "Partner",
        "Status",
        "Version",
        "Priority",
        "Launch target",
      ],
      ...filtered.map((c) => [
        c.name,
        c.id,
        c.product,
        c.channel,
        c.partner,
        statusLabel(c.status),
        String(currentVersion(c).number),
        riskLevel(c),
        c.dueAt,
      ]),
    ];
    download(
      "clearpath-review-queue.csv",
      rows.map((r) => r.map(csvCell).join(",")).join("\r\n"),
      "text/csv;charset=utf-8",
    );
    notify("Queue exported as CSV.");
  }
  function exportAudit() {
    if (!data) return;
    download(
      "clearpath-review-record.json",
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          policyVersion: POLICY_VERSION,
          demo: true,
          ...(selected
            ? {
                campaign: selected,
                events: data.workspace.events.filter((e) => e.campaignId === selected.id),
              }
            : data.workspace),
        },
        null,
        2,
      ),
      "application/json",
    );
    notify("Review record exported.");
  }

  if (loading)
    return (
      <main className="loading-page">
        <div className="brand-mark">
          <ShieldCheck size={23} />
        </div>
        <h1>Opening your workspace</h1>
        <p>Preparing fictional campaigns and review history.</p>
        <LoaderCircle className="spin" size={20} />
      </main>
    );
  if (!data)
    return (
      <main className="loading-page">
        <TriangleAlert size={30} />
        <h1>Your workspace couldn't load</h1>
        <p>{error}</p>
        <button
          className="button primary"
          onClick={() => {
            setLoading(true);
            void refresh();
          }}
        >
          Try again
        </button>
      </main>
    );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="/"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("queue");
          }}
        >
          <span className="brand-mark">
            <ShieldCheck size={22} strokeWidth={1.8} />
          </span>
          <span>
            clearpath<span className="brand-sub">REVIEW WORKSPACE</span>
          </span>
        </a>
        <div className="workspace-label">
          <span className="workspace-icon">C</span>
          <span>
            ClearPath Financial<small>Marketing compliance</small>
          </span>
          <ShieldCheck size={15} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          <button
            className={`nav-item ${view === "queue" ? "selected" : ""}`}
            onClick={() => navigate("queue")}
          >
            <Inbox size={18} />
            Review queue<span className="nav-count">{stats.review}</span>
          </button>
          <button
            className={`nav-item ${view === "policies" ? "selected" : ""}`}
            onClick={() => navigate("policies")}
          >
            <BookOpen size={18} />
            Policy library
          </button>
          <button
            className={`nav-item ${view === "activity" ? "selected" : ""}`}
            onClick={() => navigate("activity")}
          >
            <History size={18} />
            Activity log
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="eyebrow">
            <Sparkles size={13} /> AI, with oversight
          </span>
          <p>
            A second set of eyes.
            <br />
            You make the call.
          </p>
          <button onClick={() => openModal("guide")}>
            How it works <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => openModal("guide")}>
            <CircleHelp size={17} />
            Demo guide
          </button>
          <button className="nav-item subtle" disabled={locked} onClick={() => openModal("reset")}>
            <RotateCcw size={16} />
            Reset demo
          </button>
          <div className="sidebar-person">
            <Avatar name={actorName(role)} />
            <span>
              {actorName(role)}
              <small>{role === "reviewer" ? "Compliance reviewer" : "Marketing manager"}</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {selected
                ? "Campaign review"
                : view === "queue"
                  ? "Review queue"
                  : view === "policies"
                    ? "Policy library"
                    : "Activity log"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="demo-pill">
              <span />
              Fictional demo
            </span>
            <button
              className={`button connection ${connection.connected ? "key-ready" : ""}`}
              disabled={locked}
              onClick={() => openModal("connect")}
            >
              <KeyRound size={14} />
              {connection.connected
                ? "AI connected"
                : sponsored.available
                  ? "Live AI included"
                  : "Connect AI"}
            </button>
            <div className="role-switch">
              <label htmlFor="demo-role">Demo role</label>
              <select
                id="demo-role"
                value={role}
                disabled={locked}
                onChange={(e) => {
                  setRole(e.target.value as Role);
                  setAttested(false);
                }}
              >
                <option value="reviewer">Compliance</option>
                <option value="marketer">Marketing</option>
              </select>
            </div>
            <Avatar name={actorName(role)} small />
          </div>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            <TriangleAlert size={17} />
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        <main className={`page-content ${selected ? "detail-content" : ""}`}>
          {selectedId && !selected ? (
            <Empty title="Campaign not found">
              This campaign isn't in your workspace.{" "}
              <button className="text-button" onClick={() => navigate("queue")}>
                Return to the queue
              </button>
            </Empty>
          ) : selected && version ? (
            <>
              <button className="back-link" onClick={() => navigate("queue")}>
                <ArrowLeft size={15} />
                Back to review queue
              </button>
              <div className="detail-heading">
                <div>
                  <div className="heading-eyebrow">
                    <span>{selected.id.toUpperCase()}</span>
                    <span>·</span>
                    <span>Version {version.number}</span>
                    <StatusBadge status={selected.status} />
                  </div>
                  <h1>{selected.name}</h1>
                  <p>
                    {selected.partner} <span>·</span> Submitted by {selected.owner} <span>·</span>{" "}
                    {date(version.createdAt)}
                  </p>
                </div>
                <div className="heading-actions">
                  <button className="button secondary" onClick={exportAudit}>
                    <ArrowDownToLine size={15} />
                    Export record
                  </button>
                  {role === "marketer" && (
                    <button
                      className="button primary"
                      disabled={locked}
                      onClick={() => openModal("revise")}
                    >
                      <Plus size={15} />
                      New version
                    </button>
                  )}
                </div>
              </div>
              <div className="metadata-strip">
                <div>
                  <small>PRODUCT</small>
                  <strong>{selected.product}</strong>
                </div>
                <div>
                  <small>CHANNEL</small>
                  <strong>{selected.channel}</strong>
                </div>
                <div>
                  <small>LAUNCH TARGET</small>
                  <strong>{date(selected.dueAt)}</strong>
                </div>
                <div>
                  <small>REVIEW PRIORITY</small>
                  <RiskBadge campaign={selected} />
                </div>
                <div>
                  <small>POLICY CHECKLIST</small>
                  <strong>
                    CP-2026.10 <span className="muted">v1</span>
                  </strong>
                </div>
              </div>
              <div className="review-grid">
                <section className="creative-section">
                  <div className="panel-tabs" role="tablist" aria-label="Campaign content">
                    <button
                      role="tab"
                      aria-selected={tab === "creative"}
                      onClick={() => setTab("creative")}
                    >
                      <FileText size={15} />
                      Creative
                    </button>
                    <button
                      role="tab"
                      aria-selected={tab === "comparison"}
                      onClick={() => setTab("comparison")}
                    >
                      <GitCompareArrows size={15} />
                      Compare versions
                      {selected.versions.length > 1 && <span>{selected.versions.length}</span>}
                    </button>
                    <button
                      role="tab"
                      aria-selected={tab === "activity"}
                      onClick={() => setTab("activity")}
                    >
                      <History size={15} />
                      Activity
                    </button>
                  </div>
                  {tab === "creative" && (
                    <div className="creative-body">
                      <div className="creative-toolbar">
                        <span>
                          <span className="file-icon">
                            <FileText size={14} />
                          </span>
                          {selected.channel} creative{" "}
                          <span className="muted">/ v{version.number}</span>
                        </span>
                        <span className="small-label">TEXT PREVIEW</span>
                      </div>
                      <article className="ad-preview">
                        <div className="ad-brand">
                          <ShieldCheck size={18} />
                          clearpath
                        </div>
                        {version.copy.split(/\n\n+/).map((paragraph, i) =>
                          i === 0 ? (
                            <h2 key={i}>
                              <Highlighted
                                text={paragraph}
                                findings={version.analysis.findings}
                                active={activeFinding}
                                onSelect={selectFinding}
                              />
                            </h2>
                          ) : (
                            <p key={i}>
                              <Highlighted
                                text={paragraph}
                                findings={version.analysis.findings}
                                active={activeFinding}
                                onSelect={selectFinding}
                              />
                            </p>
                          ),
                        )}
                        <div className="ad-footer">
                          <span>ClearPath Financial</span>
                          <span>Fictional creative</span>
                        </div>
                      </article>
                      <div className="preview-note">
                        <CircleHelp size={14} />
                        <p>
                          Text preview only. Review actual placement, linked terms, and disclosure
                          prominence before approval.
                        </p>
                      </div>
                      {version.analysis.proposedCopy && (
                        <section className="revision-suggestion">
                          <div className="section-line">
                            <h3>
                              <Sparkles size={16} />
                              Suggested revision
                            </h3>
                            <span className="tiny-pill">
                              {version.analysis.mode === "sample" ? "SAMPLE" : "AI DRAFT"}
                            </span>
                          </div>
                          <p className="supporting">
                            A starting point for Marketing. Verify offer terms before submitting.
                          </p>
                          <details>
                            <summary>
                              Review proposed changes <ChevronDown size={15} />
                            </summary>
                            <div className="diff-legend">
                              <span>
                                <i className="removed" />
                                Removed
                              </span>
                              <span>
                                <i className="added" />
                                Added
                              </span>
                            </div>
                            <Diff before={version.copy} after={version.analysis.proposedCopy} />
                          </details>
                          <button
                            className="button secondary"
                            disabled={locked}
                            onClick={() => {
                              setRole("marketer");
                              openModal("revise");
                              setDraftCopy(version.analysis.proposedCopy);
                            }}
                          >
                            <FileText size={14} />
                            Open as Marketing draft
                            <ArrowRight size={14} />
                          </button>
                        </section>
                      )}
                    </div>
                  )}
                  {tab === "comparison" && (
                    <div className="comparison-body">
                      {selected.versions.length < 2 ? (
                        <Empty
                          icon={<GitCompareArrows size={27} />}
                          title="The first version starts here"
                        >
                          Submit a revised version to see what changed. Earlier creative and
                          decisions stay in the record.
                        </Empty>
                      ) : (
                        <>
                          <div className="section-line">
                            <h3>
                              Version {version.number - 1} <ArrowRight size={15} /> Version{" "}
                              {version.number}
                            </h3>
                            <span className="tiny-pill">CURRENT</span>
                          </div>
                          <div className="diff-legend">
                            <span>
                              <i className="removed" />
                              Removed
                            </span>
                            <span>
                              <i className="added" />
                              Added
                            </span>
                          </div>
                          <Diff
                            before={selected.versions[selected.versions.length - 2].copy}
                            after={version.copy}
                          />
                        </>
                      )}
                      <div className="version-history">
                        <h3>Version history</h3>
                        {[...selected.versions].reverse().map((v) => (
                          <details key={v.number}>
                            <summary>
                              <span>
                                <Layers3 size={15} />
                                Version {v.number}
                                <small>
                                  {date(v.createdAt)} · {v.author}
                                </small>
                              </span>
                              <span className="history-decision">
                                {v.decision ? statusLabel(v.decision.kind) : "Awaiting decision"}
                                <ChevronDown size={14} />
                              </span>
                            </summary>
                            {v.decision && (
                              <div className="previous-decision">
                                <strong>
                                  {v.decision.actor} · {date(v.decision.at, true)}
                                </strong>
                                <p>{v.decision.note}</p>
                              </div>
                            )}
                            <pre>{v.copy}</pre>
                          </details>
                        ))}
                      </div>
                    </div>
                  )}
                  {tab === "activity" && (
                    <div className="campaign-activity">
                      <Activity
                        events={data.workspace.events.filter((e) => e.campaignId === selected.id)}
                      />
                      <form
                        className="comment-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (comment.trim())
                            void mutate(
                              { type: "comment", role, campaignId: selected.id, note: comment },
                              "Comment saved.",
                            );
                        }}
                      >
                        <label htmlFor="comment">Add a review note</label>
                        <textarea
                          id="comment"
                          value={comment}
                          maxLength={2000}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Keep the context with the campaign…"
                          rows={3}
                        />
                        <div>
                          <span>As {actorName(role)}</span>
                          <button
                            className="button primary"
                            disabled={locked || comment.trim().length < 2}
                          >
                            <MessageSquare size={14} />
                            Add note
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </section>
                <aside className="review-panel">
                  <div className="review-panel-heading">
                    <div>
                      <span className="ai-icon">
                        <Sparkles size={17} />
                      </span>
                      <h2>Review assistant</h2>
                    </div>
                    <span className={`analysis-mode ${version.analysis.mode}`}>
                      {version.analysis.mode === "live"
                        ? "LIVE AI"
                        : version.analysis.mode === "sample"
                          ? "SAMPLE"
                          : "NOT RUN"}
                    </span>
                  </div>
                  <p className="analysis-summary">{version.analysis.summary}</p>
                  <div className="analysis-source">
                    <ShieldCheck size={13} />
                    <span>
                      {version.analysis.mode === "sample"
                        ? "Curated example · not a live model result"
                        : version.analysis.mode === "live"
                          ? `${version.analysis.model} · ${date(version.analysis.analyzedAt!, true)}`
                          : "Basic policy checks · AI not run"}
                    </span>
                  </div>
                  {version.analysis.warnings.map((w, i) => (
                    <div className="inline-warning" key={i}>
                      <TriangleAlert size={14} />
                      {w}
                    </div>
                  ))}
                  {selected.status === "in_review" && (
                    <button
                      className="button ai-run"
                      disabled={
                        locked || version.analysis.findings.some((f) => f.disposition !== "open")
                      }
                      onClick={() => void analyze()}
                    >
                      {analyzing ? (
                        <LoaderCircle size={15} className="spin" />
                      ) : (
                        <Sparkles size={15} />
                      )}
                      {analyzing
                        ? "Reviewing the creative…"
                        : connection.connected || sponsored.available
                          ? "Run live AI review"
                          : "Connect OpenRouter for live AI"}
                      {!analyzing && <ArrowUpRight size={14} />}
                    </button>
                  )}
                  {!connection.connected &&
                    sponsored.available &&
                    selected.status === "in_review" && (
                      <p className="included-ai-note">
                        {sponsored.remaining} included live{" "}
                        {sponsored.remaining === 1 ? "review" : "reviews"} left · Claude Haiku 5.5.
                        Copy goes to Anthropic when you run a review. One review per minute.
                      </p>
                    )}
                  <div className="findings-heading">
                    <h3>
                      Findings <span>{version.analysis.findings.length}</span>
                    </h3>
                    <span>{activeFindings(version).length} to resolve</span>
                  </div>
                  {version.analysis.findings.length === 0 ? (
                    <div className="no-findings">
                      <CheckCheck size={24} />
                      <h3>No automated findings</h3>
                      <p>
                        Review the full creative and verify offer terms. An empty findings list is
                        not a compliance certification.
                      </p>
                    </div>
                  ) : (
                    <div className="findings-list">
                      {version.analysis.findings.map((f, index) => {
                        const policy = POLICIES.find((p) => p.id === f.policyId)!;
                        return (
                          <article
                            id={`finding-${f.id}`}
                            key={f.id}
                            className={`finding-card ${activeFinding === f.id ? "focused" : ""} ${f.disposition === "dismissed" ? "dismissed" : ""}`}
                          >
                            <button
                              className="finding-title"
                              onClick={() => {
                                setActiveFinding(f.id);
                                setTab("creative");
                              }}
                            >
                              <span className={`finding-index ${f.severity}`}>{index + 1}</span>
                              <span>{f.title}</span>
                              <span className={`severity-label ${f.severity}`}>{f.severity}</span>
                            </button>
                            <div className="finding-content">
                              {f.quote ? (
                                <blockquote>“{f.quote}”</blockquote>
                              ) : (
                                <span className="missing-evidence">
                                  Missing from submitted copy
                                </span>
                              )}
                              <p>{f.explanation}</p>
                              <div className="finding-suggestion">
                                <strong>Suggested action</strong>
                                <p>{f.suggestion}</p>
                              </div>
                              <div className="finding-policy">
                                <BookOpen size={12} />
                                <span>{f.policyId}</span>
                                {policy.source ? (
                                  <a href={policy.source} target="_blank" rel="noreferrer">
                                    Reference
                                    <ArrowUpRight size={11} />
                                  </a>
                                ) : (
                                  <span>Internal checklist</span>
                                )}
                                <span className="finding-origin">
                                  {f.origin === "ai"
                                    ? "AI"
                                    : f.origin === "sample"
                                      ? "Sample"
                                      : "Policy check"}
                                </span>
                              </div>
                              {f.disposition === "dismissed" ? (
                                <div className="disposition-state">
                                  <Check size={13} />
                                  <span>Dismissed · {f.reason}</span>
                                </div>
                              ) : f.disposition === "confirmed" ? (
                                <div className="disposition-state confirmed">
                                  <Check size={13} />
                                  Confirmed for revision
                                </div>
                              ) : null}
                              {role === "reviewer" && selected.status === "in_review" && (
                                <div className="finding-actions">
                                  {f.disposition === "open" ? (
                                    <>
                                      <button
                                        disabled={locked}
                                        onClick={() =>
                                          void mutate(
                                            {
                                              type: "disposition",
                                              role,
                                              campaignId: selected.id,
                                              findingId: f.id,
                                              disposition: "confirmed",
                                              reason: "",
                                            },
                                            "Finding confirmed for revision.",
                                          )
                                        }
                                      >
                                        <Check size={13} />
                                        Confirm issue
                                      </button>
                                      <button
                                        disabled={locked}
                                        onClick={() => {
                                          setActiveFinding(f.id);
                                          openModal("dismiss");
                                        }}
                                      >
                                        Dismiss
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      disabled={locked}
                                      onClick={() =>
                                        void mutate(
                                          {
                                            type: "disposition",
                                            role,
                                            campaignId: selected.id,
                                            findingId: f.id,
                                            disposition: "open",
                                            reason: "",
                                          },
                                          "Finding reopened.",
                                        )
                                      }
                                    >
                                      <RotateCcw size={12} />
                                      Reopen finding
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                  <div className="decision-area">
                    {version.decision ? (
                      <div className={`decision-record ${version.decision.kind}`}>
                        <span>
                          {version.decision.kind === "approved" ? (
                            <CheckCircle2 size={20} />
                          ) : (
                            <MessageSquare size={20} />
                          )}
                        </span>
                        <h3>
                          {version.decision.kind === "approved"
                            ? `Version ${version.number} approved`
                            : "Changes requested"}
                        </h3>
                        <p>{version.decision.note}</p>
                        <small>
                          {version.decision.actor} · {date(version.decision.at, true)}
                        </small>
                        {role === "marketer" && (
                          <button
                            className="button secondary"
                            disabled={locked}
                            onClick={() => openModal("revise")}
                          >
                            Prepare a new version
                            <ArrowRight size={14} />
                          </button>
                        )}
                      </div>
                    ) : role === "reviewer" ? (
                      <>
                        <p>
                          <ShieldCheck size={14} />
                          Your decision applies to version {version.number}.
                        </p>
                        <button
                          className="button primary approve-button"
                          disabled={locked || activeFindings(version).length > 0}
                          onClick={() => openModal("approve")}
                        >
                          <CheckCircle2 size={15} />
                          Approve version {version.number}
                        </button>
                        <button
                          className="button secondary"
                          disabled={locked}
                          onClick={() => openModal("request")}
                        >
                          <MessageSquare size={15} />
                          Request changes
                        </button>
                        {activeFindings(version).length > 0 && (
                          <small>
                            Correct the copy or dismiss findings with a reason before approval.
                          </small>
                        )}
                      </>
                    ) : (
                      <div className="marketing-note">
                        <Clock3 size={19} />
                        <strong>With Compliance for review</strong>
                        <p>
                          Switch the demo role to Compliance to record a decision, or submit a new
                          version as Marketing.
                        </p>
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            </>
          ) : view === "queue" ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">MARKETING COMPLIANCE</div>
                  <h1>
                    Keep good ideas moving<span className="title-dot">.</span>
                  </h1>
                  <p>A clear path from first draft to final approval.</p>
                </div>
                <button
                  className="button primary"
                  disabled={locked}
                  onClick={() => openModal("submit")}
                >
                  <Plus size={16} />
                  New submission
                </button>
              </div>
              <div className="stats-grid">
                <Stat
                  icon={<Inbox size={18} />}
                  label="Awaiting review"
                  value={stats.review}
                  detail="Ready for your attention"
                  color="blue"
                />
                <Stat
                  icon={<RotateCcw size={18} />}
                  label="With Marketing"
                  value={stats.changes}
                  detail="Revisions in progress"
                  color="amber"
                />
                <Stat
                  icon={<CheckCircle2 size={18} />}
                  label="Approved"
                  value={stats.approved}
                  detail="Decisions recorded by version"
                  color="green"
                />
                <Stat
                  icon={<FileCheck2 size={18} />}
                  label="No open findings"
                  value={stats.ready}
                  detail="Human review still required"
                  color="purple"
                />
              </div>
              <div className="demo-callout">
                <span className="callout-icon">
                  <Sparkles size={21} />
                </span>
                <div>
                  <strong>Less searching. More reviewing.</strong>
                  <p>
                    {sponsored.available
                      ? "Try a real AI review, inspect its evidence, and take a campaign through revision to human approval. Two live reviews included per workspace, subject to demo availability."
                      : "Explore a sample review, inspect the findings, and try the revision workflow. Connect your OpenRouter account for live AI."}
                  </p>
                </div>
                <button onClick={() => navigate("queue", "cp-1048")}>
                  Open sample review
                  <ArrowRight size={15} />
                </button>
              </div>
              <section className="queue-section">
                <div className="queue-heading">
                  <div>
                    <h2>
                      Review queue<span>{campaigns.length}</span>
                    </h2>
                    <p>Every submission, decision, and revision in one place.</p>
                  </div>
                  <button className="button secondary" onClick={exportQueue}>
                    <ArrowDownToLine size={14} />
                    Export
                  </button>
                </div>
                <div className="queue-tabs" role="tablist" aria-label="Filter by review status">
                  {(
                    [
                      ["all", "All submissions", campaigns.length],
                      ["in_review", "In review", stats.review],
                      ["changes_requested", "Changes requested", stats.changes],
                      ["approved", "Approved", stats.approved],
                    ] as const
                  ).map(([value, label, count]) => (
                    <button
                      key={value}
                      role="tab"
                      aria-selected={status === value}
                      className={status === value ? "active" : ""}
                      onClick={() => setStatus(value)}
                    >
                      {label}
                      <span>{count}</span>
                    </button>
                  ))}
                </div>
                <div className="queue-filters">
                  <div className="search-input">
                    <Search size={16} />
                    <input
                      aria-label="Search submissions"
                      placeholder="Search submissions or partners…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button aria-label="Clear search" onClick={() => setQuery("")}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <select
                    aria-label="Filter by product"
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                  >
                    <option value="all">All products</option>
                    {PRODUCTS.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by priority"
                    value={risk}
                    onChange={(e) => setRisk(e.target.value)}
                  >
                    <option value="all">All priorities</option>
                    <option value="high">High priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="low">Low priority</option>
                  </select>
                  <select
                    aria-label="Sort submissions"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="newest">Newest first</option>
                    <option value="due">Launch date</option>
                  </select>
                </div>
                <div className="table-scroll">
                  <table className="campaign-table">
                    <thead>
                      <tr>
                        <th>Campaign</th>
                        <th>Product / channel</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Launch target</th>
                        <th>Submitted by</th>
                        <th>
                          <span className="sr-only">Open</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <button
                              className="campaign-link"
                              onClick={() => navigate("queue", c.id)}
                            >
                              <span
                                className={`campaign-symbol ${c.product === "Credit card" ? "lilac" : c.product === "Personal loan" ? "peach" : "mint"}`}
                              >
                                <FileText size={19} strokeWidth={1.6} />
                              </span>
                              <span>
                                <strong>{c.name}</strong>
                                <small>
                                  {c.partner}
                                  <span>·</span>
                                  {c.id.toUpperCase()}
                                  <span>·</span>v{currentVersion(c).number}
                                </small>
                              </span>
                            </button>
                          </td>
                          <td>
                            <span className="product-text">{c.product}</span>
                            <small>{c.channel}</small>
                          </td>
                          <td>
                            <RiskBadge campaign={c} />
                          </td>
                          <td>
                            <StatusBadge status={c.status} />
                          </td>
                          <td>
                            <span className="table-date">{date(c.dueAt)}</span>
                          </td>
                          <td>
                            <div className="owner-cell">
                              <Avatar name={c.owner} small />
                              <span>{c.owner.split(" ")[0]}</span>
                            </div>
                          </td>
                          <td>
                            <button
                              className="row-open"
                              aria-label={`Open ${c.name}`}
                              onClick={() => navigate("queue", c.id)}
                            >
                              <ChevronRight size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!filtered.length && (
                  <Empty icon={<Search size={26} />} title="No matching submissions">
                    Try another search or{" "}
                    <button
                      className="text-button"
                      onClick={() => {
                        setQuery("");
                        setProduct("all");
                        setRisk("all");
                        setStatus("all");
                      }}
                    >
                      clear the filters
                    </button>
                    .
                  </Empty>
                )}
                <div className="table-footer">
                  <span>
                    Showing {filtered.length} of {campaigns.length} submissions
                  </span>
                  <span>
                    <ShieldCheck size={12} />
                    Decisions stay with their versions
                  </span>
                </div>
              </section>
              <div className="page-footnote">
                <span>
                  <span className="green-dot" />
                  Your demo workspace saves automatically
                </span>
                <span>Fictional data · Text review · Human approval required</span>
              </div>
            </>
          ) : view === "policies" ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">REVIEW FOUNDATION</div>
                  <h1>
                    A shared standard<span className="title-dot">.</span>
                  </h1>
                  <p>
                    The checklist behind every review. Clear, traceable, and open to human judgment.
                  </p>
                </div>
                <span className="version-chip">{POLICY_VERSION}</span>
              </div>
              <div className="policy-notice">
                <BookOpen size={20} />
                <div>
                  <strong>An illustrative internal checklist</strong>
                  <p>
                    These demo policies draw on the references below. They are not a complete legal
                    ruleset. A reviewer must verify offer terms, applicable requirements, and final
                    placement.
                  </p>
                </div>
              </div>
              <div className="policy-grid">
                {POLICIES.map((p) => (
                  <article className="policy-card" key={p.id}>
                    <div className="section-line">
                      <span className="policy-code">{p.id}</span>
                      <ShieldCheck size={17} />
                    </div>
                    <h2>{p.title}</h2>
                    <p>{p.description}</p>
                    <div className="policy-guidance">
                      <strong>What to review</strong>
                      <p>{p.guidance}</p>
                    </div>
                    <div className="policy-products">
                      {p.products.length === 3 ? (
                        <span>All products</span>
                      ) : (
                        p.products.map((product) => <span key={product}>{product}</span>)
                      )}
                    </div>
                    {p.source ? (
                      <a
                        className="policy-reference"
                        href={p.source}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {p.sourceLabel}
                        <ArrowUpRight size={13} />
                      </a>
                    ) : (
                      <span className="policy-reference">{p.sourceLabel}</span>
                    )}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">DECISION HISTORY</div>
                  <h1>
                    Context that stays<span className="title-dot">.</span>
                  </h1>
                  <p>A record of submissions, feedback, and version-specific decisions.</p>
                </div>
                <button className="button secondary" onClick={exportAudit}>
                  <ArrowDownToLine size={15} />
                  Export record
                </button>
              </div>
              <section className="activity-panel">
                <div className="section-line">
                  <h2>Workspace activity</h2>
                  <span className="tiny-pill">{data.workspace.events.length} EVENTS</span>
                </div>
                <Activity events={data.workspace.events} onOpen={(id) => navigate("queue", id)} />
              </section>
            </>
          )}
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button className={view === "queue" ? "selected" : ""} onClick={() => navigate("queue")}>
          <Inbox size={17} />
          Queue
        </button>
        <button
          className={view === "policies" ? "selected" : ""}
          onClick={() => navigate("policies")}
        >
          <BookOpen size={17} />
          Policies
        </button>
        <button
          className={view === "activity" ? "selected" : ""}
          onClick={() => navigate("activity")}
        >
          <History size={17} />
          Activity
        </button>
        <button onClick={() => openModal("guide")} aria-label="Open demo guide">
          <CircleHelp size={17} />
        </button>
      </nav>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          <span>{toast}</span>
          <button onClick={() => setToast("")} aria-label="Dismiss notification">
            <X size={14} />
          </button>
        </div>
      )}
      <Dialog.Root
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open && !locked) {
            setModal(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay" />
          <Dialog.Content
            className={`modal-content ${modal === "submit" || modal === "revise" ? "wide" : ""}`}
            onEscapeKeyDown={(e) => {
              if (locked) e.preventDefault();
            }}
            onPointerDownOutside={(e) => {
              if (locked) e.preventDefault();
            }}
          >
            <Dialog.Close className="modal-close" aria-label="Close dialog" disabled={locked}>
              <X size={18} />
            </Dialog.Close>
            <Dialog.Title>
              {modal === "connect"
                ? "Connect your AI"
                : modal === "submit"
                  ? "A new idea starts here"
                  : modal === "revise"
                    ? `Prepare version ${(version?.number || 0) + 1}`
                    : modal === "request"
                      ? "Give Marketing a clear next step"
                      : modal === "approve"
                        ? `Approve version ${version?.number}`
                        : modal === "dismiss"
                          ? "Record your judgment"
                          : modal === "reset"
                            ? "Start a fresh demo?"
                            : "Try the complete review workflow"}
            </Dialog.Title>
            <Dialog.Description>
              {modal === "connect"
                ? sponsored.available
                  ? "Live AI is included in this demo. You can also connect your own OpenRouter account."
                  : "Connect your OpenRouter account for live analysis. Explore the sample workflow without signing in."
                : modal === "submit"
                  ? "Submit the complete ad copy, including disclosures. You are submitting as Jamie Chen in Marketing."
                  : modal === "revise"
                    ? "Current copy and its decision stay in history. This draft starts a fresh review when submitted."
                    : modal === "request"
                      ? "Feedback stays with this version so the next reviewer has the context."
                      : modal === "approve"
                        ? "This is a human decision about the exact creative currently shown."
                        : modal === "dismiss"
                          ? "Explain why this finding does not require a revision. Your reason becomes part of the record."
                          : modal === "reset"
                            ? "This replaces only this browser's workspace. Export any records you want to keep first."
                            : "All data is fictional. Role switching simulates two colleagues; it is not production authentication."}
            </Dialog.Description>
            {formError && (
              <div className="form-error" role="alert">
                {formError}
              </div>
            )}
            {modal === "connect" && (
              <div className="oauth-connect">
                {sponsored.available && (
                  <div className="included-ai-panel">
                    <Sparkles size={19} />
                    <div>
                      <strong>
                        {sponsored.remaining} included live{" "}
                        {sponsored.remaining === 1 ? "review" : "reviews"} remaining
                      </strong>
                      <p>
                        Open a campaign and click Run live AI review. Claude Haiku 5.5 reviews your
                        fictional copy through Anthropic. No account needed. Global demo limits
                        apply.
                      </p>
                      <button
                        className="button secondary"
                        onClick={() => {
                          setModal(null);
                          if (!selected) navigate("queue", "cp-1048");
                        }}
                      >
                        Try an included review
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
                <div className="provider-tile">
                  <span className="openrouter-symbol">
                    <ArrowUpRight size={24} />
                  </span>
                  <div>
                    <strong>OpenRouter</strong>
                    <small>
                      {connection.connected
                        ? "Connected to this demo session"
                        : "Use your own AI account"}
                    </small>
                  </div>
                  <span className="tiny-pill">{connection.connected ? "CONNECTED" : "OAUTH"}</span>
                </div>
                <div className="oauth-model">
                  <span className="small-label">REVIEW MODEL</span>
                  <strong>GPT-4.1 Mini</strong>
                  <p>
                    Text review through OpenRouter. Usage is charged to your OpenRouter credits and
                    key allowance.
                  </p>
                </div>
                <div className="key-privacy">
                  <ShieldCheck size={18} />
                  <p>
                    Authorize ClearPath on OpenRouter’s website. Your credential is encrypted on the
                    server and is never sent to this page. This demo connection expires after 24
                    hours.
                  </p>
                </div>
                <p className="provider-note">
                  Your creative is sent to OpenRouter and the model provider only when you click Run
                  live AI review. Use fictional data. You control the allowance and can revoke
                  access in OpenRouter.
                </p>
                {connection.connected && (
                  <p className="provider-note">
                    Disconnect removes ClearPath’s stored connection. To revoke the provider key
                    itself, use Manage access.
                  </p>
                )}
                <div className="modal-actions">
                  {connection.connected ? (
                    <>
                      <a
                        className="button secondary"
                        href={connection.manageUrl || "https://openrouter.ai/keys"}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Manage access
                        <ArrowUpRight size={13} />
                      </a>
                      <button
                        className="button secondary"
                        disabled={locked}
                        onClick={() => void disconnectOpenRouter()}
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      className="button secondary"
                      onClick={() => setModal(null)}
                      disabled={locked}
                    >
                      Keep exploring
                    </button>
                  )}
                  <button
                    className="button primary"
                    disabled={locked}
                    onClick={() => void connectOpenRouter()}
                  >
                    {connecting ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : (
                      <ArrowUpRight size={15} />
                    )}
                    {connection.connected ? "Reconnect OpenRouter" : "Continue with OpenRouter"}
                  </button>
                </div>
              </div>
            )}

            {(modal === "submit" || modal === "revise") && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (modal === "submit") {
                    if (!draftDue || Number.isNaN(new Date(draftDue).getTime())) {
                      setFormError("Choose a launch target.");
                      return;
                    }
                    void mutate(
                      {
                        type: "submit",
                        role: "marketer",
                        name: draftName,
                        product: draftProduct,
                        channel: draftChannel,
                        partner: draftChannel === "Affiliate" ? draftPartner : "ClearPath",
                        dueAt: new Date(`${draftDue}T12:00:00`).toISOString(),
                        copy: draftCopy,
                      },
                      "Campaign submitted for review.",
                    );
                  } else if (selected)
                    void mutate(
                      {
                        type: "revise",
                        role: "marketer",
                        campaignId: selected.id,
                        copy: draftCopy,
                        note,
                      },
                      "New version saved. Ready for a fresh review.",
                    );
                }}
              >
                {modal === "submit" && (
                  <>
                    <label htmlFor="campaign-name">Campaign name</label>
                    <input
                      id="campaign-name"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder="e.g. A little breathing room"
                      minLength={3}
                      maxLength={120}
                      required
                    />
                    <div className="form-columns">
                      <div>
                        <label htmlFor="product">Product</label>
                        <select
                          id="product"
                          value={draftProduct}
                          onChange={(e) => setDraftProduct(e.target.value as Product)}
                        >
                          {PRODUCTS.map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="channel">Channel</label>
                        <select
                          id="channel"
                          value={draftChannel}
                          onChange={(e) =>
                            setDraftChannel(e.target.value as (typeof CHANNELS)[number])
                          }
                        >
                          {CHANNELS.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="form-columns">
                      {draftChannel === "Affiliate" && (
                        <div>
                          <label htmlFor="partner">Affiliate partner</label>
                          <input
                            id="partner"
                            value={draftPartner}
                            onChange={(e) => setDraftPartner(e.target.value)}
                            maxLength={100}
                            required
                            placeholder="Partner name"
                          />
                        </div>
                      )}
                      <div>
                        <label htmlFor="launch-date">Launch target</label>
                        <input
                          id="launch-date"
                          type="date"
                          value={draftDue}
                          onChange={(e) => setDraftDue(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </>
                )}
                <div className="label-with-meta">
                  <label htmlFor="creative-copy">Complete creative</label>
                  <span>{draftCopy.length.toLocaleString()} / 6,000</span>
                </div>
                <textarea
                  id="creative-copy"
                  className="creative-editor"
                  value={draftCopy}
                  onChange={(e) => setDraftCopy(e.target.value)}
                  minLength={20}
                  maxLength={6000}
                  rows={modal === "revise" ? 12 : 8}
                  placeholder="Headline, body copy, call to action, and all disclosures…"
                  required
                />
                {modal === "revise" && (
                  <>
                    <label htmlFor="revision-note">
                      What changed? <span className="muted">Optional</span>
                    </label>
                    <textarea
                      id="revision-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={2000}
                      rows={2}
                      placeholder="Summarize the changes for the reviewer."
                    />
                  </>
                )}
                <div className="submission-note">
                  <ShieldCheck size={14} />
                  Submitting never publishes to a marketing channel.
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={locked}
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button className="button primary" disabled={locked}>
                    {busy ? <LoaderCircle size={15} className="spin" /> : <ArrowRight size={15} />}
                    {modal === "submit" ? "Submit for review" : "Submit new version"}
                  </button>
                </div>
              </form>
            )}
            {modal === "request" && selected && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate(
                    {
                      type: "decision",
                      role: "reviewer",
                      campaignId: selected.id,
                      decision: "changes_requested",
                      note,
                      attested: false,
                    },
                    "Changes requested. Marketing can submit a revision.",
                  );
                }}
              >
                <label htmlFor="feedback">Feedback for Marketing</label>
                <textarea
                  id="feedback"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  minLength={8}
                  maxLength={2000}
                  rows={7}
                  required
                />
                <p className="supporting">Recorded in the workspace. No email is sent.</p>
                <div className="modal-actions">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setModal(null)}
                    disabled={locked}
                  >
                    Cancel
                  </button>
                  <button className="button primary" disabled={locked}>
                    {busy ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : (
                      <MessageSquare size={15} />
                    )}
                    Request changes
                  </button>
                </div>
              </form>
            )}
            {modal === "approve" && selected && version && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate(
                    {
                      type: "decision",
                      role: "reviewer",
                      campaignId: selected.id,
                      decision: "approved",
                      note,
                      attested,
                    },
                    `Version ${version.number} approved. Decision recorded.`,
                  );
                }}
              >
                <div className="approval-summary">
                  <CheckCircle2 size={20} />
                  <div>
                    <strong>{selected.name}</strong>
                    <span>
                      Version {version.number} · {selected.product}
                    </span>
                  </div>
                </div>
                <label className="attestation">
                  <input
                    type="checkbox"
                    checked={attested}
                    onChange={(e) => setAttested(e.target.checked)}
                    required
                  />
                  <span>
                    I reviewed the complete creative, verified offer terms and substantiation, and
                    checked disclosure placement. Automated findings alone are not sufficient.
                  </span>
                </label>
                <label htmlFor="approval-note">
                  Decision note <span className="muted">Optional</span>
                </label>
                <textarea
                  id="approval-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="Add context for the review record."
                />
                <div className="modal-actions">
                  <button
                    className="button secondary"
                    type="button"
                    disabled={locked}
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button className="button primary" disabled={locked || !attested}>
                    {busy ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    Record approval
                  </button>
                </div>
              </form>
            )}
            {modal === "dismiss" && selected && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate(
                    {
                      type: "disposition",
                      role: "reviewer",
                      campaignId: selected.id,
                      findingId: activeFinding,
                      disposition: "dismissed",
                      reason: note,
                    },
                    "Finding dismissed. Your reason is recorded.",
                  );
                }}
              >
                <div className="dismiss-title">
                  {version?.analysis.findings.find((f) => f.id === activeFinding)?.title}
                </div>
                <label htmlFor="dismiss-reason">Reason for dismissal</label>
                <textarea
                  id="dismiss-reason"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  minLength={8}
                  maxLength={2000}
                  rows={4}
                  required
                  placeholder="What evidence or context addresses this concern?"
                />
                <div className="modal-actions">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={locked}
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button className="button primary" disabled={locked}>
                    Save dismissal
                  </button>
                </div>
              </form>
            )}
            {modal === "guide" && (
              <>
                <ol className="guide-steps">
                  <li>
                    <span>1</span>
                    <div>
                      <strong>Review the BrightMoney campaign</strong>
                      <p>
                        Inspect highlighted claims, then run an included live AI review when
                        available. You can also connect OpenRouter.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span>2</span>
                    <div>
                      <strong>Request a revision</strong>
                      <p>Record actionable feedback. Switch to Marketing and submit edited copy.</p>
                    </div>
                  </li>
                  <li>
                    <span>3</span>
                    <div>
                      <strong>Compare and decide</strong>
                      <p>
                        Compare versions and record a human decision. Export the complete history.
                      </p>
                    </div>
                  </li>
                </ol>
                <div className="guide-note">
                  Sample analyses are curated illustrations. New creative gets basic policy checks.
                  Two sponsored live reviews are included per workspace while the global allowance
                  lasts; OpenRouter is optional. Each browser receives a separate saved demo
                  workspace.
                </div>
                <div className="modal-actions">
                  <button
                    className="button primary"
                    onClick={() => {
                      setModal(null);
                      navigate("queue", "cp-1048");
                    }}
                  >
                    Open sample review
                    <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}
            {modal === "reset" && (
              <div className="modal-actions">
                <button className="button secondary" disabled={locked} onClick={exportAudit}>
                  Export first
                </button>
                <button
                  className="button primary"
                  disabled={locked}
                  onClick={() =>
                    void mutate({ type: "reset", role }, "Demo reset. Sample campaigns are ready.")
                  }
                >
                  {busy ? <LoaderCircle size={15} className="spin" /> : <RotateCcw size={15} />}
                  Reset this demo
                </button>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
