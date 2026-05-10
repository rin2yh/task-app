export function dueToInput(due: number | null): string {
  return due ? new Date(due).toISOString().slice(0, 10) : '';
}

export function inputToDue(input: string): number | null {
  return input ? Date.parse(`${input}T00:00:00Z`) : null;
}
