// @vitest-environment jsdom
/**
 * Tests for app-logs preserved cell components (SPEC-184 migration).
 *
 * The bespoke AppLogsPanel and AppLogFilters were deleted in favour of the
 * shared createEntityListPage framework.  These tests cover the two Widget
 * renderers that were kept and are reused by the framework columns:
 *
 *   - AppLogLevelBadge   — badge styling per log level
 *   - AppLogMessageCell  — expandable message with request-context detail
 *
 * The request-cell Widget (RequestCell) lives inside app-logs.columns.ts
 * as a module-private component; its markup is indirectly covered by the
 * cell integration path.
 *
 * References: SPEC-184 T-013 / T-014 migration
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// AppLogLevelBadge
// ---------------------------------------------------------------------------

import { AppLogLevelBadge } from '../components/AppLogLevelBadge';

describe('AppLogLevelBadge', () => {
    it('renders ERROR with destructive styling', () => {
        render(<AppLogLevelBadge level="ERROR" />);
        const badge = screen.getByText('ERROR');
        expect(badge).toBeInTheDocument();
        // Destructive variant badge must carry the destructive class
        expect(badge.closest('[class*="destructive"]')).not.toBeNull();
    });

    it('renders WARN with amber/outline styling (no destructive)', () => {
        render(<AppLogLevelBadge level="WARN" />);
        const badge = screen.getByText('WARN');
        expect(badge).toBeInTheDocument();
        // Outline variant should NOT carry the destructive class
        expect(badge.closest('[class*="destructive"]')).toBeNull();
        // Should carry the amber border class
        expect(badge).toHaveClass('border-yellow-400');
    });
});

// ---------------------------------------------------------------------------
// AppLogMessageCell
// ---------------------------------------------------------------------------

import { AppLogMessageCell } from '../components/AppLogMessageCell';

describe('AppLogMessageCell', () => {
    it('renders the message in preview mode by default', () => {
        render(
            <AppLogMessageCell
                message="Something broke hard"
                data={null}
            />
        );

        expect(screen.getByTestId('log-message-preview')).toBeInTheDocument();
        expect(screen.getByTestId('log-message-preview')).toHaveTextContent('Something broke hard');
        expect(screen.queryByTestId('log-message-full')).not.toBeInTheDocument();
    });

    it('expands to show the full message on click', () => {
        render(
            <AppLogMessageCell
                message="A very long message that should be expanded"
                data={null}
            />
        );

        const toggle = screen.getByTestId('log-message-toggle');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(toggle);

        expect(screen.getByTestId('log-message-full')).toBeInTheDocument();
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(screen.queryByTestId('log-message-preview')).not.toBeInTheDocument();
    });

    it('collapses back to preview on second click', () => {
        render(
            <AppLogMessageCell
                message="Toggle me"
                data={null}
            />
        );

        const toggle = screen.getByTestId('log-message-toggle');
        fireEvent.click(toggle); // expand
        fireEvent.click(toggle); // collapse

        expect(screen.getByTestId('log-message-preview')).toBeInTheDocument();
        expect(screen.queryByTestId('log-message-full')).not.toBeInTheDocument();
    });

    it('shows the data payload as pretty-printed JSON when expanded and data is present', () => {
        const data = { userId: 'abc', amount: 1500 };

        render(
            <AppLogMessageCell
                message="Payment failed"
                data={data}
            />
        );

        fireEvent.click(screen.getByTestId('log-message-toggle'));

        const dataPre = screen.getByTestId('log-message-data');
        expect(dataPre).toBeInTheDocument();
        expect(dataPre.textContent).toContain('"userId"');
        expect(dataPre.textContent).toContain('"abc"');
    });

    it('does not show data payload when data is null', () => {
        render(
            <AppLogMessageCell
                message="No data here"
                data={null}
            />
        );

        fireEvent.click(screen.getByTestId('log-message-toggle'));

        expect(screen.queryByTestId('log-message-data')).not.toBeInTheDocument();
    });

    it('does not show data payload when data is an empty object', () => {
        render(
            <AppLogMessageCell
                message="Empty data"
                data={{}}
            />
        );

        fireEvent.click(screen.getByTestId('log-message-toggle'));

        expect(screen.queryByTestId('log-message-data')).not.toBeInTheDocument();
    });

    // ── Request-context fields in expanded detail ──────────────────────────

    it('shows request-context section when expanded and fields are present', () => {
        render(
            <AppLogMessageCell
                message="Request failed"
                data={null}
                requestId="req-abc-123"
                userId="550e8400-e29b-41d4-a716-446655440000"
                method="POST"
                path="/api/v1/admin/logs"
            />
        );

        fireEvent.click(screen.getByTestId('log-message-toggle'));

        expect(screen.getByTestId('log-request-context')).toBeInTheDocument();
        expect(screen.getByTestId('log-detail-request-id')).toHaveTextContent('req-abc-123');
        expect(screen.getByTestId('log-detail-user-id')).toHaveTextContent(
            '550e8400-e29b-41d4-a716-446655440000'
        );
        expect(screen.getByTestId('log-detail-method')).toHaveTextContent('POST');
        expect(screen.getByTestId('log-detail-path')).toHaveTextContent('/api/v1/admin/logs');
    });

    it('does not show request-context section when all context fields are null', () => {
        render(
            <AppLogMessageCell
                message="Cron job entry"
                data={null}
                requestId={null}
                userId={null}
                method={null}
                path={null}
            />
        );

        fireEvent.click(screen.getByTestId('log-message-toggle'));

        expect(screen.queryByTestId('log-request-context')).not.toBeInTheDocument();
    });

    it('does not show request-context section when props are omitted', () => {
        render(
            <AppLogMessageCell
                message="Startup log"
                data={null}
            />
        );

        fireEvent.click(screen.getByTestId('log-message-toggle'));

        expect(screen.queryByTestId('log-request-context')).not.toBeInTheDocument();
    });

    it('shows only the present context fields when partial context is given', () => {
        render(
            <AppLogMessageCell
                message="Partial context"
                data={null}
                method="GET"
                path="/api/v1/public/accommodations"
                requestId={null}
                userId={null}
            />
        );

        fireEvent.click(screen.getByTestId('log-message-toggle'));

        expect(screen.getByTestId('log-request-context')).toBeInTheDocument();
        expect(screen.getByTestId('log-detail-method')).toHaveTextContent('GET');
        expect(screen.getByTestId('log-detail-path')).toHaveTextContent(
            '/api/v1/public/accommodations'
        );
        expect(screen.queryByTestId('log-detail-request-id')).not.toBeInTheDocument();
        expect(screen.queryByTestId('log-detail-user-id')).not.toBeInTheDocument();
    });

    it('hides request-context section after collapsing', () => {
        render(
            <AppLogMessageCell
                message="Toggle context"
                data={null}
                requestId="req-xyz"
            />
        );

        const toggle = screen.getByTestId('log-message-toggle');
        fireEvent.click(toggle); // expand
        expect(screen.getByTestId('log-request-context')).toBeInTheDocument();

        fireEvent.click(toggle); // collapse
        expect(screen.queryByTestId('log-request-context')).not.toBeInTheDocument();
    });
});
