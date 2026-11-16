/**
 * `isPasswordChangeRequired` is the one predicate behind both the session
 * gate (`mustChangePasswordGate`) and the MCP bearer middleware (HOS-2184).
 * Pinned here so the two credential paths cannot drift.
 */

import { describe, expect, it } from 'vitest';
import {
    isPasswordChangeRequired,
    PASSWORD_CHANGE_REQUIRED_RESPONSE
} from '../../src/middlewares/must-change-password';

describe('isPasswordChangeRequired', () => {
    it('requires a change only on an explicit true', () => {
        // Act + Assert
        expect(isPasswordChangeRequired({ user: { mustChangePassword: true } })).toBe(true);
    });

    it.each([
        ['false', { mustChangePassword: false }],
        ['null', { mustChangePassword: null }],
        ['absent', {}],
        ['a truthy non-boolean', { mustChangePassword: 'true' }]
    ])('does not require it when the flag is %s', (_label, user) => {
        // Act + Assert
        expect(isPasswordChangeRequired({ user })).toBe(false);
    });

    it('does not require it without a user', () => {
        // Act + Assert
        expect(isPasswordChangeRequired({ user: undefined })).toBe(false);
        expect(isPasswordChangeRequired({ user: null })).toBe(false);
    });
});

describe('PASSWORD_CHANGE_REQUIRED_RESPONSE', () => {
    it('carries the PASSWORD_CHANGE_REQUIRED code clients redirect on', () => {
        // Assert
        expect(PASSWORD_CHANGE_REQUIRED_RESPONSE.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });
});
