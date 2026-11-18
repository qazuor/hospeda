/**
 * HOS-2347 (D-4): `FeedbackModal` spreads optional `rootDataAttributes` onto
 * its root `<dialog>`, the element a host portals into `document.body`. The web
 * passes `{ 'data-umami-block': '' }` so the session recorder never captures
 * the modal, while this package stays unaware of Umami (no new dependency).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { describe, expect, it, vi } from 'vitest';
import type { FeedbackFormProps } from '../../src/components/FeedbackForm.js';
import { FeedbackModal } from '../../src/components/FeedbackModal.js';

vi.mock('../../src/components/FeedbackForm.js', () => ({
    FeedbackForm: () => <div data-testid="mock-feedback-form" />
}));

const formProps: Omit<FeedbackFormProps, 'onClose'> = {
    apiUrl: 'http://localhost:3001',
    appSource: 'web'
};

/** Renders the modal the way FeedbackHeadlessHost does: portaled to body. */
function renderPortaled(rootDataAttributes?: Readonly<Record<`data-${string}`, string>>) {
    return render(
        createPortal(
            <FeedbackModal
                isOpen={true}
                onClose={vi.fn()}
                formProps={formProps}
                {...(rootDataAttributes ? { rootDataAttributes } : {})}
            />,
            document.body
        )
    );
}

describe('FeedbackModal rootDataAttributes (HOS-2347 AC-B4)', () => {
    it('puts the attribute on the portal root under document.body', () => {
        // Arrange / Act
        renderPortaled({ 'data-umami-block': '' });

        // Assert
        const root = document.body.querySelector(':scope > dialog[data-feedback-modal]');
        expect(root).not.toBeNull();
        expect(root?.getAttribute('data-umami-block')).toBe('');
    });

    it('omits it without the prop', () => {
        renderPortaled();

        const root = document.body.querySelector(':scope > dialog[data-feedback-modal]');
        expect(root).not.toBeNull();
        expect(root?.hasAttribute('data-umami-block')).toBe(false);
    });

    it('never lets a host override the modal own attributes', () => {
        renderPortaled({ 'data-testid': 'hijacked', 'data-feedback-modal': 'x' });

        const root = document.body.querySelector(':scope > dialog');
        expect(root?.getAttribute('data-testid')).toBe('feedback-modal-dialog');
        expect(root?.getAttribute('data-feedback-modal')).toBe('');
    });

    it('adds no dependency to the package (D-4)', () => {
        const pkg = JSON.parse(
            readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8')
        ) as { dependencies?: Record<string, string>; peerDependencies?: Record<string, string> };
        const names = [
            ...Object.keys(pkg.dependencies ?? {}),
            ...Object.keys(pkg.peerDependencies ?? {})
        ];
        expect(names.some((name) => /umami|analytics/i.test(name))).toBe(false);
    });
});
