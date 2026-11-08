/**
 * The Edit limit: once a Job holds this many Applications (every status counts, so the number only
 * goes up), its Requirements can no longer be changed. One value for every Job for now; it becomes
 * a per-Job value when tiers arrive. A placeholder to confirm (Layer 3 spec, open item 5).
 */
export const REQUIREMENT_EDIT_LIMIT = 100;
