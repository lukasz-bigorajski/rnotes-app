import { useState, useEffect, useRef, useCallback } from "react";
import type { MutableRefObject } from "react";
import { Stack, Text, Button, Group, TextInput, Paper, UnstyledButton, ActionIcon } from "@mantine/core";
import { IconPlus, IconFolder, IconChecklist, IconSearch, IconX, IconKeyboard } from "@tabler/icons-react";
import { createNote, listNotes, searchNotes } from "../ipc/notes";
import type { NoteRow, SearchResult } from "../ipc/notes";
import { DraggableTree } from "./sidebar/DraggableTree";
import { ArchivePanel } from "./sidebar/ArchivePanel";
import { ArchiveToggle } from "./sidebar/ArchiveToggle";

interface SidebarProps {
  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;
  refreshRef?: MutableRefObject<(() => void) | null>;
  createNoteRef?: MutableRefObject<(() => void) | null>;
  createFolderRef?: MutableRefObject<(() => void) | null>;
  onShowTaskOverview?: () => void;
  onOpenGlobalSearch?: () => void;
  onOpenShortcutsDialog?: () => void;
}

export function Sidebar({
  activeNoteId,
  setActiveNoteId,
  refreshRef,
  createNoteRef,
  createFolderRef,
  onShowTaskOverview,
  onOpenGlobalSearch,
  onOpenShortcutsDialog,
}: SidebarProps) {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archivedCount, setArchivedCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadNotes = () => {
    listNotes().then(setNotes).catch(console.error);
  };

  const loadArchivedCount = async () => {
    try {
      const allNotes = await listNotes(true);
      const deleted = allNotes.filter((n) => n.deleted_at !== null);
      setArchivedCount(deleted.length);
    } catch (err) {
      console.error("Failed to load archived count:", err);
    }
  };

  // Expose loadNotes via refreshRef so parent can trigger sidebar refresh
  const loadNotesRef = useRef(loadNotes);
  loadNotesRef.current = loadNotes;

  useEffect(() => {
    if (refreshRef) {
      refreshRef.current = () => loadNotesRef.current();
    }
  }, [refreshRef]);

  useEffect(() => {
    loadNotes();
    loadArchivedCount();
  }, []);

  const handleCreateNote = async () => {
    try {
      const note = await createNote({ title: "Untitled", isFolder: false });
      loadNotes();
      setActiveNoteId(note.id);
    } catch (err) {
      console.error("Failed to create note:", err);
    }
  };

  const handleCreateFolder = async () => {
    try {
      await createNote({ title: "Untitled Folder", isFolder: true });
      loadNotes();
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
  };

  // Expose create handlers via refs so hotkeys in App.tsx can call them
  const handleCreateNoteRef = useRef(handleCreateNote);
  handleCreateNoteRef.current = handleCreateNote;

  const handleCreateFolderRef = useRef(handleCreateFolder);
  handleCreateFolderRef.current = handleCreateFolder;

  useEffect(() => {
    if (createNoteRef) {
      createNoteRef.current = () => handleCreateNoteRef.current();
    }
  }, [createNoteRef]);

  useEffect(() => {
    if (createFolderRef) {
      createFolderRef.current = () => handleCreateFolderRef.current();
    }
  }, [createFolderRef]);

  const handleNoteRestored = () => {
    loadNotes();
    loadArchivedCount();
    setIsArchiveOpen(false);
  };

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!value.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchNotes(value.trim());
        setSearchResults(results);
      } catch (err) {
        console.error("Search failed:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  }, []);

  const handleResultClick = useCallback(
    (id: string) => {
      setActiveNoteId(id);
      handleClearSearch();
    },
    [setActiveNoteId, handleClearSearch],
  );

  // Filter out deleted notes for tree display
  const visibleNotes = notes.filter((n) => !n.deleted_at);

  return (
    <Stack gap="sm" h="100%" justify="space-between">
      <Stack gap="sm" style={{ flex: 1, overflow: "auto" }}>
        {!isArchiveOpen && (
          <>
            <Group justify="space-between">
              <Text fw={700} size="lg">
                Notes
              </Text>
              <Group gap="xs">
                {onOpenGlobalSearch && (
                  <Button
                    variant="subtle"
                    size="compact-sm"
                    title="Search all notes (Cmd+K)"
                    aria-label="Open global search"
                    leftSection={<IconSearch size={14} />}
                    onClick={onOpenGlobalSearch}
                    data-testid="open-global-search-btn"
                  />
                )}
                <Button
                  variant="subtle"
                  size="compact-sm"
                  leftSection={<IconPlus size={14} />}
                  onClick={handleCreateNote}
                >
                  Note
                </Button>
                <Button
                  variant="subtle"
                  size="compact-sm"
                  leftSection={<IconFolder size={14} />}
                  onClick={handleCreateFolder}
                >
                  Folder
                </Button>
                <Button
                  variant="subtle"
                  size="compact-sm"
                  title="Task Overview"
                  aria-label="Task Overview"
                  leftSection={<IconChecklist size={14} />}
                  onClick={onShowTaskOverview}
                  data-testid="task-overview-btn"
                >
                  Tasks
                </Button>
              </Group>
            </Group>

            <TextInput
              placeholder="Search notes..."
              leftSection={<IconSearch size={14} />}
              rightSection={
                searchQuery ? (
                  <UnstyledButton
                    onClick={handleClearSearch}
                    aria-label="Clear search"
                    style={{ display: "flex", alignItems: "center" }}
                  >
                    <IconX size={14} />
                  </UnstyledButton>
                ) : null
              }
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") handleClearSearch();
              }}
              size="xs"
              data-testid="sidebar-search-input"
            />

            {searchQuery ? (
              isSearching ? (
                <Text c="dimmed" size="sm" ta="center">
                  Searching…
                </Text>
              ) : searchResults.length === 0 ? (
                <Text c="dimmed" size="sm" ta="center" mt="sm" data-testid="search-no-results">
                  No results found.
                </Text>
              ) : (
                <Stack gap={4} data-testid="search-results-list">
                  {searchResults.map((result) => (
                    <Paper
                      key={result.id}
                      p="xs"
                      withBorder
                      style={{ cursor: "pointer" }}
                      onClick={() => handleResultClick(result.id)}
                      data-testid="search-result-item"
                    >
                      <Text fw={700} size="sm" truncate>
                        {result.title}
                      </Text>
                      <Text
                        size="xs"
                        c="dimmed"
                        lineClamp={2}
                        dangerouslySetInnerHTML={{ __html: result.snippet }}
                      />
                    </Paper>
                  ))}
                </Stack>
              )
            ) : visibleNotes.length === 0 ? (
              <Text c="dimmed" ta="center" mt="xl">
                No notes yet. Create one to get started.
              </Text>
            ) : (
              <DraggableTree
                notes={visibleNotes}
                activeNoteId={activeNoteId}
                setActiveNoteId={setActiveNoteId}
                onNotesChanged={() => {
                  loadNotes();
                  loadArchivedCount();
                }}
              />
            )}
          </>
        )}

        {isArchiveOpen && (
          <ArchivePanel onNoteRestored={handleNoteRestored} />
        )}
      </Stack>

      <Group justify="space-between" align="center">
        <ArchiveToggle
          isArchiveOpen={isArchiveOpen}
          setIsArchiveOpen={setIsArchiveOpen}
          archivedCount={archivedCount}
        />
        {onOpenShortcutsDialog && (
          <ActionIcon
            variant="subtle"
            size="sm"
            title="Keyboard shortcuts (Cmd+/)"
            aria-label="Open keyboard shortcuts"
            onClick={onOpenShortcutsDialog}
            data-testid="open-shortcuts-btn"
          >
            <IconKeyboard size={16} />
          </ActionIcon>
        )}
      </Group>
    </Stack>
  );
}
