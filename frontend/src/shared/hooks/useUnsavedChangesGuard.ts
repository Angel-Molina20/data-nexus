import { useCallback, useEffect, useRef } from "react";
import { useBlocker } from "react-router";

export function useUnsavedChangesGuard(isDirty: boolean) {
  const bypass = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (bypass.current) {
      bypass.current = false;
      return false;
    }
    return (
      isDirty &&
      `${currentLocation.pathname}${currentLocation.search}` !==
        `${nextLocation.pathname}${nextLocation.search}`
    );
  });

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  const navigateWithoutPrompt = useCallback((navigation: () => void) => {
    bypass.current = true;
    navigation();
  }, []);

  return {
    isBlocked: blocker.state === "blocked",
    leave: () => {
      blocker.proceed?.();
    },
    navigateWithoutPrompt,
    stay: () => {
      blocker.reset?.();
    },
  };
}
