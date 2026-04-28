import { useState, useEffect, useCallback, useRef } from "react";
import { Text, Title, SegmentedControl, Select, Checkbox, Badge, Stack, Group, Button, Modal, TextInput } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { IconNotes } from "@tabler/icons-react";
import dayjs from "dayjs";
import { getAllTasks, updateTaskChecked, createInboxTask } from "../ipc/tasks";
import type { NoteTaskWithNote } from "../ipc/tasks";
import { notifyError } from "../utils/notify";
import styles from "./TaskOverview.module.css";

interface TaskOverviewProps {
  onNavigateToNote: (noteId: string) => void;
  activeNoteId?: string | null;
  onNoteContentChanged?: (noteId: string) => void;
}

type StatusFilter = "All" | "Open" | "Completed";
type SortOption = "Due date" | "Note" | "Created";

type GroupKey = "overdue" | "today" | "week" | "later" | "none";

interface TaskGroup {
  key: GroupKey;
  label: string;
  headerClass: string;
  tasks: NoteTaskWithNote[];
}

function getGroupKey(task: NoteTaskWithNote, now: dayjs.Dayjs): GroupKey {
  if (task.notify_at == null) return "none";

  const due = dayjs(task.notify_at);
  const startOfToday = now.startOf("day");
  const endOfToday = now.endOf("day");
  const endOfWeek = now.add(7, "day").endOf("day");

  if (due.isBefore(startOfToday) && !task.is_checked) return "overdue";
  if (due.isBefore(endOfToday) || due.isSame(endOfToday)) return "today";
  if (due.isBefore(endOfWeek) || due.isSame(endOfWeek)) return "week";
  return "later";
}

function formatDueDate(notifyAt: number | null): string | null {
  if (notifyAt == null) return null;
  const d = dayjs(notifyAt);
  const now = dayjs();
  if (d.isSame(now, "day")) return `Today ${d.format("HH:mm")}`;
  if (d.isSame(now.add(1, "day"), "day")) return `Tomorrow ${d.format("HH:mm")}`;
  return d.format("MMM D, HH:mm");
}

function getBadgeColor(groupKey: GroupKey): string {
  if (groupKey === "overdue") return "red";
  if (groupKey === "today") return "yellow";
  return "gray";
}

