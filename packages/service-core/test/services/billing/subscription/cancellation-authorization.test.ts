import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { resolveCancellationAuthority } from '../../../../src/services/billing/subscription/cancellation-authorization.js';
import type { Actor } from '../../../../src/types/index.js';

function actor(id: string, permissions: readonly PermissionEnum[] = [], system = false): Actor {
    return { id, permissions, roles: [], _isSystemActor: system };
}

describe('resolveCancellationAuthority', () => {
    it('allows the subject as owner', () => {
        expect(
            resolveCancellationAuthority({ actor: actor('owner'), subjectUserId: 'owner' })
        ).toEqual({ allowed: true, as: 'OWNER' });
    });
    it('forbids system actors even when they carry ACC_8', () => {
        expect(
            resolveCancellationAuthority({
                actor: actor('job', [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION], true),
                subjectUserId: 'owner'
            })
        ).toEqual({ allowed: false, reason: 'FORBIDDEN' });
    });
    it('allows an administrator with ACC_8 on another subject', () => {
        expect(
            resolveCancellationAuthority({
                actor: actor('admin', [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]),
                subjectUserId: 'owner'
            })
        ).toEqual({ allowed: true, as: 'ADMIN' });
    });
    it('hides another subject from callers without ACC_8', () => {
        expect(
            resolveCancellationAuthority({ actor: actor('other'), subjectUserId: 'owner' })
        ).toEqual({ allowed: false, reason: 'NOT_VISIBLE' });
    });
    it('keeps the owner path ahead of administrative permission', () => {
        expect(
            resolveCancellationAuthority({
                actor: actor('owner', [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]),
                subjectUserId: 'owner'
            })
        ).toEqual({ allowed: true, as: 'OWNER' });
    });
});
