import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export function useUpdater() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const update = await check();
        if (cancelled || !update) return;

        const ok = window.confirm(
          `rnotes ${update.version} is available.\n\n${update.body ?? ""}\n\nDownload and install now?`,
        );
        if (!ok) return;

        await update.downloadAndInstall();
        await relaunch();
      } catch (err) {
        console.error("Updater check failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
