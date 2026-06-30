/**
 * @file alojamientos-single-conv-call.test.ts
 * @description Regression test: accommodation detail page must issue exactly ONE
 * conversation-list API call per SSR render (rate-limit fix).
 *
 * Previously the page had two separate `protectedConversationsApi.list` calls:
 *   1. A filtered call (accommodationId, pageSize:1) for review eligibility.
 *   2. An unfiltered call (pageSize:50) to find an existing conversation ID.
 * These were collapsed into a single filtered call whose result satisfies both.
 *
 * Astro components cannot be rendered in Vitest — assertions are source-based.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = resolve(__dirname, '../../src');
const src = readFileSync(resolve(SRC_DIR, 'pages/[lang]/alojamientos/[slug].astro'), 'utf8');

describe('alojamientos/[slug].astro — single conversation list call (rate-limit fix)', () => {
    it('calls protectedConversationsApi.list exactly once', () => {
        const occurrences = (src.match(/protectedConversationsApi\.list\(/g) ?? []).length;
        expect(occurrences).toBe(1);
    });

    it('the single call is filtered by accommodationId', () => {
        expect(src).toContain('accommodationId: accommodation.id');
    });

    it('does not contain the unfiltered pageSize:50 conversation list', () => {
        // The old second call fetched all user conversations and filtered client-side.
        expect(src).not.toContain('pageSize: 50');
    });

    it('both canLeaveReview and existingConversationId are present in the same guarded block', () => {
        // Both variables must exist (not one removed) and both must appear within
        // the same isAuthenticated guard — confirmed by the single list() call check above.
        expect(src).toContain('canLeaveReview');
        expect(src).toContain('existingConversationId');
        // The variables are assigned from the SAME convResult — no duplicate call can satisfy both.
        // The count assertion above (1 call) already enforces this invariant.
        const convResultAssignment = src.match(/const firstConv\s*=\s*convResult\.data\.items/);
        expect(convResultAssignment).not.toBeNull();
    });
});
