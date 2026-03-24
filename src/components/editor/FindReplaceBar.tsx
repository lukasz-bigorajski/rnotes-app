import { useRef, useEffect, useState, useCallback } from "react";
import { Group, TextInput, ActionIcon, Text, UnstyledButton } from "@mantine/core";
import {
  IconX,
  IconArrowUp,
  IconArrowDown,
  IconReplace,
  IconChevronDown,
  IconChevronUp,
} from "@tabler/icons-react";
import type { Editor } from "@tiptap/react";
import { findReplaceKey } from "./findReplacePlugin";

import classes from "./FindReplaceBar.module.css";

interface FindReplaceBarProps {
  editor: Editor;
  onClose: () => void;
}

export function FindReplaceBar({ editor, onClose }: FindReplaceBarProps) {
  const [findValue, setFindValue] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const findInputRef = useRef<HTMLInputElement>(null);

  // Focus find input on mount
  useEffect(() => {
    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, []);

  // Clear decorations when bar closes
  useEffect(() => {
    return () => {
      if (editor && !editor.isDestroyed) {
        const { tr } = editor.state;
        tr.setMeta(findReplaceKey, { query: "" });
        editor.view.dispatch(tr);
      }
    };
  }, [editor]);

  const pluginState = findReplaceKey.getState(editor.state);
  const matchCount = pluginState?.matches.length ?? 0;
  const currentIndex = pluginState?.currentIndex ?? 0;

  const updateQuery = useCallback(
    (value: string) => {
      setFindValue(value);
      const { tr } = editor.state;
      tr.setMeta(findReplaceKey, { query: value, currentIndex: 0 });
      editor.view.dispatch(tr);
    },
    [editor],
  );

  const goToNext = useCallback(() => {
    if (matchCount === 0) return;
    const next = (currentIndex + 1) % matchCount;
    const { tr } = editor.state;
    tr.setMeta(findReplaceKey, { currentIndex: next });
    editor.view.dispatch(tr);
    // Scroll to match
    const state = findReplaceKey.getState(editor.state);
    if (state && state.matches[next]) {
      const { from } = state.matches[next];
      editor.commands.setTextSelection(from);
      editor.commands.scrollIntoView();
    }
  }, [editor, matchCount, currentIndex]);

  const goToPrev = useCallback(() => {
    if (matchCount === 0) return;
    const prev = (currentIndex - 1 + matchCount) % matchCount;
    const { tr } = editor.state;
    tr.setMeta(findReplaceKey, { currentIndex: prev });
    editor.view.dispatch(tr);
    const state = findReplaceKey.getState(editor.state);
    if (state && state.matches[prev]) {
      const { from } = state.matches[prev];
      editor.commands.setTextSelection(from);
      editor.commands.scrollIntoView();
    }
  }, [editor, matchCount, currentIndex]);

  const replaceOne = useCallback(() => {
    if (matchCount === 0) return;
    const state = findReplaceKey.getState(editor.state);
    if (!state || !state.matches[state.currentIndex]) return;
    const { from, to } = state.matches[state.currentIndex];
    editor.chain().setTextSelection({ from, to }).insertContent(replaceValue).run();
  }, [editor, matchCount, replaceValue]);

  const replaceAll = useCallback(() => {
    if (matchCount === 0) return;
    const state = findReplaceKey.getState(editor.state);
    if (!state) return;
    // Replace in reverse order to preserve positions
    const sortedMatches = [...state.matches].sort((a, b) => b.from - a.from);
    let chain = editor.chain();
    for (const { from, to } of sortedMatches) {
      chain = chain.setTextSelection({ from, to }).insertContent(replaceValue);
    }
    chain.run();
  }, [editor, matchCount, replaceValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          goToPrev();
        } else {
          goToNext();
        }
      }
    },
    [onClose, goToNext, goToPrev],
  );

  return (
    <div className={classes.bar} data-testid="find-replace-bar">
      <Group gap="xs" align="center" wrap="nowrap">
        <UnstyledButton
          onClick={() => setShowReplace((v) => !v)}
          aria-label={showReplace ? "Hide replace" : "Show replace"}
          className={classes.toggleBtn}
          data-testid="find-replace-toggle"
        >
          {showReplace ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        </UnstyledButton>

        <TextInput
          ref={findInputRef}
          placeholder="Find..."
          value={findValue}
          onChange={(e) => updateQuery(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          size="xs"
          style={{ flex: 1 }}
          data-testid="find-input"
          rightSection={
            matchCount > 0 ? (
              <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap", paddingRight: 4 }}>
                {currentIndex + 1}/{matchCount}
              </Text>
            ) : findValue ? (
              <Text size="xs" c="dimmed" style={{ paddingRight: 4 }}>
                0/0
              </Text>
            ) : null
          }
          rightSectionWidth={matchCount > 0 || findValue ? 48 : undefined}
        />

        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={goToPrev}
          disabled={matchCount === 0}
          aria-label="Previous match"
          data-testid="find-prev-btn"
        >
          <IconArrowUp size={14} />
        </ActionIcon>

        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={goToNext}
          disabled={matchCount === 0}
          aria-label="Next match"
          data-testid="find-next-btn"
        >
          <IconArrowDown size={14} />
        </ActionIcon>

        {showReplace && (
          <>
            <TextInput
              placeholder="Replace..."
              value={replaceValue}
              onChange={(e) => setReplaceValue(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              size="xs"
              style={{ flex: 1 }}
              data-testid="replace-input"
            />
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={replaceOne}
              disabled={matchCount === 0}
              aria-label="Replace"
              title="Replace"
              data-testid="replace-btn"
            >
              <IconReplace size={14} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={replaceAll}
              disabled={matchCount === 0}
              aria-label="Replace All"
              title="Replace All"
              data-testid="replace-all-btn"
            >
              <IconReplace size={14} />
            </ActionIcon>
          </>
        )}

        <ActionIcon variant="subtle" size="sm" onClick={onClose} aria-label="Close find bar">
          <IconX size={14} />
        </ActionIcon>
      </Group>
    </div>
  );
}
