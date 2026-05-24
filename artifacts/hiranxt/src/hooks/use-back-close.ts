import { useEffect, useRef } from "react";

/**
 * Pushes a history entry when `open` is true so the browser/Android back
 * button closes the modal instead of navigating to the previous route.
 */
export function useBackClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    window.history.pushState({ __modal: true }, "");

    const handler = () => {
      onCloseRef.current();
    };

    window.addEventListener("popstate", handler);

    return () => {
      window.removeEventListener("popstate", handler);
      // If the dialog closed normally (not via back), pop the history entry we pushed
      if (window.history.state?.__modal) {
        window.history.go(-1);
      }
    };
  }, [open]);
}
