import { Stack, Text, Button, Group } from "@mantine/core";
import { IconPlus, IconFolder } from "@tabler/icons-react";

export function Sidebar() {
  return (
    <Stack gap="sm" h="100%">
      <Group justify="space-between">
        <Text fw={700} size="lg">
          Notes
        </Text>
        <Group gap="xs">
          <Button variant="subtle" size="compact-sm" leftSection={<IconPlus size={14} />}>
            Note
          </Button>
          <Button variant="subtle" size="compact-sm" leftSection={<IconFolder size={14} />}>
            Folder
          </Button>
        </Group>
      </Group>

      <Text c="dimmed" ta="center" mt="xl">
        No notes yet. Create one to get started.
      </Text>
    </Stack>
  );
}
