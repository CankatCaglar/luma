"use client";

export type HapticKind = "selection" | "impact" | "success" | "warning";

const PATTERNS: Record<HapticKind, number | number[]> = {
  selection: 12,
  impact: 18,
  success: [12, 48, 16],
  warning: [16, 42, 16],
};

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button:not(:disabled)",
  "[role='button']",
  "[role='menuitem']",
  "[role='tab']",
  "summary",
  "select",
  "label",
  "input[type='checkbox']",
  "input[type='radio']",
  "input[type='submit']",
  "input[type='button']",
  "input[type='file']",
  "[data-haptic]",
].join(",");

const TEXT_FIELD_SELECTOR = [
  "textarea",
  "[contenteditable='true']",
  "input:not([type])",
  "input[type='text']",
  "input[type='email']",
  "input[type='password']",
  "input[type='search']",
  "input[type='tel']",
  "input[type='url']",
  "input[type='number']",
  "input[type='date']",
  "input[type='time']",
  "input[type='datetime-local']",
].join(",");

let lastAt = 0;
let iosSwitch: HTMLInputElement | null = null;

function isIos() {
  const ua = navigator.userAgent;
  if (/iP(hone|ad|od)/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function ensureIosSwitch() {
  if (iosSwitch?.isConnected) return iosSwitch;
  if (typeof document === "undefined") return null;

  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.setAttribute("aria-hidden", "true");
  input.tabIndex = -1;
  input.style.cssText =
    "position:fixed;left:-64px;top:-64px;width:24px;height:24px;margin:0;opacity:0;pointer-events:none;appearance:auto;";
  document.body.appendChild(input);
  iosSwitch = input;
  return input;
}

export function haptic(kind: HapticKind = "selection") {
  if (typeof window === "undefined") return;
  const now = performance.now();
  if (now - lastAt < 40) return;
  lastAt = now;

  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(PATTERNS[kind]);
      return;
    }

    if (!isIos()) return;
    const input = ensureIosSwitch();
    if (!input) return;

    if (kind === "success" || kind === "warning") {
      input.click();
      window.setTimeout(() => input.click(), 70);
      return;
    }

    input.click();
  } catch {
    // Haptic is progressive enhancement only.
  }
}

function kindFromElement(element: Element): HapticKind | null {
  if (element.getAttribute("aria-disabled") === "true") return null;
  if (element.hasAttribute("data-haptic-off")) return null;

  const explicit = element.getAttribute("data-haptic");
  if (explicit === "off") return null;
  if (explicit === "success" || explicit === "warning" || explicit === "impact") {
    return explicit;
  }
  if (explicit === "selection") return "selection";
  return "selection";
}

export function bindAppHaptics() {
  if (typeof document === "undefined") return () => {};

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(TEXT_FIELD_SELECTOR)) return;

    const interactive = target.closest(INTERACTIVE_SELECTOR);
    if (!interactive) return;

    const kind = kindFromElement(interactive);
    if (!kind) return;
    haptic(kind);
  };

  document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
  return () => {
    document.removeEventListener("pointerdown", onPointerDown, true);
  };
}
