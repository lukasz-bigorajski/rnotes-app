import { TextInput, Loader } from "@mantine/core";
import { useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
  };

  const handleBlur = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialValue.trim()) {
      onCommit(trimmed);
    } else if (!trimmed) {
      onCancel();
    } else {
      onCancel();
    }
  };

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
