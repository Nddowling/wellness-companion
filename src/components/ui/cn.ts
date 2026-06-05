// Tiny class-name joiner — keeps variant maps readable without pulling in a
// dependency (clsx/cva). Falsy values are dropped so conditional classes can be
// passed inline: cn('base', isActive && 'active', className).
export type ClassValue = string | false | null | undefined;

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}
