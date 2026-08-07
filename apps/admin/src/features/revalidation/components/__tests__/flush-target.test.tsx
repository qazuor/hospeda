// @vitest-environment jsdom
/**
 * Flush-target display — component tests (HOS-369).
 *
 * The admin "flush everything" control no longer empties the Cloudflare zone;
 * it purges the catch-all tag of ONE deployment. These tests pin the two
 * properties that make that safe to operate:
 *
 *  - a resolved target is shown verbatim, exactly as the API reported it, so
 *    the operator reads the environment instead of inferring it;
 *  - an unresolved target says so out loud — never a blank, never a
 *    plausible-looking default such as `prod:all`.
 *
 * `@/hooks/use-translations` is mocked globally in `test/setup.tsx` to echo the
 * key, so assertions on copy target the KEY; the target string itself is
 * deliberately rendered raw (it is an identifier, not translated copy) and is
 * asserted by value.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    deriveFlushTargetState,
    FlushTargetNotice,
    type FlushTargetState,
    ManualForm
} from '../revalidation-shared';

// ---------------------------------------------------------------------------
// deriveFlushTargetState
// ---------------------------------------------------------------------------

describe('deriveFlushTargetState', () => {
    it('reports loading while the health query is in flight', () => {
        // Arrange / Act
        const state = deriveFlushTargetState({
            isLoading: true,
            isError: false,
            target: undefined
        });

        // Assert
        expect(state).toEqual({ kind: 'loading' });
    });

    it('reports error when the health query failed', () => {
        // Arrange / Act
        const state = deriveFlushTargetState({
            isLoading: false,
            isError: true,
            target: undefined
        });

        // Assert
        expect(state).toEqual({ kind: 'error' });
    });

    it("maps the backend's 'unresolved' sentinel to the unresolved state", () => {
        // Arrange / Act
        const state = deriveFlushTargetState({
            isLoading: false,
            isError: false,
            target: 'unresolved'
        });

        // Assert
        expect(state).toEqual({ kind: 'unresolved' });
    });

    it('treats a missing or empty target as unresolved, never as resolved', () => {
        // Arrange / Act
        const missing = deriveFlushTargetState({
            isLoading: false,
            isError: false,
            target: undefined
        });
        const empty = deriveFlushTargetState({ isLoading: false, isError: false, target: '' });

        // Assert
        expect(missing).toEqual({ kind: 'unresolved' });
        expect(empty).toEqual({ kind: 'unresolved' });
    });

    it('passes a real target through unchanged', () => {
        // Arrange / Act
        const state = deriveFlushTargetState({
            isLoading: false,
            isError: false,
            target: 'preview:all'
        });

        // Assert
        expect(state).toEqual({ kind: 'resolved', target: 'preview:all' });
    });
});

// ---------------------------------------------------------------------------
// FlushTargetNotice
// ---------------------------------------------------------------------------

describe('FlushTargetNotice', () => {
    it('names the resolved target verbatim', () => {
        // Arrange
        const state: FlushTargetState = { kind: 'resolved', target: 'prod:all' };

        // Act
        render(<FlushTargetNotice state={state} />);

        // Assert
        expect(screen.getByTestId('revalidation-flush-target')).toHaveTextContent('prod:all');
        expect(screen.getByText('revalidation.manual.flushTargetLabel')).toBeInTheDocument();
    });

    it('states the unresolved case explicitly instead of rendering a target', () => {
        // Arrange
        const state: FlushTargetState = { kind: 'unresolved' };

        // Act
        render(<FlushTargetNotice state={state} />);

        // Assert — the warning is shown, and NO target element exists to be
        // misread as an environment the flush would actually reach.
        expect(screen.getByTestId('revalidation-flush-target-unresolved')).toHaveTextContent(
            'revalidation.manual.flushTargetUnresolved'
        );
        expect(screen.queryByTestId('revalidation-flush-target')).toBeNull();
    });

    it('never falls back to a plausible-looking default when unresolved', () => {
        // Arrange
        const state: FlushTargetState = { kind: 'unresolved' };

        // Act
        const { container } = render(<FlushTargetNotice state={state} />);

        // Assert
        expect(container.textContent).not.toContain('prod:all');
        expect(container.textContent).not.toContain('unresolved:');
        expect(container.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    });

    it('says the query is still running rather than rendering nothing', () => {
        // Arrange
        const state: FlushTargetState = { kind: 'loading' };

        // Act
        render(<FlushTargetNotice state={state} />);

        // Assert
        expect(screen.getByTestId('revalidation-flush-target-loading')).toHaveTextContent(
            'revalidation.manual.flushTargetLoading'
        );
        expect(screen.queryByTestId('revalidation-flush-target')).toBeNull();
    });

    it('says the lookup failed rather than rendering nothing', () => {
        // Arrange
        const state: FlushTargetState = { kind: 'error' };

        // Act
        render(<FlushTargetNotice state={state} />);

        // Assert
        expect(screen.getByTestId('revalidation-flush-target-error')).toHaveTextContent(
            'revalidation.manual.flushTargetError'
        );
        expect(screen.queryByTestId('revalidation-flush-target')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// ManualForm wiring
// ---------------------------------------------------------------------------

describe('ManualForm', () => {
    const baseProps = {
        tagsInput: '',
        reason: '',
        isPending: false,
        parsedCount: 0,
        purgeEverything: false,
        onTagsChange: vi.fn(),
        onReasonChange: vi.fn(),
        onPurgeEverythingChange: vi.fn(),
        onSubmit: vi.fn()
    } as const;

    it('shows the flush target alongside the destructive opt-in', () => {
        // Arrange / Act
        render(
            <ManualForm
                {...baseProps}
                flushTarget={{ kind: 'resolved', target: 'prod:all' }}
            />
        );

        // Assert
        expect(screen.getByTestId('revalidation-flush-target')).toHaveTextContent('prod:all');
        expect(screen.getByText('revalidation.manual.purgeEverythingWarning')).toBeInTheDocument();
    });

    it('warns in place of the target when the environment is unresolved', () => {
        // Arrange / Act
        render(
            <ManualForm
                {...baseProps}
                flushTarget={{ kind: 'unresolved' }}
            />
        );

        // Assert
        expect(screen.getByTestId('revalidation-flush-target-unresolved')).toBeInTheDocument();
        expect(screen.queryByTestId('revalidation-flush-target')).toBeNull();
    });
});
