/**
 * @fileoverview Regression: unlinking a POI from a destination must not go
 * through `softDelete`.
 *
 * `r_destination_point_of_interest` is a pure join table — three columns
 * (`destination_id`, `point_of_interest_id`, `relation`) and no `deleted_at`.
 * `BaseModel.softDelete` throws outright on a table without that column, so
 * `removePointOfInterestFromDestination` could never succeed: every unlink
 * returned a `DbError` from the model layer.
 *
 * The existing unit tests all passed through it because they mock
 * `relatedModel.softDelete` and hand back a relation object — a mock kinder
 * than the model it stands in for, immunising the exact line that fails in
 * production.
 *
 * So the first test here uses the REAL model. It needs no database: the guard
 * in `softDelete` runs before the client is ever resolved, which is precisely
 * what makes the failure unconditional rather than data-dependent.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RDestinationPointOfInterestModel } from '@repo/db';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_FILE = path.resolve(
    __dirname,
    '../../../src/services/point-of-interest/point-of-interest.service.ts'
);

describe('POI ↔ destination unlink (HOS-369)', () => {
    it('the real model rejects softDelete on this table — no deleted_at column', async () => {
        const model = new RDestinationPointOfInterestModel();

        await expect(
            model.softDelete(
                {
                    destinationId: '00000000-0000-0000-0000-000000000001',
                    pointOfInterestId: '00000000-0000-0000-0000-000000000002'
                },
                '00000000-0000-0000-0000-000000000003'
            )
        ).rejects.toThrow(/deletedAt|soft delete is not supported/i);
    });

    it('accepts hardDelete on the same table', async () => {
        // Same call shape, one method over. This reaches the database client
        // instead of the column guard, so in a unit run it fails for a
        // connection reason — never for "soft delete is not supported". That
        // distinction is the whole point: one is a wrong-method error that no
        // data can fix, the other is just an unconfigured test environment.
        const model = new RDestinationPointOfInterestModel();

        await expect(
            model.hardDelete({
                destinationId: '00000000-0000-0000-0000-000000000001',
                pointOfInterestId: '00000000-0000-0000-0000-000000000002'
            })
        ).rejects.not.toThrow(/soft delete is not supported/i);
    });

    it('removePointOfInterestFromDestination calls hardDelete, not softDelete', () => {
        // Source-level, deliberately: a mocked-model test cannot tell the two
        // apart (both are stubs that resolve), which is how the bug survived a
        // green suite in the first place.
        const source = readFileSync(SERVICE_FILE, 'utf8');
        const removeMethod = source.slice(
            source.indexOf('public async removePointOfInterestFromDestination'),
            source.indexOf('public async updatePointOfInterestDestinationRelation')
        );

        expect(removeMethod.length).toBeGreaterThan(200); // not a vacuous slice
        expect(removeMethod).toContain('this.relatedModel.hardDelete');
        expect(removeMethod).not.toContain('this.relatedModel.softDelete');
    });
});
