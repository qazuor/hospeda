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
 * The paso-3 cut migration (V6.9) fills the three required columns through
 * write `C` before enforcing NOT NULL. They have no DEFAULT: a default would
 * write outside the closed list guarded by `G-R6-B`.
 *
 * @returns The four column builders, keyed by their TypeScript property name.
 */
export function listingPublicationColumns() {
    return {
        /**
         * The listing state of `V/03` §9 (see `PublicationStatusEnum`). Replaces
         * `lifecycle_state`, `visibility` and `moderation_state`, which the paso-3
         * cut migration (V6.9b) drops.
         */
        publicationStatus: PublicationStatusPgEnum('publication_status').notNull(),

        /**
         * Spec `inactiva_desde`: where the retention clock lives — the instant of
         * the most recent of the facts that restart it (`NUCLEO/01` §1.2) or the
         * cut's write `C`. Written only by that closed list (`G-R6-B`), together
         * with `deadlines_version`.
         */
        inactiveSince: timestamp('inactive_since', { withTimezone: true }).notNull(),

        /**
         * Spec `plazos_version`: the version of the vertical deadlines the clock
         * started with (`NUCLEO/02` §1.5). Written only together with
         * `inactive_since`, never alone. Plain integer: the versioned deadlines
         * table is introduced by V6.9. No foreign key is declared.
         */
        deadlinesVersion: integer('deadlines_version').notNull(),

        /**
         * Spec `borrado_anunciado`: the deletion date announced by the listing's
         * last archive, written by `PB4`/`PB5` and read by `PB9`, which never
         * deletes earlier. NULL until the first archive (final shape: nullable).
         */
        deletionAnnouncedAt: timestamp('deletion_announced_at', { withTimezone: true })
    };
}
