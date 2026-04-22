export function parsePositiveIntQueryParam(value: unknown): number | null {
  if (!value) return null;

  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error('must be a positive integer');
  }

  return num;
}
