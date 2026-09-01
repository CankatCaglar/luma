export function MissingRecord({ label }: { label: string }) {
  return (
    <p className="rounded-2xl bg-luma-card px-4 py-8 text-center text-sm text-luma-muted ring-1 ring-luma-border/80">
      {label}
    </p>
  );
}
