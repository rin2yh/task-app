import { z } from 'zod';
import { LabelSchema } from './label';
import { PrioritySchema } from './priority';

export const TaskSchema = z.object({
  id: z.string(),
  columnId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).nullable(),
  priority: PrioritySchema,
  dueDate: z.number().nullable(),
  position: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskWithLabelsSchema = TaskSchema.extend({
  labels: z.array(LabelSchema),
});
export type TaskWithLabels = z.infer<typeof TaskWithLabelsSchema>;
