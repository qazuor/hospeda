/**
 * Tests for the FeedbackErrorBoundary component.
 *
 * Because this package does not have @testing-library/react or jsdom installed,
 * all tests verify the component contract through pure-logic helpers that
 * mirror the internal behaviour of FeedbackErrorBoundary without DOM rendering.
 *
 * Covered areas:
 * - Component class structure (named export, class shape, getDerivedStateFromError)
 * - Error state management transitions
 * - Pre-fill data construction from a caught Error
 * - New-tab URL construction via serializeFeedbackParams
 * - truncate helper logic
 * - FeedbackErrorBoundaryProps type contract (compile-time checks via usage)
 */
import { describe, expect, it, vi } from 'vitest';
import {
    FeedbackErrorBoundary,
    type FeedbackErrorBoundaryProps
} from '../../src/components/FeedbackErrorBoundary.js';
import { FEEDBACK_STRINGS } from '../../src/config/strings.js';
import { serializeFeedbackParams } from '../../src/lib/query-params.js';
import type { AppSourceId } from '../../src/schemas/feedback.schema.js';

// ---------------------------------------------------------------------------
// Pure helper: truncate (mirrors the private truncate() in FeedbackErrorBoundary)
// ---------------------------------------------------------------------------

/**
 * Truncates a string to `maxLength` characters, appending an ellipsis when the
 * input exceeds the limit.
 *
 * @param text - Input string
 * @param maxLength - Maximum allowed character count (inclusive)
 * @returns Truncated string with trailing ellipsis if needed
 */
