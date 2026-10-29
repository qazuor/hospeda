import { getTableName } from 'drizzle-orm';
import {
    addons,
    addonVersionEntitlements,
    addonVersionLimits,
    addonVersions
} from './addon-catalog.dbschema.ts';
import { addonProducts } from './addon-product.dbschema.ts';
import { billingDeadlineVersions } from './billing-deadline-version.dbschema.ts';
import { billingOptions } from './billing-option.dbschema.ts';
import { catalogKeys } from './catalog-key.dbschema.ts';
import {
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions
} from './plan-catalog.dbschema.ts';
import { verticals } from './vertical.dbschema.ts';
import { verticalDeadlineVersions } from './vertical-deadline-version.dbschema.ts';

/**
 * Tables whose rows are written BY A STRUCTURAL MIGRATION, not by any seed
 * (HOS-1430). The rule: a table belongs here if ANY file in
 * `packages/db/src/migrations/*.sql` runs `INSERT INTO` it and no seed re-inserts those
 * rows (guarded by `test/schemas/reference-tables.guard.test.ts`). The billing catalog is
 * the plan tables plus `billing_option` and the add-on tables (migration 0176); leaving
 * them out let a seed reset empty the pricing pages (HOS-1827). Any "wipe every table" mechanism must skip them: after a TRUNCATE
 * nothing re-inserts them, because `db:migrate` already considers the migration
 * applied. Consumed by the seed reset and by the integration-test clean slate;
 * add a table here the moment a migration starts inserting reference rows into it.
 */
export const REFERENCE_TABLES: readonly string[] = [
    getTableName(verticals),
    getTableName(catalogKeys),
    getTableName(billingDeadlineVersions),
    getTableName(verticalDeadlineVersions),
    getTableName(plans),
    getTableName(planVersions),
    getTableName(planVersionEntitlements),
    getTableName(planVersionLimits),
    getTableName(billingOptions),
    getTableName(addons),
    getTableName(addonVersions),
    getTableName(addonVersionEntitlements),
    getTableName(addonVersionLimits),
    getTableName(addonProducts)
];
