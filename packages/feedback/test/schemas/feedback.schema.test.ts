import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    APP_SOURCE_IDS,
    REPORT_TYPE_IDS,
    SEVERITY_IDS,
    feedbackEnvironmentSchema,
    feedbackErrorInfoSchema,
    feedbackFormSchema
} from '../../src/schemas/feedback.schema.js';
import { feedbackApiSchema } from '../../src/schemas/feedback.schema.server.js';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

/**
 * Minimal valid payload that satisfies all required fields of feedbackFormSchema.
 * Use spread to override individual fields in test cases.
 */
const validPayload = {
    type: 'bug-js',
    title: 'Test bug report title',
    description: 'This is a test description for the bug report.',
    reporterEmail: 'test@example.com',
    reporterName: 'Test User',
    environment: {
        timestamp: new Date().toISOString(),
        appSource: 'web'
    }
} as const;

// ─── feedbackErrorInfoSchema ───────────────────────────────────────────────────

describe('feedbackErrorInfoSchema', () => {
    describe('valid data', () => {
        it('should accept message with stack', () => {
            // Arrange
            const input = {
                message: 'TypeError: Cannot read property of undefined',
                stack: 'TypeError: Cannot read property...\n  at Component.render (App.tsx:42)'
            };

            // Act
            const result = feedbackErrorInfoSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept message without stack (stack is optional)', () => {
            // Arrange
            const input = { message: 'Something went wrong' };

            // Act
            const result = feedbackErrorInfoSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('invalid data', () => {
        it('should reject missing message', () => {
            // Arrange
            const input = { stack: 'some stack trace' };

            // Act
            const result = feedbackErrorInfoSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(ZodError);
        });
    });
});

// ─── feedbackEnvironmentSchema ─────────────────────────────────────────────────

describe('feedbackEnvironmentSchema', () => {
    describe('valid data', () => {
        it('should accept minimal environment with only required fields', () => {
            // Arrange
            const input = {
                timestamp: new Date().toISOString(),
                appSource: 'web'
            };

            // Act
            const result = feedbackEnvironmentSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept complete environment with all optional fields', () => {
            // Arrange
            const input = {
                currentUrl: 'https://hospeda.ar/es/alojamientos',
                browser: 'Chrome 124',
                os: 'macOS 14',
                viewport: '1440x900',
                timestamp: new Date().toISOString(),
                appSource: 'admin',
                deployVersion: '1.2.3',
                userId: 'user-abc-123',
                consoleErrors: ['Error: failed to fetch', 'Warning: unknown prop'],
                errorInfo: {
                    message: 'ReferenceError: foo is not defined',
                    stack: 'ReferenceError...\n  at eval'
                }
            };

            // Act
            const result = feedbackEnvironmentSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept all valid appSource values', () => {
            for (const appSource of APP_SOURCE_IDS) {
                // Arrange
                const input = { timestamp: new Date().toISOString(), appSource };

                // Act
                const result = feedbackEnvironmentSchema.safeParse(input);

                // Assert
                expect(result.success).toBe(true);
            }
        });

        it('should accept consoleErrors as an array of strings', () => {
            // Arrange
            const input = {
                timestamp: new Date().toISOString(),
                appSource: 'web',
                consoleErrors: ['TypeError: x is undefined', 'ReferenceError: y is not defined']
            };

            // Act
            const result = feedbackEnvironmentSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.consoleErrors).toHaveLength(2);
            }
        });

        it('should accept errorInfo as optional object', () => {
            // Arrange
            const withErrorInfo = {
                timestamp: new Date().toISOString(),
                appSource: 'web',
                errorInfo: { message: 'Boom', stack: 'at fn (file.ts:1)' }
            };
            const withoutErrorInfo = {
                timestamp: new Date().toISOString(),
                appSource: 'web'
            };

            // Act & Assert
            expect(feedbackEnvironmentSchema.safeParse(withErrorInfo).success).toBe(true);
            expect(feedbackEnvironmentSchema.safeParse(withoutErrorInfo).success).toBe(true);
        });
    });

    describe('invalid data', () => {
        it('should reject missing timestamp', () => {
            // Arrange
            const input = { appSource: 'web' };

            // Act
            const result = feedbackEnvironmentSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(ZodError);
        });

        it('should reject missing appSource', () => {
            // Arrange
            const input = { timestamp: new Date().toISOString() };

            // Act
            const result = feedbackEnvironmentSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject invalid appSource value', () => {
            // Arrange
            const input = {
                timestamp: new Date().toISOString(),
                appSource: 'mobile' // not in APP_SOURCE_IDS
            };

            // Act
            const result = feedbackEnvironmentSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject currentUrl that is not a valid URL', () => {
            // Arrange
            const input = {
                timestamp: new Date().toISOString(),
                appSource: 'web',
                currentUrl: 'not-a-url'
            };

            // Act
            const result = feedbackEnvironmentSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject non-datetime timestamp string', () => {
            // Arrange
            const input = {
                timestamp: '15/03/2025', // not ISO 8601 datetime
                appSource: 'web'
            };

            // Act
            const result = feedbackEnvironmentSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

// ─── feedbackFormSchema ────────────────────────────────────────────────────────

describe('feedbackFormSchema', () => {
    describe('valid data', () => {
        it('should accept a valid minimal payload (required fields only)', () => {
            // Arrange
            const input = { ...validPayload };

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a complete payload with all optional fields', () => {
            // Arrange
            const input = {
                ...validPayload,
                severity: 'high',
                stepsToReproduce: '1. Open the page\n2. Click the button\n3. See error',
                expectedResult: 'The button should open the modal.',
                actualResult: 'The page crashes instead.',
                environment: {
                    ...validPayload.environment,
                    currentUrl: 'https://hospeda.ar/es/alojamientos',
                    browser: 'Firefox 125',
                    os: 'Windows 11',
                    viewport: '1920x1080',
                    deployVersion: '2.0.0',
                    userId: 'user-xyz',
                    consoleErrors: ['Error: net::ERR_FAILED'],
                    errorInfo: {
                        message: 'ReferenceError: document is not defined',
                        stack: 'at render (Component.tsx:10)'
                    }
                }
            };

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept all valid type values', () => {
            for (const type of REPORT_TYPE_IDS) {
                // Arrange
                const input = { ...validPayload, type };

                // Act
                const result = feedbackFormSchema.safeParse(input);

                // Assert
                expect(result.success).toBe(true);
            }
        });

        it('should accept all valid severity values when provided', () => {
            for (const severity of SEVERITY_IDS) {
                // Arrange
                const input = { ...validPayload, severity };

                // Act
                const result = feedbackFormSchema.safeParse(input);

                // Assert
                expect(result.success).toBe(true);
            }
        });

        it('should pass when optional fields are omitted', () => {
            // Arrange — only required fields present
            const input = {
                type: 'improvement',
                title: 'Improve search speed',
                description: 'The search takes more than 5 seconds to return results.',
                reporterEmail: 'user@example.com',
                reporterName: 'Maria Garcia',
                environment: {
                    timestamp: new Date().toISOString(),
                    appSource: 'web'
                }
            };

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.severity).toBeUndefined();
                expect(result.data.stepsToReproduce).toBeUndefined();
                expect(result.data.expectedResult).toBeUndefined();
                expect(result.data.actualResult).toBeUndefined();
            }
        });
    });

    describe('missing required fields', () => {
        it('should reject when type is missing', () => {
            // Arrange
            const { type: _type, ...input } = validPayload;

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(ZodError);
        });

        it('should reject when title is missing', () => {
            // Arrange
            const { title: _title, ...input } = validPayload;

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject when description is missing', () => {
            // Arrange
            const { description: _description, ...input } = validPayload;

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject when reporterEmail is missing', () => {
            // Arrange
            const { reporterEmail: _email, ...input } = validPayload;

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject when reporterName is missing', () => {
            // Arrange
            const { reporterName: _name, ...input } = validPayload;

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject when environment is missing', () => {
            // Arrange
            const { environment: _env, ...input } = validPayload;

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject when environment.timestamp is missing', () => {
            // Arrange
            const input = {
                ...validPayload,
                environment: { appSource: 'web' }
            };

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject when environment.appSource is missing', () => {
            // Arrange
            const input = {
                ...validPayload,
                environment: { timestamp: new Date().toISOString() }
            };

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('enum validation', () => {
        it('should reject invalid type value', () => {
            // Arrange
            const input = { ...validPayload, type: 'crash-report' }; // not in REPORT_TYPE_IDS

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject invalid severity value', () => {
            // Arrange
            const input = { ...validPayload, severity: 'blocker' }; // not in SEVERITY_IDS

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject invalid appSource value', () => {
            // Arrange
            const input = {
                ...validPayload,
                environment: {
                    ...validPayload.environment,
                    appSource: 'mobile' // not in APP_SOURCE_IDS
                }
            };

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('length constraints — title', () => {
        it('should accept title at minimum length (5 chars)', () => {
            // Arrange
            const input = { ...validPayload, title: 'Short' }; // exactly 5 chars

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject title shorter than 5 characters', () => {
            // Arrange
            const input = { ...validPayload, title: 'Bug' }; // 3 chars

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should accept title at maximum length (200 chars)', () => {
            // Arrange
            const input = { ...validPayload, title: 'A'.repeat(200) };

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject title longer than 200 characters', () => {
            // Arrange
            const input = { ...validPayload, title: 'A'.repeat(201) };

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('length constraints — description', () => {
        it('should accept description at minimum length (10 chars)', () => {
            // Arrange
            const input = { ...validPayload, description: '1234567890' }; // exactly 10 chars

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject description shorter than 10 characters', () => {
            // Arrange
            const input = { ...validPayload, description: 'Too short' }; // 9 chars

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should accept description at maximum length (5000 chars)', () => {
            // Arrange
            const input = { ...validPayload, description: 'D'.repeat(5000) };

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject description longer than 5000 characters', () => {
            // Arrange
            const input = { ...validPayload, description: 'D'.repeat(5001) };

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('length constraints — optional step-2 fields', () => {
        it('should reject stepsToReproduce longer than 3000 characters', () => {
            // Arrange
            const input = { ...validPayload, stepsToReproduce: 'S'.repeat(3001) };

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should accept stepsToReproduce at exactly 3000 characters', () => {
            // Arrange
            const input = { ...validPayload, stepsToReproduce: 'S'.repeat(3000) };

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject expectedResult longer than 1000 characters', () => {
            // Arrange
            const input = { ...validPayload, expectedResult: 'E'.repeat(1001) };

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject actualResult longer than 1000 characters', () => {
            // Arrange
            const input = { ...validPayload, actualResult: 'A'.repeat(1001) };

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('length constraints — reporterName', () => {
        it('should accept reporterName at minimum length (2 chars)', () => {
            // Arrange
            const input = { ...validPayload, reporterName: 'Jo' };

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject reporterName shorter than 2 characters', () => {
            // Arrange
            const input = { ...validPayload, reporterName: 'J' };

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should accept reporterName at maximum length (100 chars)', () => {
            // Arrange
            const input = { ...validPayload, reporterName: 'N'.repeat(100) };

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject reporterName longer than 100 characters', () => {
            // Arrange
            const input = { ...validPayload, reporterName: 'N'.repeat(101) };

            // Act
            const result = feedbackFormSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('email validation', () => {
        it('should accept valid email addresses', () => {
            const validEmails = [
                'user@example.com',
                'user+tag@subdomain.example.org',
                'first.last@hospeda.ar'
            ];

            for (const reporterEmail of validEmails) {
                // Arrange
                const input = { ...validPayload, reporterEmail };

                // Act
                const result = feedbackFormSchema.safeParse(input);

                // Assert
                expect(result.success).toBe(true);
            }
        });

        it('should reject invalid email addresses', () => {
            const invalidEmails = [
                'not-an-email',
                'missing@domain',
                '@nodomain.com',
                'spaces in@email.com',
                ''
            ];

            for (const reporterEmail of invalidEmails) {
                // Arrange
                const input = { ...validPayload, reporterEmail };

                // Act
                const result = feedbackFormSchema.safeParse(input);

                // Assert
                expect(result.success).toBe(false);
            }
        });
    });

    describe('parsed output shape', () => {
        it('should return correct field values after parsing', () => {
            // Arrange
            const input = {
                ...validPayload,
                severity: 'medium' as const
            };

            // Act
            const result = feedbackFormSchema.parse(input);

            // Assert
            expect(result.type).toBe('bug-js');
            expect(result.title).toBe('Test bug report title');
            expect(result.description).toBe('This is a test description for the bug report.');
            expect(result.severity).toBe('medium');
            expect(result.reporterEmail).toBe('test@example.com');
            expect(result.reporterName).toBe('Test User');
            expect(result.environment.appSource).toBe('web');
        });
    });
});

// ─── feedbackApiSchema ─────────────────────────────────────────────────────────

describe('feedbackApiSchema', () => {
    it('should be equivalent to feedbackFormSchema and accept the same valid payload', () => {
        // Arrange
        const input = { ...validPayload };

        // Act
        const result = feedbackApiSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should reject the same invalid payloads as feedbackFormSchema', () => {
        // Arrange — missing required type field
        const { type: _type, ...input } = validPayload;

        // Act
        const result = feedbackApiSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });
});
