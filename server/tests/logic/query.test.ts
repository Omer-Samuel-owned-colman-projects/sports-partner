import { describe, expect, it } from '@jest/globals';
import { parsePositiveIntQueryParam } from '../../src/lib/query.js';

describe('parsePositiveIntQueryParam', () => {
  it('returns null when value is missing', () => {
    expect(parsePositiveIntQueryParam(undefined)).toBeNull();
    expect(parsePositiveIntQueryParam(null)).toBeNull();
    expect(parsePositiveIntQueryParam('')).toBeNull();
  });

  it('parses positive integer values', () => {
    expect(parsePositiveIntQueryParam('1')).toBe(1);
    expect(parsePositiveIntQueryParam(42)).toBe(42);
  });

  it('throws on non-integer or non-positive values', () => {
    expect(() => parsePositiveIntQueryParam('abc')).toThrow('must be a positive integer');
    expect(() => parsePositiveIntQueryParam('1.5')).toThrow('must be a positive integer');
    expect(() => parsePositiveIntQueryParam('0')).toThrow('must be a positive integer');
    expect(() => parsePositiveIntQueryParam(-1)).toThrow('must be a positive integer');
  });
});
