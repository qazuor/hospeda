/**
 * Unit tests for `hasUnseenHighlights`.
 *
 * Pure function — no React, no DOM, no network. All test cases use
 * inline fixtures; this file has zero test-framework config dependencies.
 *
 * @see apps/admin/src/lib/whats-new/has-unseen-highlights.ts
 * @see SPEC-175 §7.7, §12.5
 */

import type { WhatsNewItem } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { hasUnseenHighlights } from '../has-unseen-highlights';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<WhatsNewItem> = {}): WhatsNewItem {
    return {
        id: 'item-1',
        publishedAt: '2026-01-01T00:00:00Z',
        highlight: false,
        title: 'Item title',
        body: 'Item body',
        seen: false,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('hasUnseenHighlights', () => {
    it('returns false for an empty items array', () => {
        // Arrange
        const items: WhatsNewItem[] = [];

        // Act
        const result = hasUnseenHighlights({ items });

        // Assert
        expect(result).toBe(false);
    });

    it('returns false when all items are non-highlight (seen or unseen)', () => {
        // Arrange — mix of seen/unseen but none are highlight
        const items: WhatsNewItem[] = [
            makeItem({ highlight: false, seen: false }),
            makeItem({ id: 'item-2', highlight: false, seen: true })
        ];

        // Act
        const result = hasUnseenHighlights({ items });

        // Assert
        expect(result).toBe(false);
    });

    it('returns false when all highlight items are already seen', () => {
        // Arrange
        const items: WhatsNewItem[] = [
            makeItem({ highlight: true, seen: true }),
            makeItem({ id: 'item-2', highlight: true, seen: true }),
            makeItem({ id: 'item-3', highlight: false, seen: false })
        ];

        // Act
        const result = hasUnseenHighlights({ items });

        // Assert
        expect(result).toBe(false);
    });

    it('returns true when at least one item is highlight and unseen', () => {
        // Arrange
        const items: WhatsNewItem[] = [
            makeItem({ highlight: true, seen: true }),
            makeItem({ id: 'item-2', highlight: true, seen: false }),
            makeItem({ id: 'item-3', highlight: false, seen: false })
        ];

        // Act
        const result = hasUnseenHighlights({ items });

        // Assert
        expect(result).toBe(true);
    });

    it('returns true when a single highlight-unseen item is present', () => {
        // Arrange
        const items: WhatsNewItem[] = [makeItem({ highlight: true, seen: false })];

        // Act
        const result = hasUnseenHighlights({ items });

        // Assert
        expect(result).toBe(true);
    });

    it('returns false when only non-highlight items exist and none are unseen', () => {
        // Arrange — all seen, none highlighted
        const items: WhatsNewItem[] = [
            makeItem({ highlight: false, seen: true }),
            makeItem({ id: 'item-2', highlight: false, seen: true })
        ];

        // Act
        const result = hasUnseenHighlights({ items });

        // Assert
        expect(result).toBe(false);
    });
});
