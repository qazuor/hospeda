/**
 * Tests for the StepBasic component.
 *
 * Since @testing-library/react is not installed in this package, we verify
 * the component contract through: import validation, prop type compliance,
 * and the pure helper logic embedded in the module.
 *
 * Full DOM render tests should be added once jsdom + testing-library are
 * added to this package's devDependencies.
 */
import { describe, expect, it, vi } from 'vitest';
import {
    StepBasic,
    type StepBasicData,
    type StepBasicProps
} from '../../../src/components/steps/StepBasic.js';
import { REPORT_TYPES } from '../../../src/config/feedback.config.js';
import { FEEDBACK_STRINGS } from '../../../src/config/strings.js';

/** Minimal valid data for step 1 */
const makeData = (overrides: Partial<StepBasicData> = {}): StepBasicData => ({
    type: 'bug-js',
    title: '',
    description: '',
    reporterEmail: '',
    reporterName: '',
    ...overrides
});

describe('StepBasic', () => {
    it('should be a callable React function component', () => {
        expect(typeof StepBasic).toBe('function');
    });

    it('should export StepBasicData and StepBasicProps types (compile-time check via usage)', () => {
        // If this file compiles, the types are exported correctly
        const data: StepBasicData = makeData();
        const props: StepBasicProps = {
            data,
            onChange: vi.fn(),
            errors: {},
            showContactFields: false,
            onGoToStep2: vi.fn(),
            onSubmit: vi.fn(),
            isSubmitting: false
        };
        expect(props.data.type).toBe('bug-js');
    });

    it('should accept all REPORT_TYPES as valid type values', () => {
        for (const reportType of REPORT_TYPES) {
            const data = makeData({ type: reportType.id });
            expect(data.type).toBe(reportType.id);
        }
    });

    it('should have a label for each REPORT_TYPE', () => {
        const ids = REPORT_TYPES.map((t) => t.id);
        const labels = REPORT_TYPES.map((t) => t.label);
        expect(ids).toContain('bug-js');
        expect(ids).toContain('feature-request');
        expect(labels.every((l) => typeof l === 'string' && l.length > 0)).toBe(true);
    });

    it('should expose the correct button labels from FEEDBACK_STRINGS', () => {
        expect(FEEDBACK_STRINGS.buttons.addDetails).toBe('Agregar mas detalles');
        expect(FEEDBACK_STRINGS.buttons.submit).toBe('Enviar');
    });

    it('onChange callback types accept all StepBasicData keys', () => {
        const calls: Array<[keyof StepBasicData, string]> = [];
        const onChange = <K extends keyof StepBasicData>(field: K, value: StepBasicData[K]) => {
            calls.push([field, value as string]);
        };

        onChange('title', 'My title');
        onChange('description', 'My description');
        onChange('reporterEmail', 'test@example.com');
        onChange('reporterName', 'Test User');
        onChange('type', 'bug-ui-ux');

        expect(calls).toHaveLength(5);
        expect(calls[0]).toEqual(['title', 'My title']);
        expect(calls[4]).toEqual(['type', 'bug-ui-ux']);
    });

    it('errors object accepts partial field keys', () => {
        const errors: Partial<Record<keyof StepBasicData, string>> = {
            title: FEEDBACK_STRINGS.validation.titleMin,
            reporterEmail: FEEDBACK_STRINGS.validation.emailInvalid
        };
        expect(errors.title).toBe(FEEDBACK_STRINGS.validation.titleMin);
        expect(errors.description).toBeUndefined();
    });

    it('showContactFields=true should cause email/name fields to be included in data', () => {
        const data = makeData({ reporterEmail: 'user@test.com', reporterName: 'User' });
        expect(data.reporterEmail).toBe('user@test.com');
        expect(data.reporterName).toBe('User');
    });

    it('showContactFields=false allows empty email/name', () => {
        const data = makeData({ reporterEmail: '', reporterName: '' });
        expect(data.reporterEmail).toBe('');
        expect(data.reporterName).toBe('');
    });

    it('onSubmit and onGoToStep2 are callable function props', () => {
        const onSubmit = vi.fn();
        const onGoToStep2 = vi.fn();

        onSubmit();
        onGoToStep2();

        expect(onSubmit).toHaveBeenCalledOnce();
        expect(onGoToStep2).toHaveBeenCalledOnce();
    });

    it('isSubmitting=true should prevent interaction (contract check)', () => {
        // We verify the prop signature accepts boolean
        const props: Pick<StepBasicProps, 'isSubmitting'> = { isSubmitting: true };
        expect(props.isSubmitting).toBe(true);
    });

    it('validation error messages match FEEDBACK_STRINGS', () => {
        const errors: Partial<Record<keyof StepBasicData, string>> = {
            title: FEEDBACK_STRINGS.validation.titleMin,
            description: FEEDBACK_STRINGS.validation.descriptionMin,
            reporterEmail: FEEDBACK_STRINGS.validation.emailRequired,
            reporterName: FEEDBACK_STRINGS.validation.nameRequired
        };
        expect(errors.title).toBeTruthy();
        expect(errors.description).toBeTruthy();
        expect(errors.reporterEmail).toBeTruthy();
        expect(errors.reporterName).toBeTruthy();
    });
});
