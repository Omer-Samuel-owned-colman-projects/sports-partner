export function parsePositiveIntQueryParam(value: unknown): number | null {
  if (!value) return null;

  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error('must be a positive integer');
  }

  return num;
}

export function parseBooleanQueryParam(value: unknown): boolean | null {
  if (value === undefined || value === null || value === '') return null;

  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;

  throw new Error('must be a boolean');
}
