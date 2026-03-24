import { useState, useEffect, useRef, useCallback } from "react";
import { Modal, TextInput, Stack, Paper, Text, UnstyledButton } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { searchNotes } from "../ipc/notes";
import type { SearchResult } from "../ipc/notes";

interface GlobalSearchProps {
  opened: boolean;
  onClose: () => void;
  onSelectNote: (noteId: string) => void;
}

export function GlobalSearch({ opened, onClose, onSelectNote }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!opened) {
      setQuery("");
      setResults([]);
      setIsSearching(false);
      setSelectedIndex(0);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
  }, [opened]);

  // Focus input when modal opens
  useEffect(() => {
    if (opened) {
      // Small delay to ensure modal is rendered before focusing
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [opened]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setSelectedIndex(0);
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
        console.error("Global search failed:", err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      onSelectNote(id);
      onClose();
    },
    [onSelectNote, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results.length > 0) {
        e.preventDefault();
        handleSelect(results[selectedIndex].id);
      }
    },
    [results, selectedIndex, handleSelect],
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Search Notes"
      size="lg"
    >
      <Stack gap="sm" data-testid="global-search-modal">
        <TextInput
          ref={inputRef}
          placeholder="Type to search..."
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(e) => handleQueryChange(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          size="md"
          data-testid="global-search-input"
        />

        {isSearching && (
          <Text c="dimmed" size="sm" ta="center">
            Searching…
          </Text>
        )}

        {!isSearching && query && results.length === 0 && (
          <Text c="dimmed" size="sm" ta="center" data-testid="global-search-no-results">
            No results found.
          </Text>
        )}

        {results.length > 0 && (
          <Stack gap={4} data-testid="global-search-results">
            {results.map((result, index) => (
              <UnstyledButton key={result.id} onClick={() => handleSelect(result.id)}>
                <Paper
                  p="sm"
                  withBorder
                  style={{
                    cursor: "pointer",
                    background: index === selectedIndex ? "var(--mantine-color-blue-light)" : undefined,
                  }}
                  data-testid="global-search-result-item"
                >
                  <Text fw={700} size="sm">
                    {result.title}
                  </Text>
                  <Text
                    size="xs"
                    c="dimmed"
                    lineClamp={2}
                    dangerouslySetInnerHTML={{ __html: result.snippet }}
                  />
                </Paper>
              </UnstyledButton>
            ))}
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
