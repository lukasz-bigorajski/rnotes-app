import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Modal, TextInput, Stack, Paper, Text, UnstyledButton, Switch, Group } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { searchNotes } from "../ipc/notes";
import type { SearchResult } from "../ipc/notes";

interface GlobalSearchProps {
  opened: boolean;
  onClose: () => void;
  onSelectNote: (noteId: string, query: string) => void;
  titleOnly?: boolean;
}

export function GlobalSearch({ opened, onClose, onSelectNote, titleOnly: titleOnlyProp }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [titleOnly, setTitleOnly] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync titleOnly from prop when modal opens; reset when it closes
  useEffect(() => {
    if (opened) {
      setTitleOnly(!!titleOnlyProp);
    } else {
      setQuery("");
      setResults([]);
      setIsSearching(false);
      setSelectedIndex(0);
      setTitleOnly(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
  }, [opened, titleOnlyProp]);

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
      onSelectNote(id, query);
      onClose();
    },
    [onSelectNote, onClose, query],
  );

  // Filter results by title when titleOnly mode is active
  const displayedResults = useMemo(() => {
    if (!titleOnly || !query.trim()) return results;
    const q = query.trim().toLowerCase();
    return results.filter((r) => r.title.toLowerCase().includes(q));
  }, [results, titleOnly, query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, displayedResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && displayedResults.length > 0) {
        e.preventDefault();
        handleSelect(displayedResults[selectedIndex].id);
      }
    },
    [displayedResults, selectedIndex, handleSelect],
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Search Notes"
      size="lg"
    >
      <Stack gap="sm" data-testid="global-search-modal">
        <Group gap="sm">
          <TextInput
            ref={inputRef}
            placeholder="Type to search..."
            leftSection={<IconSearch size={16} />}
            value={query}
            onChange={(e) => handleQueryChange(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            size="md"
            style={{ flex: 1 }}
            data-testid="global-search-input"
            data-autofocus
          />
          <Switch
            label="Title only"
            checked={titleOnly}
            onChange={(e) => {
              setTitleOnly(e.currentTarget.checked);
              setSelectedIndex(0);
            }}
            size="sm"
            data-testid="global-search-title-only-toggle"
          />
        </Group>

        {isSearching && (
          <Text c="dimmed" size="sm" ta="center">
            Searching…
          </Text>
        )}

        {!isSearching && query && displayedResults.length === 0 && (
          <Text c="dimmed" size="sm" ta="center" data-testid="global-search-no-results">
            No results found.
          </Text>
        )}

        {displayedResults.length > 0 && (
          <Stack gap={4} data-testid="global-search-results">
            {displayedResults.map((result, index) => (
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
