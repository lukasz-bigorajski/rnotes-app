import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { EmojiEntry } from "./emojiData";
import classes from "./EmojiList.module.css";

export interface EmojiListProps {
  items: EmojiEntry[];
  command: (item: EmojiEntry) => void;
}

export interface EmojiListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

export const EmojiList = forwardRef<EmojiListHandle, EmojiListProps>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = items[selectedIndex];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  if (!items.length) return null;

  return (
    <div className={classes.list}>
      {items.map((item, index) => (
        <button
          key={item.shortcode}
          className={`${classes.item} ${index === selectedIndex ? classes.selected : ""}`}
          onClick={() => command(item)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className={classes.emoji}>{item.emoji}</span>
          <span className={classes.shortcode}>:{item.shortcode}:</span>
        </button>
      ))}
    </div>
  );
});

EmojiList.displayName = "EmojiList";
