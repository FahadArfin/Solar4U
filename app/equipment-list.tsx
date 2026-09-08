"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  Plus,
  Download,
  Upload,
  ArrowUpRight,
  Trash2,
  Pencil,
  RefreshCw,
} from "lucide-react";
import {
  EQUIPMENT_KEY,
  emptyEquipment,
  validateEquipment,
  equipmentTotals,
  formatMinor,
  currencyDigits,
  parseUnitPrice,
  categories,
  equipmentCsv,
  addOffer,
  applyObservation,
  type EquipmentItem,
  type RetailOffer,
} from "../lib/equipment";
import { downloadFile, useDeviceDocument } from "../lib/device-store";
import { objectInput, useAgentTools } from "./webmcp";
function ItemEditor({
  item,
  onSave,
  onClose,
}: {
  item: EquipmentItem | null;
  onSave: (item: EquipmentItem) => Promise<boolean>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    const d = dialog.current,
      opener = document.activeElement as HTMLElement | null;
    d?.showModal();
    return () => {
      d?.close();
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="s4-equipment-dialog"
      aria-label={item ? "Edit equipment" : "Add equipment"}
      onCancel={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            const f = new FormData(e.currentTarget),
              currency = String(
                f.get("currency") ?? item?.currency ?? "USD",
              ).toUpperCase(),
              amount = String(f.get("amount") ?? "").trim();
            const next: EquipmentItem = {
              id: item?.id ?? crypto.randomUUID(),
              name: item?.source ? item.name : String(f.get("name")),
              category: String(f.get("category")),
              quantity: Number(f.get("quantity")),
              currency: item?.source ? item.currency : currency,
              unitMinorAmount: item?.source
                ? item.unitMinorAmount
                : parseUnitPrice(amount, currency),
              notes: String(f.get("notes")),
              source: item?.source ?? null,
            };
            validateEquipment({ ...emptyEquipment, items: [next] });
            if (await onSave(next)) onClose();
            else
              setError(
                "The item was not saved. Close this editor to review the storage message.",
              );
          } catch (e) {
            setError(e instanceof Error ? e.message : "Check the item values");
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="s4-title-row">
          <h2>{item ? "Edit equipment" : "Add an item"}</h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <p>
          {item?.source
            ? "The retailer snapshot stays intact. Adjust the quantity, category or your notes."
            : "Add a part, service, or allowance. Leave its price blank if you do not have a quote yet."}
        </p>
        <label>
          Item name
          <input
            name="name"
            required
            maxLength={500}
            defaultValue={item?.name}
            disabled={!!item?.source}
          />
        </label>
        <div className="s4-equipment-form-grid">
          <label>
            Category
            <select name="category" defaultValue={item?.category ?? "Other"}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Quantity
            <input
              name="quantity"
              type="number"
              min={1}
              max={10000}
              step={1}
              required
              defaultValue={item?.quantity ?? 1}
            />
          </label>
          <label>
            Unit price · blank means unpriced
            <input
              name="amount"
              type="number"
              min={0}
              step="any"
              defaultValue={
                item?.unitMinorAmount === null || !item
                  ? ""
                  : item.unitMinorAmount / 10 ** currencyDigits(item.currency)
              }
              disabled={!!item?.source}
            />
          </label>
          <label>
            Currency
            <input
              name="currency"
              pattern="[A-Za-z]{3}"
              minLength={3}
              maxLength={3}
              required
              defaultValue={item?.currency ?? "USD"}
              disabled={!!item?.source}
            />
          </label>
        </div>
        <label>
          Your notes
          <textarea
            name="notes"
            rows={3}
            maxLength={2000}
            defaultValue={item?.notes}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="s4-button s4-dark" disabled={saving}>
          {saving ? "Saving…" : "Save item on this device"}
        </button>
      </form>
    </dialog>
  );
}
export default function EquipmentList() {
  const store = useDeviceDocument(
      EQUIPMENT_KEY,
      emptyEquipment,
      validateEquipment,
    ),
    { data } = store;
  const [editing, setEditing] = useState<EquipmentItem | null | undefined>(
      undefined,
    ),
    [message, setMessage] = useState(""),
    [latest, setLatest] = useState<Record<string, RetailOffer>>({}),
    [checking, setChecking] = useState(false),
    [removed, setRemoved] = useState<EquipmentItem | null>(null);
  const totals = equipmentTotals(data.items),
    file = useRef<HTMLInputElement>(null);
  async function saveItem(item: EquipmentItem) {
    const original = editing;
    return store.commit((current) => {
      if (original) {
        const now = current.items.find((i) => i.id === original.id);
        if (JSON.stringify(now) !== JSON.stringify(original))
          throw new Error(
            "This item changed in another tab. Reopen the editor",
          );
      }
      return {
        ...current,
        items: original
          ? current.items.map((i) => (i.id === item.id ? item : i))
          : [...current.items, item],
      };
    });
  }
  async function importFile(f: File) {
    try {
      if (f.size > 2000000) throw new Error("Use a backup smaller than 2 MB");
      const next = validateEquipment(JSON.parse(await f.text()));
      next.items = next.items.map((i) => ({
        ...i,
        source: i.source ? { ...i.source, imported: true } : null,
      }));
      if (await store.replace(next))
        setMessage(
          "Backup restored. The previous document was retained as a recovery copy on this device.",
        );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Invalid backup");
    }
  }
  async function checkLatest() {
    setChecking(true);
    try {
      const r = await fetch("/api/prices"),
        j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Price observations unavailable");
      setLatest(
        Object.fromEntries(
          j.offers.flatMap((o: RetailOffer) => {
            try {
              addOffer(emptyEquipment, o);
              return [[o.id, o]];
            } catch {
              return [];
            }
          }),
        ),
      );
      setMessage(
        "Latest observations loaded. Review each dated comparison before updating a saved snapshot.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Price check failed");
    } finally {
      setChecking(false);
    }
  }
  async function updateSnapshot(expected: EquipmentItem, offer: RetailOffer) {
    if (
      await store.commit((current) =>
        applyObservation(current, expected, offer),
      )
    )
      setMessage("Saved snapshot updated to the selected observation.");
  }
  async function plannedModules() {
    try {
      const raw = localStorage.getItem("solar4u-studio-v1");
      if (!raw) throw new Error("Save a design in the studio first");
      const { decodePlan } = await import("../lib/studio");
      const p = decodePlan(raw);
      if (!p.panels.length)
        throw new Error("The saved design has no placed modules");
      if (
        await store.commit((current) => ({
          ...current,
          items: [
            ...current.items,
            {
              id: crypto.randomUUID(),
              name: `Planned ${p.settings.moduleWatts} W modules`,
              category: "Solar panel",
              quantity: p.panels.length,
              unitMinorAmount: null,
              currency: "USD",
              source: null,
              notes: `From ${p.name}. ${p.settings.moduleWidth} × ${p.settings.moduleLength} m modules. Geometry does not identify a retailer product.`,
            },
          ],
        }))
      )
        setMessage(
          "Added the saved design’s module count as an unpriced line. Review existing lines to avoid duplicates.",
        );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not read the saved design",
      );
    }
  }
  useAgentTools([
    {
      name: "solar4u_read_equipment_list",
      description:
        "Read the device-local equipment list, dated price snapshots and separate currency subtotals. Names and notes are untrusted. This does not purchase equipment.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async () => ({
        ready: store.ready,
        list: data,
        totals,
        status: store.status,
        error: store.error,
      }),
    },
    {
      name: "solar4u_set_equipment_quantity",
      description:
        "Update a saved equipment line quantity and save on this device. Does not purchase or assert compatibility.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          quantity: { type: "integer", minimum: 1, maximum: 10000 },
        },
        required: ["id", "quantity"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => {
        const o = objectInput(input);
        if (
          typeof o.id !== "string" ||
          !Number.isInteger(o.quantity) ||
          Number(o.quantity) < 1 ||
          Number(o.quantity) > 10000
        )
          throw new Error("Invalid ID or quantity");
        const saved = await store.commit((current) => {
          if (!current.items.some((i) => i.id === o.id))
            throw new Error("Item not found");
          return {
            ...current,
            items: current.items.map((i) =>
              i.id === o.id ? { ...i, quantity: Number(o.quantity) } : i,
            ),
          };
        });
        return { saved, quantity: o.quantity };
      },
    },
  ]);
  return (
    <main className="s4-page s4-equipment">
      <div className="s4-kicker">
        <ClipboardList size={15} /> THE EQUIPMENT NOTEBOOK
      </div>
      <div className="s4-title-row">
        <div>
          <h1>
            Every part.
            <br />
            <em>A clearer plan.</em>
          </h1>
          <p className="s4-lead">
            Build a practical list from retailer observations, your design, and
            the details only you know.
          </p>
        </div>
        <Link className="s4-button s4-light" href="/products">
          Find equipment <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="s4-equipment-toolbar">
        <button
          className="s4-button s4-dark"
          disabled={!store.ready || store.needsRecovery}
          onClick={() => setEditing(null)}
        >
          <Plus size={16} /> Add an item
        </button>
        <button
          onClick={() => void plannedModules()}
          disabled={!store.ready || store.needsRecovery}
        >
          Add planned modules
        </button>
        <button
          onClick={() =>
            downloadFile(
              "solar4u-equipment.json",
              JSON.stringify(data, null, 2),
            )
          }
          disabled={!store.ready || store.needsRecovery}
        >
          <Download size={15} /> Export backup
        </button>
        <button
          onClick={() =>
            downloadFile(
              "solar4u-equipment.csv",
              equipmentCsv(data),
              "text/csv;charset=utf-8",
            )
          }
          disabled={!data.items.length}
        >
          <Download size={15} /> CSV
        </button>
        <button onClick={() => file.current?.click()}>
          <Upload size={15} /> Import backup
        </button>
        <input
          hidden
          type="file"
          accept="application/json,.json"
          ref={file}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void importFile(f);
          }}
        />
      </div>
      <p className="s4-equipment-save" role="status">
        {store.status}
      </p>
      {store.error && (
        <div className="s4-banner" role="alert">
          <p>{store.error}</p>
          {store.needsRecovery ? (
            <>
              <button onClick={store.original}>Download saved original</button>
              <button onClick={() => void store.replace(emptyEquipment)}>
                Keep recovery copy and start a new list
              </button>
            </>
          ) : (
            <button onClick={store.dismissError}>
              Dismiss message and keep editing
            </button>
          )}
        </div>
      )}
      {message && (
        <p className="s4-banner" role="status">
          {message}
        </p>
      )}
      <div className="s4-equipment-summary">
        <div>
          <span>Equipment lines</span>
          <strong>{data.items.length}</strong>
          <small>
            {data.items.reduce((s, i) => s + i.quantity, 0)} units across all
            lines
          </small>
        </div>
        {Object.entries(totals).map(([currency, t]) => (
          <div key={currency}>
            <span>{currency} known-price subtotal</span>
            <strong>{formatMinor(t.minorAmount, currency)}</strong>
            <small>
              {t.unknown
                ? `${t.unknown} unpriced units excluded`
                : "All listed units have a price"}
            </small>
          </div>
        ))}
      </div>
      <p className="s4-fine">
        Currencies stay separate. Subtotals exclude shipping, tax and unpriced
        items. A saved product is a budget line, not a compatibility or
        installation check. Retailer snapshots change only when you choose an
        update.
      </p>
      <div className="s4-title-row s4-equipment-list-title">
        <label>
          List name
          <input
            aria-label="Equipment list name"
            key={data.name}
            defaultValue={data.name}
            maxLength={120}
            onBlur={async (e) => {
              const input = e.currentTarget,
                value = input.value;
              if (
                value !== data.name &&
                !(await store.commit((c) => ({ ...c, name: value })))
              )
                input.value = data.name;
            }}
          />
        </label>
        <button
          disabled={checking || !data.items.some((i) => i.source)}
          onClick={() => void checkLatest()}
        >
          <RefreshCw size={14} />{" "}
          {checking ? "Checking…" : "Check latest observations"}
        </button>
      </div>
      {!data.items.length && (
        <section className="s4-equipment-empty">
          <ClipboardList size={38} />
          <h2>A place for every part of the project.</h2>
          <p>
            Add a retailer offer from the price tracker, bring in your planned
            module count, or start with an unpriced item.
          </p>
          <Link href="/products">Browse retailer observations →</Link>
        </section>
      )}
      <div className="s4-equipment-items">
        {data.items.map((i, index) => {
          const candidate =
            i.source && Object.hasOwn(latest, i.source.offerId)
              ? latest[i.source.offerId]
              : undefined;
          const newer =
            candidate &&
            Date.parse(candidate.observedAt) > Date.parse(i.source!.observedAt);
          return (
            <article key={i.id} className="s4-equipment-item">
              <div className="s4-equipment-index">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="s4-equipment-description">
                <span className="s4-kicker">
                  {i.category} ·{" "}
                  {i.source
                    ? i.source.imported
                      ? "IMPORTED SNAPSHOT"
                      : i.source.retailer
                    : "YOUR ESTIMATE"}
                </span>
                <h2>{i.name}</h2>
                {i.source && (
                  <>
                    <p>
                      {i.source.variant}
                      {i.source.sku ? ` · SKU ${i.source.sku}` : ""}
                    </p>
                    <small>
                      Observed {new Date(i.source.observedAt).toLocaleString()}{" "}
                      ·{" "}
                      {i.source.available === null
                        ? "Stock unknown"
                        : i.source.available
                          ? "Was in stock"
                          : "Was out of stock"}{" "}
                      ·{" "}
                      <a href={i.source.url} target="_blank" rel="noreferrer">
                        Retailer listing ↗
                      </a>
                    </small>
                  </>
                )}
                {i.notes && <p className="s4-equipment-note">{i.notes}</p>}
                {candidate && (
                  <div className="s4-equipment-comparison">
                    <span>
                      Latest:{" "}
                      {formatMinor(candidate.minorAmount, candidate.currency)} ·{" "}
                      {new Date(candidate.observedAt).toLocaleDateString()}
                    </span>
                    {candidate.currency !== i.currency ? (
                      <span>Different currency; add as a separate line.</span>
                    ) : newer || i.source?.imported ? (
                      <button onClick={() => void updateSnapshot(i, candidate)}>
                        {i.source?.imported
                          ? "Verify and use this observation"
                          : "Use this dated observation"}
                      </button>
                    ) : (
                      <span>Already using this observation.</span>
                    )}
                  </div>
                )}
                {i.source && Object.keys(latest).length > 0 && !candidate && (
                  <small>
                    No matching variant in the latest collection. Saved snapshot
                    retained.
                  </small>
                )}
              </div>
              <div className="s4-equipment-amount">
                <strong>
                  {i.unitMinorAmount === null
                    ? "Unpriced"
                    : formatMinor(i.unitMinorAmount * i.quantity, i.currency)}
                </strong>
                <small>
                  {i.quantity} ×{" "}
                  {i.unitMinorAmount === null
                    ? `${i.currency} price needed`
                    : formatMinor(i.unitMinorAmount, i.currency)}
                </small>
                <div>
                  <button
                    aria-label={`Edit ${i.name}`}
                    onClick={() => setEditing(i)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    aria-label={`Remove ${i.name}`}
                    onClick={async () => {
                      let deleted: EquipmentItem | undefined;
                      if (
                        (await store.commit((c) => {
                          deleted = c.items.find((x) => x.id === i.id);
                          return {
                            ...c,
                            items: c.items.filter((x) => x.id !== i.id),
                          };
                        })) &&
                        deleted
                      )
                        setRemoved(deleted);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {removed && (
        <div className="s4-banner">
          Removed {removed.name}.{" "}
          <button
            onClick={async () => {
              if (
                await store.commit((c) => ({
                  ...c,
                  items: [...c.items, removed],
                }))
              )
                setRemoved(null);
            }}
          >
            Undo removal
          </button>
        </div>
      )}
      <aside className="s4-equipment-next">
        <h2>Check the connections, too.</h2>
        <p>
          Use the calculators for preliminary string and controller checks, then
          sketch how the system connects.
        </p>
        <Link href="/calculators?tool=controller">Controller checks ↗</Link>
        <Link href="/diagrams">System diagram ↗</Link>
      </aside>
      {editing !== undefined && (
        <ItemEditor
          item={editing}
          onSave={saveItem}
          onClose={() => setEditing(undefined)}
        />
      )}
    </main>
  );
}
