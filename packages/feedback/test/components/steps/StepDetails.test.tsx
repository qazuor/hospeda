import type { FeedbackEnvironment } from '@repo/schemas';
/**
 * Tests for the StepDetails component.
 *
 * Combines contract-level checks (import validation, prop type compliance,
 * embedded helper logic) with DOM render tests via @testing-library/react +
 * jsdom (e.g. the BETA-17 drag-and-drop upload behavior).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    StepDetails,
    type StepDetailsData,
    type StepDetailsProps
} from '../../../src/components/steps/StepDetails.js';
import { FEEDBACK_CONFIG, SEVERITY_LEVELS } from '../../../src/config/feedback.config.js';
import { FEEDBACK_STRINGS } from '../../../src/config/strings.js';

/** Minimal valid environment data for tests */
const makeEnvironment = (overrides: Partial<FeedbackEnvironment> = {}): FeedbackEnvironment => ({
    timestamp: new Date().toISOString(),
    appSource: 'admin',
    ...overrides
});

/** Minimal valid data for step 2 */
const makeData = (overrides: Partial<StepDetailsData> = {}): StepDetailsData => ({
    severity: undefined,
    stepsToReproduce: undefined,
    expectedResult: undefined,
    actualResult: undefined,
    ...overrides
});

describe('StepDetails', () => {
    it('should be a callable React function component', () => {
        expect(typeof StepDetails).toBe('function');
    });

    it('should export StepDetailsData and StepDetailsProps types (compile-time check via usage)', () => {
        const data: StepDetailsData = makeData();
        const props: StepDetailsProps = {
            data,
            onChange: vi.fn(),
            attachments: [],
            onAddAttachments: vi.fn(),
            onRemoveAttachment: vi.fn(),
            environment: makeEnvironment(),
            onEnvironmentChange: vi.fn(),
            onBack: vi.fn(),
            onSubmit: vi.fn(),
            isSubmitting: false
        };
        expect(props.data.severity).toBeUndefined();
    });

    it('should have all severity levels with correct ids', () => {
        const ids = SEVERITY_LEVELS.map((s) => s.id);
        expect(ids).toContain('critical');
        expect(ids).toContain('high');
        expect(ids).toContain('medium');
        expect(ids).toContain('low');
    });

    it('should have linearPriority for each severity level', () => {
        for (const level of SEVERITY_LEVELS) {
            expect(typeof level.linearPriority).toBe('number');
            expect(level.linearPriority).toBeGreaterThan(0);
        }
    });

    it('onChange callback accepts all StepDetailsData keys', () => {
        const calls: Array<[keyof StepDetailsData, unknown]> = [];
        const onChange = <K extends keyof StepDetailsData>(field: K, value: StepDetailsData[K]) => {
            calls.push([field, value]);
        };

        onChange('severity', 'high');
        onChange('stepsToReproduce', '1. Click here\n2. See error');
        onChange('expectedResult', 'Should work');
        onChange('actualResult', 'It crashed');

        expect(calls).toHaveLength(4);
        expect(calls[0]).toEqual(['severity', 'high']);
        expect(calls[1][0]).toBe('stepsToReproduce');
    });

    it('file upload: onAddAttachments receives File array', () => {
        const added: File[][] = [];
        const onAddAttachments = (files: File[]) => added.push(files);
        const file = new File(['data'], 'screenshot.png', { type: 'image/png' });

        onAddAttachments([file]);

        expect(added).toHaveLength(1);
        expect(added[0][0].name).toBe('screenshot.png');
    });

    it('file upload: onRemoveAttachment receives correct index', () => {
        const removed: number[] = [];
        const onRemoveAttachment = (index: number) => removed.push(index);

        onRemoveAttachment(0);
        onRemoveAttachment(2);

        expect(removed).toEqual([0, 2]);
    });

    it('FEEDBACK_CONFIG.maxAttachments is a positive integer', () => {
        expect(typeof FEEDBACK_CONFIG.maxAttachments).toBe('number');
        expect(FEEDBACK_CONFIG.maxAttachments).toBeGreaterThan(0);
    });

    it('FEEDBACK_CONFIG.maxFileSize is 10MB', () => {
        expect(FEEDBACK_CONFIG.maxFileSize).toBe(10_485_760);
    });

    it('FEEDBACK_CONFIG.allowedFileTypes includes common image formats', () => {
        const types = FEEDBACK_CONFIG.allowedFileTypes as readonly string[];
        expect(types).toContain('image/png');
        expect(types).toContain('image/jpeg');
        expect(types).toContain('image/webp');
    });

    it('collapsible tech details section strings are defined', () => {
        expect(FEEDBACK_STRINGS.techDetails.title).toBeTruthy();
        expect(FEEDBACK_STRINGS.techDetails.url).toBeTruthy();
        expect(FEEDBACK_STRINGS.techDetails.browser).toBeTruthy();
        expect(FEEDBACK_STRINGS.techDetails.os).toBeTruthy();
        expect(FEEDBACK_STRINGS.techDetails.viewport).toBeTruthy();
        expect(FEEDBACK_STRINGS.techDetails.version).toBeTruthy();
        expect(FEEDBACK_STRINGS.techDetails.consoleErrors).toBeTruthy();
    });

    it('onEnvironmentChange callback accepts all FeedbackEnvironment keys', () => {
        const changes: Array<[keyof FeedbackEnvironment, unknown]> = [];
        const onEnvironmentChange = <K extends keyof FeedbackEnvironment>(
            key: K,
            value: FeedbackEnvironment[K]
        ) => {
            changes.push([key, value]);
        };

        onEnvironmentChange('currentUrl', 'https://example.com/page');
        onEnvironmentChange('browser', 'Chrome 120');
        onEnvironmentChange('os', 'Windows 11');
        onEnvironmentChange('viewport', '1920x1080');
        onEnvironmentChange('deployVersion', 'v1.2.3');

        expect(changes).toHaveLength(5);
        expect(changes[0]).toEqual(['currentUrl', 'https://example.com/page']);
    });

    it('environment consoleErrors is an optional array of strings', () => {
        const env = makeEnvironment({ consoleErrors: ['TypeError: undefined', 'SyntaxError'] });
        expect(env.consoleErrors).toHaveLength(2);
        expect(typeof env.consoleErrors?.[0]).toBe('string');
    });

    it('onBack and onSubmit are callable function props', () => {
        const onBack = vi.fn();
        const onSubmit = vi.fn();

        onBack();
        onSubmit();

        expect(onBack).toHaveBeenCalledOnce();
        expect(onSubmit).toHaveBeenCalledOnce();
    });

    it('isSubmitting=true prop accepted (contract check)', () => {
        const props: Pick<StepDetailsProps, 'isSubmitting'> = { isSubmitting: true };
        expect(props.isSubmitting).toBe(true);
    });

    it('button labels match FEEDBACK_STRINGS', () => {
        expect(FEEDBACK_STRINGS.buttons.back).toBe('Volver');
        expect(FEEDBACK_STRINGS.buttons.submit).toBe('Enviar');
    });
});

