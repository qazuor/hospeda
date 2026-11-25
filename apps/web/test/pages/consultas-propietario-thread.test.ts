/**
 * @file consultas-propietario-thread.test.ts
 * @description Source-level tests for the owner conversation thread page
 * (SPEC-206, migrated to the account kit by HOS-2482). The thread and the
 * owner reply are the shared `ConversationPanel` island, tested with
 * `viewer="owner"` in `test/components/account/conversations/ConversationPanel.test.tsx`.
 *
 * Astro pages cannot be rendered via Vitest, so we lean on string-level
 * assertions on the .astro source.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(
        __dirname,
        '../../src/pages/[lang]/mi-cuenta/consultas-propietario/[conversationId].astro'
    ),
    'utf8'
);
const markup = source.slice(source.lastIndexOf('---') + 3);

describe('consultas-propietario/[conversationId].astro (owner thread on the kit)', () => {
    it('is an SSR page (prerender = false)', () => {
        expect(source).toContain('prerender = false');
    });

    it('uses AccountLayout with activeSection="owner-messages"', () => {
        expect(source).toContain('<AccountLayout');
        expect(source).toContain('activeSection="owner-messages"');
    });

    it('fetches the thread via ownerConversationsApi.getById() with the session cookie', () => {
        expect(source).toContain('ownerConversationsApi.getById(');
        expect(source).toMatch(/Astro\.request\.headers\.get\(\s*['"]cookie['"]\s*\)/);
    });

    it('renders ONE PageHeader with account breadcrumbs', () => {
        expect(markup.match(/<PageHeader\b/g)).toHaveLength(1);
        expect(markup).toContain('breadcrumbs={buildAccountBreadcrumbs(');
        expect(source).toContain("getAccountSectionLabel({ t, section: 'owner-messages' })");
        expect(markup).not.toContain('href={back.href}');
        expect(markup).not.toMatch(/<h1[\s>]/);
    });

    it('shares the guest thread island, with viewer="owner"', () => {
        expect(markup).toMatch(/<ConversationPanel\s+client:load[\s\S]*?viewer="owner"/);
        expect(source).not.toContain('ConversationReply');
        expect(source).not.toContain('replyUrl');
        expect(source).not.toContain('<style');
    });

    it('uses i18n for the thread title', () => {
        expect(source).toContain('conversations.thread.title');
    });

    it('redirects unauthenticated users to sign-in with the return URL', () => {
        expect(source).toContain(
            'buildLoginRedirect({ locale, currentUrl: Astro.url.pathname + Astro.url.search })'
        );
    });

    it('handles closed/blocked conversation status', () => {
        expect(source).toContain("const closedStatuses = ['CLOSED', 'BLOCKED'];");
        expect(markup).toContain("t('conversations.status.closed')");
    });
});

describe('consultas-propietario/[conversationId].astro — missing vs failed (HOS-2434)', () => {
    it('a 404 (missing or someone else’s conversation) rewrites to the in-layout not-found page', () => {
        expect(source).toMatch(
            /if \(!result\.ok && result\.error\.status === 404\) \{\s*return Astro\.rewrite\(buildAccountNotFoundTarget\(\{ locale, back: 'ownerMessages' \}\)\);/
        );
    });

    it('any other failure renders the retryable ErrorState inside the shell', () => {
        expect(markup).toMatch(/\) : \(\s*<ConversationLoadError client:load/);
    });
});

describe('consultas-propietario/[conversationId].astro — row 28 (HOS-1492)', () => {
    it('reads listingAvailability from the owner thread response', () => {
        expect(source).toContain(
            'const { conversation, nextCursor, listingAvailability } = thread;'
        );
        expect(source).toContain("listingAdmitsMessages = listingAvailability === 'AVAILABLE';");
    });

    it('TEST:V8a:6 — canReply is false once the listing is GONE', () => {
        expect(source).toMatch(
            /canReply = listingAdmitsMessages && !closedStatuses\.includes\(conversation\.status\.toUpperCase\(\)\);/
        );
    });

    it('TEST:V8a:6 — GONE: "this listing no longer exists" stands where the composer was', () => {
        expect(source).toContain(
            "import ListingGoneNotice from '@/components/account/ListingGoneNotice.astro';"
        );
        expect(markup).toMatch(
            /\{!listingAdmitsMessages \? \(\s*<ListingGoneNotice locale=\{locale\} availability=\{thread\.listingAvailability\} \/>\s*\) : canReply \? null/
        );
    });

    it('TEST:V8a:6 — the whole conversation stays visible whatever the availability', () => {
        expect(markup).toContain('initialMessages={thread.messages}');
        expect(markup).not.toMatch(/listingAdmitsMessages\s*&&/);
    });
});