export function TaskOverview({
  onNavigateToNote,
  activeNoteId,
  onNoteContentChanged,
}: TaskOverviewProps) {
  const [tasks, setTasks] = useState<NoteTaskWithNote[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Open");
  const [sortOption, setSortOption] = useState<SortOption>("Due date");
  const [modalOpen, setModalOpen] = useState(false);
  const [newTaskContent, setNewTaskContent] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const contentInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    getAllTasks()
      .then(setTasks)
      .catch(console.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = useCallback(
    async (task: NoteTaskWithNote) => {
      const newChecked = !task.is_checked;
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, is_checked: newChecked } : t)),
      );
      try {
        const result = await updateTaskChecked(task.id, newChecked);
        // If the affected note is currently open in the editor, signal that its
        // content has changed so the editor re-fetches and shows the updated state.
        if (result.note_id && result.note_id === activeNoteId && onNoteContentChanged) {
          onNoteContentChanged(result.note_id);
        }
      } catch (err) {
        console.error("Failed to update task:", err);
        // Revert on error
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, is_checked: !newChecked } : t)),
        );
        notifyError("Update failed", "Could not update the task");
      }
    },
    [activeNoteId, onNoteContentChanged],
  );

  const handleOpenModal = () => {
    setNewTaskContent("");
    setNewTaskDueDate(null);
    setModalOpen(true);
  };

  const handleSaveTask = async () => {
    if (!newTaskContent.trim()) return;
    setSaving(true);
    try {
      await createInboxTask(newTaskContent.trim(), newTaskDueDate ? newTaskDueDate.getTime() : null);
      setModalOpen(false);
      load();
    } catch (err) {
      console.error("Failed to create task:", err);
      notifyError("Create failed", "Could not create the task");
    } finally {
      setSaving(false);
    }
  };

  // Apply status filter
  const filtered = tasks.filter((t) => {
    if (statusFilter === "Open") return !t.is_checked;
    if (statusFilter === "Completed") return t.is_checked;
    return true;
  });

  // Apply sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortOption === "Due date") {
      const aDate = a.notify_at ?? Number.MAX_SAFE_INTEGER;
      const bDate = b.notify_at ?? Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    }
    if (sortOption === "Note") {
      return a.note_title.localeCompare(b.note_title);
    }
    // Created
    return a.created_at - b.created_at;
  });

  // Group tasks
  const now = dayjs();
  const groupOrder: GroupKey[] = ["overdue", "today", "week", "later", "none"];
  const groupMeta: Record<GroupKey, { label: string; headerClass: string }> = {
    overdue: { label: "Overdue", headerClass: styles.groupHeaderOverdue },
    today: { label: "Today", headerClass: styles.groupHeaderToday },
    week: { label: "This Week", headerClass: styles.groupHeaderDefault },
    later: { label: "Later", headerClass: styles.groupHeaderDefault },
    none: { label: "No Due Date", headerClass: styles.groupHeaderDefault },
  };

  const groupMap = new Map<GroupKey, NoteTaskWithNote[]>();
  for (const key of groupOrder) groupMap.set(key, []);
  for (const task of sorted) {
    const key = getGroupKey(task, now);
    groupMap.get(key)!.push(task);
  }

  const groups: TaskGroup[] = groupOrder
    .filter((key) => groupMap.get(key)!.length > 0)
    .map((key) => ({
      key,
      label: groupMeta[key].label,
      headerClass: groupMeta[key].headerClass,
      tasks: groupMap.get(key)!,
    }));

  return (
    <>
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Task"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && newTaskContent.trim()) {
            handleSaveTask();
          }
        }}
      >
        <Stack gap="md">
          <TextInput
            ref={contentInputRef}
            label="Task"
            placeholder="What needs to be done?"
            value={newTaskContent}
            onChange={(e) => setNewTaskContent(e.currentTarget.value)}
            autoFocus
            required
          />
          <DateTimePicker
            label="Due date (optional)"
            placeholder="Pick a date and time"
            value={newTaskDueDate}
            onChange={setNewTaskDueDate}
            clearable
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTask}
              disabled={!newTaskContent.trim()}
              loading={saving}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

    <div className={styles.container} data-testid="task-overview">
      <div className={styles.header}>
        <Title order={2}>Tasks</Title>
        <div className={styles.filters}>
          <SegmentedControl
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            data={["All", "Open", "Completed"]}
            size="sm"
          />
          <Select
            value={sortOption}
            onChange={(v) => setSortOption((v ?? "Due date") as SortOption)}
            data={["Due date", "Note", "Created"]}
            size="sm"
            w={140}
            allowDeselect={false}
          />
          <Button size="sm" variant="light" onClick={handleOpenModal}>
            + New Task
          </Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className={styles.emptyState} data-testid="task-overview-empty">
          <Stack align="center" gap="sm">
            <IconNotes size={48} stroke={1.5} color="var(--mantine-color-dimmed)" />
            <Text c="dimmed" size="lg">
              No tasks found
            </Text>
          </Stack>
        </div>
      ) : (
        <div>
          {groups.map((group) => (
            <div key={group.key} className={styles.groupSection}>
              <div className={`${styles.groupHeader} ${group.headerClass}`}>{group.label}</div>
              {group.tasks.map((task) => {
                const dateLabel = formatDueDate(task.notify_at);
                const badgeColor = getBadgeColor(group.key);
                return (
                  <div key={task.id} className={styles.taskRow}>
                    <Checkbox
                      checked={task.is_checked}
                      onChange={() => handleToggle(task)}
                      size="sm"
                    />
                    <span
                      className={`${styles.taskContent} ${task.is_checked ? styles.taskContentChecked : ""}`}
                    >
                      {task.content}
                    </span>
                    {dateLabel && (
                      <Badge color={badgeColor} variant="light" size="sm">
                        {dateLabel}
                      </Badge>
                    )}
                    <Group gap={4}>
                      <span
                        className={styles.noteLink}
                        onClick={() => onNavigateToNote(task.note_id)}
                        data-testid="task-note-link"
                      >
                        {task.note_title}
                      </span>
                    </Group>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
