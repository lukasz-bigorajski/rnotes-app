import { useState, useEffect } from "react";
import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  Loader,
  ScrollArea,
  Paper,
  Badge,
} from "@mantine/core";
import { IconDatabaseOff, IconRefresh, IconAlertTriangle } from "@tabler/icons-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { type AppHealth, type BackupInfo, listBackups, restoreFromBackup } from "../ipc/backup";

dayjs.extend(relativeTime);

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface RecoveryDialogProps {
  health: AppHealth;
  onRecovered: () => void;
}

export function RecoveryDialog({ health, onRecovered }: RecoveryDialogProps) {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opened = health === "missing" || health === "corrupted";

  useEffect(() => {
    if (!opened) return;
    setLoadingBackups(true);
    listBackups()
      .then((list) => {
        setBackups(list);
        if (list.length > 0) {
          setSelectedPath(list[0].path);
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingBackups(false));
  }, [opened]);

  const handleRestore = async () => {
    if (!selectedPath) return;
    setRestoring(true);
    setError(null);
    try {
      await restoreFromBackup(selectedPath);
      onRecovered();
    } catch (e) {
      setError(String(e));
      setRestoring(false);
    }
  };

  const handleStartFresh = () => {
    onRecovered();
  };

  const title =
    health === "corrupted" ? "Database Corrupted" : "Database Not Found";

  const description =
    health === "corrupted"
      ? "The database file is corrupted and cannot be opened. Select a backup to restore from, or start fresh with an empty database."
      : "The database file could not be found. Select a backup to restore from, or start fresh with an empty database.";

  return (
    <Modal
      opened={opened}
      onClose={() => {}}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      title={
        <Group gap="xs">
          {health === "corrupted" ? (
            <IconAlertTriangle size={20} color="var(--mantine-color-orange-6)" />
          ) : (
            <IconDatabaseOff size={20} color="var(--mantine-color-red-6)" />
          )}
          <Text fw={600}>{title}</Text>
        </Group>
      }
      size="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {description}
        </Text>

        {loadingBackups ? (
          <Group justify="center" py="lg">
            <Loader size="sm" />
          </Group>
        ) : backups.length === 0 ? (
          <Paper withBorder p="md" radius="sm">
            <Text size="sm" c="dimmed" ta="center">
              No backups available. You will start with an empty database.
            </Text>
          </Paper>
        ) : (
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Available backups
            </Text>
            <ScrollArea.Autosize mah={280}>
              <Stack gap="xs">
                {backups.map((backup) => {
                  const selected = backup.path === selectedPath;
                  const relTime = dayjs(backup.timestamp).fromNow();
                  return (
                    <Paper
                      key={backup.path}
                      withBorder
                      p="sm"
                      radius="sm"
                      style={{
                        cursor: "pointer",
                        borderColor: selected
                          ? "var(--mantine-color-blue-6)"
                          : undefined,
                        backgroundColor: selected
                          ? "var(--mantine-color-blue-light)"
                          : undefined,
                      }}
                      onClick={() => setSelectedPath(backup.path)}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Stack gap={2}>
                          <Text size="sm" fw={500}>
                            {backup.timestamp.replace("T", " ")}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {relTime}
                          </Text>
                        </Stack>
                        <Badge variant="light" size="sm">
                          {formatSize(backup.size_bytes)}
                        </Badge>
                      </Group>
                    </Paper>
                  );
                })}
              </Stack>
            </ScrollArea.Autosize>
          </Stack>
        )}

        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}

        <Group justify="space-between" mt="xs">
          <Button variant="subtle" color="gray" onClick={handleStartFresh} disabled={restoring}>
            Start Fresh
          </Button>
          {backups.length > 0 && (
            <Button
              leftSection={restoring ? <Loader size={14} /> : <IconRefresh size={16} />}
              onClick={handleRestore}
              disabled={!selectedPath || restoring}
              loading={restoring}
            >
              Restore Selected
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
