import { z } from 'zod';

export const ColumnSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  columnId: z.string(),
  name: z.string().min(1).max(50),
  position: z.number(),
  isSystem: z.boolean(),
});
export type Column = z.infer<typeof ColumnSchema>;
