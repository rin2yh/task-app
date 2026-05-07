import { z } from 'zod';

export const PrioritySchema = z.enum(['low', 'medium', 'high']);
export type Priority = z.infer<typeof PrioritySchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  ownerId: z.number(),
  name: z.string().min(1).max(100),
  description: z.string().max(2000).nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ColumnSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string().min(1).max(50),
  position: z.number(),
  createdAt: z.number(),
});
export type Column = z.infer<typeof ColumnSchema>;

export const LabelSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type Label = z.infer<typeof LabelSchema>;

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

export const UserSchema = z.object({
  id: z.number(),
  login: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});
export type User = z.infer<typeof UserSchema>;

export type SharedProps = {
  auth: { user: User | null };
  csrfToken: string;
  flash: { success?: string; error?: string };
};
