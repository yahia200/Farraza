/**
 * Shortest slug the database accepts: the `*_slug_format` CHECK constraints in
 * src/prisma/contract.prisma need a first and last [a-z0-9] with at least one
 * character between them.
 */
const MIN_SLUG_LENGTH = 3;

/**
 * Turns a name into a URL slug that always satisfies the `*_slug_format`
 * constraints: lowercase [a-z0-9-], 3+ characters, no leading or trailing "-".
 *
 * `fallback` must itself be a valid slug (e.g. "company"). It replaces a
 * name with nothing usable ("!!" → "company") and pads one that is too short
 * ("HP" → "hp-company").
 */
export function slugify(text: string, maxLength: number, fallback: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    // Cutting can leave a "-" at the end, which the constraint rejects.
    .replace(/-+$/, '');

  if (!slug) {
    return fallback;
  }
  return slug.length < MIN_SLUG_LENGTH ? `${slug}-${fallback}` : slug;
}
