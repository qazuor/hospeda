/**
 * @file GastronomyReviewForm.test.tsx
 * @description Unit tests for GastronomyReviewForm.client.tsx (HOS-190 slice 3,
 * form 11). Focused on the client-side title/content min-length gate added to
 * mirror DestinationReviewSidebarCard.client.tsx's pattern — the API does not
 * return per-field errors in production, so this validation is the only gate.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GastronomyReviewForm } from '@/components/gastronomy/GastronomyReviewForm.client';
import { buildAuthSnapshot } from '../../helpers/auth-session';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/lib/api-errors', () => ({
    translateApiError: ({ fallback }: { error: unknown; locale: string; fallback: string }) =>
        fallback
}));

vi.mock('@/lib/cn', () => ({
    cn: (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('@/components/gastronomy/GastronomyReviewForm.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// HOS-369 WB0-4: the component resolves the session client-side via
// `useAccountPermissions`, which reads `auth-cache`. See test/helpers/auth-session.ts.
const mockReadCachedAuthMe = vi.fn();

vi.mock('@/lib/auth-cache', () => ({
    readCachedAuthMe: () => mockReadCachedAuthMe(),
    fetchAuthMe: () => new Promise(() => undefined),
    writeCachedAuthMe: () => undefined,
    resetInFlightAuthMe: () => undefined
}));

const DEFAULT_PROPS = {
    gastronomyId: 'gastro-123',
    gastronomyName: 'La Parrilla de Juan',
    locale: 'es' as const,
    apiUrl: 'http://localhost:3001',
    signInHref: '/es/auth/signin'
};

type FormProps = Parameters<typeof GastronomyReviewForm>[0];

/**
 * Render the card for a signed-in visitor by default. `isAuthenticated` is no
 * longer a prop — it arranges the session the component resolves.
 */
function renderForm({
    isAuthenticated = true,
    ...overrides
}: Partial<FormProps> & { readonly isAuthenticated?: boolean } = {}) {
    mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated }));
    return render(
        <GastronomyReviewForm
            {...DEFAULT_PROPS}
            {...overrides}
        />
    );
}

function setupDialogMocks() {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute('open');
    });
}

function openDialog() {
    fireEvent.click(screen.getByRole('button', { name: /dejar reseña/i }));
}

function rateFiveStars() {
    fireEvent.click(screen.getByRole('radio', { name: '5' }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GastronomyReviewForm — title/content min-length gate (HOS-190)', () => {
    beforeEach(() => {
        setupDialogMocks();
    });

    it('disables submit and shows a field error when title is 1-2 chars', () => {
        renderForm();
        openDialog();
        rateFiveStars();

        fireEvent.change(screen.getByPlaceholderText(/resumen de tu experiencia/i), {
            target: { value: 'ab' }
        });

        expect(screen.getByRole('button', { name: /enviar reseña/i })).toBeDisabled();
        expect(screen.getByText('El título debe tener al menos 3 caracteres')).toBeInTheDocument();
    });

    it('disables submit and shows a field error when content is 1-9 chars', () => {
        renderForm();
        openDialog();
        rateFiveStars();

        fireEvent.change(screen.getByPlaceholderText(/comparte tu experiencia en detalle/i), {
            target: { value: 'too short' }
        });

        expect(screen.getByRole('button', { name: /enviar reseña/i })).toBeDisabled();
        expect(
            screen.getByText('El comentario debe tener al menos 10 caracteres')
        ).toBeInTheDocument();
    });

    it('does NOT call fetch when title is under the minimum and the form is submitted', () => {
        vi.stubGlobal('fetch', vi.fn());
        renderForm();
        openDialog();
        rateFiveStars();

        fireEvent.change(screen.getByPlaceholderText(/resumen de tu experiencia/i), {
            target: { value: 'ab' }
        });

        const form = document.querySelector('form') as HTMLFormElement;
        fireEvent.submit(form);

        expect(global.fetch).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    it('allows submit with empty (optional) title and content once rated', () => {
        renderForm();
        openDialog();
        rateFiveStars();

        expect(screen.getByRole('button', { name: /enviar reseña/i })).not.toBeDisabled();
    });

    it('re-enables submit once title/content reach their minimums', () => {
        renderForm();
        openDialog();
        rateFiveStars();

        const titleInput = screen.getByPlaceholderText(/resumen de tu experiencia/i);
        const contentTextarea = screen.getByPlaceholderText(/comparte tu experiencia en detalle/i);

        fireEvent.change(titleInput, { target: { value: 'ab' } });
        fireEvent.change(contentTextarea, { target: { value: 'short' } });
        expect(screen.getByRole('button', { name: /enviar reseña/i })).toBeDisabled();

        fireEvent.change(titleInput, { target: { value: 'Buena experiencia' } });
        fireEvent.change(contentTextarea, {
            target: { value: 'Volvería sin dudas, todo excelente.' }
        });
        expect(screen.getByRole('button', { name: /enviar reseña/i })).not.toBeDisabled();
    });
});

describe('GastronomyReviewForm — client-side session resolution (HOS-369 WB0-4)', () => {
    beforeEach(() => {
        setupDialogMocks();
    });

    it('shows the sign-in card for a guest', () => {
        renderForm({ isAuthenticated: false });
        expect(screen.getByText(/Necesitás una cuenta para dejar tu reseña/i)).toBeInTheDocument();
    });

    it('no longer accepts isAuthenticated — removed from GastronomyReviewForm props (HOS-369 WB0-5)', () => {
        // Assert — this only typechecks if the field is gone. If a future
        // change resurrects it, `@ts-expect-error` starts reporting an
        // unused-directive error and typecheck fails.
        // @ts-expect-error — isAuthenticated was removed; session is resolved client-side via useAccountPermissions.
        const props: FormProps = {
            ...DEFAULT_PROPS,
            isAuthenticated: false
        };
        expect(props.gastronomyId).toBe(DEFAULT_PROPS.gastronomyId);
    });

    it('shows the review CTA for a signed-in visitor — state comes only from the session, never a prop', () => {
        // Cached anonymous HTML served to a reader who has a session.
        // There is no prop left that could disagree with that session.
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
        render(<GastronomyReviewForm {...DEFAULT_PROPS} />);

        expect(screen.getByRole('button', { name: /dejar reseña/i })).toBeInTheDocument();
        expect(
            screen.queryByText(/Necesitás una cuenta para dejar tu reseña/i)
        ).not.toBeInTheDocument();
    });
});
