import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { Button, Text } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { error as logError } from "@tauri-apps/plugin-log";

function showUpdateInstalledNotification(version: string) {
  const id = "update-installed";
  notifications.show({
    id,
    title: "Update installed",
    message: (
      <div>
        <div>{`The app has been updated to v${version}. Restart to apply.`}</div>
        <Button
          size="xs"
          variant="light"
          color="teal"
          mt="xs"
          onClick={() => {
            notifications.hide(id);
            relaunch();
          }}
        >
          Restart now
        </Button>
      </div>
    ),
    color: "teal",
    icon: <IconCheck size={16} />,
    autoClose: 8000,
  });
}

function promptAndInstall(version: string, body: string | undefined, doInstall: () => Promise<void>) {
  modals.openConfirmModal({
    title: `Update available: v${version}`,
    children: (
      <Text size="sm">
        {body ? body + "\n\n" : ""}Download and install now?
      </Text>
    ),
    labels: { confirm: "Install", cancel: "Later" },
    confirmProps: { color: "teal" },
    onConfirm: () => {
      doInstall()
        .then(() => showUpdateInstalledNotification(version))
        .catch((err: unknown) => {
          void logError(`Update install failed: ${String(err)}`);
          notifications.show({
            title: "Update failed",
            message: "Could not install the update. Please try again later.",
            color: "red",
          });
        });
    },
  });
}

export function useUpdater() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const update = await check();
        if (cancelled || !update) return;
        promptAndInstall(update.version, update.body, () => update.downloadAndInstall());
      } catch (err) {
        void logError(`Updater check failed: ${String(err)}`);
        notifications.show({
          title: "Update check failed",
          message: "Could not check for updates. Check your internet connection.",
          color: "orange",
          autoClose: 6000,
        });
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
    promptAndInstall(update.version, update.body, () => update.downloadAndInstall());
  } catch (err) {
    void logError(`Updater check failed: ${String(err)}`);
    notifications.show({
      title: "Update check failed",
      message: "Could not check for updates. Check your internet connection.",
      color: "red",
    });
  }
}
