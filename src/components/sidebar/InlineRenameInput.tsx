import { TextInput, Loader } from "@mantine/core";
import { useEffect, useRef, useState, useCallback } from "react";

interface InlineRenameInputProps {
  initialValue: string;
  onCommit: (newValue: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function InlineRenameInput({
  initialValue,
  onCommit,
  onCancel,
  isLoading = false,
}: InlineRenameInputProps) {
  const [value, setValue] = useState(initialValue.trim());
  const inputRef = useRef<HTMLInputElement>(null);
  // Ignore blur for a short window after mount — Mantine Menu restores focus to its
  // trigger after an item is clicked, which would immediately blur the rename input.
  const ignoreBlur = useRef(true);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
    const timer = setTimeout(() => {
      ignoreBlur.current = false;
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.stopPropagation();
      const trimmed = value.trim();
      if (trimmed) {
        onCommit(trimmed);
      }
    } else if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
    }
  }, [value, onCommit, onCancel]);

  const handleBlur = useCallback(() => {
    if (ignoreBlur.current) return;
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialValue.trim()) {
      onCommit(trimmed);
    } else if (!trimmed) {
      onCancel();
    } else {
      onCancel();
    }
  }, [value, initialValue, onCommit, onCancel]);

  return (
    <TextInput
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.currentTarget.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      disabled={isLoading}
      rightSection={isLoading ? <Loader size={14} /> : undefined}
      autoFocus
      style={{ flex: 1 }}
    />
  );
}
