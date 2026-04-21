import { useState, useCallback, useEffect } from "react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Popover, ActionIcon, Badge, Stack, Text, Divider, Group, Button } from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { IconCalendar, IconX, IconChevronUp, IconChevronDown } from "@tabler/icons-react";

/**
 * Format a date for display on a task badge.
 * Returns e.g. "Mar 25, 2:30 PM"
 */
function formatDueDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Determine badge color based on due date proximity.
 * - Overdue (past): red
 * - Due today: orange
 * - Future: blue
 */
function getDueDateColor(isoString: string): string {
  const now = new Date();
  const due = new Date(isoString);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  if (due < now) return "red";
  if (due < startOfTomorrow) return "orange";
  return "blue";
}

export function TaskItemView({ node, updateAttributes }: NodeViewProps) {
  const [opened, setOpened] = useState(false);

  const dueDate = (node.attrs.dueDate as string | null) ?? null;
  const checked = (node.attrs.checked as boolean) ?? false;

  const pickerDate = dueDate ? new Date(dueDate) : null;
  const pickerTime = dueDate ? dueDate.slice(11, 16) : "12:00";

  // Local state so the calendar highlights the selected day immediately (before
  // TipTap propagates the attribute update back through the component tree).
  const [selectedDate, setSelectedDate] = useState<Date | null>(pickerDate);

  // Local hour/minute state for the +/- controls
  const [localHours, setLocalHours] = useState(() => parseInt(pickerTime.split(":")[0] ?? "12"));
  const [localMinutes, setLocalMinutes] = useState(() => parseInt(pickerTime.split(":")[1] ?? "0"));

  // Sync local state when the popover opens or the stored value changes externally
  useEffect(() => {
    if (opened) {
      setSelectedDate(pickerDate);
      const [h, m] = pickerTime.split(":").map(Number);
      setLocalHours(isNaN(h) ? 12 : h);
      setLocalMinutes(isNaN(m) ? 0 : m);
    }
  }, [opened, pickerTime]); // pickerDate intentionally omitted — derived from pickerTime

  const buildAndStore = useCallback(
    (date: Date | null, h: number, m: number) => {
      if (!date) {
        updateAttributes({ dueDate: null });
        return;
      }
      const combined = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
      const iso = new Date(combined.getTime() - combined.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      updateAttributes({ dueDate: iso });
    },
    [updateAttributes],
  );

  const handleDateChange = useCallback(
    (value: Date | null) => {
      setSelectedDate(value); // immediate visual feedback
      buildAndStore(value, localHours, localMinutes);
    },
    [buildAndStore, localHours, localMinutes],
  );

  const adjustHours = useCallback(
    (delta: number) => {
      const newH = ((localHours + delta) % 24 + 24) % 24;
      setLocalHours(newH);
      if (selectedDate) buildAndStore(selectedDate, newH, localMinutes);
    },
    [localHours, localMinutes, selectedDate, buildAndStore],
  );

  const adjustMinutes = useCallback(
    (delta: number) => {
      const newM = ((localMinutes + delta) % 60 + 60) % 60;
      setLocalMinutes(newM);
      if (selectedDate) buildAndStore(selectedDate, localHours, newM);
    },
    [localHours, localMinutes, selectedDate, buildAndStore],
  );

  const handleClearDate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      updateAttributes({ dueDate: null });
    },
    [updateAttributes],
  );

  return (
    <NodeViewWrapper as="li" data-checked={checked ? "true" : "false"}>
      <label contentEditable={false}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => updateAttributes({ checked: e.target.checked })}
        />
        <span />
      </label>
      <div>
        <NodeViewContent />
      </div>
      <div contentEditable={false} className="task-item-due-date-controls" data-testid="task-due-controls">
        {dueDate && !checked && (
          <Badge
            size="xs"
            color={getDueDateColor(dueDate)}
            variant="light"
            className="task-due-badge"
            data-testid="task-due-badge"
            rightSection={
              <ActionIcon
                size="xs"
                color={getDueDateColor(dueDate)}
                variant="transparent"
                onClick={handleClearDate}
                aria-label="Clear due date"
                data-testid="task-due-badge-clear"
              >
                <IconX size={10} />
              </ActionIcon>
            }
          >
            {formatDueDate(dueDate)}
          </Badge>
        )}
        <Popover
          opened={opened}
          onChange={setOpened}
          position="bottom-end"
          withinPortal
          closeOnClickOutside
          middlewares={{ shift: false, flip: false }}
        >
          <Popover.Target>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              className="task-calendar-btn"
              onClick={() => setOpened((o) => !o)}
              aria-label="Set due date"
              data-testid="task-calendar-btn"
            >
              <IconCalendar size={14} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown p="xs">
            <Stack gap="xs" data-testid="task-date-picker">
              <DatePicker
                size="xs"
                value={selectedDate}
                onChange={handleDateChange}
                highlightToday
              />
              <Divider />
              <Group gap={2} justify="center" align="center" wrap="nowrap">
                <Stack gap={0} align="center">
                  <ActionIcon
                    size={16}
                    variant="subtle"
                    disabled={!selectedDate}
                    onClick={() => adjustHours(1)}
                    style={{ padding: 0 }}
                  >
                    <IconChevronUp size={8} />
                  </ActionIcon>
                  <Text size="xs" fw={500} w={24} ta="center">
                    {String(localHours).padStart(2, "0")}
                  </Text>
                  <ActionIcon
                    size={16}
                    variant="subtle"
                    disabled={!selectedDate}
                    onClick={() => adjustHours(-1)}
                    style={{ padding: 0 }}
                  >
                    <IconChevronDown size={8} />
                  </ActionIcon>
                </Stack>
                <Text size="xs" fw={600}>:</Text>
                <Stack gap={0} align="center">
                  <ActionIcon
                    size={16}
                    variant="subtle"
                    disabled={!selectedDate}
                    onClick={() => adjustMinutes(5)}
                    style={{ padding: 0 }}
                  >
                    <IconChevronUp size={8} />
                  </ActionIcon>
                  <Text size="xs" fw={500} w={24} ta="center">
                    {String(localMinutes).padStart(2, "0")}
                  </Text>
                  <ActionIcon
                    size={16}
                    variant="subtle"
                    disabled={!selectedDate}
                    onClick={() => adjustMinutes(-5)}
                    style={{ padding: 0 }}
                  >
                    <IconChevronDown size={8} />
                  </ActionIcon>
                </Stack>
              </Group>
              <Button size="xs" onClick={() => setOpened(false)}>
                Accept
              </Button>
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </div>
    </NodeViewWrapper>
  );
}
