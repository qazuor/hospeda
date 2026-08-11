/**
 * Guards that the Turnstile widget only mounts while the feedback modal is
 * open (HOS-369).
 *
 * ## Why this exists
 *
 * `FeedbackModal` renders `FeedbackForm` unconditionally — it drives
 * visibility through the native `<dialog>`'s `showModal()`, never by
 * unmounting the form. So a `<Turnstile>` rendered on `turnstileSiteKey`
 * alone mounts on EVERY page that includes the feedback host, which in
 * `apps/web` is every page (`BaseLayout.astro` mounts
 * `FeedbackHeadlessHost`).
 *
 * `@marsidev/react-turnstile` injects `challenges.cloudflare.com/turnstile/v0/api.js`
 * on mount. Measured on the staging home with a cold Chrome trace, that script
 * cost **1,626 ms of main-thread `FunctionCall` time** — the single largest
 * contributor to Total Blocking Time, which is 30 % of the Lighthouse
 * performance score. It was arming an anti-bot check for a form nobody had
 * opened.
 *
 * The regression this guards against is invisible in every other test: the
 * form still works, the widget still challenges, the token still submits. Only
 * a performance trace shows the cost. Hence a dedicated assertion.
 */
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackForm } from '../../src/components/FeedbackForm.js';

vi.mock('../../src/hooks/useAutoCollect.js', () => ({
    useAutoCollect: () => ({
        environment: { timestamp: new Date().toISOString(), appSource: 'web' as const },
        updateField: vi.fn()
    })
}));

vi.mock('../../src/hooks/useFeedbackSubmit.js', () => ({
    useFeedbackSubmit: () => ({
        state: { isSubmitting: false, error: null, result: null },
        submit: vi.fn(),
        reset: vi.fn()
    })
}));

/**
 * Stands in for the real widget and records every mount, so the assertion is
 * about the component actually mounting — which is what triggers the script
 * injection — rather than about markup that happens to be hidden.
 */
const turnstileMounts = vi.hoisted(() => ({ count: 0 }));

vi.mock('@marsidev/react-turnstile', () => ({
    Turnstile: () => {
        turnstileMounts.count += 1;
        return <div data-testid="turnstile-widget" />;
    }
}));

const BASE_PROPS = {
    apiUrl: 'http://localhost:3001',
    appSource: 'web' as const,
    turnstileSiteKey: '1x00000000000000000000AA'
};

describe('FeedbackForm — Turnstile mounts only while the modal is open', () => {
    it('does NOT mount Turnstile when the modal is closed', () => {
        turnstileMounts.count = 0;

        const { queryByTestId } = render(
            <FeedbackForm
                {...BASE_PROPS}
                isOpen={false}
            />
        );

        expect(
            turnstileMounts.count,
            'Turnstile mounted while the feedback modal was CLOSED. FeedbackModal never ' +
                'unmounts this form, so that means the widget mounts on every page and ' +
                'injects challenges.cloudflare.com/turnstile/v0/api.js — measured at ' +
                '1,626 ms of main-thread time on the staging home. Gate the render on `isOpen`.'
        ).toBe(0);
        expect(queryByTestId('turnstile-widget')).toBeNull();
    });

    it('mounts Turnstile once the modal is open', () => {
        turnstileMounts.count = 0;

        const { getByTestId } = render(
            <FeedbackForm
                {...BASE_PROPS}
                isOpen={true}
            />
        );

        expect(
            turnstileMounts.count,
            'Turnstile did not mount with the modal OPEN — the anti-bot check would ' +
                'never run and the server is fail-closed on a missing token.'
        ).toBe(1);
        expect(getByTestId('turnstile-widget')).toBeTruthy();
    });

    it('does not mount Turnstile when no site key is configured, even when open', () => {
        turnstileMounts.count = 0;

        render(
            <FeedbackForm
                apiUrl="http://localhost:3001"
                appSource="web"
                isOpen={true}
            />
        );

        expect(turnstileMounts.count).toBe(0);
    });
});
