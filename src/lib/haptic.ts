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

function isFullScreenHitTarget(el: HTMLElement) {
  const style = getComputedStyle(el);
  if (style.position !== "fixed" && style.position !== "absolute") return false;
  const rect = el.getBoundingClientRect();
  return rect.width >= window.innerWidth * 0.85 && rect.height >= window.innerHeight * 0.45;
}

function isScrollSafeHost(el: HTMLElement) {
  if (el.closest("nav")) return true;
  if (isFullScreenHitTarget(el)) return false;

  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return el.tagName === "BUTTON" || Boolean(el.closest("nav, header"));
  }

  // Large cards/list rows must stay free so the page can scroll.
  if (rect.height > 72) return false;
  if (rect.width > 220 && rect.height > 56) return false;
  return true;
}

function attachIosOverlay(host: HTMLElement) {
  if (host.querySelector(`:scope > [${OVERLAY_ATTR}]`)) return () => {};
  if (!isScrollSafeHost(host)) return () => {};

  const position = getComputedStyle(host).position;
  if (
    position !== "absolute" &&
    position !== "relative" &&
    position !== "fixed" &&
    position !== "sticky"
  ) {
    host.style.position = "relative";
  }

  const layer = document.createElement("span");
  layer.setAttribute(OVERLAY_ATTR, "");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = [
    "position:absolute",
    "inset:0",
    "z-index:1",
    "display:block",
    "overflow:hidden",
    "pointer-events:auto",
    "touch-action:manipulation",
    "-webkit-tap-highlight-color:transparent",
  ].join(";");

  const overlay = document.createElement("input");
  overlay.type = "checkbox";
  overlay.setAttribute("switch", "");
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
    "-webkit-appearance:switch",
    "appearance:auto",
    "opacity:0",
    "outline:none",
    "box-shadow:none",
    "-webkit-tap-highlight-color:transparent",
    "accent-color:transparent",
    "pointer-events:auto",
    "touch-action:manipulation",
  ].join(";");

  const onOverlayClick = (event: Event) => {
    event.stopPropagation();
    overlay.blur();
    host.click();
  };

  overlay.addEventListener("click", onOverlayClick);
  layer.appendChild(overlay);
  host.appendChild(layer);

  return () => {
    overlay.removeEventListener("click", onOverlayClick);
    layer.remove();
  };
}

function bindIosOverlays() {
  const detachers = new Map<HTMLElement, () => void>();

  const attachOne = (el: HTMLElement) => {
    if (detachers.has(el)) return;
    if (el.hasAttribute(OVERLAY_ATTR)) return;
    if (el.closest(TEXT_FIELD_SELECTOR)) return;
    if (el.closest(`[${OVERLAY_ATTR}]`)) return;
    if (kindFromElement(el) === null) return;
    if (isFullScreenHitTarget(el)) return;
    if (!isScrollSafeHost(el)) return;
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
