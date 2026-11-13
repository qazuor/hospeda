/**
 * @file UnpublishButton.test.tsx
 * @description TEST:V8a:7 rows 2 and 25 (HOS-1492): the unpublish confirmation
 * says the trial clock keeps running and that the recurring boosts keep being
 * charged, when — and only when — the card hands those lines in from the
 * listing-notices read. Without them (no trial, no boosts, or a failed read)
 * the confirmation is today's.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnpublishButton } from '../../../src/components/host/UnpublishButton.client';
import { createTranslations } from '../../../src/lib/i18n';
import { buildUnpublishConfirmNotes } from '../../../src/lib/listing/listing-notices';

vi.mock('../../../src/components/host/UnpublishButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, p) => String(p) })
}));

const unpublishMock = vi.fn();
vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    accommodationEditApi: {
        unpublish: (args: { id: string }) => unpublishMock(args)
    }
}));

const es = createTranslations('es');
const TRIAL_LINE = 'La prueba gratis sigue corriendo: despublicar no detiene el reloj del trial.';
const RECURRING_LINE =
    'Tenés 1 destaque recurrente sobre esta ficha: se sigue cobrando aunque no esté publicada, hasta que lo des de baja.';

function renderConfirming({
    trialRunning,
    recurringListingAddons
}: {
    readonly trialRunning: boolean | null;
    readonly recurringListingAddons: number | null;
}) {
    const notes = buildUnpublishConfirmNotes({
        locale: 'es',
        t: es.t,
        tPlural: es.tPlural,
        trialRunning,
        item:
            recurringListingAddons === null
                ? undefined
                : {
                      listingId: '2f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11',
                      publicationStatus: 'PUBLISHED' as never,
                      recurringListingAddons,
                      recurringListingAddonItems: Array.from(
                          { length: recurringListingAddons },
                          (_, index) => ({
                              addonVersionId: `version-${index}`,
                              name: `Destaque ${index + 1}`
                          })
                      ),
                      notices: []
                  }
    });
    render(
        <UnpublishButton
            accommodationId="acc-1"
            locale="es"
            label="Despublicar"
            confirmText="¿Despublicar esta propiedad?"
            confirmYes="Sí, despublicar"
            confirmNo="Cancelar"
            errorText="No se pudo despublicar."
            trialNote={notes.trialNote}
            recurringNote={notes.recurringNote}
            recurringAddonNames={notes.recurringAddonNames}
            withdrawHref={notes.withdrawHref}
            withdrawLabel={es.t('host.properties.card.recurringWithdrawLink')}
        />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Despublicar' }));
}

describe('TEST:V8a:7 UnpublishButton — rows 2 and 25 in the confirmation', () => {
    afterEach(() => vi.clearAllMocks());

    it('row 2: says the trial clock keeps running while the trial runs', () => {
        // Act
        renderConfirming({ trialRunning: true, recurringListingAddons: 0 });

        // Assert
        expect(screen.getByText('¿Despublicar esta propiedad?')).toBeInTheDocument();
        expect(screen.getByText(TRIAL_LINE)).toBeInTheDocument();
        expect(screen.queryByText(RECURRING_LINE)).not.toBeInTheDocument();
    });

    it('row 25: says the recurring boosts keep being charged while unpublished', () => {
        // Act
        renderConfirming({ trialRunning: false, recurringListingAddons: 1 });

        // Assert
        expect(screen.getByText(RECURRING_LINE)).toBeInTheDocument();
        expect(screen.queryByText(TRIAL_LINE)).not.toBeInTheDocument();
    });

    it('a failed read keeps today confirmation, with no invented line', () => {
        // Act
        renderConfirming({ trialRunning: null, recurringListingAddons: null });

        // Assert
        expect(screen.getByText('¿Despublicar esta propiedad?')).toBeInTheDocument();
        expect(screen.queryByTestId('unpublish-trial-note')).not.toBeInTheDocument();
        expect(screen.queryByTestId('unpublish-recurring-note')).not.toBeInTheDocument();
    });

    it('the lines appear only in the confirmation, not before it', () => {
        // Arrange
        render(
            <UnpublishButton
                accommodationId="acc-1"
                locale="es"
                label="Despublicar"
                confirmText="¿Despublicar esta propiedad?"
                confirmYes="Sí, despublicar"
                confirmNo="Cancelar"
                errorText="No se pudo despublicar."
                trialNote={TRIAL_LINE}
            />
        );

        // Assert
        expect(screen.queryByText(TRIAL_LINE)).not.toBeInTheDocument();
        expect(unpublishMock).not.toHaveBeenCalled();
    });
});

describe('TEST:B13b:2 AC:B13b:2 — la confirmación nombra los destaques recurrentes y ofrece la baja; sin destaques, no dice nada de ellos', () => {
    it('names two live addons and links their listing to withdrawal', () => {
        renderConfirming({ trialRunning: false, recurringListingAddons: 2 });
        expect(
            screen.getAllByTestId('unpublish-recurring-addon').map((node) => node.textContent)
        ).toEqual(['Destaque 1', 'Destaque 2']);
        expect(screen.getAllByTestId('unpublish-recurring-withdraw-link')).toHaveLength(1);
        expect(screen.getByTestId('unpublish-recurring-withdraw-link')).toHaveAttribute(
            'href',
            '/es/mi-cuenta/complementos/?listing=2f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11#recurring-addons'
        );
    });

    it('renders no recurring note, names or withdrawal link without addons', () => {
        renderConfirming({ trialRunning: false, recurringListingAddons: 0 });
        expect(screen.queryAllByTestId('unpublish-recurring-note')).toHaveLength(0);
        expect(screen.queryAllByTestId('unpublish-recurring-addon')).toHaveLength(0);
        expect(screen.queryAllByTestId('unpublish-recurring-withdraw-link')).toHaveLength(0);
    });
});
