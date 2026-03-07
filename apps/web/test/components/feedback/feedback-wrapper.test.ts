/**
 * @file feedback-wrapper.test.ts
 * @description Source-level tests for FeedbackIslandWrapper.tsx.
 *
 * FeedbackIslandWrapper wraps complex React islands with FeedbackErrorBoundary
 * from @repo/feedback so that JS crashes show a recoverable error UI.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = resolve(__dirname, '../../../src');

function readComponent(relativePath: string): string {
    return readFileSync(resolve(srcDir, relativePath), 'utf8');
}

describe('FeedbackIslandWrapper.tsx', () => {
    const src = readComponent('components/feedback/FeedbackIslandWrapper.tsx');

    describe('Exports', () => {
        it('should export FeedbackIslandWrapper as a named function', () => {
            expect(src).toContain('export function FeedbackIslandWrapper');
        });

        it('should export FeedbackIslandWrapperProps interface', () => {
            expect(src).toContain('export interface FeedbackIslandWrapperProps');
        });

        it('should NOT use a default export', () => {
            expect(src).not.toMatch(/^export default/m);
        });
    });

    describe('Props interface', () => {
        it('should have children prop', () => {
            expect(src).toContain('children:');
        });

        it('should have apiUrl prop for the feedback API endpoint', () => {
            expect(src).toContain('apiUrl:');
        });

        it('should have optional userEmail prop', () => {
            expect(src).toContain('userEmail?');
        });

        it('should have optional userName prop', () => {
            expect(src).toContain('userName?');
        });

        it('should have optional userId prop', () => {
            expect(src).toContain('userId?');
        });
    });

    describe('@repo/feedback integration', () => {
        it('should import FeedbackErrorBoundary from @repo/feedback', () => {
            expect(src).toContain('FeedbackErrorBoundary');
            expect(src).toContain('@repo/feedback');
        });

        it('should wrap children with FeedbackErrorBoundary', () => {
            expect(src).toContain('<FeedbackErrorBoundary');
        });

        it('should render children inside the boundary', () => {
            expect(src).toContain('{children}');
        });
    });

    describe('FeedbackErrorBoundary props passthrough', () => {
        it('should pass appSource="web" to identify the app', () => {
            expect(src).toContain('appSource="web"');
        });

        it('should forward apiUrl to the error boundary', () => {
            expect(src).toContain('apiUrl={apiUrl}');
        });

        it('should forward userEmail to the error boundary', () => {
            expect(src).toContain('userEmail={userEmail}');
        });

        it('should forward userName to the error boundary', () => {
            expect(src).toContain('userName={userName}');
        });

        it('should forward userId to the error boundary', () => {
            expect(src).toContain('userId={userId}');
        });

        it('should include a feedbackPageUrl pointing to the feedback page', () => {
            expect(src).toContain('feedbackPageUrl=');
            expect(src).toContain('/feedback/');
        });
    });

    describe('Return type', () => {
        it('should return React.JSX.Element', () => {
            expect(src).toContain('React.JSX.Element');
        });
    });

    describe('Type imports', () => {
        it('should use import type for ReactNode', () => {
            expect(src).toContain('import type');
            expect(src).toContain('ReactNode');
        });
    });

    describe('JSDoc documentation', () => {
        it('should have JSDoc comment describing the component purpose', () => {
            expect(src).toContain('FeedbackErrorBoundary');
        });

        it('should document when NOT to use this wrapper', () => {
            // The file contains a note about not wrapping every island
            expect(src).toContain('Do not wrap every island');
        });
    });
});
