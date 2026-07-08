/**
 * Fixture for `discover.test.ts` (HOS-25 T-008): `meta.name` deliberately
 * does not match the filename stem, to verify `discoverMigrationFiles`
 * throws on that mismatch instead of silently accepting it.
 */
import type { SeedMigrationModule } from '../../../../src/data-migrations/types.js';

export const meta = {
    name: '0001-does-not-match-filename',
    group: 'required'
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async () => {
    return { summary: 'mismatch' };
};
