/**
 * @file consultas-propietario-index.test.ts
 * @description Source-level tests for the owner conversations inbox page
 * (SPEC-206 PR2). Verifies correct layout, API call, i18n keys, and
 * navigation patterns.
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

describe('consultas-propietario/index.astro (SPEC-206 owner inbox)', () => {
    it('is an SSR page (prerender = false)', () => {
        expect(source).toContain('prerender = false');
    });

    it('uses AccountLayout with activeSection="owner-messages"', () => {
        expect(source).toContain('<AccountLayout');
        expect(source).toContain('activeSection="owner-messages"');
    });

    it('fetches from ownerConversationsApi.list()', () => {
        expect(source).toContain('ownerConversationsApi');
        expect(source).toContain('.list(');
    });

    it('forwards the session cookie for SSR authentication', () => {
        expect(source).toMatch(/Astro\.request\.headers\.get\(\s*['"]cookie['"]\s*\)/);
    });

    it('uses i18n key for owner inbox title', () => {
        expect(source).toContain('conversations.inbox.ownerInboxTitle');
    });

    it('uses i18n key for empty owner inbox', () => {
        expect(source).toContain('conversations.empty.ownerInbox');
    });

    it('links each conversation to the owner thread page', () => {
        expect(source).toContain('consultas-propietario/');
    });

    it('renders unread count badges', () => {
        expect(source).toContain('unreadCount');
    });

    it('fetches owner conversations with correct API endpoint', () => {
        expect(source).toContain('ownerConversationsApi');
        expect(source).toContain('.list(');
    });

    it('renders guest name for each conversation', () => {
        expect(source).toContain('guestName');
    });

    it('renders accommodation name for each conversation', () => {
        expect(source).toContain('accommodationName');
    });

    it('redirects unauthenticated users to sign-in', () => {
        expect(source).toContain('auth/signin');
    });

    it('uses buildUrl for internal navigation', () => {
        expect(source).toContain('buildUrl');
    });

    it('import ownerConversationsApi from endpoints-protected', () => {
        expect(source).toContain("from '@/lib/api/endpoints-protected'");
        expect(source).toContain('ownerConversationsApi');
    });
});
