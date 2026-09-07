"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Play,
  RefreshCw,
  Settings2,
  ShieldCheck,
} from "lucide-react";

type Source = {
  id: string;
  name: string;
  status: string;
  enabled: boolean;
  schedule_time: string;
  page_delay_ms: number;
  max_pages: number;
  policy_override: string;
  integration_kind?: string;
  authorized_source_url?: string;
  authorization_reference?: string;
  checkpoint_status?: string;
  processed_count?: number;
  offer_count?: number;
  checkpoint_updated_at?: string;
};
type Run = {
  id: string;
  retailer_id: string;
  retailer: string;
  status: string;
  started_at: string;
  offer_count: number;
  error?: string;
};
type PageEvent = {
  retailer_id: string;
  last_status: string;
  last_error?: string;
  source_url: string;
  last_fetched_at?: string;
};
type Overview = {
  sources: Source[];
  runs: Run[];
  pages: PageEvent[];
  summary: {
    sources: number;
    runs_today: number;
    offers_today: number;
    issues_today: number;
    products: number;
    observations: number;
  };
  runtime: { running: boolean };
};
const endpoint = "http://localhost:4004";

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [draftToken, setDraftToken] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Source | null>(null);
  const [adding, setAdding] = useState(false);
  const [newSource, setNewSource] = useState({ name: "", baseUrl: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const stored = window.sessionStorage.getItem("solar4u-admin-token") || "";
    const timer = window.setTimeout(() => {
      setToken(stored);
      setDraftToken(stored);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const load = useCallback(
    async (key = token) => {
      if (!key) return;
      const response = await fetch(`${endpoint}/v1/admin/overview`, {
        headers: { "x-solar4u-admin-token": key },
      });
      if (!response.ok) {
        setOverview(null);
        setError(
          response.status === 403
            ? "That admin key was not accepted."
            : "The price worker is unavailable.",
        );
        return;
      }
      setError("");
      setOverview((await response.json()).data);
    },
    [token],
  );
  useEffect(() => {
    if (!token) return;
    const initial = window.setTimeout(() => load(token), 0);
    const timer = window.setInterval(() => load(token), 10000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [token, load]);
  const unlock = () => {
    window.sessionStorage.setItem("solar4u-admin-token", draftToken);
    setToken(draftToken);
  };
  const runSource = async (retailerId: string) => {
    setBusy(true);
    const response = await fetch(`${endpoint}/v1/scraper/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-solar4u-admin-token": token,
      },
      body: JSON.stringify({ retailerId, force: true }),
    });
    if (!response.ok) setError("The worker could not start that retailer.");
    await load();
    setBusy(false);
  };
  const saveSource = async (source: Source) => {
    setBusy(true);
    const response = await fetch(
      `${endpoint}/v1/admin/sources/${encodeURIComponent(source.id)}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-solar4u-admin-token": token,
        },
        body: JSON.stringify({
          enabled: source.enabled,
          scheduleTime: source.schedule_time,
          pageDelayMs: source.page_delay_ms,
          maxPages: source.max_pages,
          policyOverride: source.policy_override,
          integrationKind: source.integration_kind,
          authorizedSourceUrl: source.authorized_source_url,
          authorizationReference: source.authorization_reference,
        }),
      },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(
        payload.error === "authorized_integration_requires_kind_source_and_reference"
          ? "Authorized integrations require a type, data-source URL or import reference, and proof of authorization."
          : "Source settings were not saved.",
      );
    } else {
      setError("");
      setSelected(null);
    }
    await load();
    setBusy(false);
  };
  const addSource = async () => {
    setBusy(true);
    const response = await fetch(`${endpoint}/v1/admin/sources`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-solar4u-admin-token": token },
      body: JSON.stringify(newSource),
    });
    if (!response.ok) setError("Enter a valid source name and https:// website address.");
    else {
      setAdding(false);
      setNewSource({ name: "", baseUrl: "" });
    }
    await load();
    setBusy(false);
  };
  if (!token || (!overview && error))
    return (
      <main className="admin-page admin-lock-page">
        <section className="admin-lock-card">
          <ShieldCheck size={34} />
          <div className="eyebrow">RESTRICTED OPERATIONS</div>
          <h1>Scraper administration</h1>
          <p>
            This console changes crawler schedules, source policy state, and
            starts live collection jobs. It is not available to member profiles.
          </p>
          <label>
            Local admin key
            <input
              type="password"
              value={draftToken}
              onChange={(event) => setDraftToken(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && unlock()}
            />
          </label>
          <button className="primary-button" onClick={unlock}>
            Unlock admin console
          </button>
          {error && (
            <span className="admin-error">
              <AlertTriangle size={14} /> {error}
            </span>
          )}
        </section>
      </main>
    );
  if (!overview)
    return (
      <main className="admin-page">
        <div className="admin-loading">
          <RefreshCw /> Loading scraper operations…
        </div>
      </main>
    );
  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <div className="eyebrow">LOCAL ADMIN · PRICE WORKER</div>
          <h1>Scraper operations</h1>
          <p>
            Monitor respectful collection, policy decisions, scan volume, and
            historical catalog health.
          </p>
        </div>
        <div
          className={`admin-runtime ${overview.runtime.running ? "running" : ""}`}
        >
          <Activity size={17} />
          <span>
            <b>
              {overview.runtime.running
                ? "Collection running"
                : "Worker standing by"}
            </b>
            <small>Refreshes every 10 seconds</small>
          </span>
        </div>
      </header>
      <section className="admin-metrics">
        <article>
          <small>Sources</small>
          <b>{overview.summary.sources}</b>
          <span>
            {overview.sources.filter((source) => source.enabled).length} enabled
          </span>
        </article>
        <article>
          <small>Runs today</small>
          <b>{overview.summary.runs_today}</b>
          <span>
            {overview.summary.offers_today.toLocaleString()} offers recorded
          </span>
        </article>
        <article className={overview.summary.issues_today ? "warning" : ""}>
          <small>Issues today</small>
          <b>{overview.summary.issues_today}</b>
          <span>
            {overview.summary.issues_today
              ? "Review required"
              : "No failed runs"}
          </span>
        </article>
        <article>
          <small>Catalog</small>
          <b>{overview.summary.products.toLocaleString()}</b>
          <span>
            {overview.summary.observations.toLocaleString()} observations
          </span>
        </article>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-title">
          <div>
            <h2>Retailer sources</h2>
            <p>
              Policy status, today’s checkpoint, pacing, and manual controls.
            </p>
          </div>
          <div className="admin-panel-actions">
            <button className="secondary-button" onClick={() => load()}><RefreshCw size={14} /> Refresh</button>
            <button className="primary-button" onClick={() => setAdding(true)}>+ Add source</button>
          </div>
        </div>
        <div className="admin-source-table">
          <div className="admin-source-head">
            <span>Source</span>
            <span>Policy</span>
            <span>Today</span>
            <span>Scanned / offers</span>
            <span>Delay</span>
            <span>Last check</span>
            <span />
          </div>
          {overview.sources.map((source) => (
            <div className="admin-source-row" key={source.id}>
              <span>
                <b>{source.name}</b>
                <small>{source.id}</small>
              </span>
              <span className={`admin-status status-${source.status}`}>
                {source.status === "enabled" ? (
                  <CheckCircle2 size={13} />
                ) : (
                  <AlertTriangle size={13} />
                )}
                {source.status.replaceAll("_", " ")}
              </span>
              <span>{source.checkpoint_status || "Not started"}</span>
              <span>
                <b>{Number(source.processed_count || 0).toLocaleString()}</b>
                <small>
                  {Number(source.offer_count || 0).toLocaleString()} offers
                </small>
              </span>
              <span>{Math.round(source.page_delay_ms / 1000)} sec/page</span>
              <span>
                {source.checkpoint_updated_at
                  ? new Date(source.checkpoint_updated_at).toLocaleString()
                  : "—"}
              </span>
              <span className="admin-source-actions">
                <button
                  title="Edit source settings"
                  onClick={() => setSelected(source)}
                >
                  <Settings2 size={15} />
                </button>
                <button
                  title="Run this source now"
                  disabled={busy || !source.enabled}
                  onClick={() => runSource(source.id)}
                >
                  <Play size={15} />
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>
      <div className="admin-lower-grid">
        <section className="admin-panel">
          <div className="admin-panel-title">
            <div>
              <h2>Recent runs</h2>
              <p>Completed and failed retailer jobs.</p>
            </div>
          </div>
          <div className="admin-run-list">
            {overview.runs.slice(0, 14).map((run) => (
              <article key={run.id}>
                <i className={`run-${run.status}`} />
                <span>
                  <b>{run.retailer || run.retailer_id}</b>
                  <small>{new Date(run.started_at).toLocaleString()}</small>
                </span>
                <span>
                  <b>{run.offer_count.toLocaleString()} offers</b>
                  <small>{run.status.replaceAll("_", " ")}</small>
                </span>
                {run.error && <em title={run.error}>{run.error}</em>}
              </article>
            ))}
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-title">
            <div>
              <h2>Live page activity</h2>
              <p>Latest cached requests and errors.</p>
            </div>
            <Eye size={17} />
          </div>
          <div className="admin-activity-list">
            {overview.pages.slice(0, 12).map((event, index) => (
              <article key={`${event.retailer_id}-${index}`}>
                <i className={`run-${event.last_status}`} />
                <span>
                  <b>{event.retailer_id}</b>
                  <small>
                    {event.last_status} ·{" "}
                    {event.last_fetched_at
                      ? new Date(event.last_fetched_at).toLocaleTimeString()
                      : "pending"}
                  </small>
                  <a href={event.source_url} target="_blank" rel="noreferrer">
                    {event.source_url}
                  </a>
                  {event.last_error && <em>{event.last_error}</em>}
                </span>
              </article>
            ))}
          </div>
        </section>
      </div>
      {selected && (
        <div
          className="admin-modal-backdrop"
          onMouseDown={() => setSelected(null)}
        >
          <section
            className="admin-source-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="eyebrow">SOURCE SETTINGS</div>
            <h2>{selected.name}</h2>
            <p>
              Policy checks always remain active. Disabling a source prevents
              scheduled and manual collection.
            </p>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={selected.enabled}
                onChange={(event) =>
                  setSelected({ ...selected, enabled: event.target.checked })
                }
              />{" "}
              Enable collection
            </label>
            <label>
              Daily start (Eastern)
              <input
                type="time"
                value={selected.schedule_time}
                onChange={(event) =>
                  setSelected({
                    ...selected,
                    schedule_time: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Delay between product pages (ms)
              <input
                type="number"
                min="5000"
                max="900000"
                value={selected.page_delay_ms}
                onChange={(event) =>
                  setSelected({
                    ...selected,
                    page_delay_ms: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Maximum pages per run
              <input
                type="number"
                min="1"
                max="10000"
                value={selected.max_pages}
                onChange={(event) =>
                  setSelected({
                    ...selected,
                    max_pages: Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="admin-policy-field">
              Collection policy
              <select
                value={selected.policy_override}
                onChange={(event) =>
                  setSelected({
                    ...selected,
                    policy_override: event.target.value,
                  })
                }
              >
                <option value="follow_policy">Enforce robots.txt and published terms</option>
                <option value="authorized_integration">Authorized API, feed, or import</option>
                <option value="disabled">Disabled by administrator — do not scrape</option>
              </select>
              <small className="admin-policy-help">
                Website crawling always enforces compliance checks. Authorized mode records a separate approved API, feed, or import and never converts it into unrestricted page scraping.
              </small>
            </label>
            {selected.policy_override === "authorized_integration" && (
              <div className="admin-authorized-fields">
                <label>
                  Integration type
                  <select
                    value={selected.integration_kind || ""}
                    onChange={(event) =>
                      setSelected({ ...selected, integration_kind: event.target.value })
                    }
                  >
                    <option value="">Choose a type</option>
                    <option value="api">Official or authorized API</option>
                    <option value="feed">Affiliate or retailer data feed</option>
                    <option value="manual_import">Supplied file or manual import</option>
                  </select>
                </label>
                <label>
                  Data-source URL or import reference
                  <input
                    type="text"
                    value={selected.authorized_source_url || ""}
                    placeholder="https://partner.example/feed.csv or import job reference"
                    onChange={(event) =>
                      setSelected({ ...selected, authorized_source_url: event.target.value })
                    }
                  />
                </label>
                <label>
                  Authorization reference
                  <input
                    type="text"
                    value={selected.authorization_reference || ""}
                    placeholder="Agreement, email, API terms, or internal approval reference"
                    onChange={(event) =>
                      setSelected({ ...selected, authorization_reference: event.target.value })
                    }
                  />
                </label>
                <small>
                  Saving this mode does not start generic crawling. Collection begins only after a connector for the approved source has been configured.
                </small>
              </div>
            )}
            <div>
              <button
                className="secondary-button"
                onClick={() => setSelected(null)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => saveSource(selected)}
              >
                Save settings
              </button>
            </div>
          </section>
        </div>
      )}
      {adding && (
        <div className="admin-modal-backdrop" onMouseDown={() => setAdding(false)}>
          <section className="admin-source-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="eyebrow">NEW RETAILER SOURCE</div>
            <h2>Add a catalog source</h2>
            <p>The source starts in pending policy review. The worker will inspect robots and terms before discovering product pages.</p>
            <label>Retailer name<input value={newSource.name} onChange={(event) => setNewSource({ ...newSource, name: event.target.value })} /></label>
            <label>Website address<input type="url" placeholder="https://retailer.example" value={newSource.baseUrl} onChange={(event) => setNewSource({ ...newSource, baseUrl: event.target.value })} /></label>
            <div><button className="secondary-button" onClick={() => setAdding(false)}>Cancel</button><button className="primary-button" disabled={busy || !newSource.name || !newSource.baseUrl} onClick={addSource}>Add source</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
