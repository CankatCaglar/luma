export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-4">
      <h1 className="text-[28px] font-bold tracking-tight text-foreground">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1.5 text-sm leading-relaxed text-luma-muted">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}
