import { useEffect, useRef } from "react";

export interface Shortcut {
  key: string; // single character, compared case-insensitively (e.g. "n", "/", "?")
  description: string;
  action: () => void;
  // Fire even while focus is inside a text input/textarea/select. Off by default so
  // shortcuts don't hijack normal typing (e.g. typing "n" into a notes field).
  allowInInputs?: boolean;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

// Gmail/Linear-style single-key shortcuts. Pass `enabled: false` while any dialog on
// the page is open so a stray keypress can't fire an action underneath/behind it.
export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; // reserve modifier combos for browser/OS
      const typing = isTypingTarget(e.target);
      for (const s of shortcutsRef.current) {
        if (s.key.toLowerCase() !== e.key.toLowerCase()) continue;
        if (typing && !s.allowInInputs) continue;
        e.preventDefault();
        s.action();
        return;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [enabled]);
}
