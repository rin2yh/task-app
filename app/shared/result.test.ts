import { describe, expect, it, vi } from 'vitest';
import { Result } from './result';

describe('Result.try', () => {
  it('returns ok with value when fn resolves', async () => {
    const result = await Result.try(async () => 42);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('returns ok with value when fn returns sync value', async () => {
    const result = await Result.try(() => 'hello');
    expect(result).toEqual({ ok: true, value: 'hello' });
  });

  it('returns err when fn rejects', async () => {
    const error = new Error('boom');
    const result = await Result.try(async () => {
      throw error;
    });
    expect(result).toEqual({ ok: false, error });
  });

  it('returns err when fn throws synchronously', async () => {
    const error = new Error('sync boom');
    const result = await Result.try(() => {
      throw error;
    });
    expect(result).toEqual({ ok: false, error });
  });

  it('preserves non-Error throws as-is', async () => {
    const result = await Result.try(() => {
      throw 'string error';
    });
    expect(result).toEqual({ ok: false, error: 'string error' });
  });

  it('calls onFinally after success', async () => {
    const onFinally = vi.fn();
    const result = await Result.try(async () => 1, onFinally);
    expect(result).toEqual({ ok: true, value: 1 });
    expect(onFinally).toHaveBeenCalledOnce();
  });

  it('calls onFinally after failure', async () => {
    const onFinally = vi.fn();
    const result = await Result.try(async () => {
      throw new Error('x');
    }, onFinally);
    expect(result.ok).toBe(false);
    expect(onFinally).toHaveBeenCalledOnce();
  });

  it('does not call onFinally before fn settles', async () => {
    const order: string[] = [];
    await Result.try(
      async () => {
        await new Promise((r) => setTimeout(r, 5));
        order.push('fn');
      },
      () => {
        order.push('finally');
      },
    );
    expect(order).toEqual(['fn', 'finally']);
  });

  it('awaits async onFinally before resolving', async () => {
    const order: string[] = [];
    await Result.try(
      async () => {
        order.push('fn');
      },
      async () => {
        await new Promise((r) => setTimeout(r, 5));
        order.push('finally');
      },
    );
    expect(order).toEqual(['fn', 'finally']);
  });

  it('works without onFinally argument', async () => {
    const result = await Result.try(async () => 'ok');
    expect(result).toEqual({ ok: true, value: 'ok' });
  });

  it('propagates onFinally errors over fn result (mirrors try/finally)', async () => {
    const finallyError = new Error('finally boom');
    await expect(
      Result.try(
        async () => 1,
        () => {
          throw finallyError;
        },
      ),
    ).rejects.toBe(finallyError);
  });
});
