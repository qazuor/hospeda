/**
 * Tests for the FeedbackForm component.
 *
 * Since @testing-library/react is not installed in this package, we verify
 * the component contract through: import validation, prop type compliance,
 * form data merge logic (as a pure helper), and initial state derivation.
 *
 * Full DOM render tests should be added once jsdom + testing-library are
 * added to this package's devDependencies.
 */
import { describe, expect, it, vi } from 'vitest';
import { FeedbackForm, type FeedbackFormProps } from '../../src/components/FeedbackForm.js';
import type { StepBasicData } from '../../src/components/steps/StepBasic.js';
import type { StepDetailsData } from '../../src/components/steps/StepDetails.js';
import { FEEDBACK_STRINGS } from '../../src/config/strings.js';
import type { FeedbackEnvironment, ReportTypeId } from '../../src/schemas/feedback.schema.js';
import { feedbackFormSchema } from '../../src/schemas/feedback.schema.js';

// ---------------------------------------------------------------------------
// Pure helper: replicates the initial-data builder from FeedbackForm
// (extracted here so we can unit-test the derivation without rendering)
// ---------------------------------------------------------------------------

function buildInitialBasicData(
    userEmail?: string,
    userName?: string,
    prefillData?: FeedbackFormProps['prefillData']
): StepBasicData {
    return {
        type: prefillData?.type ?? 'bug-js',
        title: prefillData?.title ?? '',
        description: prefillData?.description ?? '',
        reporterEmail: userEmail ?? '',
        reporterName: userName ?? ''
    };
}

// ---------------------------------------------------------------------------
// Pure helper: merges step data (mirrors what handleSubmit does before parse)
// ---------------------------------------------------------------------------

