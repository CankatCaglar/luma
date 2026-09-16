export function brandReportsEnabled(
  data: { reportsEnabled?: boolean } | null | undefined,
): boolean {
  return data?.reportsEnabled === true;
}
