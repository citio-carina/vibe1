import { useCallback, useEffect, useRef, useState } from "react";
import { isTypingTarget } from "./robot";

export function useRobotInput(enabled: boolean) {
  const keys = useRef(new Set<string>()),
    keyboard = useRef(new Set<string>()),
    pointers = useRef(new Map<number, string>());
  const [pressed, setPressed] = useState<string[]>([]);
  const sync = useCallback(() => {
    keys.current = new Set([...keyboard.current, ...pointers.current.values()]);
    setPressed([...keys.current]);
  }, []);
  const clear = useCallback(() => {
    keyboard.current.clear();
    pointers.current.clear();
    sync();
  }, [sync]);
  useEffect(() => {
    if (!enabled) clear();
    const keydown = (event: KeyboardEvent) => {
      if (
        !enabled ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingTarget(event.target)
      )
        return;
      const key = event.code.startsWith("Key")
        ? event.code.slice(3).toLowerCase()
        : event.key.toLowerCase();
      if (!["w", "a", "s", "d"].includes(key)) return;
      event.preventDefault();
      if (!keyboard.current.has(key)) {
        keyboard.current.add(key);
        sync();
      }
    };
    const keyup = (event: KeyboardEvent) => {
      const key = event.code.startsWith("Key")
        ? event.code.slice(3).toLowerCase()
        : event.key.toLowerCase();
      if (keyboard.current.delete(key)) sync();
    };
    const focus = (event: FocusEvent) => {
      if (isTypingTarget(event.target)) clear();
    };
    const visibility = () => {
      if (document.hidden) clear();
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("focusin", focus);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("focusin", focus);
      keys.current.clear();
    };
  }, [enabled, clear, sync]);
  const hold = (id: number, key: string) => {
    if (enabled) {
      pointers.current.set(id, key);
      sync();
    }
  };
  const release = (id: number) => {
    pointers.current.delete(id);
    sync();
  };
  return { keys, pressed, clear, hold, release };
}
