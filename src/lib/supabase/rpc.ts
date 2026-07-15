/**
 * PostgREST accepts SQL NULL for nullable function parameters, but generated
 * Supabase RPC argument types currently expose every `text` parameter as
 * `string`. This changes only the compile-time view; the runtime value remains
 * null so the database can preserve its intended NULL semantics.
 */
export function postgresNullableText(value: string | null): string {
  return value as string;
}
