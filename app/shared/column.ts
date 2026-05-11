import { z } from 'zod';

export const SYSTEM_COLUMN_NO_STATUS = 'no_status';

export const SYSTEM_COLUMN_IDS: ReadonlySet<string> = new Set([SYSTEM_COLUMN_NO_STATUS]);

export const ColumnSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  columnId: z.string(),
  name: z.string().min(1).max(50),
  position: z.number(),
});
export type Column = z.infer<typeof ColumnSchema>;

export function isSystemColumn(column: Pick<Column, 'columnId'>): boolean {
  return SYSTEM_COLUMN_IDS.has(column.columnId);
}
