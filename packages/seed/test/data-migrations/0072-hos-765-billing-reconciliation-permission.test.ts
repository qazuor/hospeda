/**
 * @fileoverview
 * `0072-hos-765-billing-reconciliation-permission` is a documented no-op since HOS-1419: the permission it granted was
 * retired. The file stays because the live seed ledger references it by name.
 *
 * @module test/data-migrations/0072-hos-765-billing-reconciliation-permission
 */
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0072-hos-765-billing-reconciliation-permission.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

describe('0072-hos-765-billing-reconciliation-permission (retired no-op)', () => {
    it('keeps its ledger identity', () => {
        expect(migration.meta).toEqual({
            name: '0072-hos-765-billing-reconciliation-permission',
            group: 'required',
            destructive: false
        });
    });

    it('up() touches nothing and reports zero grants', async () => {
        // Arrange: a ctx whose every property throws if touched.
        const ctx = new Proxy(
            {},
            {
                get: () => {
                    throw new Error('ctx must not be used by a no-op migration');
                }
            }
        ) as unknown as SeedMigrationCtx;

        // Act
        const result = await migration.up(ctx);

        // Assert
        expect(result.counts?.granted).toBe(0);
    });
});
