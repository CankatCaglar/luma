function isListRoute(href: string): boolean {
  return (
    href === "/isler" ||
    href === "/isler/aktif" ||
    href === "/isler/onay" ||
    href === "/isler/tamamlanan"
  );
}

export function resolveJobHref(input: { id: string; href: string }): string {
  if (isListRoute(input.href)) {
    return `/isler/gorev/${encodeURIComponent(input.id)}`;
  }
  return input.href;
}
