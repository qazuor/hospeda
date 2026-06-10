/**
 * BrowserGateBanner tests — SPEC-176 T-008.
 *
 * Detection is capability-based (CSS.supports), never UA parsing. These tests
 * stub CSS.supports and sessionStorage to exercise the four behaviors in the
 * task AC: shows on unsupported, hides on supported, respects session dismissal,
 * and dismiss click persists + hides.
 *
 * `useTranslations` is mocked globally in test/setup.tsx as `t: (key) => key`,
 * so assertions match on the translation KEY strings.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserGateBanner } from '../BrowserGateBanner';

/** Stubs CSS.supports to return a fixed value for every probe. */
function stubCssSupports(supported: boolean): void {
    vi.stubGlobal('CSS', { supports: () => supported });
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    sessionStorage.clear();
});

describe('BrowserGateBanner', () => {
    it('renders an alert banner when the browser lacks the required CSS features', () => {
        stubCssSupports(false);

        render(<BrowserGateBanner />);

        const banner = screen.getByRole('alert');
        expect(banner).toBeInTheDocument();
        expect(screen.getByText('admin-common.browserGate.title')).toBeInTheDocument();
    });

    it('renders nothing when the browser supports the required CSS features', () => {
        stubCssSupports(true);

        const { container } = render(<BrowserGateBanner />);

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when the banner was already dismissed this session', () => {
        stubCssSupports(false);
        sessionStorage.setItem('browserGateDismissed', '1');

        render(<BrowserGateBanner />);

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('persists dismissal to sessionStorage and hides the banner on dismiss click', () => {
        stubCssSupports(false);

        render(<BrowserGateBanner />);
        expect(screen.getByRole('alert')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('admin-common.browserGate.dismiss'));

        expect(sessionStorage.getItem('browserGateDismissed')).toBe('1');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('links the upgrade CTA to chrome in a new tab with safe rel', () => {
        stubCssSupports(false);

        render(<BrowserGateBanner />);

        const upgrade = screen.getByText('admin-common.browserGate.upgradeLink');
        expect(upgrade).toHaveAttribute('href', 'https://www.google.com/chrome/');
        expect(upgrade).toHaveAttribute('target', '_blank');
        expect(upgrade).toHaveAttribute('rel', 'noopener noreferrer');
    });
});
