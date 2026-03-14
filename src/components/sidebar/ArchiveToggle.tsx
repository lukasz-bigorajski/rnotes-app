import { Group, Button, Badge } from "@mantine/core";
import { IconArchive, IconFolderOpen } from "@tabler/icons-react";

interface ArchiveToggleProps {
  isArchiveOpen: boolean;
  setIsArchiveOpen: (open: boolean) => void;
  archivedCount: number;
}

export function ArchiveToggle({
  isArchiveOpen,
  setIsArchiveOpen,
  archivedCount,
}: ArchiveToggleProps) {
  return (
    <Group justify="center" gap="xs" mt="md">
      <Button
        variant={isArchiveOpen ? "default" : "subtle"}
        size="compact-sm"
        leftSection={<IconFolderOpen size={14} />}
        onClick={() => setIsArchiveOpen(false)}
      >
        Notes
      </Button>
      <Button
        variant={isArchiveOpen ? "default" : "subtle"}
        size="compact-sm"
        leftSection={<IconArchive size={14} />}
        onClick={() => setIsArchiveOpen(true)}
        rightSection={
          archivedCount > 0 ? (
            <Badge size="xs" variant="light">
              {archivedCount}
            </Badge>
          ) : null
        }
      >
        Archive
      </Button>
    </Group>
  );
}
