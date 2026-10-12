export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && 'sqlState' in error && error.sqlState === '23505';
}