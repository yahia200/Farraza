import { param } from '@prisma/orm-postgres/relational-core/expression';

// Typed bound parameters for the hand-written `db.raw.sql` queries (`RecheckRepository`,
// `ReembedRepository`). `$1..` are bound parameters (the tag turns each ${} into one); nothing is
// ever interpolated into the SQL text.
export const bindText = (value: string) => param(value, { codecId: 'pg/text@1' });
export const bindUuid = (value: string) => param(value, { codecId: 'pg/uuid@1' });
export const bindInt4 = (value: number) => param(value, { codecId: 'pg/int4@1' });

/** Sorts before every real id (`gen_random_uuid()` never returns it): "no cursor yet" without a NULL parameter. */
export const START_OF_IDS = '00000000-0000-0000-0000-000000000000';
