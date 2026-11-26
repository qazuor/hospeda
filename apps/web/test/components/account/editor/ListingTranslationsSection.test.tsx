/** HOS-2658: the shared listing translations section (AC-11, AC-12, AC-21, AC-23 UI). */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingTranslationsSection } from '@/components/account/editor/ListingTranslationsSection.client';

const { get, saveManual, translateWithAi, addToast } = vi.hoisted(() => ({
    get: vi.fn(),
    saveManual: vi.fn(),
    translateWithAi: vi.fn(),
    addToast: vi.fn()
}));
vi.mock('@/lib/api/endpoints-protected-translations', () => ({
    listingTranslationsApi: { get, saveManual, translateWithAi }
}));
vi.mock('@/store/toast-store', () => ({ addToast }));

const ID = '0c9f4d2e-1b6a-4c3d-9e8f-7a6b5c4d3e2f';
type State = 'auto' | 'manual' | 'stale' | 'pending' | 'noQuota' | 'noEntitlement' | 'noSource';
type Field = 'name' | 'summary' | 'description' | 'richDescription' | 'entryNote';

function pair(value: string, state: State) {
    return { value, state, translatedAt: state === 'pending' ? null : '2026-11-20T10:00:00.000Z' };
}

function entry(
    field: Field,
    source: string,
    en: ReturnType<typeof pair>,
    pt: ReturnType<typeof pair>
) {
    return { field, source, locales: { en, pt } };
}

function response({
    vertical = 'venue',
    ai = 'available',
    fields
}: {
    readonly vertical?: 'accommodation' | 'venue' | 'experience';
    readonly ai?: 'available' | 'quota' | 'entitlement';
    readonly fields: ReturnType<typeof entry>[];
}) {
    return { listingId: ID, vertical, ai: { status: ai }, fields };
}

const VENUE = response({
    fields: [
        entry('name', 'La Parrilla', pair('The Grill', 'auto'), pair('A Grelha', 'auto')),
        entry('description', 'Carnes', pair('Meat', 'auto'), pair('', 'pending')),
        entry('entryNote', 'Gratis hasta la 1', pair('Free', 'auto'), pair('Grátis', 'auto'))
    ]
});

const LABELS = { name: 'Datos básicos', description: 'Datos básicos', entryNote: 'Noche' };

function renderSection(vertical: 'accommodation' | 'venue' | 'experience' = 'venue') {
    return render(
        <ListingTranslationsSection
            locale="es"
            vertical={vertical}
            listingId={ID}
            sourceSectionLabels={LABELS}
        />
    );
}

function tab(name: string) {
    return screen.getByRole('tab', { name: new RegExp(`^${name}`) });
}