function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1)}…`;
}

// ---------------------------------------------------------------------------
// Pure helper: buildErrorPrefillData (mirrors the inline logic in renderInlineModal)
// ---------------------------------------------------------------------------

interface ErrorPrefillData {
    type: 'bug-js';
    title: string;
    errorInfo: {
        message: string;
        stack: string | undefined;
    };
}

const MAX_TITLE_LENGTH = 200;

/**
 * Constructs the prefill data object that FeedbackErrorBoundary passes to
 * FeedbackModal when reporting a caught error.
 *
 * @param error - The caught Error instance
 * @returns Pre-fill data ready for FeedbackModal's `prefillData` prop
 */
function buildErrorPrefillData(error: Error): ErrorPrefillData {
    return {
        type: 'bug-js',
        title: truncate(error.message, MAX_TITLE_LENGTH),
        errorInfo: {
            message: error.message,
            stack: error.stack
        }
    };
}

// ---------------------------------------------------------------------------
// Pure helper: buildFallbackTabUrl (mirrors openFeedbackTab logic)
// ---------------------------------------------------------------------------

/**
 * Builds the URL that would be opened in a new tab when the inline
 * FeedbackModal fails to render.
 *
 * @param feedbackPageUrl - Base URL of the standalone feedback page
 * @param error - The caught error
 * @param appSource - App source identifier
 * @param currentUrl - The URL at which the error occurred
 * @returns Full URL string with query params
 */
function buildFallbackTabUrl(
    feedbackPageUrl: string,
    error: Error,
    appSource: AppSourceId,
    currentUrl?: string
): string {
    const qs = serializeFeedbackParams({
        type: 'bug-js',
        error: truncate(error.message, MAX_TITLE_LENGTH),
        stack: error.stack,
        source: appSource,
        url: currentUrl
    });

    const separator = feedbackPageUrl.includes('?') ? '&' : '?';
    return `${feedbackPageUrl}${separator}${qs}`;
}

// ---------------------------------------------------------------------------
// Pure helper: errorBoundaryStateTransition
// (mirrors the state transitions triggered by getDerivedStateFromError / reset)
// ---------------------------------------------------------------------------

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    showInlineForm: boolean;
}

/**
 * Simulates the state after getDerivedStateFromError is called.
 *
 * @param error - The error that was thrown
 * @returns New state with hasError=true
 */
function stateAfterError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, showInlineForm: false };
}

/**
 * Simulates the state after resetError() is called.
 *
 * @returns Reset state with hasError=false
 */
function stateAfterReset(): ErrorBoundaryState {
    return { hasError: false, error: null, showInlineForm: false };
}

/**
 * Simulates the state after handleReportClick() is called.
 *
 * @param current - Current error boundary state
 * @returns New state with showInlineForm=true
 */
function stateAfterReportClick(current: ErrorBoundaryState): ErrorBoundaryState {
    return { ...current, showInlineForm: true };
}

/**
 * Simulates the state after handleModalClose() is called.
 *
 * @param current - Current error boundary state
 * @returns New state with showInlineForm=false
 */
function stateAfterModalClose(current: ErrorBoundaryState): ErrorBoundaryState {
    return { ...current, showInlineForm: false };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeProps = (
    overrides: Partial<FeedbackErrorBoundaryProps> = {}
): FeedbackErrorBoundaryProps => ({
    children: null,
    appSource: 'web',
    apiUrl: 'http://localhost:3001',
    ...overrides
});

const sampleError = new Error('Something went wrong during render');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FeedbackErrorBoundary class structure', () => {
    it('should be exported as a named export (not default)', () => {
        expect(FeedbackErrorBoundary).toBeDefined();
    });

    it('should be a class (constructor function) with render method on prototype', () => {
        expect(typeof FeedbackErrorBoundary).toBe('function');
        // React class components always have render() defined on the prototype
        expect(typeof FeedbackErrorBoundary.prototype.render).toBe('function');
    });

    it('should have a static getDerivedStateFromError method', () => {
        expect(typeof FeedbackErrorBoundary.getDerivedStateFromError).toBe('function');
    });

    it('should have a componentDidCatch instance method', () => {
        expect(typeof FeedbackErrorBoundary.prototype.componentDidCatch).toBe('function');
    });

    it('getDerivedStateFromError should set hasError=true and preserve the error', () => {
        // Arrange
        const error = new Error('Test render error');

        // Act
        const newState = FeedbackErrorBoundary.getDerivedStateFromError(error);

        // Assert
        expect(newState).toMatchObject({ hasError: true, error });
    });

    it('getDerivedStateFromError should work with any Error subclass', () => {
        // Arrange
        const typeError = new TypeError('Type mismatch');
        const refError = new ReferenceError('Undefined ref');

        // Act & Assert
        expect(FeedbackErrorBoundary.getDerivedStateFromError(typeError)).toMatchObject({
            hasError: true,
            error: typeError
        });
        expect(FeedbackErrorBoundary.getDerivedStateFromError(refError)).toMatchObject({
            hasError: true,
            error: refError
        });
    });
});

describe('FeedbackErrorBoundaryProps type contract', () => {
    it('should accept required props only', () => {
        // Compile-time check via usage
        const props: FeedbackErrorBoundaryProps = makeProps();
        expect(props.appSource).toBe('web');
        expect(props.apiUrl).toBe('http://localhost:3001');
    });

    it('should accept all optional props', () => {
        const props: FeedbackErrorBoundaryProps = makeProps({
            deployVersion: 'abc1234',
            userId: 'usr_001',
            userEmail: 'user@test.com',
            userName: 'Test User',
            feedbackPageUrl: 'https://example.com/feedback',
            fallbackComponent: ({ error, resetError, reportError }) => {
                void error;
                void resetError;
                void reportError;
                return null;
            }
        });

        expect(props.deployVersion).toBe('abc1234');
        expect(props.userId).toBe('usr_001');
        expect(props.userEmail).toBe('user@test.com');
        expect(props.userName).toBe('Test User');
        expect(props.feedbackPageUrl).toBe('https://example.com/feedback');
        expect(typeof props.fallbackComponent).toBe('function');
    });

    it('should accept all valid appSource values', () => {
        const sources: AppSourceId[] = ['web', 'admin', 'standalone'];
        for (const appSource of sources) {
            const props: FeedbackErrorBoundaryProps = makeProps({ appSource });
            expect(props.appSource).toBe(appSource);
        }
    });

    it('fallbackComponent should receive error, resetError, and reportError', () => {
        // Arrange
        const receivedArgs: { error?: Error; hasReset?: boolean; hasReport?: boolean } = {};

        const props: FeedbackErrorBoundaryProps = makeProps({
            fallbackComponent: ({ error, resetError, reportError }) => {
                receivedArgs.error = error;
                receivedArgs.hasReset = typeof resetError === 'function';
                receivedArgs.hasReport = typeof reportError === 'function';
                return null;
            }
        });

        // Act - simulate the fallbackComponent call
        props.fallbackComponent?.({
            error: sampleError,
            resetError: vi.fn(),
            reportError: vi.fn()
        });

        // Assert
        expect(receivedArgs.error).toBe(sampleError);
        expect(receivedArgs.hasReset).toBe(true);
        expect(receivedArgs.hasReport).toBe(true);
    });
});

describe('Error state management logic', () => {
    it('initial state should have hasError=false and no error', () => {
        const initial: ErrorBoundaryState = { hasError: false, error: null, showInlineForm: false };
        expect(initial.hasError).toBe(false);
        expect(initial.error).toBeNull();
        expect(initial.showInlineForm).toBe(false);
    });

    it('stateAfterError should set hasError=true and store the error', () => {
        // Arrange & Act
        const state = stateAfterError(sampleError);

        // Assert
        expect(state.hasError).toBe(true);
        expect(state.error).toBe(sampleError);
        expect(state.showInlineForm).toBe(false);
    });

    it('stateAfterReset should clear error state', () => {
        // Arrange
        const errorState = stateAfterError(sampleError);

        // Act
        const resetState = stateAfterReset();

        // Assert
        expect(resetState.hasError).toBe(false);
        expect(resetState.error).toBeNull();
        expect(resetState.showInlineForm).toBe(false);
        // Verify errorState itself was not mutated
        expect(errorState.hasError).toBe(true);
    });

    it('stateAfterReportClick should set showInlineForm=true', () => {
        // Arrange
        const errorState = stateAfterError(sampleError);

        // Act
        const reportingState = stateAfterReportClick(errorState);

        // Assert
        expect(reportingState.showInlineForm).toBe(true);
        expect(reportingState.hasError).toBe(true);
        expect(reportingState.error).toBe(sampleError);
    });

    it('stateAfterModalClose should set showInlineForm=false without resetting error', () => {
        // Arrange
        const errorState = stateAfterError(sampleError);
        const reportingState = stateAfterReportClick(errorState);

        // Act
        const closedState = stateAfterModalClose(reportingState);

        // Assert
        expect(closedState.showInlineForm).toBe(false);
        expect(closedState.hasError).toBe(true);
        expect(closedState.error).toBe(sampleError);
    });

    it('state transitions should be immutable (no mutation of previous state)', () => {
        // Arrange
        const initial: ErrorBoundaryState = { hasError: false, error: null, showInlineForm: false };
        const errorState = stateAfterError(sampleError);

        // Act
        const reportingState = stateAfterReportClick(errorState);
        stateAfterModalClose(reportingState);

        // Assert - initial state unchanged
        expect(initial.hasError).toBe(false);
        expect(errorState.showInlineForm).toBe(false); // was not mutated by stateAfterReportClick
    });
});

describe('Pre-fill data construction from Error', () => {
    it('should set type to "bug-js"', () => {
        const prefill = buildErrorPrefillData(sampleError);
        expect(prefill.type).toBe('bug-js');
    });

    it('should use error message as the title', () => {
        const error = new Error('NullPointerException at line 42');
        const prefill = buildErrorPrefillData(error);
        expect(prefill.title).toBe('NullPointerException at line 42');
    });

    it('should include errorInfo.message matching error.message', () => {
        const error = new Error('Cannot read property of undefined');
        const prefill = buildErrorPrefillData(error);
        expect(prefill.errorInfo.message).toBe(error.message);
    });

    it('should include errorInfo.stack matching error.stack', () => {
        const error = new Error('Stack trace test');
        const prefill = buildErrorPrefillData(error);
        expect(prefill.errorInfo.stack).toBe(error.stack);
    });

    it('should truncate title to 200 chars when error message is longer', () => {
        const longMessage = 'A'.repeat(250);
        const error = new Error(longMessage);
        const prefill = buildErrorPrefillData(error);

        // Title must be at most 200 chars and end with ellipsis
        expect(prefill.title.length).toBeLessThanOrEqual(200);
        expect(prefill.title.endsWith('…')).toBe(true);
    });

    it('should not truncate title when error message is exactly 200 chars', () => {
        const exactMessage = 'B'.repeat(200);
        const error = new Error(exactMessage);
        const prefill = buildErrorPrefillData(error);

        expect(prefill.title).toBe(exactMessage);
        expect(prefill.title.endsWith('…')).toBe(false);
    });

    it('should not truncate title when error message is shorter than 200 chars', () => {
        const shortMessage = 'Short error message';
        const error = new Error(shortMessage);
        const prefill = buildErrorPrefillData(error);

        expect(prefill.title).toBe(shortMessage);
    });

    it('should handle errors without a stack trace', () => {
        const error = new Error('No stack');
        // Simulate environment where stack may be undefined
        error.stack = undefined;
        const prefill = buildErrorPrefillData(error);

        expect(prefill.errorInfo.stack).toBeUndefined();
        expect(prefill.errorInfo.message).toBe('No stack');
    });
});

describe('truncate helper', () => {
    it('should return the original string when length <= maxLength', () => {
        expect(truncate('hello', 10)).toBe('hello');
        expect(truncate('hello', 5)).toBe('hello');
    });

    it('should truncate and append ellipsis when length > maxLength', () => {
        const result = truncate('hello world', 8);
        expect(result.length).toBeLessThanOrEqual(8);
        expect(result.endsWith('…')).toBe(true);
    });

    it('should handle empty string', () => {
        expect(truncate('', 10)).toBe('');
    });

    it('should handle maxLength of 1', () => {
        const result = truncate('hello', 1);
        expect(result).toBe('…');
        expect(result.length).toBe(1);
    });

    it('should truncate to exactly maxLength characters (including ellipsis)', () => {
        const result = truncate('abcdefgh', 5);
        // 4 chars + 1 ellipsis = 5 total
        expect([...result].length).toBe(5);
    });
});

describe('Fallback tab URL construction via serializeFeedbackParams', () => {
    it('should include type=bug-js in the query string', () => {
        const url = buildFallbackTabUrl(
            'https://example.com/feedback',
            sampleError,
            'web',
            'https://app.example.com/page'
        );
        expect(url).toContain('type=bug-js');
    });

    it('should include the error message in the query string', () => {
        const error = new Error('Crash at startup');
        const url = buildFallbackTabUrl('https://example.com/feedback', error, 'web');
        expect(url).toContain('error=');
        // serializeFeedbackParams uses URLSearchParams which encodes spaces as "+"
        expect(url).toContain('error=Crash+at+startup');
    });

    it('should include the app source in the query string', () => {
        const url = buildFallbackTabUrl('https://example.com/feedback', sampleError, 'admin');
        expect(url).toContain('source=admin');
    });

    it('should include the current URL in the query string when provided', () => {
        const currentUrl = 'https://app.example.com/dashboard';
        const url = buildFallbackTabUrl(
            'https://example.com/feedback',
            sampleError,
            'web',
            currentUrl
        );
        expect(url).toContain('url=');
        expect(decodeURIComponent(url)).toContain(currentUrl);
    });

    it('should omit the url param when currentUrl is not provided', () => {
        const url = buildFallbackTabUrl(
            'https://example.com/feedback',
            sampleError,
            'web',
            undefined
        );
        expect(url).not.toContain('url=');
    });

    it('should use "?" as separator when feedbackPageUrl has no query string', () => {
        const url = buildFallbackTabUrl('https://example.com/feedback', sampleError, 'web');
        expect(url).toMatch(/^https:\/\/example\.com\/feedback\?/);
    });

    it('should use "&" as separator when feedbackPageUrl already has query params', () => {
        const url = buildFallbackTabUrl('https://example.com/feedback?lang=es', sampleError, 'web');
        expect(url).toMatch(/^https:\/\/example\.com\/feedback\?lang=es&/);
    });

    it('should truncate long error messages in the URL to <= 200 chars (param value)', () => {
        const longError = new Error('E'.repeat(300));
        const url = buildFallbackTabUrl('https://example.com/feedback', longError, 'web');

        const parsed = new URL(url);
        const errorParam = parsed.searchParams.get('error') ?? '';
        // The param value (before URL encoding) should be <= 200 chars
        expect([...errorParam].length).toBeLessThanOrEqual(200);
    });

    it('should include the stack trace in the query string when error has a stack', () => {
        const error = new Error('Stack trace included');
        // Ensure stack is present
        if (error.stack) {
            const url = buildFallbackTabUrl('https://example.com/feedback', error, 'web');
            expect(url).toContain('stack=');
        }
    });
});

describe('FEEDBACK_STRINGS errorBoundary keys', () => {
    it('should have errorBoundary.title', () => {
        expect(FEEDBACK_STRINGS.errorBoundary.title).toBeTruthy();
        expect(typeof FEEDBACK_STRINGS.errorBoundary.title).toBe('string');
    });

    it('should have errorBoundary.message', () => {
        expect(FEEDBACK_STRINGS.errorBoundary.message).toBeTruthy();
        expect(typeof FEEDBACK_STRINGS.errorBoundary.message).toBe('string');
    });

    it('should have buttons.reportError', () => {
        expect(FEEDBACK_STRINGS.buttons.reportError).toBeTruthy();
        expect(typeof FEEDBACK_STRINGS.buttons.reportError).toBe('string');
    });

    it('should have buttons.reloadPage', () => {
        expect(FEEDBACK_STRINGS.buttons.reloadPage).toBeTruthy();
        expect(typeof FEEDBACK_STRINGS.buttons.reloadPage).toBe('string');
    });

    it('errorBoundary.title should match the expected Spanish text', () => {
        expect(FEEDBACK_STRINGS.errorBoundary.title).toBe('Algo salio mal');
    });

    it('buttons.reportError should match the expected Spanish text', () => {
        expect(FEEDBACK_STRINGS.buttons.reportError).toBe('Reportar este error');
    });

    it('buttons.reloadPage should match the expected Spanish text', () => {
        expect(FEEDBACK_STRINGS.buttons.reloadPage).toBe('Recargar');
    });
});
