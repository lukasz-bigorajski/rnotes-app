import { Modal, Text } from "@mantine/core";
import classes from "./KeyboardShortcutsDialog.module.css";

// Detect macOS for symbol display
const isMac =
  typeof navigator !== "undefined" &&
  (navigator.platform.startsWith("Mac") || /Mac/.test(navigator.userAgent));

export const MOD = isMac ? "⌘" : "Ctrl";
export const SHIFT = isMac ? "⇧" : "Shift";
export const ALT = isMac ? "⌥" : "Alt";
export const BACKSPACE = isMac ? "⌫" : "Del";

export interface ShortcutDef {
  action: string;
  keys: string[][];
}

export interface ShortcutGroup {
  group: string;
  shortcuts: ShortcutDef[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    group: "General",
    shortcuts: [
      { action: "Open keyboard shortcuts", keys: [[MOD, "/"]] },
      { action: "Global search", keys: [[MOD, "K"], [MOD, SHIFT, "F"]] },
      { action: "Global find & replace", keys: [[MOD, SHIFT, "R"]] },
      { action: "Create new note", keys: [[MOD, "N"]] },
      { action: "Create new folder", keys: [[MOD, SHIFT, "N"]] },
      { action: "Force save note", keys: [[MOD, "S"]] },
      { action: "Archive current note", keys: [[MOD, BACKSPACE]] },
    ],
  },
  {
    group: "Navigation",
    shortcuts: [
      { action: "Toggle sidebar", keys: [[MOD, "\\"]] },
      { action: "Switch to Task Overview", keys: [[MOD, SHIFT, "T"]] },
    ],
  },
  {
    group: "Editor Formatting",
    shortcuts: [
      { action: "Bold", keys: [[MOD, "B"]] },
      { action: "Italic", keys: [[MOD, "I"]] },
      { action: "Strikethrough", keys: [[MOD, SHIFT, "X"]] },
      { action: "Find / Replace", keys: [[MOD, "F"]] },
      { action: "Undo", keys: [[MOD, "Z"]] },
      { action: "Redo", keys: [[MOD, SHIFT, "Z"]] },
    ],
  },
  {
    group: "Editor Structure",
    shortcuts: [
      { action: "Heading 1", keys: [[MOD, SHIFT, "1"]] },
      { action: "Heading 2", keys: [[MOD, SHIFT, "2"]] },
      { action: "Heading 3", keys: [[MOD, SHIFT, "3"]] },
      { action: "Heading 4", keys: [[MOD, SHIFT, "4"]] },
      { action: "Heading 5", keys: [[MOD, SHIFT, "5"]] },
      { action: "Heading 6", keys: [[MOD, SHIFT, "6"]] },
      { action: "Ordered list", keys: [[MOD, SHIFT, "7"]] },
      { action: "Bullet list", keys: [[MOD, SHIFT, "8"]] },
      { action: "Task list", keys: [[MOD, SHIFT, "9"]] },
    ],
  },
];

interface KeyboardShortcutsDialogProps {
  opened: boolean;
  onClose: () => void;
}

function KeyCombo({ parts }: { parts: string[] }) {
  return (
    <span className={classes.keys}>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className={classes.plus}>+</span>}
          <kbd className={classes.key}>{part}</kbd>
        </span>
      ))}
    </span>
  );
}

export function KeyboardShortcutsDialog({ opened, onClose }: KeyboardShortcutsDialogProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Keyboard Shortcuts"
      size="md"
    >
      <div data-testid="keyboard-shortcuts-dialog">
      {SHORTCUT_GROUPS.map((group) => (
        <div key={group.group} className={classes.section} data-testid={`shortcut-group-${group.group.toLowerCase().replace(/\s+/g, "-")}`}>
          <Text className={classes.sectionTitle}>{group.group}</Text>
          <div className={classes.table}>
            {group.shortcuts.map((shortcut) => (
              <div key={shortcut.action} className={classes.row}>
                <Text className={classes.actionLabel}>{shortcut.action}</Text>
                <span className={classes.keys}>
                  {shortcut.keys.map((combo, i) => (
                    <span key={i}>
                      {i > 0 && <Text span c="dimmed" size="xs" mx={4}>/</Text>}
                      <KeyCombo parts={combo} />
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
      </div>
    </Modal>
  );
}
