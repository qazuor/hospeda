import { describe, expect, it } from 'vitest';
import type {
    CreateEmailClientInput,
    EmailClient,
    EmailLayoutProps,
    ResetPasswordTemplateProps,
    SendEmailInput,
    SendEmailResult,
    VerifyEmailTemplateProps
} from '../src/index.js';
import {
    createEmailClient,
    EmailLayout,
    ResetPasswordTemplate,
    sendEmail,
    VerifyEmailTemplate
} from '../src/index.js';

/**
 * Barrel export tests for packages/email/src/index.ts.
 * Ensures all public API exports are defined and accessible.
 */
describe('email barrel exports', () => {
    it('should export createEmailClient function', () => {
        // Assert
        expect(createEmailClient).toBeDefined();
        expect(typeof createEmailClient).toBe('function');
    });

    it('should export sendEmail function', () => {
        // Assert
        expect(sendEmail).toBeDefined();
        expect(typeof sendEmail).toBe('function');
    });

    it('should export EmailLayout component', () => {
        // Assert
        expect(EmailLayout).toBeDefined();
        expect(typeof EmailLayout).toBe('function');
    });

    it('should export VerifyEmailTemplate component', () => {
        // Assert
        expect(VerifyEmailTemplate).toBeDefined();
        expect(typeof VerifyEmailTemplate).toBe('function');
    });

    it('should export ResetPasswordTemplate component', () => {
        // Assert
        expect(ResetPasswordTemplate).toBeDefined();
        expect(typeof ResetPasswordTemplate).toBe('function');
    });

    it('should export all expected type definitions', () => {
        // Arrange - verify type exports compile correctly by using satisfies
        const clientInput: CreateEmailClientInput = { apiKey: 'test' };
        const client = {} as EmailClient;
        const sendInput = {} as SendEmailInput;
        const sendResult = {} as SendEmailResult;
        const layoutProps = {} as EmailLayoutProps;
        const verifyProps = {} as VerifyEmailTemplateProps;
        const resetProps = {} as ResetPasswordTemplateProps;

        // Assert - all type imports resolved without compile errors
        expect(clientInput).toBeDefined();
        expect(client).toBeDefined();
        expect(sendInput).toBeDefined();
        expect(sendResult).toBeDefined();
        expect(layoutProps).toBeDefined();
        expect(verifyProps).toBeDefined();
        expect(resetProps).toBeDefined();
    });
});
