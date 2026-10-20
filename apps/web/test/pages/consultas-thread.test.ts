/**
 * @file consultas-thread.test.ts
 * @description Source-level tests for the tourist's conversation thread page
 * (`mi-cuenta/consultas/[conversationId].astro`), HOS-1492 rows 28 and 35.
 *
 * Astro pages cannot be rendered via Vitest in this repo, so these assertions
 * read the `.astro` source: the reply form exists only while the listing still
 * admits messages (`listingAvailability: 'AVAILABLE'`); otherwise the whole
 * conversation stays visible and `ListingGoneNotice` stands where the form
 * was, without saying why.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/consultas/[conversationId].astro'),
    'utf8'
);

const markup = source.slice(source.lastIndexOf('---') + 3);

describe('mi-cuenta/consultas/[conversationId].astro — the thread as today', () => {
    it('is an SSR page that reads the thread with the session cookie', () => {
        expect(source).toContain('prerender = false');
        expect(source).toContain('protectedConversationsApi.getThread(');
        expect(source).toMatch(/Astro\.request\.headers\.get\(\s*['"]cookie['"]\s*\)/);
    });

    it('keeps the closed/blocked status gate', () => {
        expect(source).toContain("const closedStatuses = ['CLOSED', 'BLOCKED'];");
        expect(markup).toContain("t('conversations.status.closed')");
    });

    it('AVAILABLE: mounts the reply island as before', () => {
        expect(markup).toMatch(/\) : canReply \? \(\s*<ConversationReply\s+client:visible/);
    });
});

describe('mi-cuenta/consultas/[conversationId].astro — rows 28 and 35 (HOS-1492)', () => {
    it('reads listingAvailability from the thread response', () => {
        expect(source).toContain(
            'const { conversation, messages, nextCursor, listingAvailability } = result.data;'
        );
        expect(source).toContain(
            "const listingAdmitsMessages = listingAvailability === 'AVAILABLE';"
        );
    });

    it('TEST:V8a:6 — canReply is false whenever the listing does not admit messages', () => {
        expect(source).toMatch(
            /const canReply =\s*listingAdmitsMessages && !closedStatuses\.includes\(conversation\.status\.toUpperCase\(\)\);/
        );
    });

    it('TEST:V8a:6 / TEST:V8a:7 — GONE or NOT_PUBLISHED: the notice replaces the reply form', () => {
        expect(source).toContain(
            "import ListingGoneNotice from '@/components/account/ListingGoneNotice.astro';"
        );
        expect(markup).toMatch(
            /\{!listingAdmitsMessages \? \(\s*<ListingGoneNotice locale=\{locale\} availability=\{listingAvailability\} \/>\s*\) : canReply \?/
        );
        expect(markup.indexOf('<ListingGoneNotice')).toBeLessThan(
            markup.indexOf('<ConversationReply')
        );
    });

    it('TEST:V8a:6 — the whole conversation stays visible whatever the availability', () => {
        expect(markup).toContain('{messages.map((msg) => (');
        expect(markup.indexOf('{messages.map(')).toBeLessThan(
            markup.indexOf('{!listingAdmitsMessages')
        );
        expect(markup).not.toMatch(/listingAdmitsMessages\s*&&/);
        expect(markup).not.toMatch(/listingAvailability\s*===/);
    });

    it('TEST:V8a:7 — row 35 never says why the listing is not published', () => {
        expect(markup).not.toMatch(
            /DRAFT|ARCHIVED|MODERATED|UNPUBLISHED_BY_BILLING|publicationStatus/
        );
    });
});
