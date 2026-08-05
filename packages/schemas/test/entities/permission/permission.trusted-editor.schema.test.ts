/**
 * Tests for the trusted-editor schemas (HOS-374 §5.1.2 / OQ-1).
 *
 * `TRUSTED_EDITOR_PERMISSIONS` is the single source of truth for the bundle, so
 * these cases pin BOTH its exact membership (a silent addition/removal changes
 * who counts as trusted across the whole platform) and the all-or-nothing
 * semantics of the derived predicate.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    isTrustedEditorFromGrants,
    TRUSTED_EDITOR_PERMISSIONS,
    TrustedEditorInputSchema,
    TrustedEditorResultSchema
} from '../../../src/entities/permission/permission.trusted-editor.schema.js';
import { PermissionEnum } from '../../../src/enums/index.js';

describe('TRUSTED_EDITOR_PERMISSIONS', () => {
    it('is exactly the four publish-own / delete-own grants', () => {
        expect([...TRUSTED_EDITOR_PERMISSIONS]).toEqual([
            PermissionEnum.POST_PUBLISH_OWN,
            PermissionEnum.EVENT_PUBLISH_OWN,
            PermissionEnum.POST_DELETE_OWN,
            PermissionEnum.EVENT_DELETE_OWN
        ]);
    });
});

describe('isTrustedEditorFromGrants', () => {
    it('returns true only when the whole bundle is granted', () => {
        expect(
            isTrustedEditorFromGrants({ grantedPermissions: [...TRUSTED_EDITOR_PERMISSIONS] })
        ).toBe(true);
    });

    it('returns true when the bundle is granted alongside unrelated permissions', () => {
        expect(
            isTrustedEditorFromGrants({
                grantedPermissions: [...TRUSTED_EDITOR_PERMISSIONS, PermissionEnum.POST_CREATE]
            })
        ).toBe(true);
    });

    it.each(
        TRUSTED_EDITOR_PERMISSIONS.map((p) => [p] as const)
    )('returns false when %s is missing', (missing) => {
        const granted = TRUSTED_EDITOR_PERMISSIONS.filter((p) => p !== missing);

        expect(isTrustedEditorFromGrants({ grantedPermissions: granted })).toBe(false);
    });

    it('returns false for an empty grant list', () => {
        expect(isTrustedEditorFromGrants({ grantedPermissions: [] })).toBe(false);
    });
});

describe('TrustedEditorInputSchema', () => {
    it('accepts a valid userId', () => {
        const userId = '11111111-1111-4111-8111-111111111111';

        expect(TrustedEditorInputSchema.parse({ userId })).toEqual({ userId });
    });

    it('rejects a malformed userId', () => {
        expect(() => TrustedEditorInputSchema.parse({ userId: 'nope' })).toThrow(ZodError);
    });

    it('is strict — the permission set is never caller-supplied', () => {
        expect(() =>
            TrustedEditorInputSchema.parse({
                userId: '11111111-1111-4111-8111-111111111111',
                permissions: [PermissionEnum.POST_PUBLISH_OWN]
            })
        ).toThrow(ZodError);
    });
});

describe('TrustedEditorResultSchema', () => {
    it('validates the result shape', () => {
        expect(TrustedEditorResultSchema.parse({ isTrustedEditor: true, changed: false })).toEqual({
            isTrustedEditor: true,
            changed: false
        });
    });

    it('rejects a missing changed flag', () => {
        expect(() => TrustedEditorResultSchema.parse({ isTrustedEditor: true })).toThrow(ZodError);
    });
});
