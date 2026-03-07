import { describe, expect, it } from 'vitest';
import * as feedback from '../src/index';

describe('@repo/feedback package exports', () => {
    it('should export FeedbackFAB component', () => {
        expect(feedback.FeedbackFAB).toBeDefined();
        expect(typeof feedback.FeedbackFAB).toBe('function');
    });

    it('should export FeedbackForm component', () => {
        expect(feedback.FeedbackForm).toBeDefined();
    });

    it('should export FeedbackModal component', () => {
        expect(feedback.FeedbackModal).toBeDefined();
    });

    it('should export FeedbackErrorBoundary component', () => {
        expect(feedback.FeedbackErrorBoundary).toBeDefined();
    });

    it('should export hooks', () => {
        expect(feedback.useAutoCollect).toBeDefined();
        expect(feedback.useConsoleCapture).toBeDefined();
        expect(feedback.useKeyboardShortcut).toBeDefined();
        expect(feedback.useFeedbackSubmit).toBeDefined();
    });

    it('should export config', () => {
        expect(feedback.FEEDBACK_CONFIG).toBeDefined();
        expect(feedback.FEEDBACK_STRINGS).toBeDefined();
        expect(feedback.REPORT_TYPES).toBeDefined();
        expect(feedback.SEVERITY_LEVELS).toBeDefined();
    });

    it('should export schemas', () => {
        expect(feedback.feedbackFormSchema).toBeDefined();
        expect(feedback.feedbackEnvironmentSchema).toBeDefined();
    });

    it('should export utilities', () => {
        expect(feedback.collectEnvironmentData).toBeDefined();
        expect(feedback.serializeFeedbackParams).toBeDefined();
        expect(feedback.parseFeedbackParams).toBeDefined();
    });
});
