// Singleton flag for cross-component "focus editor on next load" signalling.
// Set to true by NoteTree when Enter activates a note via keyboard;
// NoteEditor clears it and focuses once the editor instance is ready.
export const editorFocusBridge = { focusOnLoad: false };
