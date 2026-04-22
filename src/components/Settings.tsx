import { useState, useCallback, useRef } from "react";
import {
  Title,
  Text,
  Stack,
  Group,
  SegmentedControl,
  NumberInput,
  Select,
  Switch,
  Divider,
  ScrollArea,
  Button,
  Notification,
} from "@mantine/core";
import { useMantineColorScheme } from "@mantine/core";
import { modals } from "@mantine/modals";
import { save as saveDialog, open as openDialog } from "@tauri-apps/plugin-dialog";
import { useUserConfig } from "../context/UserConfigContext";
import type { UserConfig } from "../ipc/config";
import { exportAll, importAll } from "../ipc/backup";
import classes from "./Settings.module.css";

const FONT_FAMILY_OPTIONS = [
  { value: "system", label: "System Default" },
  { value: "monospace", label: "Monospace" },
  { value: "serif", label: "Serif" },
  { value: "sans-serif", label: "Sans-serif" },
];

export function Settings() {
  const { config, updateConfig } = useUserConfig();
  const { setColorScheme } = useMantineColorScheme();
  const [savedVisible, setSavedVisible] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dataMessage, setDataMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [dataLoading, setDataLoading] = useState<"export" | "import" | null>(null);

  const showSaved = useCallback(() => {
    setSavedVisible(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedVisible(false), 2000);
  }, []);

  const handleChange = useCallback(
    (updates: Partial<UserConfig>) => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(async () => {
        await updateConfig(updates);
        showSaved();
      }, 500);
    },
    [updateConfig, showSaved],
  );

  const handleThemeChange = useCallback(
    (value: string) => {
      const scheme = value as "light" | "dark" | "auto";
      setColorScheme(scheme);
      handleChange({ theme: value });
    },
    [setColorScheme, handleChange],
  );

  const handleExport = useCallback(async () => {
    const path = await saveDialog({
      title: "Export notes",
      defaultPath: "notes-export.rnotes",
      filters: [{ name: "RNotes archive", extensions: ["rnotes"] }],
    });
    if (!path) return;

    setDataLoading("export");
    setDataMessage(null);
    try {
      await exportAll(path);
      setDataMessage({ text: "Export complete.", error: false });
    } catch (err) {
      setDataMessage({ text: `Export failed: ${err}`, error: true });
    } finally {
      setDataLoading(null);
    }
  }, []);

  const handleImport = useCallback(async () => {
    const path = await openDialog({
      title: "Import notes",
      filters: [{ name: "RNotes archive", extensions: ["rnotes"] }],
      multiple: false,
    });
    if (!path) return;

    const filePath = typeof path === "string" ? path : path[0];

    modals.openConfirmModal({
      title: "Replace all data?",
      children: (
        <Text size="sm">
          This will <strong>permanently wipe</strong> all your current notes, tasks and assets, then
          restore everything from the selected archive. This action cannot be undone.
        </Text>
      ),
      labels: { confirm: "Replace all data", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        setDataLoading("import");
        setDataMessage(null);
        try {
          await importAll(filePath, "replace");
          setDataMessage({ text: "Import complete. Please restart the app.", error: false });
        } catch (err) {
          setDataMessage({ text: `Import failed: ${err}`, error: true });
        } finally {
          setDataLoading(null);
        }
      },
    });
  }, []);

  return (
    <ScrollArea style={{ flex: 1 }} h="100%">
      <div className={classes.container}>
        <Group justify="space-between" mb="xl">
          <Title order={2}>Settings</Title>
          <Text
            className={`${classes.savedBadge} ${savedVisible ? classes.savedBadgeVisible : ""}`}
            data-testid="settings-saved-indicator"
          >
            Settings saved
          </Text>
        </Group>

        <Stack gap="xl">
          {/* Theme */}
          <Stack gap="xs" className={classes.section}>
            <Text fw={600} size="sm">
              Theme
            </Text>
            <SegmentedControl
              data={[
                { label: "Light", value: "light" },
                { label: "Dark", value: "dark" },
                { label: "Auto", value: "auto" },
              ]}
              value={config.theme}
              onChange={handleThemeChange}
              data-testid="theme-selector"
            />
          </Stack>

          <Divider />

          {/* Auto-save interval */}
          <Stack gap="xs" className={classes.section}>
            <Text fw={600} size="sm">
              Auto-save Interval
            </Text>
            <Text size="xs" c="dimmed">
              How long to wait after you stop typing before saving (milliseconds)
            </Text>
            <NumberInput
              value={config.auto_save_interval_ms}
              onChange={(val) => {
                const ms = typeof val === "number" ? val : 1000;
                handleChange({ auto_save_interval_ms: ms });
              }}
              min={500}
              max={5000}
              step={500}
              suffix=" ms"
              w={180}
              data-testid="auto-save-interval-input"
            />
          </Stack>

          <Divider />

          {/* Editor font size */}
          <Stack gap="xs" className={classes.section}>
            <Text fw={600} size="sm">
              Editor Font Size
            </Text>
            <NumberInput
              value={config.font_size}
              onChange={(val) => {
                const size = typeof val === "number" ? val : 16;
                handleChange({ font_size: size });
              }}
              min={12}
              max={24}
              step={1}
              suffix=" px"
              w={120}
              data-testid="font-size-input"
            />
          </Stack>

          <Divider />

          {/* Editor font family */}
          <Stack gap="xs" className={classes.section}>
            <Text fw={600} size="sm">
              Editor Font Family
            </Text>
            <Select
              data={FONT_FAMILY_OPTIONS}
              value={config.font_family}
              onChange={(val) => {
                if (val) handleChange({ font_family: val });
              }}
              w={220}
              data-testid="font-family-select"
            />
          </Stack>

          <Divider />

          {/* Spell check */}
          <Stack gap="xs" className={classes.section}>
            <Group>
              <Stack gap={2} style={{ flex: 1 }}>
                <Text fw={600} size="sm">
                  Spell Check
                </Text>
                <Text size="xs" c="dimmed">
                  Enable spell checking in the editor
                </Text>
              </Stack>
              <div data-testid="spell-check-toggle">
                <Switch
                  checked={config.spell_check}
                  onChange={(e) => handleChange({ spell_check: e.currentTarget.checked })}
                />
              </div>
            </Group>
          </Stack>

          <Divider />

          {/* Data — export / import */}
          <Stack gap="xs" className={classes.section}>
            <Text fw={600} size="sm">
              Data
            </Text>
            <Text size="xs" c="dimmed">
              Export all notes, tasks and assets to a portable archive, or restore from one.
            </Text>
            <Group>
              <Button
                variant="light"
                loading={dataLoading === "export"}
                onClick={handleExport}
              >
                Export all…
              </Button>
              <Button
                variant="light"
                color="red"
                loading={dataLoading === "import"}
                onClick={handleImport}
              >
                Import all…
              </Button>
            </Group>
            {dataMessage && (
              <Notification
                color={dataMessage.error ? "red" : "teal"}
                onClose={() => setDataMessage(null)}
                mt="xs"
              >
                {dataMessage.text}
              </Notification>
            )}
          </Stack>
        </Stack>
      </div>
    </ScrollArea>
  );
}
