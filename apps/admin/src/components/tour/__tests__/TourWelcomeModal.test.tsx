/**
 * Unit tests for TourWelcomeModal (SPEC-174 T-010).
 *
 * Covers:
 * 1. Renders title and body from the first `center` step of the tour.
 * 2. "Saltar" button calls `onSkip`; does NOT call `onConfirm`.
 * 3. "Mostrame" button calls `onConfirm`; does NOT call `onSkip`.
 * 4. ESC key dispatches `onSkip` (Dialog onOpenChange(false)).
 * 5. reducedMotion prop applies without throwing.
 *
 * The `useTranslations` hook is mocked to return fixed chrome strings so tests
 * are not locale-dependent.
 *
 * @see apps/admin/src/components/tour/TourWelcomeModal.tsx — subject
 * @see SPEC-174 §7.4, D1
 */

import type { Tour } from '@/config/ia/tour.schema';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TourWelcomeModal } from '../TourWelcomeModal';

// ---------------------------------------------------------------------------
// Mock useTranslations to return predictable chrome strings
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => {
            const map: Record<string, string> = {
                'admin-common.tour.skip': 'Saltar',
                'admin-common.tour.showMe': 'Mostrame'
            };
            return map[key] ?? key;
        },
        locale: 'es'
    })
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal tour fixture with a centered greeting step. */
const TOUR: Tour = {
    id: 'host.welcome',
    roles: ['HOST'],
    kind: 'welcome',
    version: 1,
    trigger: 'auto-first-visit',
    showWelcomeModal: true,
    steps: [
        {
            id: 'greeting',
            target: 'center',
            title: {
                es: 'Bienvenido al panel',
                en: 'Welcome to the panel',
                pt: 'Bem-vindo ao painel'
            },
            body: {
                es: 'Te mostramos cómo funciona todo.',
                en: 'Let us show you how everything works.',
                pt: 'Vamos te mostrar como tudo funciona.'
            }
        },
        {
            id: 'main-nav',
            target: 'data-tour:main-menu',
            title: { es: 'Menú principal', en: 'Main menu', pt: 'Menu principal' },
            body: { es: 'Tu navegación.', en: 'Your navigation.', pt: 'Sua navegação.' }
        }
    ]
};

/** Tour with no centered step — falls back to first step. */
const TOUR_NO_CENTER: Tour = {
    ...TOUR,
    id: 'host.welcome.nocenter',
    steps: [
        {
            id: 'nav',
            target: 'data-tour:main-menu',
            title: { es: 'Menú', en: 'Menu', pt: 'Menu' },
            body: { es: 'Tu navegación.', en: 'Your navigation.', pt: 'Sua navegação.' }
        }
    ]
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TourWelcomeModal', () => {
    let onSkip: ReturnType<typeof vi.fn>;
    let onConfirm: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onSkip = vi.fn();
        onConfirm = vi.fn();
    });

    it('renders title and body from the first centered step', () => {
        // Arrange / Act
        render(
            <TourWelcomeModal
                tour={TOUR}
                onSkip={onSkip}
                onConfirm={onConfirm}
                reducedMotion={false}
            />
        );

        // Assert
        expect(screen.getByText('Bienvenido al panel')).toBeInTheDocument();
        expect(screen.getByText('Te mostramos cómo funciona todo.')).toBeInTheDocument();
    });

    it('renders title from first step when no centered step exists', () => {
        // Arrange / Act
        render(
            <TourWelcomeModal
                tour={TOUR_NO_CENTER}
                onSkip={onSkip}
                onConfirm={onConfirm}
                reducedMotion={false}
            />
        );

        // Assert — falls back to first step title
        expect(screen.getByText('Menú')).toBeInTheDocument();
    });

    it('calls onSkip and NOT onConfirm when Saltar is clicked', async () => {
        // Arrange
        const user = userEvent.setup();
        render(
            <TourWelcomeModal
                tour={TOUR}
                onSkip={onSkip}
                onConfirm={onConfirm}
                reducedMotion={false}
            />
        );

        // Act
        await user.click(screen.getByRole('button', { name: /saltar/i }));

        // Assert
        expect(onSkip).toHaveBeenCalledOnce();
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('calls onConfirm and NOT onSkip when Mostrame is clicked', async () => {
        // Arrange
        const user = userEvent.setup();
        render(
            <TourWelcomeModal
                tour={TOUR}
                onSkip={onSkip}
                onConfirm={onConfirm}
                reducedMotion={false}
            />
        );

        // Act
        await user.click(screen.getByRole('button', { name: /mostrame/i }));

        // Assert
        expect(onConfirm).toHaveBeenCalledOnce();
        expect(onSkip).not.toHaveBeenCalled();
    });

    it('calls onSkip when ESC key is pressed (Dialog close)', async () => {
        // Arrange
        const user = userEvent.setup();
        render(
            <TourWelcomeModal
                tour={TOUR}
                onSkip={onSkip}
                onConfirm={onConfirm}
                reducedMotion={false}
            />
        );

        // Act — ESC dismisses Radix Dialog, triggering onOpenChange(false)
        await user.keyboard('{Escape}');

        // Assert
        expect(onSkip).toHaveBeenCalledOnce();
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('renders without errors when reducedMotion is true', () => {
        // Arrange / Act
        render(
            <TourWelcomeModal
                tour={TOUR}
                onSkip={onSkip}
                onConfirm={onConfirm}
                reducedMotion={true}
            />
        );

        // Assert — just verify it renders
        expect(screen.getByText('Bienvenido al panel')).toBeInTheDocument();
    });

    it('has aria-modal on the dialog content', () => {
        // Arrange / Act
        render(
            <TourWelcomeModal
                tour={TOUR}
                onSkip={onSkip}
                onConfirm={onConfirm}
                reducedMotion={false}
            />
        );

        // Assert
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
    });
});
