import { getTableName } from 'drizzle-orm';
import { billingDeadlineVersions } from './billing-deadline-version.dbschema.ts';
import { catalogKeys } from './catalog-key.dbschema.ts';
import { verticals } from './vertical.dbschema.ts';

/**
 * Tables whose rows are written BY A STRUCTURAL MIGRATION, not by any seed
 * (HOS-1430). Any "wipe every table" mechanism must skip them: after a TRUNCATE
 * nothing re-inserts them, because `db:migrate` already considers the migration
 * applied. Consumed by the seed reset and by the integration-test clean slate;
 * add a table here the moment a migration starts inserting reference rows into it.
 */
export const REFERENCE_TABLES: readonly string[] = [
    getTableName(verticals),
    getTableName(catalogKeys),
    getTableName(billingDeadlineVersions)
];