describe('ListingTranslationsSection', () => {
    beforeEach(() => vi.resetAllMocks());

    it('renders ES | EN | PT tabs with locale-labelled controls after the GET', async () => {
        // Arrange
        get.mockResolvedValue({ ok: true, data: VENUE });

        // Act
        renderSection();

        // Assert
        expect(await screen.findByLabelText('Descripción (EN)')).toHaveValue('Meat');
        expect(get).toHaveBeenCalledWith({ vertical: 'venue', id: ID });
        expect(screen.getAllByRole('tab').map((item) => item.textContent?.slice(0, 2))).toEqual([
            'ES',
            'EN',
            'PT'
        ]);
        expect(screen.getByLabelText('Nombre (EN)')).toHaveValue('The Grill');
        expect(screen.getAllByRole('button', { name: 'Guardar' })).toHaveLength(3);
        expect(screen.getAllByRole('button', { name: 'Traducir con IA' })).toHaveLength(3);
    });

    it('shows the Spanish source read-only with the section where it is edited', async () => {
        // Arrange
        get.mockResolvedValue({ ok: true, data: VENUE });
        renderSection();
        await screen.findByLabelText('Nombre (EN)');

        // Act
        fireEvent.click(tab('ES'));

        // Assert
        const panel = screen.getByRole('tabpanel', { hidden: false });
        expect(within(panel).queryByRole('textbox')).toBeNull();
        expect(within(panel).getByText('La Parrilla')).toBeInTheDocument();
        expect(
            within(panel).getAllByText('Este texto se edita en la sección «Datos básicos».')
        ).toHaveLength(2);
        expect(
            within(panel).getByText('Este texto se edita en la sección «Noche».')
        ).toBeInTheDocument();
    });

    it('renders the entry note row for a venue and not for an accommodation', async () => {
        // Arrange
        get.mockResolvedValueOnce({ ok: true, data: VENUE });
        const { unmount } = renderSection('venue');
        expect(await screen.findByLabelText('Nota de entrada (EN)')).toHaveValue('Free');
        unmount();
        get.mockResolvedValueOnce({
            ok: true,
            data: response({ vertical: 'accommodation', fields: VENUE.fields.slice(0, 2) })
        });

        // Act
        renderSection('accommodation');

        // Assert
        await screen.findByLabelText('Nombre (EN)');
        expect(screen.queryByLabelText('Nota de entrada (EN)')).toBeNull();
        expect(get).toHaveBeenLastCalledWith({ vertical: 'accommodation', id: ID });
    });

    it('saves a manual pair through the PUT and re-renders the returned state', async () => {
        // Arrange
        get.mockResolvedValue({ ok: true, data: VENUE });
        const saved = response({
            fields: [
                entry(
                    'name',
                    'La Parrilla',
                    pair('Port Grill', 'manual'),
                    pair('A Grelha', 'auto')
                ),
                ...VENUE.fields.slice(1)
            ]
        });
        saveManual.mockResolvedValue({ ok: true, data: saved });
        renderSection();
        const input = await screen.findByLabelText('Nombre (EN)');
        const row = input.closest('[data-pair]') as HTMLElement;
        expect(within(row).getByRole('button', { name: 'Guardar' })).toBeDisabled();

        // Act
        fireEvent.change(input, { target: { value: 'Port Grill' } });
        fireEvent.click(within(row).getByRole('button', { name: 'Guardar' }));

        // Assert
        await waitFor(() => expect(addToast).toHaveBeenCalledTimes(1));
        expect(saveManual).toHaveBeenCalledWith({
            vertical: 'venue',
            id: ID,
            field: 'name',
            locale: 'en',
            value: 'Port Grill'
        });
        expect(addToast).toHaveBeenCalledWith({ type: 'success', message: 'Traducción guardada' });
        expect(screen.getByLabelText('Nombre (EN)')).toHaveValue('Port Grill');
        expect(screen.getByText('Corregida por vos').closest('[data-pair-state]')).toHaveAttribute(
            'data-pair-state',
            'manual'
        );
    });

    it('shows a save validation error under the control and keeps the draft', async () => {
        // Arrange
        get.mockResolvedValue({ ok: true, data: VENUE });
        saveManual.mockResolvedValue({
            ok: false,
            error: { status: 400, code: 'VALIDATION_ERROR', message: 'Invalid' }
        });
        renderSection();
        const input = await screen.findByLabelText('Nombre (EN)');
        const row = input.closest('[data-pair]') as HTMLElement;

        // Act
        fireEvent.change(input, { target: { value: 'x'.repeat(101) } });
        fireEvent.click(within(row).getByRole('button', { name: 'Guardar' }));

        // Assert
        expect(await within(row).findByText('Los datos enviados no son válidos.')).toBeVisible();
        expect(addToast).not.toHaveBeenCalled();
        expect(screen.getByLabelText('Nombre (EN)')).toHaveValue('x'.repeat(101));
    });

    it('disables «Traducir con IA» with the visible quota reason and never calls the API', async () => {
        // Arrange
        get.mockResolvedValue({
            ok: true,
            data: response({
                ai: 'quota',
                fields: [entry('name', 'La Parrilla', pair('', 'noQuota'), pair('', 'noQuota'))]
            })
        });
        renderSection();
        const input = await screen.findByLabelText('Nombre (EN)');
        const row = input.closest('[data-pair]') as HTMLElement;
        const button = within(row).getByRole('button', { name: 'Traducir con IA' });

        // Act
        fireEvent.click(button);

        // Assert
        expect(button).toHaveAttribute('aria-disabled', 'true');
        const reason = within(row).getByText('Llegaste al cupo de traducciones de este mes');
        expect(button).toHaveAttribute('aria-describedby', reason.id);
        const listItem = row.closest('[data-translation-row]') as HTMLElement;
        expect(
            within(listItem).getByText('Sin traducción automática: llegaste al cupo del mes')
        ).toBeInTheDocument();
        expect(translateWithAi).not.toHaveBeenCalled();
    });

    it('shows the stale alert linked to the control and allows saving it unchanged', async () => {
        // Arrange
        get.mockResolvedValue({
            ok: true,
            data: response({
                fields: [
                    entry(
                        'description',
                        'Carnes',
                        pair('Grilled meat', 'stale'),
                        pair('', 'pending')
                    )
                ]
            })
        });
        renderSection();

        // Act
        const input = await screen.findByLabelText('Descripción (EN)');

        // Assert
        const row = input.closest('[data-pair]') as HTMLElement;
        const alert = within(row).getByText(
            'El texto en español cambió, esta traducción puede estar desactualizada'
        );
        const staleId = 'lts-description-en-stale';
        expect(alert.closest(`#${staleId}`)).not.toBeNull();
        expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(staleId);
        expect(within(row).getByRole('button', { name: 'Guardar' })).toBeEnabled();
        expect(within(row).getByRole('button', { name: 'Traducir con IA' })).toHaveAttribute(
            'aria-disabled',
            'false'
        );
    });

    it('translates one pair with AI and replaces the state with the response', async () => {
        // Arrange
        get.mockResolvedValue({ ok: true, data: VENUE });
        const translated = response({
            fields: [
                VENUE.fields[0],
                entry(
                    'description',
                    'Carnes',
                    pair('Meat', 'auto'),
                    pair('Carnes grelhadas', 'auto')
                ),
                VENUE.fields[2]
            ]
        });
        translateWithAi.mockResolvedValue({ ok: true, data: translated });
        renderSection();
        await screen.findByLabelText('Nombre (EN)');
        fireEvent.click(tab('PT'));
        const row = screen.getByLabelText('Descripción (PT)').closest('[data-pair]') as HTMLElement;

        // Act
        fireEvent.click(within(row).getByRole('button', { name: 'Traducir con IA' }));

        // Assert
        await waitFor(() =>
            expect(screen.getByLabelText('Descripción (PT)')).toHaveValue('Carnes grelhadas')
        );
        expect(translateWithAi).toHaveBeenCalledWith({
            vertical: 'venue',
            id: ID,
            field: 'description',
            locales: ['pt']
        });
        expect(addToast).toHaveBeenCalledWith({ type: 'success', message: 'Traducción generada' });
    });

    it('on a 403 from AI shows the translated gate message and reloads the state', async () => {
        // Arrange
        get.mockResolvedValue({ ok: true, data: VENUE });
        translateWithAi.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'LIMIT_REACHED', message: 'Limit reached' }
        });
        renderSection();
        const row = (await screen.findByLabelText('Nombre (EN)')).closest(
            '[data-pair]'
        ) as HTMLElement;

        // Act
        fireEvent.click(within(row).getByRole('button', { name: 'Traducir con IA' }));

        // Assert
        await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
        expect(addToast).toHaveBeenCalledWith({
            type: 'error',
            message: 'Alcanzaste el límite de tu plan. Actualizalo para continuar.'
        });
    });

    it('on a provider failure shows the AI failure copy, not the payment one', async () => {
        // Arrange
        get.mockResolvedValue({ ok: true, data: VENUE });
        translateWithAi.mockResolvedValue({
            ok: false,
            error: { status: 502, code: 'PROVIDER_ERROR', message: 'Upstream failed' }
        });
        renderSection();
        const row = (await screen.findByLabelText('Nombre (EN)')).closest(
            '[data-pair]'
        ) as HTMLElement;

        // Act
        fireEvent.click(within(row).getByRole('button', { name: 'Traducir con IA' }));

        // Assert
        await waitFor(() => expect(addToast).toHaveBeenCalledTimes(1));
        expect(addToast).toHaveBeenCalledWith({
            type: 'error',
            message: 'No pudimos traducir ahora. Probá de nuevo en un rato.'
        });
        expect(get).toHaveBeenCalledTimes(1);
    });

    it('offers «Actualizar» while a pair is pending and re-reads the state', async () => {
        // Arrange
        get.mockResolvedValue({ ok: true, data: VENUE });
        renderSection();
        await screen.findByLabelText('Nombre (EN)');

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

        // Assert
        await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    });

    it('a load failure shows the error with a retry that reads again', async () => {
        // Arrange
        get.mockResolvedValueOnce({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR', message: 'Internal error' }
        });
        get.mockResolvedValueOnce({ ok: true, data: VENUE });
        renderSection();
        expect(await screen.findByText('No pudimos cargar las traducciones')).toBeInTheDocument();
        expect(screen.queryByRole('textbox')).toBeNull();

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

        // Assert
        expect(await screen.findByLabelText('Nombre (EN)')).toHaveValue('The Grill');
        expect(get).toHaveBeenCalledTimes(2);
    });

    it('hides «Guardar» and keeps the control read-only without a Spanish source', async () => {
        // Arrange
        get.mockResolvedValue({
            ok: true,
            data: response({
                fields: [entry('summary', '', pair('', 'noSource'), pair('', 'noSource'))]
            })
        });
        renderSection();

        // Act
        const input = await screen.findByLabelText('Resumen (EN)');

        // Assert
        const row = input.closest('[data-pair]') as HTMLElement;
        expect(input).toHaveAttribute('readonly');
        expect(within(row).queryByRole('button', { name: 'Guardar' })).toBeNull();
        expect(within(row).getByText('Escribí primero el texto en español')).toBeInTheDocument();
    });
});
