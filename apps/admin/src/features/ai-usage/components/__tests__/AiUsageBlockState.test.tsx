// @vitest-environment jsdom
/**
 * AiUsageBlockState component tests (SPEC-260 T-021).
 *
 * Covers the three non-data states rendered by this presentational component:
 *   - `loading`  — spinner icon present, title rendered
 *   - `error`    — no spinner, title rendered in destructive class, hint rendered
 *   - `empty`    — no spinner, title rendered in muted class, hint rendered
 *
 * `useTranslations` is mocked globally in test/setup.tsx as `t: (key) => key`,
 * so assertions use translation key strings.
 * `@repo/icons` is also mocked globally (LoaderIcon → `<span data-testid="icon-LoaderIcon" />`).
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AiUsageBlockState } from '../AiUsageBlockState';

afterEach(() => {
    cleanup();
});

describe('AiUsageBlockState', () => {
    // -------------------------------------------------------------------------
    // loading variant
    // -------------------------------------------------------------------------
    describe('loading status', () => {
        it('renders the spinner icon', () => {
            render(
                <AiUsageBlockState
                    status="loading"
                    title="Loading..."
                />
            );
            expect(screen.getByTestId('icon-LoaderIcon')).toBeInTheDocument();
        });

        it('renders the title text', () => {
            render(
                <AiUsageBlockState
                    status="loading"
                    title="admin-pages.ai.usage.byModel.loading"
                />
            );
            expect(screen.getByText('admin-pages.ai.usage.byModel.loading')).toBeInTheDocument();
        });

        it('does NOT render a hint paragraph', () => {
            render(
                <AiUsageBlockState
                    status="loading"
                    title="Loading"
                />
            );
            // No hint prop → no second paragraph beyond the title
            // The title <p> has no role in the accessibility tree, so use getByText
            expect(screen.queryByText('some-hint')).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // error variant
    // -------------------------------------------------------------------------
    describe('error status', () => {
        it('does NOT render the spinner icon', () => {
            render(
                <AiUsageBlockState
                    status="error"
                    title="Something went wrong"
                />
            );
            expect(screen.queryByTestId('icon-LoaderIcon')).not.toBeInTheDocument();
        });

        it('renders the error title with destructive class', () => {
            render(
                <AiUsageBlockState
                    status="error"
                    title="admin-pages.ai.usage.byModel.loadError"
                />
            );
            const title = screen.getByText('admin-pages.ai.usage.byModel.loadError');
            expect(title).toBeInTheDocument();
            expect(title.className).toContain('text-destructive');
        });

        it('renders the hint paragraph when hint is provided', () => {
            render(
                <AiUsageBlockState
                    status="error"
                    title="Error"
                    hint="admin-pages.ai.usage.byModel.loadErrorHint"
                />
            );
            expect(
                screen.getByText('admin-pages.ai.usage.byModel.loadErrorHint')
            ).toBeInTheDocument();
        });

        it('does NOT render a hint paragraph when hint is omitted', () => {
            render(
                <AiUsageBlockState
                    status="error"
                    title="Error"
                />
            );
            // Only one text node should be in the container (the title)
            const { container } = render(
                <AiUsageBlockState
                    status="error"
                    title="Error title"
                />
            );
            const paras = container.querySelectorAll('p');
            // Should have exactly 1 <p> (title only)
            expect(paras).toHaveLength(1);
        });
    });

    // -------------------------------------------------------------------------
    // empty variant
    // -------------------------------------------------------------------------
    describe('empty status', () => {
        it('does NOT render the spinner icon', () => {
            render(
                <AiUsageBlockState
                    status="empty"
                    title="No data"
                />
            );
            expect(screen.queryByTestId('icon-LoaderIcon')).not.toBeInTheDocument();
        });

        it('renders the empty title with muted class', () => {
            render(
                <AiUsageBlockState
                    status="empty"
                    title="admin-pages.ai.usage.byModel.empty"
                />
            );
            const title = screen.getByText('admin-pages.ai.usage.byModel.empty');
            expect(title).toBeInTheDocument();
            expect(title.className).toContain('text-muted-foreground');
        });

        it('renders the hint paragraph when hint is provided', () => {
            render(
                <AiUsageBlockState
                    status="empty"
                    title="No data"
                    hint="admin-pages.ai.usage.byModel.emptyHint"
                />
            );
            expect(screen.getByText('admin-pages.ai.usage.byModel.emptyHint')).toBeInTheDocument();
        });
    });
});
