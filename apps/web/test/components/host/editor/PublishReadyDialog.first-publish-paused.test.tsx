/**
 * @file PublishReadyDialog.first-publish-paused.test.tsx
 * @description The editor's post-save publish dialog when the click reaches an
 * API whose new signups are frozen (the verdict read before opening was stale):
 * it shows the "publishing new listings is paused — your listing stays a
 * draft" notice and offers only "Seguir editando", never a retry.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishReadyDialog } from '@/components/host/editor/PublishReadyDialog.client';

const publishMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { publish: publishMock }
}));

vi.mock('@/components/billing/PaidSignupsPausedNotice.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

const ES_PAUSED_BODY =
    'Por el momento pausamos la publicación de fichas nuevas. Tu ficha queda guardada como borrador y vas a poder publicarla cuando se reanuden.';

beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
        value: { href: '', pathname: '/' },
        writable: true,
        configurable: true
    });
});

describe('PublishReadyDialog — first publish paused', () => {
    it('shows the paused notice and drops the publish action on NEW_PAID_SIGNUPS_FROZEN', async () => {
        // Arrange
        publishMock.mockResolvedValue({
            ok: false,
            error: {
                status: 409,
                code: 'NEW_PAID_SIGNUPS_FROZEN',
                reason: 'FIRST_PUBLISH_PAUSED',
                message: 'Publishing new listings is temporarily paused.'
            }
        });
        const user = userEvent.setup();
        render(
            <PublishReadyDialog
                isOpen
                onClose={vi.fn()}
                locale="es"
                accommodationId="acc-1"
                startsTrial
                trialDays={30}
            />
        );

        // Act
        await user.click(screen.getByText('Publicar ahora'));

        // Assert
        await waitFor(() => {
            expect(screen.getByTestId('publish-ready-paused-notice')).toHaveTextContent(
                ES_PAUSED_BODY
            );
        });
        expect(screen.queryByText('Publicar ahora')).not.toBeInTheDocument();
        expect(screen.getByText('Seguir editando')).toBeInTheDocument();
        expect(window.location.href).toBe('');
    });
});
