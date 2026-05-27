/**
 * Unit tests for the role-permissions seed static data (SPEC-155 T-016).
 *
 * These tests verify the ROLE_PERMISSIONS constant directly — no database
 * connection is required because the data is a pure in-memory declaration.
 *
 * Literal string values are used instead of @repo/schemas imports to avoid
 * workspace module resolution issues in the Vitest runner (same approach as
 * systemUser.seed.test.ts). Values MUST match packages/schemas/src/enums/
 * permission.enum.ts and role.enum.ts.
 *
 * Focus: EDITOR role newsletter permission grants.
 * Policy: editor drafts/views only; NEWSLETTER_CAMPAIGN_SEND stays admin-only.
 */

import { describe, expect, it } from 'vitest';
import { _internals } from '../../src/required/rolePermissions.seed.js';

// Use literal values to avoid workspace resolution issues.
// Must match packages/schemas/src/enums/role.enum.ts and permission.enum.ts.
const EDITOR = 'EDITOR' as const;
const NEWSLETTER_CAMPAIGN_VIEW = 'newsletter.campaign.view' as const;
const NEWSLETTER_CAMPAIGN_WRITE = 'newsletter.campaign.write' as const;
const NEWSLETTER_CAMPAIGN_SEND = 'newsletter.campaign.send' as const;
const NEWSLETTER_SUBSCRIBER_VIEW = 'newsletter.subscriber.view' as const;

const { ROLE_PERMISSIONS } = _internals;

describe('ROLE_PERMISSIONS — EDITOR newsletter permissions (SPEC-155 T-016)', () => {
    // Cast through unknown to satisfy the Record index signature without
    // importing the enums from @repo/schemas.
    const editorPerms = ROLE_PERMISSIONS[EDITOR as unknown as keyof typeof ROLE_PERMISSIONS];

    it('grants NEWSLETTER_CAMPAIGN_VIEW to EDITOR', () => {
        expect(editorPerms).toContain(NEWSLETTER_CAMPAIGN_VIEW);
    });

    it('grants NEWSLETTER_CAMPAIGN_WRITE to EDITOR', () => {
        expect(editorPerms).toContain(NEWSLETTER_CAMPAIGN_WRITE);
    });

    it('grants NEWSLETTER_SUBSCRIBER_VIEW to EDITOR', () => {
        expect(editorPerms).toContain(NEWSLETTER_SUBSCRIBER_VIEW);
    });

    it('does NOT grant NEWSLETTER_CAMPAIGN_SEND to EDITOR (send stays admin-only)', () => {
        expect(editorPerms).not.toContain(NEWSLETTER_CAMPAIGN_SEND);
    });
});