const makeProps = (overrides: Partial<StepDetailsProps> = {}): StepDetailsProps => ({
    data: makeData(),
    onChange: vi.fn(),
    attachments: [],
    onAddAttachments: vi.fn(),
    onRemoveAttachment: vi.fn(),
    environment: makeEnvironment(),
    onEnvironmentChange: vi.fn(),
    onBack: vi.fn(),
    onSubmit: vi.fn(),
    isSubmitting: false,
    ...overrides
});

const getUploadZone = (): HTMLLabelElement =>
    screen.getByText(FEEDBACK_STRINGS.fields.uploadButton).closest('label') as HTMLLabelElement;

describe('StepDetails drag-and-drop upload (BETA-17)', () => {
    it('attaches a dropped valid image via onAddAttachments', () => {
        const onAddAttachments = vi.fn();
        render(<StepDetails {...makeProps({ onAddAttachments })} />);

        const file = new File(['data'], 'shot.png', { type: 'image/png' });
        fireEvent.drop(getUploadZone(), { dataTransfer: { files: [file] } });

        expect(onAddAttachments).toHaveBeenCalledTimes(1);
        expect(onAddAttachments.mock.calls[0]?.[0]?.[0]?.name).toBe('shot.png');
    });

    it('prevents the browser default on dragover (image is not opened in the tab)', () => {
        render(<StepDetails {...makeProps()} />);

        // fireEvent returns false when the event's default action was prevented.
        const notPrevented = fireEvent.dragOver(getUploadZone(), { dataTransfer: { files: [] } });

        expect(notPrevented).toBe(false);
    });

    it('prevents the browser default on drop', () => {
        render(<StepDetails {...makeProps()} />);

        const file = new File(['data'], 'shot.png', { type: 'image/png' });
        const notPrevented = fireEvent.drop(getUploadZone(), { dataTransfer: { files: [file] } });

        expect(notPrevented).toBe(false);
    });

    it('rejects a dropped file with a disallowed type (no attachment added)', () => {
        const onAddAttachments = vi.fn();
        render(<StepDetails {...makeProps({ onAddAttachments })} />);

        const pdf = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
        fireEvent.drop(getUploadZone(), { dataTransfer: { files: [pdf] } });

        expect(onAddAttachments).not.toHaveBeenCalled();
    });
});
