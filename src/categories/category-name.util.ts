/** "  Grocery  Items " -> "grocery items" */
export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export const DEFAULT_CATEGORIES = [
  'Grocery',
  'Fuel',
  'Bills',
  'Food',
  'Transport',
  'Shopping',
  'Health',
  'Other',
] as const;
