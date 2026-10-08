import { integer, timestamp } from 'drizzle-orm/pg-core';
import { PublicationStatusPgEnum } from './publication_status.dbschema.ts';

/**
 * The publication-model columns of a `listing` (HOS-1478, V6.8a; `V/02` §2.5,
 * `V/03` §9), added identically to the three listing tables — `accommodations`,
 * `gastronomies` and `experiences`. `listing` is those existing rows, not a new
 * table, and the vertical IS the table, so it cannot change.
 *
 * Returns fresh column builders on every call: a Drizzle builder must not be
 * shared between two tables.
 *
 * NULLABILITY IS TRANSITIONAL. The spec wants `publication_status`,
 * `inactive_since` and `deadlines_version` NOT NULL. They are born nullable and
 * without a DEFAULT on purpose: the only writer for pre-existing rows is the
 * write `C` of the paso-3 cut migration (V6.9), which fills them and adds the
 * NOT NULL in the same migration. A DEFAULT here would be a writer outside the
 * closed list that `G-R6-B` guards.
 *
 * @returns The four column builders, keyed by their TypeScript property name.
 */
export function listingPublicationColumns() {
    return {
        /**
         * The listing state of `V/03` §9 (see `PublicationStatusEnum`). Replaces
         * `lifecycle_state`, `visibility` and `moderation_state`, which the paso-3
         * cut migration (V6.9) drops. NOT NULL arrives with V6.9.
         */
        publicationStatus: PublicationStatusPgEnum('publication_status'),

        /**
         * Spec `inactiva_desde`: where the retention clock lives — the instant of
         * the most recent of the facts that restart it (`NUCLEO/01` §1.2) or the
         * cut's write `C`. Written only by that closed list (`G-R6-B`), together
         * with `deadlines_version`. NOT NULL arrives with V6.9.
         */
        inactiveSince: timestamp('inactive_since', { withTimezone: true }),

        /**
         * Spec `plazos_version`: the version of the vertical deadlines the clock
         * started with (`NUCLEO/02` §1.5). Written only together with
         * `inactive_since`, never alone. Plain integer: the versioned deadlines
         * table does not exist yet (V6.10). NOT NULL arrives with V6.9.
         */
        deadlinesVersion: integer('deadlines_version'),

        /**
         * Spec `borrado_anunciado`: the deletion date announced by the listing's
         * last archive, written by `PB4`/`PB5` and read by `PB9`, which never
         * deletes earlier. NULL until the first archive (final shape: nullable).
         */
        deletionAnnouncedAt: timestamp('deletion_announced_at', { withTimezone: true })
    };
}
