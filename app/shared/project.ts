import { z } from 'zod';

export const ProjectSchema = z.object({
  id: z.string(),
  ownerId: z.number(),
  name: z.string().min(1).max(100),
  description: z.string().max(2000).nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Project = z.infer<typeof ProjectSchema>;
