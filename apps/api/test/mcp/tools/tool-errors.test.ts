/**
 * HOS-2184 T-012 — Spanish mapping of tool errors.
 *
 * @module test/mcp/tools/tool-errors
 */

import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    formatValidationMessage,
    TOOL_NOT_FOUND_MESSAGE,
    TOOL_UNEXPECTED_ERROR_MESSAGE,
    toToolFailure,
    unexpectedToolFailure
} from '../../../src/mcp/tools/tool-errors';

const INTERNAL = 'Accommodation 7c1d not found in table accommodations (SELECT ...)';

describe('toToolFailure', () => {
    it.each([
        [ServiceErrorCode.NOT_FOUND, TOOL_NOT_FOUND_MESSAGE, 'denied'],
        [ServiceErrorCode.GONE, TOOL_NOT_FOUND_MESSAGE, 'denied'],
        [
            ServiceErrorCode.FORBIDDEN,
            'Tu cuenta no tiene permiso para hacer esta acción.',
            'denied'
        ],
        [
            ServiceErrorCode.UNAUTHORIZED,
            'Tu conexión con Hospeda venció o fue revocada. Volvé a conectar tu cuenta.',
            'denied'
        ],
        [
            ServiceErrorCode.ENTITLEMENT_REQUIRED,
            'Tu plan de Hospeda no incluye esta acción.',
            'denied'
        ],
        [
            ServiceErrorCode.LIMIT_REACHED,
            'Llegaste al límite de tu plan para esta acción.',
            'denied'
        ],
        [
            ServiceErrorCode.QUOTA_EXCEEDED,
            'Hiciste demasiadas solicitudes seguidas. Esperá un momento y volvé a intentar.',
            'denied'
        ],
        [
            'RATE_LIMIT_EXCEEDED' as const,
            'Hiciste demasiadas solicitudes seguidas. Esperá un momento y volvé a intentar.',
            'denied'
        ],
        [
            ServiceErrorCode.ALREADY_EXISTS,
            'Eso ya existe en Hospeda; no hizo falta crearlo de nuevo.',
            'error'
        ],
        [
            ServiceErrorCode.SERVICE_UNAVAILABLE,
            'Un servicio de Hospeda no está disponible en este momento. Probá de nuevo en unos minutos.',
            'error'
        ]
    ])('maps %s to its Spanish message (%s) as %s', (code, message, kind) => {
        // Act
        const failure = toToolFailure({ error: { code, message: INTERNAL } });

        // Assert
        expect(failure).toEqual({
            kind,
            code,
            message,
            requiresReauthentication: code === ServiceErrorCode.UNAUTHORIZED,
            unexpected: false
        });
    });

    it('maps EMAIL_NOT_VERIFIED to the verification message', () => {
        // Act
        const failure = toToolFailure({
            error: { code: ServiceErrorCode.EMAIL_NOT_VERIFIED, message: INTERNAL }
        });

        // Assert
        expect(failure.kind).toBe('denied');
        expect(failure.message).toMatch(/^Tenés que verificar tu email en Hospeda/);
        expect(failure.requiresReauthentication).toBe(false);
    });

    it('flags only UNAUTHORIZED as requiring re-authentication', () => {
        // Act
        const codes = Object.values(ServiceErrorCode).filter(
            (code) => toToolFailure({ error: { code, message: '' } }).requiresReauthentication
        );

        // Assert
        expect(codes).toEqual([ServiceErrorCode.UNAUTHORIZED]);
    });

    it.each([
        ServiceErrorCode.INTERNAL_ERROR,
        ServiceErrorCode.CONFIGURATION_ERROR,
        ServiceErrorCode.NOT_IMPLEMENTED,
        ServiceErrorCode.PLAN_DISABLED
    ])('answers %s with the generic message and flags it unexpected', (code) => {
        // Act
        const failure = toToolFailure({ error: { code, message: INTERNAL } });

        // Assert
        expect(failure).toMatchObject({
            kind: 'error',
            message: TOOL_UNEXPECTED_ERROR_MESSAGE,
            unexpected: true
        });
    });

    it('never shows the internal message for any code', () => {
        // Act
        const leaked = Object.values(ServiceErrorCode).filter((code) =>
            toToolFailure({ error: { code, message: INTERNAL } }).message.includes('7c1d')
        );

        // Assert
        expect(leaked).toEqual([]);
    });

    it('lists field details for a VALIDATION_ERROR with Zod issues', () => {
        // Act
        const failure = toToolFailure({
            error: {
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: INTERNAL,
                details: [
                    { path: ['contactInfo', 'website'], message: 'Invalid URL' },
                    { path: ['description'], message: 'Too short' }
                ]
            }
        });

        // Assert
        expect(failure).toEqual({
            kind: 'error',
            code: ServiceErrorCode.VALIDATION_ERROR,
            message:
                'Los datos enviados no son válidos: campo «contactInfo.website»: Invalid URL; campo «description»: Too short.',
            requiresReauthentication: false,
            unexpected: false
        });
    });

    it('prefers a tool reason message over the code message', () => {
        // Act
        const failure = toToolFailure({
            error: {
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: 'Message body contains content that is not allowed',
                reason: 'MESSAGE_CONTENT_BLOCKED'
            },
            reasonMessages: { MESSAGE_CONTENT_BLOCKED: 'El mensaje tiene contenido no permitido.' }
        });

        // Assert
        expect(failure.message).toBe('El mensaje tiene contenido no permitido.');
        expect(failure.kind).toBe('error');
    });

    it('ignores a reason the tool has no message for', () => {
        // Act
        const failure = toToolFailure({
            error: { code: ServiceErrorCode.NOT_FOUND, message: INTERNAL, reason: 'OTHER' },
            reasonMessages: { MESSAGE_CONTENT_BLOCKED: 'x' }
        });

        // Assert
        expect(failure.message).toBe(TOOL_NOT_FOUND_MESSAGE);
    });
});

describe('formatValidationMessage', () => {
    it('reads a Zod flatten() result', () => {
        expect(
            formatValidationMessage({
                details: { formErrors: [], fieldErrors: { pageSize: ['Too big'] } }
            })
        ).toBe('Los datos enviados no son válidos: campo «pageSize»: Too big.');
    });

    it('reads { issues }', () => {
        expect(
            formatValidationMessage({ details: { issues: [{ path: [], message: 'Bad input' }] } })
        ).toBe('Los datos enviados no son válidos: Bad input.');
    });

    it('reads { field } without a message', () => {
        expect(formatValidationMessage({ details: { field: 'slug' } })).toBe(
            'Los datos enviados no son válidos: campo «slug»: valor inválido.'
        );
    });

    it('falls back to the base sentence for unknown details', () => {
        expect(formatValidationMessage({ details: 'free text' })).toBe(
            'Los datos enviados no son válidos.'
        );
    });

    it('caps the number of listed fields at ten', () => {
        // Arrange
        const details = Array.from({ length: 15 }, (_, i) => ({ path: [`f${i}`], message: 'm' }));

        // Act
        const message = formatValidationMessage({ details });

        // Assert
        expect(message.match(/campo «/g)).toHaveLength(10);
    });
});

describe('unexpectedToolFailure', () => {
    it('is generic and flagged unexpected', () => {
        expect(unexpectedToolFailure()).toEqual({
            kind: 'error',
            code: 'UNEXPECTED',
            message: TOOL_UNEXPECTED_ERROR_MESSAGE,
            requiresReauthentication: false,
            unexpected: true
        });
    });
});
