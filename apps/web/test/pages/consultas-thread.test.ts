/**
 * @file consultas-thread.test.ts
 * @description Source-level tests for the tourist's conversation thread page
 * (`mi-cuenta/consultas/[conversationId].astro`): HOS-1492 rows 28 and 35, and
 * its migration to the account kit (HOS-2481).
 *
 * Astro pages cannot be rendered via Vitest in this repo, so these assertions
 * read the `.astro` source. The thread and composer behaviour is tested on the
 * island itself (`test/components/account/conversations/ConversationPanel.test.tsx`).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/consultas/[conversationId].astro'),
    'utf8'
);

const markup = source.slice(source.lastIndexOf('---') + 3);

describe('mi-cuenta/consultas/[conversationId].astro — on the account kit (HOS-2481)', () => {
    it('is an SSR page that reads the thread with the session cookie', () => {
        expect(source).toContain('prerender = false');
        expect(source).toContain('protectedConversationsApi.getThread(');
        expect(source).toMatch(/Astro\.request\.headers\.get\(\s*['"]cookie['"]\s*\)/);
    });

    it('renders ONE PageHeader with a labelled back link, and no hand-made h1', () => {
        expect(markup.match(/<PageHeader\b/g)).toHaveLength(1);
        expect(markup).toContain('back={back}');
        expect(source).toContain("label: t('conversations.thread.backToInbox')");
        expect(markup).not.toMatch(/<h1[\s>]/);
    });

    it('mounts the shared ConversationPanel island as the guest, hydrated', () => {
        expect(markup).toMatch(/<ConversationPanel\s+client:load[\s\S]*?viewer="guest"/);
        expect(markup).toContain('initialMessages={thread.messages}');
    });

    it('retires the legacy reply island, the hand-made bubbles and the <style> block', () => {
        expect(source).not.toContain('ConversationReply');
        expect(source).not.toContain('resolveConversationBubbleSide');
        expect(source).not.toContain('<style');
        expect(source).not.toContain('AccountSectionCard');
        expect(source).not.toContain('AccountEmptyState');
    });

    it('keeps the closed/blocked status gate', () => {
        expect(source).toContain("const closedStatuses = ['CLOSED', 'BLOCKED'];");
        expect(markup).toContain("t('conversations.status.closed')");
    });
});

describe('mi-cuenta/consultas/[conversationId].astro — missing vs failed (HOS-2434)', () => {
    it('only a 404 rewrites to the in-layout not-found page', () => {
        expect(source).toMatch(
            /if \(!result\.ok && result\.error\.status === 404\) \{\s*return Astro\.rewrite\(buildAccountNotFoundTarget\(\{ locale, back: 'messages' \}\)\);/
        );
        expect(source).not.toContain('new Response(null');
    });

    it('any other failure renders the retryable ErrorState inside the shell', () => {
        expect(markup).toMatch(/\) : \(\s*<ConversationLoadError client:load/);
        expect(markup.indexOf('<ConversationLoadError')).toBeGreaterThan(
            markup.indexOf('<AccountLayout')
        );
    });
});

describe('mi-cuenta/consultas/[conversationId].astro — rows 28 and 35 (HOS-1492)', () => {
    it('reads listingAvailability from the thread response', () => {
        expect(source).toContain(
            'const { conversation, messages, nextCursor, listingAvailability } = thread;'
        );
        expect(source).toContain("listingAdmitsMessages = listingAvailability === 'AVAILABLE';");
    });

    it('TEST:V8a:6 — canReply is false whenever the listing does not admit messages', () => {
        expect(source).toMatch(
            /canReply = listingAdmitsMessages && !closedStatuses\.includes\(conversation\.status\.toUpperCase\(\)\);/
        );
        expect(markup).toContain('canReply={canReply}');
    });

    it('TEST:V8a:6 / TEST:V8a:7 — GONE or NOT_PUBLISHED: the notice stands where the composer was', () => {
        expect(source).toContain(
            "import ListingGoneNotice from '@/components/account/ListingGoneNotice.astro';"
        );
        expect(markup).toMatch(
            /\{!listingAdmitsMessages \? \(\s*<ListingGoneNotice locale=\{locale\} availability=\{thread\.listingAvailability\} \/>\s*\) : canReply \? null/
        );
    });

    it('TEST:V8a:6 — the whole conversation stays visible whatever the availability', () => {
        // The messages always reach the island; availability only toggles the composer.
        expect(markup).toContain('initialMessages={thread.messages}');
        expect(markup).not.toMatch(/listingAdmitsMessages\s*&&/);
        expect(markup).not.toMatch(/listingAvailability\s*===/);
    });

    it('TEST:V8a:7 — row 35 never says why the listing is not published', () => {
        expect(markup).not.toMatch(
            /DRAFT|ARCHIVED|MODERATED|UNPUBLISHED_BY_BILLING|publicationStatus/
        );
    });
});
