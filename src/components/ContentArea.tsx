import { Center, Stack, Text } from "@mantine/core";
import { IconNotes } from "@tabler/icons-react";

export function ContentArea() {
  return (
    <Center h="100%">
      <Stack align="center" gap="sm">
        <IconNotes size={48} stroke={1.5} color="var(--mantine-color-dimmed)" />
        <Text c="dimmed" size="lg">
          Select a note or create a new one
        </Text>
      </Stack>
    </Center>
  );
}
