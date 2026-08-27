/**
 * Extracts a message from a caught value of unknown type, falling back to a
 * default when it isn't an Error (e.g. a thrown string/object).
 */
export const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;
