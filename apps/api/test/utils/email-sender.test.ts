/**
 * Tests for the deployment-aware email sender decoration.
 *
 * The decoration is what makes a staging email distinguishable from a
 * production one in a personal inbox, so the cases that matter most are the
 * fail-safe ones: anything that is not an explicitly recognised non-production
 * environment must produce an undecorated sender.
 */

import { describe, expect, it } from 'vitest';
import { buildEmailEnvDecoration } from '../../src/utils/email-sender';

describe('buildEmailEnvDecoration', () => {
    it('marks the staging deployment on both the sender name and the subject', () => {
        // Arrange
        const input = { deployEnv: 'preview', baseFromName: 'Hospeda' };

        // Act
        const result = buildEmailEnvDecoration(input);

        // Assert
        expect(result.fromName).toBe('Hospeda [STAGING]');
        expect(result.subjectPrefix).toBe('[STAGING] ');
    });

    it('marks the local development deployment', () => {
        // Arrange
        const input = { deployEnv: 'dev', baseFromName: 'Hospeda' };

        // Act
        const result = buildEmailEnvDecoration(input);

        // Assert
        expect(result.fromName).toBe('Hospeda [DEV]');
        expect(result.subjectPrefix).toBe('[DEV] ');
    });

    it('leaves production undecorated', () => {
        // Arrange
        const input = { deployEnv: 'prod', baseFromName: 'Hospeda' };

        // Act
        const result = buildEmailEnvDecoration(input);

        // Assert
        expect(result.fromName).toBe('Hospeda');
        expect(result.subjectPrefix).toBeUndefined();
    });

    it('leaves the test environment undecorated so existing subject assertions hold', () => {
        // Arrange
        const input = { deployEnv: 'test', baseFromName: 'Hospeda' };

        // Act
        const result = buildEmailEnvDecoration(input);

        // Assert
        expect(result.fromName).toBe('Hospeda');
        expect(result.subjectPrefix).toBeUndefined();
    });

    it('falls back to an undecorated sender when the deploy env is unset', () => {
        // Arrange — a production deployment that forgot the variable must not
        // surface an internal marker to real customers.
        const input = { deployEnv: undefined, baseFromName: 'Hospeda' };

        // Act
        const result = buildEmailEnvDecoration(input);

        // Assert
        expect(result.fromName).toBe('Hospeda');
        expect(result.subjectPrefix).toBeUndefined();
    });

    it('falls back to an undecorated sender on an unrecognised deploy env', () => {
        // Arrange
        const input = { deployEnv: 'staging-2', baseFromName: 'Hospeda' };

        // Act
        const result = buildEmailEnvDecoration(input);

        // Assert
        expect(result.fromName).toBe('Hospeda');
        expect(result.subjectPrefix).toBeUndefined();
    });

    it('decorates a custom base sender name rather than a hardcoded one', () => {
        // Arrange
        const input = { deployEnv: 'preview', baseFromName: 'Hospeda Notificaciones' };

        // Act
        const result = buildEmailEnvDecoration(input);

        // Assert
        expect(result.fromName).toBe('Hospeda Notificaciones [STAGING]');
    });

    it('produces a subject prefix that ends in a space so subjects stay readable', () => {
        // Arrange
        const input = { deployEnv: 'preview', baseFromName: 'Hospeda' };

        // Act
        const { subjectPrefix } = buildEmailEnvDecoration(input);

        // Assert — concatenation must not glue the marker to the subject.
        expect(`${subjectPrefix}Tu plan se renueva`).toBe('[STAGING] Tu plan se renueva');
    });
});
