import { Group, Loader, Text, Button } from "@mantine/core";
import type { SaveStatus } from "../../hooks/useAutoSave";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  onRetry?: () => void;
}

export function SaveStatusIndicator({ status, onRetry }: SaveStatusIndicatorProps) {
  if (status === "idle") return null;

  if (status === "saving") {
    return (
      <Group gap={6} style={{ opacity: 0.7 }} data-testid="save-status-saving">
        <Loader size={12} />
        <Text size="xs" c="dimmed">
          Saving…
        </Text>
      </Group>
    );
  }

  if (status === "saved") {
    return (
      <Text size="xs" c="dimmed" data-testid="save-status-saved">
        Saved
      </Text>
    );
  }

  if (status === "error") {
    return (
      <Group gap={6} data-testid="save-status-error">
        <Text size="xs" c="red">
          Save failed
        </Text>
        {onRetry && (
          <Button size="compact-xs" variant="subtle" color="red" onClick={onRetry}>
            Retry
          </Button>
        )}
      </Group>
    );
  }

  return null;
}
