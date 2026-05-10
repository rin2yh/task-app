import type { Context } from 'hono';
import type { z } from 'zod';
import { Result } from '../../shared/result';
import { BadRequest } from './errors';

export async function parseJson<T extends z.ZodTypeAny>(
  c: Context,
  schema: T,
): Promise<z.infer<T>> {
  const parsed = await Result.try(c.req.json());
  if (!parsed.ok) throw BadRequest('Invalid JSON');
  const result = schema.safeParse(parsed.value);
  if (!result.success) {
    throw BadRequest(
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
    );
  }
  return result.data;
}
