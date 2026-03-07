import { describe, expect, it } from 'vitest';
import { FEEDBACK_STRINGS } from '../../src/config/strings.js';

describe('FEEDBACK_STRINGS', () => {
    describe('top-level keys', () => {
        it('should have all required top-level sections', () => {
            // Arrange
            const expectedSections = [
                'fab',
                'form',
                'fields',
                'buttons',
                'techDetails',
                'success',
                'errorBoundary',
                'validation',
                'rateLimit'
            ];

            // Assert
            for (const section of expectedSections) {
                expect(FEEDBACK_STRINGS).toHaveProperty(section);
            }
        });
    });

    describe('fab', () => {
        it('should have a non-empty tooltip string', () => {
            expect(typeof FEEDBACK_STRINGS.fab.tooltip).toBe('string');
            expect(FEEDBACK_STRINGS.fab.tooltip.length).toBeGreaterThan(0);
        });
    });

    describe('form', () => {
        it('should have a non-empty title', () => {
            expect(FEEDBACK_STRINGS.form.title.length).toBeGreaterThan(0);
        });

        it('should have a non-empty step2Title', () => {
            expect(FEEDBACK_STRINGS.form.step2Title.length).toBeGreaterThan(0);
        });
    });

    describe('fields', () => {
        const fieldKeys = [
            'type',
            'title',
            'titlePlaceholder',
            'description',
            'descriptionPlaceholder',
            'email',
            'name',
            'severity',
            'stepsToReproduce',
            'stepsPlaceholder',
            'expectedResult',
            'actualResult',
            'attachments',
            'uploadButton'
        ] as const;

        for (const key of fieldKeys) {
            it(`should have a non-empty string for fields.${key}`, () => {
                expect(FEEDBACK_STRINGS.fields[key].length).toBeGreaterThan(0);
            });
        }
    });

    describe('buttons', () => {
        const buttonKeys = [
            'submit',
            'addDetails',
            'back',
            'close',
            'submitAnother',
            'reportError',
            'reloadPage'
        ] as const;

        for (const key of buttonKeys) {
            it(`should have a non-empty string for buttons.${key}`, () => {
                expect(FEEDBACK_STRINGS.buttons[key].length).toBeGreaterThan(0);
            });
        }
    });

    describe('techDetails', () => {
        const techKeys = [
            'title',
            'url',
            'browser',
            'os',
            'viewport',
            'version',
            'consoleErrors'
        ] as const;

        for (const key of techKeys) {
            it(`should have a non-empty string for techDetails.${key}`, () => {
                expect(FEEDBACK_STRINGS.techDetails[key].length).toBeGreaterThan(0);
            });
        }
    });

    describe('success', () => {
        const successKeys = [
            'title',
            'message',
            'issueLabel',
            'fallbackMessage',
            'thanks'
        ] as const;

        for (const key of successKeys) {
            it(`should have a non-empty string for success.${key}`, () => {
                expect(FEEDBACK_STRINGS.success[key].length).toBeGreaterThan(0);
            });
        }
    });

    describe('errorBoundary', () => {
        it('should have a non-empty title', () => {
            expect(FEEDBACK_STRINGS.errorBoundary.title.length).toBeGreaterThan(0);
        });

        it('should have a non-empty message', () => {
            expect(FEEDBACK_STRINGS.errorBoundary.message.length).toBeGreaterThan(0);
        });
    });

    describe('validation', () => {
        const validationKeys = [
            'titleMin',
            'titleMax',
            'descriptionMin',
            'descriptionMax',
            'emailRequired',
            'emailInvalid',
            'nameRequired'
        ] as const;

        for (const key of validationKeys) {
            it(`should have a non-empty string for validation.${key}`, () => {
                expect(FEEDBACK_STRINGS.validation[key].length).toBeGreaterThan(0);
            });
        }
    });

    describe('rateLimit', () => {
        it('should have a non-empty message', () => {
            expect(FEEDBACK_STRINGS.rateLimit.message.length).toBeGreaterThan(0);
        });
    });

    describe('language check (no English button/submit labels)', () => {
        it('should not use English word "Submit" as a button label', () => {
            // The Spanish equivalent is "Enviar"
            expect(FEEDBACK_STRINGS.buttons.submit).not.toBe('Submit');
        });

        it('should not use English word "Close" as a button label', () => {
            expect(FEEDBACK_STRINGS.buttons.close).not.toBe('Close');
        });

        it('should not use English word "Back" as a button label', () => {
            expect(FEEDBACK_STRINGS.buttons.back).not.toBe('Back');
        });

        it('should use Spanish "Enviar" for the submit button', () => {
            expect(FEEDBACK_STRINGS.buttons.submit).toBe('Enviar');
        });

        it('should use Spanish "Cerrar" for the close button', () => {
            expect(FEEDBACK_STRINGS.buttons.close).toBe('Cerrar');
        });

        it('should use Spanish "Volver" for the back button', () => {
            expect(FEEDBACK_STRINGS.buttons.back).toBe('Volver');
        });
    });
});
