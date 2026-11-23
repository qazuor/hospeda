/**
 * @file consultas-propietario-index.test.ts
 * @description Source-level tests for the owner conversations inbox page
 * (SPEC-206, migrated to the account kit by HOS-2482). The list itself is the
 * shared `ConversationInbox` island, tested with `viewer="owner"` in
 * `test/components/account/conversations/ConversationInbox.test.tsx`.
 *
 * Astro pages cannot be rendered via Vitest, so we lean on string-level
 * assertions on the .astro source.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/consultas-propietario/index.astro'),
    'utf8'
);
const markup = source.slice(source.lastIndexOf('---') + 3);

describe('consultas-propietario/index.astro (owner inbox on the kit)', () => {
    it('is an SSR page (prerender = false)', () => {
        expect(source).toContain('prerender = false');
    });

    it('uses AccountLayout with activeSection="owner-messages"', () => {
        expect(source).toContain('<AccountLayout');
        expect(source).toContain('activeSection="owner-messages"');
    });

    it('renders ONE PageHeader with the translated owner inbox title', () => {
        expect(markup.match(/<PageHeader\b/g)).toHaveLength(1);
        expect(source).toContain("t('conversations.inbox.ownerInboxTitle')");
        expect(markup).not.toMatch(/<h1[\s>]/);
    });

    it('shares the guest inbox island, with viewer="owner"', () => {
        expect(markup).toMatch(/<ConversationInbox client:load locale=\{locale\} viewer="owner"/);
    });

    it('reads no conversation on the server (session-blind beyond the gate)', () => {
        expect(source).not.toContain('ownerConversationsApi');
        expect(source).not.toContain("headers.get('cookie')");
    });

    it('redirects unauthenticated users to sign-in with the return URL', () => {
        expect(source).toContain(
            'buildLoginRedirect({ locale, currentUrl: Astro.url.pathname + Astro.url.search })'
        );
    });

    it('retires the legacy primitives and the <style> block', () => {
        expect(source).not.toMatch(/AccountPageHeader|AccountSectionCard|AccountEmptyState/);
        expect(source).not.toContain('<style');
        expect(source).not.toContain('aria-label="Pagination"');
    });
});
