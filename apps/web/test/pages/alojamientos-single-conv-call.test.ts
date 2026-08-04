/**
 * @file alojamientos-single-conv-call.test.ts
 * @description Regression test: the accommodation detail page must resolve the
 * visitor's existing conversation with EXACTLY ONE request (rate-limit fix).
 *
 * History of this invariant, because it has now survived two moves:
 *   1. Originally the page made two separate `protectedConversationsApi.list`
 *      calls during SSR — a filtered one for review eligibility and an
 *      unfiltered `pageSize:50` one to find an existing conversation id. They
 *      were collapsed into a single filtered call answering both.
 *   2. HOS-369 WB0-7 moved that lookup off the server entirely: the page is
 *      edge-cacheable, so it cannot carry visitor state. The two consumers
 *      (`ContactHost` and `ReviewSidebarCard`) are now separate islands that
 *      hydrate in different ticks, which is precisely the situation that would
 *      re-introduce the second call. `store/accommodation-conversation-store`
 *      exists to prevent that by caching the in-flight PROMISE.
 *
 * So the assertions below are the same invariant restated for the new shape:
 * the page must make no such call at all, and two consumers must share one.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SRC_DIR = resolve(__dirname, '../../src');
const src = readFileSync(resolve(SRC_DIR, 'pages/[lang]/alojamientos/[slug].astro'), 'utf8');

const mockList = vi.fn();

vi.mock('@/lib/api/endpoints-protected', () => ({
    protectedConversationsApi: {
        list: (params: unknown) => mockList(params)
    }
}));

const mockReadCachedAuthMe = vi.fn();

vi.mock('@/lib/auth-cache', () => ({
    readCachedAuthMe: () => mockReadCachedAuthMe(),
    fetchAuthMe: () => new Promise(() => undefined),
    writeCachedAuthMe: () => undefined,
    resetInFlightAuthMe: () => undefined
}));

import {
    getAccommodationConversation,
    resetAccommodationConversationStore
} from '@/store/accommodation-conversation-store';
import { buildAuthSnapshot } from '../helpers/auth-session';

describe('alojamientos/[slug].astro — no SSR conversation lookup (HOS-369 WB0-7)', () => {
    it('reads the page source at all', () => {
        // Non-vacuity: every assertion in this block is a `not.toContain`, and
        // all of them pass on an empty string.
        expect(src.length).toBeGreaterThan(1000);
    });

    it('never calls protectedConversationsApi from the page frontmatter', () => {
        expect(src).not.toContain('protectedConversationsApi');
    });

    it('does not derive review eligibility or a conversation id server-side', () => {
        expect(src).not.toContain('canLeaveReview');
        expect(src).not.toContain('existingConversationId');
    });

    it('does not forward the visitor cookie to any API', () => {
        // The mechanism by which a response becomes personalized at all.
        expect(src).not.toContain('cookieHeader');
    });
});

describe('accommodation-conversation-store — one request serves both islands', () => {
    beforeEach(() => {
        resetAccommodationConversationStore();
        mockList.mockReset();
        mockReadCachedAuthMe.mockReset();
    });

    it('issues exactly one list call for two consumers of the same accommodation', async () => {
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
        mockList.mockResolvedValue({ ok: true, data: { items: [{ id: 'conv-1' }] } });

        // Deliberately NOT awaited between the two: this is the interleaving the
        // store exists for — a result-only cache would still let both fire.
        const [first, second] = await Promise.all([
            getAccommodationConversation('acc-1'),
            getAccommodationConversation('acc-1')
        ]);

        expect(mockList).toHaveBeenCalledTimes(1);
        expect(mockList).toHaveBeenCalledWith({ accommodationId: 'acc-1', pageSize: 1 });
        expect(first.conversationId).toBe('conv-1');
        expect(first.hasConversation).toBe(true);
        expect(second).toEqual(first);
    });

    it('filters by accommodationId rather than listing every conversation', async () => {
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
        mockList.mockResolvedValue({ ok: true, data: { items: [] } });

        await getAccommodationConversation('acc-9');

        // The old unfiltered `pageSize: 50` call is what the rate limit was
        // hitting; requiring the exact params keeps it from creeping back.
        expect(mockList).toHaveBeenCalledWith({ accommodationId: 'acc-9', pageSize: 1 });
    });

    it('never sends a cookieHeader — that parameter is SSR-only', async () => {
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
        mockList.mockResolvedValue({ ok: true, data: { items: [] } });

        await getAccommodationConversation('acc-1');

        expect(mockList.mock.calls[0]?.[0]).not.toHaveProperty('cookieHeader');
    });

    it('makes no request at all for a visitor with no session', async () => {
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: false }));

        const state = await getAccommodationConversation('acc-1');

        expect(mockList).not.toHaveBeenCalled();
        expect(state.hasConversation).toBe(false);
        expect(state.conversationId).toBeNull();
    });

    it('degrades to "no conversation" when the call fails', async () => {
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
        mockList.mockResolvedValue({ ok: false, error: { status: 500 } });

        const state = await getAccommodationConversation('acc-1');

        // Fail-closed in the direction that leaves a way forward: the contact
        // form is rendered, and the protected initiate route is idempotent.
        expect(state.hasConversation).toBe(false);
        expect(state.isResolving).toBe(false);
    });

    it('keeps different accommodations apart', async () => {
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
        mockList.mockResolvedValue({ ok: true, data: { items: [] } });

        await getAccommodationConversation('acc-1');
        await getAccommodationConversation('acc-2');

        expect(mockList).toHaveBeenCalledTimes(2);
    });
});
