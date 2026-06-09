/**
 * @file owner-conversations-api.test.ts
 * @description Source-level tests for the owner conversations API client
 * added in SPEC-206 PR2. Verifies that the ownerConversationsApi object
 * exists, is structured correctly, and references the correct endpoints.
 *
 * API clients cannot be executed in Vitest (they depend on runtime fetch),
 * so we lean on string-level assertions on the source file.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../../src/lib/api/endpoints-protected.ts'),
    'utf8'
);

describe('ownerConversationsApi (SPEC-206)', () => {
    it('exports an ownerConversationsApi object', () => {
        expect(source).toMatch(/export\s+const\s+ownerConversationsApi\s*=/);
    });

    it('has a list() method that calls GET /api/v1/protected/conversations/owner', () => {
        // The list method should reference the owner path without a trailing /:id
        expect(source).toContain('conversations/owner');
    });

    it('has a getById() method that calls GET /api/v1/protected/conversations/owner/:id', () => {
        // Should reference owner thread endpoint with template literal
        expect(source).toMatch(/conversations\/owner\/\$/);
    });

    it('has a getUnreadCount() method that calls GET /api/v1/protected/conversations/owner/unread-count', () => {
        expect(source).toContain('unread-count');
    });

    it('has a reply() method that calls POST /api/v1/protected/conversations/owner/:id/messages', () => {
        expect(source).toMatch(/owner\/\$/);
        expect(source).toContain('/messages');
    });

    it('defines OwnerConversationInboxItem interface with required fields', () => {
        expect(source).toContain('OwnerConversationInboxItem');
        expect(source).toMatch(/interface\s+OwnerConversationInboxItem/);
        // Must have key fields for the inbox list
        expect(source).toMatch(/accommodationName/);
        expect(source).toMatch(/guestName/);
        expect(source).toMatch(/lastMessageExcerpt/);
        expect(source).toMatch(/unreadCount/);
    });

    it('defines OwnerConversationThreadResponse interface', () => {
        expect(source).toContain('OwnerConversationThreadResponse');
        expect(source).toMatch(/interface\s+OwnerConversationThreadResponse/);
    });

    it('uses getProtected for list and getById (GET requests)', () => {
        // The owner list and thread should use getProtected
        const ownerSection = source.slice(source.indexOf('ownerConversationsApi'));
        expect(ownerSection).toContain('getProtected');
    });

    it('uses postProtected for reply (POST request)', () => {
        const ownerSection = source.slice(source.indexOf('ownerConversationsApi'));
        expect(ownerSection).toContain('postProtected');
    });
});
