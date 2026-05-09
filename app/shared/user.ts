import { z } from 'zod';

export const UserSchema = z.object({
  id: z.number(),
  login: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});
export type User = z.infer<typeof UserSchema>;
