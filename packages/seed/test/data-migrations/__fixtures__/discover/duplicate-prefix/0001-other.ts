/**
 * Fixture for `discover.test.ts` (HOS-25 T-008): part of a duplicate-prefix
 * pair used to verify `discoverMigrationFiles` throws when two files claim
 * the same numeric prefix.
 */
import type { SeedMigrationModule } from '../../../../src/data-migrations/types.js';

export const meta = {
    name: '0001-other',
    group: 'required'
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async () => {
    return { summary: 'other' };
};
