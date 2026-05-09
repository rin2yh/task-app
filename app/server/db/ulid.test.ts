import { describe, expect, it } from 'vitest';
import { ulid } from './ulid';

const CROCKFORD = /^[0-9A-HJKMNP-TV-Z]{26}$/;

describe('ulid', () => {
  it('returns a 26-char Crockford base32 string', () => {
    const id = ulid();
    expect(id).toHaveLength(26);
    expect(id).toMatch(CROCKFORD);
  });

  it('produces unique values for rapid successive calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => ulid()));
    expect(ids.size).toBe(1000);
  });

  it('sorts lexicographically by generation time', () => {
    const a = ulid();
    const b = ulid();
    // 同一ミリ秒で並ぶことがあるので prefix だけ比較
    expect(a.slice(0, 10) <= b.slice(0, 10)).toBe(true);
  });
});
