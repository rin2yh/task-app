import { describe, expect, it } from 'vitest';
import { Result } from './result';

describe('Result.try', () => {
  it('returns ok with value when the promise resolves', async () => {
    const result = await Result.try(Promise.resolve(42));
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('wraps a plain (non-Promise) value as ok', async () => {
    const result = await Result.try('hello');
    expect(result).toEqual({ ok: true, value: 'hello' });
  });

  it('returns err when the promise rejects', async () => {
    const error = new Error('boom');
    const result = await Result.try(Promise.reject(error));
    expect(result).toEqual({ ok: false, error });
  });

  it('preserves non-Error rejections as-is', async () => {
    const result = await Result.try(Promise.reject('string error'));
    expect(result).toEqual({ ok: false, error: 'string error' });
  });

  it('infers Result<T> from Promise<T>', async () => {
    const fetchNumber = (): Promise<number> => Promise.resolve(7);
    const result = await Result.try(fetchNumber());
    if (result.ok) {
      const _check: number = result.value;
      expect(_check).toBe(7);
    } else {
      expect.fail('expected ok');
    }
  });
});
