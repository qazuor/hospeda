/**
 * Fixture data-migration module for `discover.test.ts` (HOS-25 T-008).
 * Minimal valid `SeedMigrationModule` shape: static `meta` + a no-op `up`.
 */
import type { SeedMigrationModule } from '../../../../src/data-migrations/types.js';

export const meta = {
    name: '0003-charlie',
    group: 'required'
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async () => {
    return { summary: 'charlie' };
};
