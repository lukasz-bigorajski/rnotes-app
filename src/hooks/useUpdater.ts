import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { notifications } from "@mantine/notifications";

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

export async function checkForUpdates(): Promise<void> {
  try {
    const update = await check();
    if (!update) {
      notifications.show({
        message: "You're on the latest version",
        color: "teal",
      });
      return;
    }

    const ok = window.confirm(
      `rnotes ${update.version} is available.\n\n${update.body ?? ""}\n\nDownload and install now?`,
    );
    if (!ok) return;

    await update.downloadAndInstall();
    await relaunch();
  } catch (err) {
    console.error("Updater check failed:", err);
    notifications.show({
      message: "Update check failed",
      color: "red",
    });
  }
}
