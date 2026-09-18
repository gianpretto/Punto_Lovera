export function truncate(value: string | null | undefined, limit = 200): string {
  if (!value) return '';
  const str = String(value);
  if (str.length <= limit) return str;
  return str.slice(0, limit - 1).trimEnd() + '…';
}
