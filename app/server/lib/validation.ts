import type { Context } from 'hono';
import type { z } from 'zod';
import { BadRequest } from './errors';

export async function parseJson<T extends z.ZodTypeAny>(
  c: Context,
  schema: T,
): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw BadRequest('Invalid JSON');
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw BadRequest(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '));
  }
  return result.data;
}
