/**
 * @file PublishButton.qr-notice.test.tsx
 * @description HOS-2688: a listing's first publish queues ONE "your QR is
 * ready" toast for the page the reload lands on, linking to the listing's QR
 * page. A second publish of the same listing (after an unpublish) queues
 * nothing; a publish without `qrNotice` (a republish) queues nothing.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishButton } from '@/components/host/PublishButton.client';
import { LISTING_QR_NOTICE_STORAGE_KEY } from '@/lib/listing/listing-qr-page';

const verticalPublish = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { publish: vi.fn() },
    publishApi: { publish: verticalPublish }
}));

const PENDING_TOAST_KEY = 'hospeda.pendingToast';
const COVERED = { kind: 'covered', canPublish: true, startsTrial: false, trialDays: null } as const;
const QR_NOTICE = {
    message: '¡Tu ficha ya está publicada! Ya tenés tu código QR para imprimir.',
    actionLabel: 'Ver mi código QR',
    href: '/es/mi-cuenta/comercio/venue/listing-1/codigo-qr/'
};

const reload = vi.fn();

function renderButton(overrides: Record<string, unknown> = {}) {
    return render(
        <PublishButton
            vertical="venue"
            listingId="listing-1"
            locale="es"
            label="Publicar"
            confirmTitle="¿Publicar?"
            confirmNote="Se verá públicamente."
            confirmYes="Sí, publicar"
            confirmNo="Cancelar"
            errorText="Error"
            subscriptionRequiredMessage="Suscripción requerida"
            subscriptionRequiredCta="Ver planes"
            missingRequirementsMessage="Faltan datos"
            missingRequirementsCta="Editar"
            affordance={COVERED}
            checkFailedText="No pudimos comprobar."
            confirmTrialNote=""
            choosePlanLabel="Elegir plan"
            {...overrides}
        />
    );
}

async function publish(overrides: Record<string, unknown> = {}) {
    const user = userEvent.setup();
    const view = renderButton(overrides);
    await user.click(screen.getByRole('button', { name: 'Publicar' }));
    await user.click(screen.getByRole('button', { name: 'Sí, publicar' }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    view.unmount();
}

function pendingToast(): unknown {
    const raw = window.sessionStorage.getItem(PENDING_TOAST_KEY);
    return raw === null ? null : JSON.parse(raw);
}

beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    verticalPublish.mockResolvedValue({ ok: true, data: {} });
    vi.stubGlobal('location', { ...window.location, reload });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('PublishButton — HOS-2688 one-time QR notice', () => {
    it('queues the notice, with the QR-page link, on the first publish', async () => {
        await publish({ qrNotice: QR_NOTICE });

        expect(pendingToast()).toMatchObject({
            type: 'success',
            message: QR_NOTICE.message,
            action: { label: QR_NOTICE.actionLabel, href: QR_NOTICE.href }
        });
        expect(
            JSON.parse(window.localStorage.getItem(LISTING_QR_NOTICE_STORAGE_KEY) ?? '[]')
        ).toEqual(['listing-1']);
    });

    it('queues nothing the second time the same listing is published', async () => {
        await publish({ qrNotice: QR_NOTICE });
        window.sessionStorage.clear();

        await publish({ qrNotice: QR_NOTICE });

        expect(pendingToast()).toBeNull();
    });

    it('queues nothing for a publish that carries no notice (a republish)', async () => {
        await publish();

        expect(pendingToast()).toBeNull();
        expect(window.localStorage.getItem(LISTING_QR_NOTICE_STORAGE_KEY)).toBeNull();
    });

    it('queues nothing when the publish is refused', async () => {
        verticalPublish.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR' }
        });
        const user = userEvent.setup();
        renderButton({ qrNotice: QR_NOTICE });
        await user.click(screen.getByRole('button', { name: 'Publicar' }));
        await user.click(screen.getByRole('button', { name: 'Sí, publicar' }));

        await screen.findByText('Error');
        expect(reload).not.toHaveBeenCalled();
        expect(pendingToast()).toBeNull();
        expect(window.localStorage.getItem(LISTING_QR_NOTICE_STORAGE_KEY)).toBeNull();
    });

    it('keeps the once-per-listing claim when the toast cannot be queued', async () => {
        const realSetItem = Storage.prototype.setItem;
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
            this: Storage,
            key: string,
            value: string
        ) {
            if (this === window.sessionStorage) throw new Error('QuotaExceededError');
            realSetItem.call(this, key, value);
        });

        await publish({ qrNotice: QR_NOTICE });

        expect(pendingToast()).toBeNull();
        expect(window.localStorage.getItem(LISTING_QR_NOTICE_STORAGE_KEY)).toBeNull();

        vi.restoreAllMocks();
        await publish({ qrNotice: QR_NOTICE });
        expect(pendingToast()).toMatchObject({ message: QR_NOTICE.message });
    });
});
