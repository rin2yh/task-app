import { z } from 'zod';

export const ColumnSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string().min(1).max(50),
  position: z.number(),
  createdAt: z.number(),
});
export type Column = z.infer<typeof ColumnSchema>;
