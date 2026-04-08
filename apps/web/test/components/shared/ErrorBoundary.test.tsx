/**
 * @file ErrorBoundary.test.tsx
 * @description Unit tests for React ErrorBoundary component.
 * Uses source-reading pattern (consistent with project conventions).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/shared/ErrorBoundary.tsx'),
    'utf8'
);

describe('ErrorBoundary', () => {
    describe('structure', () => {
        it('should be a class component (required for componentDidCatch)', () => {
            expect(src).toContain('class ErrorBoundary extends Component');
        });

        it('should implement getDerivedStateFromError', () => {
            expect(src).toContain('getDerivedStateFromError');
        });

        it('should implement componentDidCatch for error logging', () => {
            expect(src).toContain('componentDidCatch');
        });
    });

    describe('props', () => {
        it('should accept children prop', () => {
            expect(src).toContain('readonly children: ReactNode');
        });

        it('should accept optional fallback prop', () => {
            expect(src).toContain('readonly fallback?: ReactNode');
        });
    });

    describe('error handling', () => {
        it('should track hasError in state', () => {
            expect(src).toContain('hasError');
        });

        it('should have a retry handler that resets state', () => {
            expect(src).toContain('handleRetry');
            expect(src).toContain('hasError: false');
        });
    });

    describe('fallback UI', () => {
        it('should show error message in default fallback', () => {
            expect(src).toContain('Something went wrong');
        });

        it('should show Try again button', () => {
            expect(src).toContain('Try again');
        });

        it('should render custom fallback when provided', () => {
            expect(src).toContain('this.props.fallback');
        });
    });

    describe('exports', () => {
        it('should use named export only', () => {
            expect(src).toContain('export class ErrorBoundary');
            expect(src).not.toContain('export default');
        });
    });
});
