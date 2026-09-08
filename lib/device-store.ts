"use client";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
export function downloadFile(
  name: string,
  text: string,
  type = "application/json",
) {
  const u = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
const EVENT = "solar4u-device-document";
function boundedJson(raw: string) {
  if (new TextEncoder().encode(raw).length > 2000000)
    throw new Error("Document exceeds 2 MB");
  return raw;
}
export async function withDocumentLock<T>(
  key: string,
  action: () => T,
): Promise<T> {
  if (navigator.locks) return navigator.locks.request(key, action);
  throw new Error("This browser does not support coordinated device saving");
}
export function readDocument<T>(
  key: string,
  empty: T,
  validate: (v: unknown) => T,
) {
  const raw = localStorage.getItem(key);
  if (raw) boundedJson(raw);
  return raw ? validate(JSON.parse(raw)) : empty;
}
export async function writeDocument<T extends { updatedAt: string }>(
  key: string,
  empty: T,
  validate: (v: unknown) => T,
  change: (v: T) => T,
) {
  return withDocumentLock(key, () => {
    const current = readDocument(key, empty, validate),
      next = validate({
        ...change(current),
        updatedAt: new Date().toISOString(),
      });
    const raw = boundedJson(JSON.stringify(next));
    localStorage.setItem(key, raw);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
    return next;
  });
}
export function useDeviceDocument<T extends { updatedAt: string }>(
  key: string,
  empty: T,
  validate: (v: unknown) => T,
) {
  const [data, setData] = useState(empty),
    [ready, setReady] = useState(false),
    [needsRecovery, setNeedsRecovery] = useState(false),
    [status, setStatus] = useState("Opening device storage…"),
    [error, setError] = useState("");
  useEffect(() => {
    function load() {
      try {
        const next = readDocument(key, empty, validate);
        setData(next);
        setNeedsRecovery(false);
        setError("");
        setStatus(
          next.updatedAt
            ? "Saved on this device · " +
                new Date(next.updatedAt).toLocaleString()
            : "No saved changes yet",
        );
      } catch (e) {
        setNeedsRecovery(true);
        setError(
          (e instanceof Error ? e.message : "Storage unavailable") +
            ". The saved original has not been overwritten.",
        );
        setStatus("Device save needs attention");
      }
      setReady(true);
    }
    const t = setTimeout(load, 0);
    const custom = (e: Event) => {
      if ((e as CustomEvent).detail === key) load();
    };
    const cross = (e: StorageEvent) => {
      if (e.key === key || e.key === null) load();
    };
    window.addEventListener(EVENT, custom);
    window.addEventListener("storage", cross);
    return () => {
      clearTimeout(t);
      window.removeEventListener(EVENT, custom);
      window.removeEventListener("storage", cross);
    };
  }, [key, empty, validate]);
  async function commit(change: (v: T) => T) {
    if (!ready) return false;
    try {
      const next = await writeDocument(key, empty, validate, change);
      flushSync(() => {
        setData(next);
        setError("");
        setStatus(
          "Autosaved on this device · " +
            new Date(next.updatedAt).toLocaleTimeString(),
        );
      });
      return true;
    } catch (e) {
      try {
        readDocument(key, empty, validate);
      } catch {
        setNeedsRecovery(true);
      }
      setError(
        (e instanceof Error ? e.message : "Save failed") +
          ". This edit was not saved or applied.",
      );
      return false;
    }
  }
  async function replace(next: T) {
    try {
      return await withDocumentLock(key, () => {
        const checked = validate(next),
          raw = localStorage.getItem(key),
          replacement = boundedJson(
            JSON.stringify({ ...checked, updatedAt: new Date().toISOString() }),
          );
        if (raw) localStorage.setItem(`${key}.recovery.${Date.now()}`, raw);
        localStorage.setItem(key, replacement);
        window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
        setError("");
        return true;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
      return false;
    }
  }
  function original() {
    try {
      downloadFile(`${key}-original.json`, localStorage.getItem(key) ?? "null");
    } catch {
      setError("Device storage is unavailable");
    }
  }
  return {
    data,
    ready,
    status,
    error,
    needsRecovery,
    dismissError: () => setError(""),
    commit,
    replace,
    original,
  };
}
