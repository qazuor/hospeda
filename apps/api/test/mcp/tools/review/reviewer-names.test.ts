/**
 * HOS-2330 D-8 — `readReviewerDisplayNames`: author names for a page of
 * reviews in one query, projected to the name and nothing else.
 *
 * @module test/mcp/tools/review/reviewer-names
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const { findByIds } = vi.hoisted(() => ({ findByIds: vi.fn() }));

vi.mock('@repo/db', () => ({
    UserModel: class {
        findByIds = findByIds;
    }
}));

import { readReviewerDisplayNames } from '../../../../src/mcp/tools/review/reviewer-names';

describe('readReviewerDisplayNames', () => {
    afterEach(() => {
        findByIds.mockReset();
    });

    it('does not query when there are no reviewers', async () => {
        // Act
        const names = await readReviewerDisplayNames({ reviewerIds: [] });

        // Assert
        expect(names.size).toBe(0);
        expect(findByIds).not.toHaveBeenCalled();
    });

    it('asks once for the distinct reviewers', async () => {
        // Arrange
        findByIds.mockResolvedValue([]);

        // Act
        await readReviewerDisplayNames({ reviewerIds: ['u1', 'u2', 'u1'] });

        // Assert
        expect(findByIds).toHaveBeenCalledTimes(1);
        expect(findByIds).toHaveBeenCalledWith(['u1', 'u2']);
    });

    it('maps ids to the public display name and leaks no other column', async () => {
        // Arrange
        findByIds.mockResolvedValue([
            {
                id: 'u1',
                displayName: null,
                firstName: 'Ana',
                lastName: 'Pérez',
                email: 'ana@example.com',
                image: 'https://img.example/ana.png'
            },
            { id: 'u2', displayName: 'Beto', email: 'beto@example.com' },
            { id: 'u3', displayName: null, firstName: null, lastName: null }
        ]);

        // Act
        const names = await readReviewerDisplayNames({ reviewerIds: ['u1', 'u2', 'u3'] });

        // Assert: a name per reviewer that has one, and only names
        expect([...names.entries()]).toEqual([
            ['u1', 'Ana P.'],
            ['u2', 'Beto']
        ]);
        expect(JSON.stringify([...names])).not.toMatch(/example\.com|img\./);
    });
});
