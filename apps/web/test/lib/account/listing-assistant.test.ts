/**
 * @file listing-assistant.test.ts
 * @description Who sees the «asistente de tus fichas» copy (HOS-2602): decided
 * from the EFFECTIVE permissions by the shared business-vertical rule, never a
 * role.
 */

import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    hasListingAssistant,
    LISTING_ASSISTANT_VERTICALS
} from '../../../src/lib/account/listing-assistant';

describe('hasListingAssistant (HOS-2602)', () => {
    it('lists exactly the verticals whose listings carry an AI chat', () => {
        expect(LISTING_ASSISTANT_VERTICALS).toEqual(['accommodations', 'venues', 'experiences']);
    });

    it.each([
        ['a pure tourist', []],
        // An editor creates posts and events: no listing, no listing assistant.
        ['an editor', [PermissionEnum.POST_CREATE, PermissionEnum.EVENT_CREATE]],
        ['an account with an unrelated permission', [PermissionEnum.ACCOMMODATION_VIEW_ALL]]
    ])('is false for %s', (_label, permissions) => {
        // Act
        const { hasAssistant } = hasListingAssistant({ permissions });
        // Assert
        expect(hasAssistant).toBe(false);
    });

    it.each([
        ['a host', [PermissionEnum.ACCOMMODATION_CREATE]],
        ['a venue owner', [PermissionEnum.VENUE_EDIT_OWN]],
        ['an experience owner', [PermissionEnum.EXPERIENCE_EDIT_OWN]]
    ])('is true for %s', (_label, permissions) => {
        expect(hasListingAssistant({ permissions }).hasAssistant).toBe(true);
    });

    it('reads permissions, not role names', () => {
        expect(hasListingAssistant({ permissions: ['HOST', 'VENUE_OWNER'] }).hasAssistant).toBe(
            false
        );
    });
});
