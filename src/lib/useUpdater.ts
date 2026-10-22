import { useCallback, useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "upToDate"
  | "available"
  | "installing"
  | "error";

/** Verifică la pornire și expune pașii de descărcare/instalare pentru Setări. */
export function useUpdater() {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdate = useCallback(async () => {
    setStatus("checking");
    setError(null);
    try {
      const found = await check();
      setUpdate(found);
      setStatus(found ? "available" : "upToDate");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!update) return;
    setStatus("installing");
    setError(null);
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  }, [update]);

  useEffect(() => {
    checkForUpdate().catch(() => {});
  }, [checkForUpdate]);

  return { status, update, error, checkForUpdate, installUpdate };
}
