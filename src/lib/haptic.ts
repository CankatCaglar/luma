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

const OVERLAY_ATTR = "data-haptic-overlay";

let lastAt = 0;

function isIos() {
  const ua = navigator.userAgent;
  if (/iP(hone|ad|od)/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function canUseVibrate() {
  return typeof navigator.vibrate === "function" && !isIos();
}

export function haptic(kind: HapticKind = "selection") {
  if (typeof window === "undefined") return;
  if (!canUseVibrate()) return;

  const now = performance.now();
  if (now - lastAt < 40) return;
  lastAt = now;

  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // Haptic is progressive enhancement only.
  }
}

function kindFromElement(element: Element): HapticKind | null {
  if (element.getAttribute("aria-disabled") === "true") return null;
  if (element.closest("[data-haptic-off]")) return null;

  const explicit = element.getAttribute("data-haptic");
  if (explicit === "off") return null;
  if (explicit === "success" || explicit === "warning" || explicit === "impact") {
    return explicit;
  }
  return "selection";
}

function raiseNestedInteractives(host: HTMLElement) {
  for (const nested of host.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)) {
    if (nested === host || nested.hasAttribute(OVERLAY_ATTR)) continue;
    const style = getComputedStyle(nested);
    if (style.position === "static") nested.style.position = "relative";
    const z = Number.parseInt(style.zIndex, 10);
    if (!Number.isFinite(z) || z < 2) nested.style.zIndex = "2";
  }
}

function attachIosOverlay(host: HTMLElement) {
  if (host.querySelector(`:scope > [${OVERLAY_ATTR}]`)) return () => {};

  const position = getComputedStyle(host).position;
  if (
    position !== "absolute" &&
    position !== "relative" &&
    position !== "fixed" &&
    position !== "sticky"
  ) {
    host.style.position = "relative";
  }

  raiseNestedInteractives(host);

  const overlay = document.createElement("input");
  overlay.type = "checkbox";
  overlay.setAttribute("switch", "");
  overlay.setAttribute(OVERLAY_ATTR, "");
  overlay.setAttribute("aria-hidden", "true");
  overlay.tabIndex = -1;
  overlay.style.cssText = [
    "position:absolute",
    "inset:0",
    "width:100%",
    "height:100%",
    "margin:0",
    "padding:0",
    "border:0",
    "z-index:1",
    "-webkit-appearance:switch",
    "appearance:auto",
    "opacity:0",
    "outline:none",
    "box-shadow:none",
    "-webkit-tap-highlight-color:transparent",
    "accent-color:transparent",
    "cursor:inherit",
    "pointer-events:auto",
    "touch-action:pan-y",
  ].join(";");

  const onOverlayClick = (event: Event) => {
    event.stopPropagation();
    overlay.blur();
    host.click();
  };

  overlay.addEventListener("click", onOverlayClick);
  host.appendChild(overlay);

  return () => {
    overlay.removeEventListener("click", onOverlayClick);
    overlay.remove();
  };
}

function bindIosOverlays() {
  const detachers = new Map<HTMLElement, () => void>();

  const attachOne = (el: HTMLElement) => {
    if (detachers.has(el)) return;
    if (el.hasAttribute(OVERLAY_ATTR)) return;
    if (el.closest(TEXT_FIELD_SELECTOR)) return;
    if (kindFromElement(el) === null) return;
    detachers.set(el, attachIosOverlay(el));
  };

  const detachOne = (el: HTMLElement) => {
    const detach = detachers.get(el);
    if (!detach) return;
    detach();
    detachers.delete(el);
  };

  const scan = (root: ParentNode = document) => {
    for (const el of root.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)) {
      attachOne(el);
    }
  };

  scan();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches(INTERACTIVE_SELECTOR)) attachOne(node);
        scan(node);
      }
      for (const node of mutation.removedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (detachers.has(node)) detachOne(node);
        for (const el of node.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)) {
          detachOne(el);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    for (const detach of detachers.values()) detach();
    detachers.clear();
  };
}

function bindAndroidVibrate() {
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

  document.addEventListener("pointerdown", onPointerDown, {
    capture: true,
    passive: true,
  });
  return () => {
    document.removeEventListener("pointerdown", onPointerDown, true);
  };
}

export function bindAppHaptics() {
  if (typeof document === "undefined") return () => {};
  return isIos() ? bindIosOverlays() : bindAndroidVibrate();
}