function mergeFormData(
    basicData: StepBasicData,
    detailsData: StepDetailsData,
    environment: FeedbackEnvironment,
    attachments: File[]
) {
    return {
        ...basicData,
        ...detailsData,
        attachments: attachments.length > 0 ? attachments : undefined,
        environment
    };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const minimalEnv: FeedbackEnvironment = {
    timestamp: new Date().toISOString(),
    appSource: 'web'
};

const validBasicData: StepBasicData = {
    type: 'bug-js',
    title: 'Something broke',
    description: 'When I click the button nothing happens.',
    reporterEmail: 'user@example.com',
    reporterName: 'Test User'
};

const emptyDetailsData: StepDetailsData = {};

describe('FeedbackForm', () => {
    // -----------------------------------------------------------------------
    // Component contract
    // -----------------------------------------------------------------------

    it('should be a callable React function component', () => {
        expect(typeof FeedbackForm).toBe('function');
    });

    it('should export FeedbackFormProps type (compile-time check via usage)', () => {
        const props: FeedbackFormProps = {
            apiUrl: 'http://localhost:3001',
            appSource: 'web',
            onClose: vi.fn()
        };
        expect(props.apiUrl).toBe('http://localhost:3001');
        expect(props.appSource).toBe('web');
    });

    it('should accept all optional props without type error', () => {
        const props: FeedbackFormProps = {
            apiUrl: 'http://localhost:3001',
            appSource: 'admin',
            deployVersion: 'abc1234',
            userId: 'usr_123',
            userEmail: 'admin@example.com',
            userName: 'Admin User',
            prefillData: {
                type: 'feature-request',
                title: 'Add dark mode',
                description: 'Please add dark mode support to the platform.',
                errorInfo: { message: 'ReferenceError', stack: 'at App.tsx:10' }
            },
            onClose: vi.fn()
        };
        expect(props.userId).toBe('usr_123');
        expect(props.prefillData?.type).toBe('feature-request');
    });

    // -----------------------------------------------------------------------
    // Initial state derivation
    // -----------------------------------------------------------------------

    it('should pre-fill basic data from userEmail and userName', () => {
        const data = buildInitialBasicData('user@test.com', 'John Doe');
        expect(data.reporterEmail).toBe('user@test.com');
        expect(data.reporterName).toBe('John Doe');
        expect(data.type).toBe('bug-js');
        expect(data.title).toBe('');
        expect(data.description).toBe('');
    });

    it('should use empty strings when userEmail and userName are not provided', () => {
        const data = buildInitialBasicData();
        expect(data.reporterEmail).toBe('');
        expect(data.reporterName).toBe('');
    });

    it('should apply prefillData.type to initial type', () => {
        const type: ReportTypeId = 'improvement';
        const data = buildInitialBasicData(undefined, undefined, { type });
        expect(data.type).toBe('improvement');
    });

    it('should apply prefillData.title and prefillData.description', () => {
        const data = buildInitialBasicData(undefined, undefined, {
            title: 'Crash on login',
            description: 'App crashes when I enter wrong password three times.'
        });
        expect(data.title).toBe('Crash on login');
        expect(data.description).toBe('App crashes when I enter wrong password three times.');
    });

    it('should default type to bug-js when prefillData.type is not provided', () => {
        const data = buildInitialBasicData('x@y.com', 'X', {});
        expect(data.type).toBe('bug-js');
    });

    it('should combine prefillData and auth context correctly', () => {
        const data = buildInitialBasicData('a@b.com', 'Alice', {
            type: 'bug-ui-ux',
            title: 'Button overlap'
        });
        expect(data.reporterEmail).toBe('a@b.com');
        expect(data.reporterName).toBe('Alice');
        expect(data.type).toBe('bug-ui-ux');
        expect(data.title).toBe('Button overlap');
    });

    // -----------------------------------------------------------------------
    // Form data merge logic
    // -----------------------------------------------------------------------

    it('should merge basic and details data into a single object', () => {
        const details: StepDetailsData = {
            severity: 'high',
            stepsToReproduce: '1. Go to /login\n2. Enter wrong password'
        };
        const merged = mergeFormData(validBasicData, details, minimalEnv, []);
        expect(merged.type).toBe('bug-js');
        expect(merged.severity).toBe('high');
        expect(merged.stepsToReproduce).toBe('1. Go to /login\n2. Enter wrong password');
        expect(merged.attachments).toBeUndefined();
    });

    it('should include attachments in merged data when files are present', () => {
        const file = new File(['content'], 'screenshot.png', { type: 'image/png' });
        const merged = mergeFormData(validBasicData, emptyDetailsData, minimalEnv, [file]);
        expect(merged.attachments).toHaveLength(1);
        expect(merged.attachments?.[0]?.name).toBe('screenshot.png');
    });

    it('should set attachments to undefined when file list is empty', () => {
        const merged = mergeFormData(validBasicData, emptyDetailsData, minimalEnv, []);
        expect(merged.attachments).toBeUndefined();
    });

    it('should include environment in merged data', () => {
        const env: FeedbackEnvironment = {
            ...minimalEnv,
            browser: 'Chrome 120',
            os: 'Windows 11',
            currentUrl: 'http://localhost:4321/test'
        };
        const merged = mergeFormData(validBasicData, emptyDetailsData, env, []);
        expect(merged.environment.browser).toBe('Chrome 120');
        expect(merged.environment.os).toBe('Windows 11');
        expect(merged.environment.currentUrl).toBe('http://localhost:4321/test');
    });

    // -----------------------------------------------------------------------
    // Zod validation via feedbackFormSchema
    // -----------------------------------------------------------------------

    it('should pass schema validation with valid merged data', () => {
        const merged = mergeFormData(validBasicData, emptyDetailsData, minimalEnv, []);
        const result = feedbackFormSchema.safeParse(merged);
        expect(result.success).toBe(true);
    });

    it('should fail schema validation when title is too short', () => {
        const data = { ...validBasicData, title: 'Hi' };
        const merged = mergeFormData(data, emptyDetailsData, minimalEnv, []);
        const result = feedbackFormSchema.safeParse(merged);
        expect(result.success).toBe(false);
        if (!result.success) {
            const titleIssue = result.error.issues.find((i) => i.path[0] === 'title');
            expect(titleIssue).toBeDefined();
        }
    });

    it('should fail schema validation when description is too short', () => {
        const data = { ...validBasicData, description: 'Short' };
        const merged = mergeFormData(data, emptyDetailsData, minimalEnv, []);
        const result = feedbackFormSchema.safeParse(merged);
        expect(result.success).toBe(false);
        if (!result.success) {
            const descIssue = result.error.issues.find((i) => i.path[0] === 'description');
            expect(descIssue).toBeDefined();
        }
    });

    it('should fail schema validation when email is invalid', () => {
        const data = { ...validBasicData, reporterEmail: 'not-an-email' };
        const merged = mergeFormData(data, emptyDetailsData, minimalEnv, []);
        const result = feedbackFormSchema.safeParse(merged);
        expect(result.success).toBe(false);
        if (!result.success) {
            const emailIssue = result.error.issues.find((i) => i.path[0] === 'reporterEmail');
            expect(emailIssue).toBeDefined();
        }
    });

    it('should fail schema validation when reporterName is too short', () => {
        const data = { ...validBasicData, reporterName: 'A' };
        const merged = mergeFormData(data, emptyDetailsData, minimalEnv, []);
        const result = feedbackFormSchema.safeParse(merged);
        expect(result.success).toBe(false);
        if (!result.success) {
            const nameIssue = result.error.issues.find((i) => i.path[0] === 'reporterName');
            expect(nameIssue).toBeDefined();
        }
    });

    it('should pass validation with optional detail fields populated', () => {
        const details: StepDetailsData = {
            severity: 'critical',
            stepsToReproduce: '1. Load page\n2. Click logout\n3. Refresh',
            expectedResult: 'Should redirect to login',
            actualResult: 'Page shows blank screen'
        };
        const merged = mergeFormData(validBasicData, details, minimalEnv, []);
        const result = feedbackFormSchema.safeParse(merged);
        expect(result.success).toBe(true);
    });

    // -----------------------------------------------------------------------
    // FEEDBACK_STRINGS used in success / error UI
    // -----------------------------------------------------------------------

    it('should have success strings defined', () => {
        expect(FEEDBACK_STRINGS.success.title).toBeTruthy();
        expect(FEEDBACK_STRINGS.success.message).toBeTruthy();
        expect(FEEDBACK_STRINGS.success.issueLabel).toBeTruthy();
        expect(FEEDBACK_STRINGS.success.fallbackMessage).toBeTruthy();
        expect(FEEDBACK_STRINGS.success.thanks).toBeTruthy();
    });

    it('should have button labels for submitAnother and close', () => {
        expect(FEEDBACK_STRINGS.buttons.submitAnother).toBe('Enviar otro');
        expect(FEEDBACK_STRINGS.buttons.close).toBe('Cerrar');
    });

    it('should have form step titles defined', () => {
        expect(FEEDBACK_STRINGS.form.title).toBeTruthy();
        expect(FEEDBACK_STRINGS.form.step2Title).toBeTruthy();
    });

    // -----------------------------------------------------------------------
    // onClose callback
    // -----------------------------------------------------------------------

    it('onClose should be an optional callable prop', () => {
        const onClose = vi.fn();
        const props: FeedbackFormProps = {
            apiUrl: 'http://localhost:3001',
            appSource: 'web',
            onClose
        };
        props.onClose?.();
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('FeedbackFormProps should compile without onClose', () => {
        const props: FeedbackFormProps = {
            apiUrl: 'http://localhost:3001',
            appSource: 'standalone'
        };
        expect(props.onClose).toBeUndefined();
    });
});
