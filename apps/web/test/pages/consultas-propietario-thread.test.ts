/**
 * @file consultas-propietario-thread.test.ts
 * @description Source-level tests for the owner conversation thread page
 * (SPEC-206 PR2). Verifies correct layout, API calls, replyUrl, i18n keys.
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

describe('consultas-propietario/[conversationId].astro (SPEC-206 owner thread)', () => {
    it('is an SSR page (prerender = false)', () => {
        expect(source).toContain('prerender = false');
    });

    it('uses AccountLayout with activeSection="owner-messages"', () => {
        expect(source).toContain('<AccountLayout');
        expect(source).toContain('activeSection="owner-messages"');
    });

    it('fetches thread via ownerConversationsApi.getById()', () => {
        expect(source).toContain('ownerConversationsApi');
        expect(source).toContain('.getById(');
    });

    it('forwards the session cookie for SSR authentication', () => {
        expect(source).toMatch(/Astro\.request\.headers\.get\(\s*['"]cookie['"]\s*\)/);
    });

    it('renders ConversationReply with owner replyUrl', () => {
        expect(source).toContain('<ConversationReply');
        expect(source).toContain('replyUrl=');
        expect(source).toContain('owner');
    });

    it('passes client:load directive to ConversationReply', () => {
        expect(source).toContain('client:load');
    });

    it('renders message bubbles with sender type classes', () => {
        expect(source).toContain('senderType');
    });

    it('renders sender labels (owner vs guest)', () => {
        expect(source).toContain('conversations.senderLabels');
    });

    it('uses i18n for thread title', () => {
        expect(source).toContain('conversations.thread.title');
    });

    it('links back to owner inbox', () => {
        expect(source).toContain('consultas-propietario');
    });

    it('redirects unauthenticated users to sign-in', () => {
        expect(source).toContain('auth/signin');
    });

    it('uses buildUrl for internal navigation', () => {
        expect(source).toContain('buildUrl');
    });

    it('handles closed/blocked conversation status', () => {
        expect(source).toContain('CLOSED');
        expect(source).toContain('BLOCKED');
    });

    it('import ownerConversationsApi from endpoints-protected', () => {
        expect(source).toContain("from '@/lib/api/endpoints-protected'");
        expect(source).toContain('ownerConversationsApi');
    });

    it('constructs the owner reply URL with conversation ID', () => {
        expect(source).toMatch(/conversations\/owner\/.*\/messages/);
    });
});
