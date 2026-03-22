import { useState, useCallback } from "react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Popover, ActionIcon, Badge } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { IconCalendar, IconX } from "@tabler/icons-react";

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

  const handleDateChange = useCallback(
    (value: Date | null) => {
      if (value) {
        // Store as ISO 8601 string without timezone (local time)
        const iso = new Date(value.getTime() - value.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        updateAttributes({ dueDate: iso });
      } else {
        updateAttributes({ dueDate: null });
      }
      setOpened(false);
    },
    [updateAttributes],
  );

  const handleClearDate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      updateAttributes({ dueDate: null });
    },
    [updateAttributes],
  );

  // Convert ISO string to Date for the picker
  const pickerValue = dueDate ? new Date(dueDate) : null;

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
          <Popover.Dropdown>
            <DateTimePicker
              value={pickerValue}
              onChange={handleDateChange}
              placeholder="Pick date & time"
              clearable
              data-testid="task-date-picker"
            />
          </Popover.Dropdown>
        </Popover>
      </div>
    </NodeViewWrapper>
  );
}
