import { describe, expect, it } from 'vitest';
import { meta, up } from '../../src/data-migrations/0111-hos1479-experience-publication-state.js';

describe('HOS-1479 experience publication state (no-op since HOS-1641)', () => {
    it('keeps its ledger name and reports zero updates without touching the database', async () => {
        // Arrange: an empty context proves `up` no longer reads the dropped columns.
        const ctx = {} as Parameters<typeof up>[0];

        // Act
        const result = await up(ctx);

        // Assert
        expect(meta).toEqual({
            name: '0111-hos1479-experience-publication-state',
            group: 'required',
            destructive: false
        });
        expect(result.counts).toEqual({ updated: 0 });
        expect(result.summary).toContain('No experience rows');
    });
});
