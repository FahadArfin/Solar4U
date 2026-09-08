"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  House,
  BookOpen,
  Bookmark,
  ClipboardList,
} from "lucide-react";
import lessons from "../data/learning-content.json";
import { decodePlan } from "../lib/studio";
import {
  EQUIPMENT_KEY,
  emptyEquipment,
  validateEquipment,
  equipmentTotals,
  formatMinor,
} from "../lib/equipment";
import { downloadFile, readDocument } from "../lib/device-store";
import { useAgentTools } from "./webmcp";
const keys = [
  "solar4u-studio-v1",
  EQUIPMENT_KEY,
  "solar4u-learning-v2",
  "solar4u-watchlist-v1",
  "solar4u-diagram-v1",
];
type Summary = {
  ready: boolean;
  studio: { name: string; panels: number; kw: number } | null;
  bom: typeof emptyEquipment;
  completed: number;
  last: string;
  watch: number;
  errors: string[];
};
const empty: Summary = {
  ready: false,
  studio: null,
  bom: emptyEquipment,
  completed: 0,
  last: "",
  watch: 0,
  errors: [],
};
export default function WorkspacePage() {
  const [summary, setSummary] = useState(empty),
    [message, setMessage] = useState("");
  useEffect(() => {
    function load() {
      const s: Summary = { ...empty, ready: true, errors: [] };
      try {
        const raw = localStorage.getItem(keys[0]);
        if (raw) {
          const p = decodePlan(raw);
          s.studio = {
            name: p.name,
            panels: p.panels.length,
            kw: p.panels.reduce((v, p) => v + p.watts, 0) / 1000,
          };
        }
      } catch {
        s.errors.push("The saved design needs recovery in the studio.");
      }
      try {
        s.bom = readDocument(EQUIPMENT_KEY, emptyEquipment, validateEquipment);
      } catch {
        s.errors.push("The equipment list needs recovery in its editor.");
      }
      try {
        const p = JSON.parse(localStorage.getItem(keys[2]) ?? "null"),
          valid = new Set(lessons.map((l) => l.id));
        if (p) {
          s.completed = Array.isArray(p.completed)
            ? new Set(
                p.completed.filter(
                  (id: unknown) => typeof id === "string" && valid.has(id),
                ),
              ).size
            : 0;
          s.last =
            typeof p.last === "string" && valid.has(p.last) ? p.last : "";
        }
      } catch {
        s.errors.push("Learning progress could not be read.");
      }
      try {
        const p = JSON.parse(localStorage.getItem(keys[3]) ?? "[]");
        s.watch = Array.isArray(p)
          ? new Set(p.filter((id) => typeof id === "string")).size
          : 0;
      } catch {
        s.errors.push("The watchlist could not be read.");
      }
      setSummary(s);
    }
    const t = setTimeout(load, 0);
    window.addEventListener("storage", load);
    window.addEventListener("solar4u-device-document", load);
    return () => {
      clearTimeout(t);
      window.removeEventListener("storage", load);
      window.removeEventListener("solar4u-device-document", load);
    };
  }, []);
  function backup() {
    try {
      const documents = Object.fromEntries(
        keys.map((key) => [key, localStorage.getItem(key)]),
      );
      downloadFile(
        "solar4u-device-archive.json",
        JSON.stringify(
          {
            format: "solar4u-device-archive",
            version: 1,
            exportedAt: new Date().toISOString(),
            documents,
          },
          null,
          2,
        ),
      );
      setMessage(
        "Device archive exported. Each stored document is preserved as its original JSON text; the studio, equipment and diagram editors also export directly restorable backups.",
      );
    } catch {
      setMessage("Device storage is blocked; the archive could not be read.");
    }
  }
  const totals = equipmentTotals(summary.bom.items);
  useAgentTools([
    {
      name: "solar4u_read_workspace",
      description:
        "Read summaries of this browser’s saved design, equipment list, learning progress and watchlist. Does not upload the documents.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async () => ({
        ready: summary.ready,
        design: summary.studio,
        equipmentLines: summary.bom.items.length,
        equipmentTotals: totals,
        completedLessons: summary.completed,
        watchlistCount: summary.watch,
        errors: summary.errors,
        storage:
          "This browser and Site origin only; use exported backups when moving devices.",
      }),
    },
  ]);
  return (
    <main className="s4-page s4-equipment">
      <div className="s4-kicker">YOUR OWN ENERGY WORKSPACE</div>
      <div className="s4-title-row">
        <div>
          <h1>
            Good ideas.
            <br />
            <em>Kept close.</em>
          </h1>
          <p className="s4-lead">
            Pick up your saved design, follow your equipment, and take the next
            small step.
          </p>
        </div>
        <button disabled={!summary.ready} onClick={backup}>
          Export device archive
        </button>
      </div>
      <p className="s4-fine">
        Saved in this browser for this Site. This is not an online account
        backup. Export your documents before clearing browser data or moving to
        another device.
      </p>
      {message && (
        <p className="s4-banner" role="status">
          {message}
        </p>
      )}
      {summary.errors.map((e) => (
        <p key={e} role="alert" className="s4-banner">
          {e} Existing data has been retained.
        </p>
      ))}
      <div className="s4-workspace-cards">
        <section className="s4-workspace-card">
          <House size={24} />
          <h2>{summary.studio?.name ?? "Your next solar design"}</h2>
          <strong>
            {!summary.ready
              ? "Opening…"
              : summary.studio
                ? `${summary.studio.panels} panels · ${summary.studio.kw.toLocaleString()} kW`
                : "No saved design yet"}
          </strong>
          <p>
            Measured house dimensions, editable roof faces, ground rows, and the
            panel layout you last saved.
          </p>
          <Link href="/planner">
            {summary.studio ? "Resume design" : "Open design studio"}{" "}
            <ArrowUpRight size={16} />
          </Link>
          <Link href="/roof-analysis">
            Explore aerial roof data <ArrowUpRight size={16} />
          </Link>
        </section>
        <section className="s4-workspace-card">
          <ClipboardList size={24} />
          <h2>{summary.bom.name}</h2>
          <strong>
            {summary.ready ? summary.bom.items.length : "—"} equipment lines
          </strong>
          <p>
            {Object.entries(totals).map(([c, t]) => (
              <span style={{ display: "block" }} key={c}>
                {formatMinor(t.minorAmount, c)} known-price subtotal
                {t.unknown ? ` · ${t.unknown} unpriced units` : ""}
              </span>
            ))}
            {summary.bom.updatedAt
              ? "Saved " + new Date(summary.bom.updatedAt).toLocaleString()
              : "Start with a retailer offer or a part you still need to price."}
          </p>
          <Link href="/equipment">
            Open equipment list <ArrowUpRight size={16} />
          </Link>
        </section>
        <section className="s4-workspace-card">
          <BookOpen size={24} />
          <h2>A little more understanding.</h2>
          <strong>
            {summary.ready ? summary.completed : "—"} / {lessons.length} lessons
            completed
          </strong>
          <p>
            Worked examples, original illustrations, and knowledge checks. Your
            progress stays with this browser.
          </p>
          <Link href={summary.last ? `/guides#${summary.last}` : "/guides"}>
            {summary.last ? "Resume your last lesson" : "Start learning"}{" "}
            <ArrowUpRight size={16} />
          </Link>
        </section>
        <section className="s4-workspace-card">
          <Bookmark size={24} />
          <h2>The equipment you’re following.</h2>
          <strong>{summary.ready ? summary.watch : "—"} saved variants</strong>
          <p>
            Your watchlist is separate from the equipment budget. See actual
            dated observations and each retailer’s collection status.
          </p>
          <Link href="/products?watchlist=1">
            Open your watchlist <ArrowUpRight size={16} />
          </Link>
          <Link href="/diagrams">
            Work on your system diagram <ArrowUpRight size={16} />
          </Link>
        </section>
      </div>
    </main>
  );
}
