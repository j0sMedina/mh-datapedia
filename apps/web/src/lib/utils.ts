export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** "FlyingWyvern" → "Flying Wyvern", "ElderDragon" → "Elder Dragon" */
export function formatType(type: string): string {
  return type.replace(/([a-z])([A-Z])/g, '$1 $2');
}
