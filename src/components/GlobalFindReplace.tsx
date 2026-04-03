import { useState, useEffect, useRef, useCallback } from "react";
import { Modal, TextInput, Stack, Paper, Text, Button, Group, Loader, Alert } from "@mantine/core";
import { IconSearch, IconAlertCircle } from "@tabler/icons-react";
import { searchNotes } from "../ipc/notes";
import type { SearchResult } from "../ipc/notes";
import { performGlobalReplace } from "../ipc/notes";

interface GlobalFindReplaceProps {
  opened: boolean;
  onClose: () => void;
}

export function GlobalFindReplace({ opened, onClose }: GlobalFindReplaceProps) {
  const [findValue, setFindValue] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const findInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!opened) {
      setFindValue("");
      setReplaceValue("");
      setResults([]);
      setIsSearching(false);
      setError(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
  }, [opened]);

  // Focus find input when modal opens
  useEffect(() => {
    if (opened) {
      const t = setTimeout(() => findInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [opened]);

  const handleFindChange = useCallback((value: string) => {
    setFindValue(value);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchNotes(value.trim());
        setResults(res);
      } catch (err) {
        console.error("Global find failed:", err);
        setError("Search failed");
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);
  }, []);

  const handleReplace = useCallback(async (noteId: string) => {
    if (!findValue.trim()) {
      setError("Find text cannot be empty");
      return;
    }
    setIsReplacing(true);
    setError(null);
    try {
      await performGlobalReplace(noteId, findValue.trim(), replaceValue);
      // Refresh search results after replace
      const res = await searchNotes(findValue.trim());
      setResults(res);
    } catch (err) {
      console.error("Replace failed:", err);
      setError("Replace failed");
    } finally {
      setIsReplacing(false);
    }
  }, [findValue, replaceValue]);

  const handleReplaceAll = useCallback(async () => {
    if (!findValue.trim()) {
      setError("Find text cannot be empty");
      return;
    }
    setIsReplacing(true);
    setError(null);
    try {
      for (const result of results) {
        await performGlobalReplace(result.id, findValue.trim(), replaceValue);
      }
      // Refresh search results after replace all
      const res = await searchNotes(findValue.trim());
      setResults(res);
    } catch (err) {
      console.error("Replace all failed:", err);
      setError("Replace all failed");
    } finally {
      setIsReplacing(false);
    }
  }, [findValue, replaceValue, results]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Find & Replace in All Notes"
      size="lg"
    >
      <Stack gap="sm" data-testid="global-find-replace-modal">
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
            {error}
          </Alert>
        )}

        <TextInput
          ref={findInputRef}
          label="Find"
          placeholder="Text to find..."
          leftSection={<IconSearch size={16} />}
          value={findValue}
          onChange={(e) => handleFindChange(e.currentTarget.value)}
          disabled={isReplacing}
          data-testid="global-find-input"
        />

        <TextInput
          label="Replace with"
          placeholder="Replacement text..."
          value={replaceValue}
          onChange={(e) => setReplaceValue(e.currentTarget.value)}
          disabled={isReplacing}
          data-testid="global-replace-input"
        />

        {isSearching && (
          <Group justify="center" gap="xs">
            <Loader size="xs" />
            <Text c="dimmed" size="sm">
              Searching…
            </Text>
          </Group>
        )}

        {!isSearching && findValue && results.length === 0 && (
          <Text c="dimmed" size="sm" ta="center" data-testid="global-find-replace-no-results">
            No results found.
          </Text>
        )}

        {results.length > 0 && (
          <>
            <Text size="sm" fw={500}>
              Found in {results.length} note{results.length !== 1 ? "s" : ""}
            </Text>
            <Stack gap={4} data-testid="global-find-replace-results">
              {results.map((result) => (
                <Paper
                  p="sm"
                  withBorder
                  key={result.id}
                  data-testid="global-find-replace-result-item"
                >
                  <Group justify="space-between" align="flex-start">
                    <div style={{ flex: 1 }}>
                      <Text fw={700} size="sm">
                        {result.title}
                      </Text>
                      <Text
                        size="xs"
                        c="dimmed"
                        lineClamp={2}
                        dangerouslySetInnerHTML={{ __html: result.snippet }}
                      />
                    </div>
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => handleReplace(result.id)}
                      disabled={isReplacing || !findValue.trim()}
                    >
                      Replace
                    </Button>
                  </Group>
                </Paper>
              ))}
            </Stack>

            <Group justify="flex-end" gap="sm">
              <Button
                variant="default"
                onClick={onClose}
                disabled={isReplacing}
              >
                Done
              </Button>
              <Button
                onClick={handleReplaceAll}
                loading={isReplacing}
                disabled={!findValue.trim() || results.length === 0}
                data-testid="global-replace-all-button"
              >
                Replace All
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
