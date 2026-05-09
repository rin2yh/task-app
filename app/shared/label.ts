import { z } from 'zod';

export const LabelSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type Label = z.infer<typeof LabelSchema>;
