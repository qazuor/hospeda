/**
 * @file TranslationPanel.test.tsx
 * @description Host translation panel — BETA-199 + HOS-317.
 *
 * The panel had no tests at all, which is how BETA-199 survived: the
 * `richDescription` row rendered "—" for every locale forever and the "generate
 * missing translations" button never disappeared, even with everything else fully
 * translated.
 *
 * Covered here:
 *  1. The row is hidden when the owner's plan has no rich description (the API
 *     omits the premium pair), so the button can finally go away.
 *  2. An entitled owner with nothing written keeps the row, marked as having no
 *     source content — and still does not keep the button alive.
 *  3. A NEVER-translated accommodation still offers the button. This is the case
 *     BETA-199 explicitly protects: its source text lives in the plain column, so
 *     a "skip fields with no content in the source locale" check that only reads
 *     the i18n columns would hide the panel for exactly the accommodations that
 *     need it most.
 *  4. Per-field run reporting: which field failed, and in which locales.
 *  5. A run that persisted nothing does not claim success, and the panel never
 *     reloads on its own — it is a fieldset inside the editor's form, and apps/web
 *     has no unsaved-changes guard, so an automatic reload discarded drafts.
 *  6. A finished run is folded back into the rows, because the prop is frozen at
 *     SSR and the reload used to be what refreshed it.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccommodationTranslationData } from '../../../../src/lib/api/types';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/components/host/editor/TranslationPanel.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

// The `t` stub INTERPOLATES. A stub that ignored the third argument would let a
// raw `{{locales}}` reach production with every test still green — the whole
// point of assertion 4 is the rendered string, not the key.
vi.mock('../../../../src/lib/i18n', async (importActual) => ({
    // Spread the real module: `translation-status.ts` reads SUPPORTED_LOCALES from
    // here, and a mock that only declares `createTranslations` would make it
    // undefined at import time.
    ...(await importActual<typeof import('../../../../src/lib/i18n')>()),
    createTranslations: () => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const raw = fallback ?? key;
            if (!params) return raw;
            return Object.keys(params).reduce(
                (acc, name) =>
                    acc.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), String(params[name])),
                raw
            );
        }
    })
}));

const { mockPostProtected } = vi.hoisted(() => ({ mockPostProtected: vi.fn() }));

vi.mock('../../../../src/lib/api/client', () => ({
    apiClient: { postProtected: mockPostProtected }
}));

const { TranslationPanel } = await import(
    '../../../../src/components/host/editor/TranslationPanel.client'
);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A field translated into all three locales. */
const FULLY_TRANSLATED = {
    locales: { es: 'Contenido ES', en: 'Content EN', pt: 'Conteudo PT' },
    plain: 'Contenido ES'
};

/** A field whose Spanish source exists but was never translated. */
const NEVER_TRANSLATED = {
    locales: { es: null, en: null, pt: null },
    plain: 'Contenido ES que nunca se tradujo'
};

/** A field with no content anywhere. */
const EMPTY_FIELD = {
    locales: { es: null, en: null, pt: null },
    plain: null
};

/** Everything translated except `richDescription`, which the plan excludes. */
const NOT_ENTITLED: AccommodationTranslationData = {
    name: FULLY_TRANSLATED,
    summary: FULLY_TRANSLATED,
    description: FULLY_TRANSLATED,
    richDescription: null
};

const ACCOMMODATION_ID = '33333333-3333-4333-8333-333333333333';

function renderPanel(translations: AccommodationTranslationData) {
    return render(
        <TranslationPanel
            locale="es"
            accommodationId={ACCOMMODATION_ID}
            translations={translations}
        />
    );
}

const GENERATE_BUTTON = /Generar traducciones faltantes/i;
const RICH_ROW = /Descripción enriquecida/i;

// ---------------------------------------------------------------------------
// window.location.reload
// ---------------------------------------------------------------------------

const reloadSpy = vi.fn();
const realLocation = window.location;

beforeEach(() => {
    Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: { ...realLocation, reload: reloadSpy }
    });
});

afterEach(() => {
    Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: realLocation
    });
    // `reset`, not `clear`: clearing wipes recorded calls but LEAVES the
    // implementation, so a `mockResolvedValue` leaks into the next test. Benign
    // only while every test that clicks sets its own response — exactly the kind
    // of precondition that stops holding without anyone noticing.
    vi.resetAllMocks();
    vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TranslationPanel — rich description row (BETA-199)', () => {
    it('hides the row and the button when the plan excludes rich description', () => {
        renderPanel(NOT_ENTITLED);

        // RED before the fix: the row rendered with three "—" badges, and because
        // the missing-translation check walked it too, the button stayed forever.
        expect(screen.queryByText(RICH_ROW)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: GENERATE_BUTTON })).not.toBeInTheDocument();
    });

    it('shows the row with its real per-locale state when the plan includes it', () => {
        renderPanel({
            ...NOT_ENTITLED,
            richDescription: {
                locales: { es: '<p>Rica</p>', en: '<p>Rich</p>', pt: null },
                plain: '<p>Rica</p>'
            }
        });

        expect(screen.getByText(RICH_ROW)).toBeInTheDocument();
        // PT is missing on a field that HAS source content, so there is work to do.
        expect(screen.getByRole('button', { name: GENERATE_BUTTON })).toBeInTheDocument();
    });

    it('keeps the row but not the button when entitled with nothing written', () => {
        renderPanel({ ...NOT_ENTITLED, richDescription: EMPTY_FIELD });

        expect(screen.getByText(RICH_ROW)).toBeInTheDocument();
        expect(screen.getByText(/Sin contenido para traducir/i)).toBeInTheDocument();
        // Nothing to translate FROM — the backend would skip the field entirely,
        // so offering to generate it is a promise that can never be kept.
        expect(screen.queryByRole('button', { name: GENERATE_BUTTON })).not.toBeInTheDocument();
    });

    it('does not paint a whitespace-only locale as present', () => {
        // The badge read the value raw while `missingLocalesFor` trims, so a
        // whitespace-only i18n value rendered a green check on the same card whose
        // run counts that locale as missing — the row contradicting itself.
        const { container } = render(
            <TranslationPanel
                locale="es"
                accommodationId={ACCOMMODATION_ID}
                translations={{
                    ...NOT_ENTITLED,
                    name: {
                        locales: { es: 'Nombre', en: 'Name', pt: '   ' },
                        plain: 'Nombre'
                    }
                }}
            />
        );

        // Scope to the row under test — the other three fields are fully
        // translated and would supply PT badges of their own. The CSS-module mock
        // returns class names verbatim, so the badge variant is readable off the DOM.
        const nameCard = [...container.querySelectorAll('.fieldCard')].find((card) =>
            card.querySelector('.fieldName')?.textContent?.includes('Nombre')
        );
        expect(nameCard).toBeDefined();

        const present = [...(nameCard as Element).querySelectorAll('.localeBadgePresent')].map(
            (el) => el.textContent?.trim()
        );
        expect(present).not.toContain('PT');
        // Not vacuous: EN carries real content on this same row and IS present.
        expect(present).toContain('EN');
    });

    it('still offers the button for a NEVER-translated accommodation', () => {
        // The case BETA-199 rules out breaking: no i18n content anywhere, all the
        // source text sitting in the plain columns. Reading only the i18n columns
        // would call every field unsourced and hide the button.
        renderPanel({
            name: NEVER_TRANSLATED,
            summary: NEVER_TRANSLATED,
            description: NEVER_TRANSLATED,
            richDescription: null
        });

        expect(screen.getByRole('button', { name: GENERATE_BUTTON })).toBeInTheDocument();
        expect(screen.queryByText(/Sin contenido para traducir/i)).not.toBeInTheDocument();
    });
});

describe('TranslationPanel — per-field run reporting (HOS-317)', () => {
    const PARTIALLY_TRANSLATED: AccommodationTranslationData = {
        name: NEVER_TRANSLATED,
        summary: NEVER_TRANSLATED,
        description: FULLY_TRANSLATED,
        richDescription: null
    };

    it('names the field and the locales that failed', async () => {
        mockPostProtected.mockResolvedValue({
            ok: true,
            data: {
                translations: [
                    { fieldType: 'name', locale: 'en', success: true, translatedText: 'Name EN' },
                    { fieldType: 'name', locale: 'pt', success: true, translatedText: 'Nome PT' },
                    {
                        fieldType: 'summary',
                        locale: 'en',
                        success: false,
                        error: 'provider timeout'
                    },
                    {
                        fieldType: 'summary',
                        locale: 'pt',
                        success: false,
                        error: 'provider timeout'
                    }
                ]
            }
        });

        renderPanel(PARTIALLY_TRANSLATED);
        fireEvent.click(screen.getByRole('button', { name: GENERATE_BUTTON }));

        // The rendered string, interpolated — not the key, and not a raw
        // `{{locales}}`.
        await waitFor(() => {
            expect(screen.getByText('No se pudo traducir a EN, PT')).toBeInTheDocument();
        });
        expect(screen.getByText(/Traducido/i)).toBeInTheDocument();
        // Partial success: content WAS written, so a refresh is offered — but the
        // page must not reload on its own and take the detail with it.
        expect(reloadSpy).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: /Actualizar la página/i })).toBeInTheDocument();
    });

    it('does not claim success when every translation failed', async () => {
        mockPostProtected.mockResolvedValue({
            ok: true,
            data: {
                translations: [
                    { fieldType: 'name', locale: 'en', success: false, error: 'quota' },
                    { fieldType: 'name', locale: 'pt', success: false, error: 'quota' },
                    { fieldType: 'summary', locale: 'en', success: false, error: 'quota' },
                    { fieldType: 'summary', locale: 'pt', success: false, error: 'quota' }
                ]
            }
        });

        renderPanel(PARTIALLY_TRANSLATED);
        fireEvent.click(screen.getByRole('button', { name: GENERATE_BUTTON }));

        // RED before the fix: the panel branched on the HTTP result alone, so this
        // run reported "Traducciones generadas" and reloaded onto unchanged content.
        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(
                /No se pudo generar ninguna traducción/i
            );
        });
        expect(screen.queryByText(/Traducciones generadas/i)).not.toBeInTheDocument();
        expect(reloadSpy).not.toHaveBeenCalled();
        // Nothing was written — there is nothing to refresh onto.
        expect(
            screen.queryByRole('button', { name: /Actualizar la página/i })
        ).not.toBeInTheDocument();
    });

    it('does not claim success when the backend attempted nothing', async () => {
        mockPostProtected.mockResolvedValue({ ok: true, data: { translations: [] } });

        renderPanel(PARTIALLY_TRANSLATED);
        fireEvent.click(screen.getByRole('button', { name: GENERATE_BUTTON }));

        await waitFor(() => {
            expect(screen.getByText(/No había traducciones pendientes/i)).toBeInTheDocument();
        });
        // Not an error: the backend skipped everything because it was already
        // filled. It must not go through `role="alert"`, and the refresh has to be
        // offered — the DB is ahead of this frozen prop, and reloading is the only
        // way to reconcile.
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Actualizar la página/i })).toBeInTheDocument();
        expect(reloadSpy).not.toHaveBeenCalled();
    });

    it('reports the transport error when the request itself fails', async () => {
        mockPostProtected.mockResolvedValue({
            ok: false,
            error: { status: 429, message: 'Too many requests' }
        });

        renderPanel(PARTIALLY_TRANSLATED);
        fireEvent.click(screen.getByRole('button', { name: GENERATE_BUTTON }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Too many requests');
        });
        // No per-field state survives a request that never reached the fields.
        expect(screen.queryByText(/Generando\.\.\./i)).not.toBeInTheDocument();
        expect(reloadSpy).not.toHaveBeenCalled();
    });

    it('never reloads on its own, even after a fully clean run', async () => {
        // This panel is a fieldset inside the editor's form, and apps/web has no
        // beforeunload guard, so an automatic reload silently threw away whatever
        // the host had typed and not saved. A clean run reports itself and offers
        // the refresh; the host decides when to lose their draft.
        vi.useFakeTimers({ shouldAdvanceTime: true });
        mockPostProtected.mockResolvedValue({
            ok: true,
            data: {
                translations: [
                    { fieldType: 'name', locale: 'en', success: true, translatedText: 'Name EN' },
                    { fieldType: 'name', locale: 'pt', success: true, translatedText: 'Nome PT' },
                    { fieldType: 'summary', locale: 'en', success: true, translatedText: 'S EN' },
                    { fieldType: 'summary', locale: 'pt', success: true, translatedText: 'S PT' }
                ]
            }
        });

        renderPanel(PARTIALLY_TRANSLATED);
        fireEvent.click(screen.getByRole('button', { name: GENERATE_BUTTON }));

        await waitFor(() => {
            expect(screen.getByText(/Traducciones generadas/i)).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: /Actualizar la página/i })).toBeInTheDocument();

        await vi.advanceTimersByTimeAsync(5000);
        expect(reloadSpy).not.toHaveBeenCalled();
    });

    it('folds a finished run into the rows and retires the generate button', async () => {
        // The prop is frozen at SSR and the auto-reload used to be what refreshed
        // it. Without folding the run back in, a clean run left every badge showing
        // a dash under a note reading "Traducido", with the generate button still
        // live — and clicking it returned an empty run the panel reports as an
        // error. BETA-199's symptom on the success path.
        mockPostProtected.mockResolvedValue({
            ok: true,
            data: {
                translations: [
                    { fieldType: 'name', locale: 'en', success: true, translatedText: 'Name EN' },
                    { fieldType: 'name', locale: 'pt', success: true, translatedText: 'Nome PT' },
                    { fieldType: 'summary', locale: 'en', success: true, translatedText: 'S EN' },
                    { fieldType: 'summary', locale: 'pt', success: true, translatedText: 'S PT' }
                ]
            }
        });

        const { container } = renderPanel(PARTIALLY_TRANSLATED);
        fireEvent.click(screen.getByRole('button', { name: GENERATE_BUTTON }));

        await waitFor(() => {
            expect(screen.getByText(/Traducciones generadas/i)).toBeInTheDocument();
        });

        // Nothing left to generate → the button is gone, so it cannot invite a
        // second run that comes back empty.
        expect(screen.queryByRole('button', { name: GENERATE_BUTTON })).not.toBeInTheDocument();

        // And the rows agree with the note: EN/PT are present on the name card now.
        const nameCard = [...container.querySelectorAll('.fieldCard')].find((card) =>
            card.querySelector('.fieldName')?.textContent?.includes('Nombre')
        );
        const present = [...(nameCard as Element).querySelectorAll('.localeBadgePresent')].map(
            (el) => el.textContent?.trim()
        );
        expect(present).toEqual(expect.arrayContaining(['EN', 'PT']));
    });

    it('leaves a failed locale showing its gap after a partial run', async () => {
        // Only successes are folded in — a failed locale must keep reading as
        // missing, or the panel would paper over the very failure it just reported.
        mockPostProtected.mockResolvedValue({
            ok: true,
            data: {
                translations: [
                    { fieldType: 'name', locale: 'en', success: true, translatedText: 'Name EN' },
                    { fieldType: 'name', locale: 'pt', success: false, error: 'provider' },
                    { fieldType: 'summary', locale: 'en', success: true, translatedText: 'S EN' },
                    { fieldType: 'summary', locale: 'pt', success: true, translatedText: 'S PT' }
                ]
            }
        });

        const { container } = renderPanel(PARTIALLY_TRANSLATED);
        fireEvent.click(screen.getByRole('button', { name: GENERATE_BUTTON }));

        await waitFor(() => {
            expect(screen.getByText('No se pudo traducir a PT')).toBeInTheDocument();
        });

        const nameCard = [...container.querySelectorAll('.fieldCard')].find((card) =>
            card.querySelector('.fieldName')?.textContent?.includes('Nombre')
        );
        const present = [...(nameCard as Element).querySelectorAll('.localeBadgePresent')].map(
            (el) => el.textContent?.trim()
        );
        expect(present).toContain('EN');
        expect(present).not.toContain('PT');
        // PT is still a real gap, so the button stays available to retry it.
        expect(screen.getByRole('button', { name: GENERATE_BUTTON })).toBeInTheDocument();
    });

    it('reloads only when the host asks for it', async () => {
        mockPostProtected.mockResolvedValue({
            ok: true,
            data: {
                translations: [
                    { fieldType: 'name', locale: 'en', success: true, translatedText: 'Name EN' },
                    { fieldType: 'name', locale: 'pt', success: true, translatedText: 'Nome PT' },
                    { fieldType: 'summary', locale: 'en', success: true, translatedText: 'S EN' },
                    { fieldType: 'summary', locale: 'pt', success: true, translatedText: 'S PT' }
                ]
            }
        });

        renderPanel(PARTIALLY_TRANSLATED);
        fireEvent.click(screen.getByRole('button', { name: GENERATE_BUTTON }));

        const refresh = await screen.findByRole('button', { name: /Actualizar la página/i });
        fireEvent.click(refresh);

        expect(reloadSpy).toHaveBeenCalledTimes(1);
    });

    it('reports every requested field as in flight while the run is open', async () => {
        // The in-flight per-field report is one of the three headline behaviours
        // and had no positive coverage — only a negative assertion on the
        // transport-error path, which passes harder when the render is deleted.
        let resolveRun: ((value: unknown) => void) | undefined;
        mockPostProtected.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveRun = resolve;
                })
        );

        renderPanel(PARTIALLY_TRANSLATED);
        fireEvent.click(screen.getByRole('button', { name: GENERATE_BUTTON }));

        // Two requested fields (name, summary) — description is fully translated.
        await waitFor(() => {
            expect(screen.getAllByText(/Generando\.\.\./i)).toHaveLength(2);
        });

        resolveRun?.({ ok: true, data: { translations: [] } });
        await waitFor(() => {
            expect(screen.queryByText(/Generando\.\.\./i)).not.toBeInTheDocument();
        });
    });

    it('marks a field the backend skipped as unchanged, not as failed', async () => {
        // `untouched` renders its own note, and the run-level message must not
        // call a skipped field a failure.
        mockPostProtected.mockResolvedValue({
            ok: true,
            data: {
                translations: [
                    { fieldType: 'name', locale: 'en', success: true, translatedText: 'Name EN' },
                    { fieldType: 'name', locale: 'pt', success: true, translatedText: 'Nome PT' }
                ]
            }
        });

        renderPanel(PARTIALLY_TRANSLATED);
        fireEvent.click(screen.getByRole('button', { name: GENERATE_BUTTON }));

        await waitFor(() => {
            expect(screen.getByText(/Sin cambios/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/Traducido/i)).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('names the field without a locale when the backend reports one it cannot name', async () => {
        // `failedLocales` is empty when the failing locale is not one of the three
        // — the failure still stands, and the note must not read "... a " with
        // nothing after it.
        mockPostProtected.mockResolvedValue({
            ok: true,
            data: {
                translations: [
                    { fieldType: 'name', locale: 'fr', success: false, error: 'unsupported' },
                    { fieldType: 'summary', locale: 'en', success: true, translatedText: 'S EN' },
                    { fieldType: 'summary', locale: 'pt', success: true, translatedText: 'S PT' }
                ]
            }
        });

        renderPanel(PARTIALLY_TRANSLATED);
        fireEvent.click(screen.getByRole('button', { name: GENERATE_BUTTON }));

        await waitFor(() => {
            expect(screen.getByText('No se pudo traducir este campo')).toBeInTheDocument();
        });
    });
});

describe('TranslationPanel — content source locale (HOS-317)', () => {
    const NEVER_TRANSLATED_ALL: AccommodationTranslationData = {
        name: NEVER_TRANSLATED,
        summary: NEVER_TRANSLATED,
        description: NEVER_TRANSLATED,
        richDescription: null
    };

    function renderIn(locale: 'es' | 'en' | 'pt') {
        return render(
            <TranslationPanel
                locale={locale}
                accommodationId={ACCOMMODATION_ID}
                translations={NEVER_TRANSLATED_ALL}
            />
        );
    }

    it.each(['es', 'en', 'pt'] as const)('offers generation with the interface in %s', (locale) => {
        // The editor form is populated from the PLAIN columns, so the host is
        // editing Spanish whatever the interface language. Deriving the source
        // from the page locale made the EN and PT views claim there was nothing
        // to translate, on an accommodation whose Spanish text was right there.
        renderIn(locale);
        expect(screen.getByRole('button', { name: GENERATE_BUTTON })).toBeInTheDocument();
        expect(screen.queryByText(/Sin contenido para traducir/i)).not.toBeInTheDocument();
    });

    it('always asks the backend to translate out of Spanish', async () => {
        mockPostProtected.mockResolvedValue({ ok: true, data: { translations: [] } });

        renderIn('pt');
        fireEvent.click(screen.getByRole('button', { name: GENERATE_BUTTON }));

        await waitFor(() => expect(mockPostProtected).toHaveBeenCalled());
        expect(mockPostProtected.mock.calls[0]?.[0]).toMatchObject({
            body: { entityType: 'accommodation', entityId: ACCOMMODATION_ID, sourceLocale: 'es' }
        });
    });
});

describe('TranslationPanel — run state (HOS-317)', () => {
    const PARTIALLY_TRANSLATED: AccommodationTranslationData = {
        name: NEVER_TRANSLATED,
        summary: NEVER_TRANSLATED,
        description: FULLY_TRANSLATED,
        richDescription: null
    };

    const CLEAN_RUN = {
        ok: true,
        data: {
            translations: [
                { fieldType: 'name', locale: 'en', success: true, translatedText: 'Name EN' },
                { fieldType: 'name', locale: 'pt', success: true, translatedText: 'Nome PT' },
                { fieldType: 'summary', locale: 'en', success: true, translatedText: 'S EN' },
                { fieldType: 'summary', locale: 'pt', success: true, translatedText: 'S PT' }
            ]
        }
    };

    it('ignores a second click while a run is open', async () => {
        // The button is `aria-disabled`, not `disabled`: disabling the control the
        // host just activated makes the browser drop focus to <body>, leaving a
        // keyboard user nowhere for up to 90 seconds. Staying focusable means the
        // guard has to live in the handler.
        let resolveRun: ((value: unknown) => void) | undefined;
        mockPostProtected.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveRun = resolve;
                })
        );

        renderPanel(PARTIALLY_TRANSLATED);
        const button = screen.getByRole('button', { name: GENERATE_BUTTON });
        button.focus();
        fireEvent.click(button);

        await waitFor(() => expect(mockPostProtected).toHaveBeenCalledTimes(1));

        expect(button).toHaveAttribute('aria-disabled', 'true');
        // NOT asserting `document.activeElement` here: jsdom does not run the
        // unfocusing steps when an element becomes `disabled`, and `fireEvent.click`
        // never moves focus — so that assertion passes with `disabled` restored and
        // proves nothing. The focus behaviour this exists for needs a real browser.
        // What IS pinned: the attribute, and the in-handler guard below, which is
        // load-bearing precisely because an aria-disabled button still takes clicks.
        fireEvent.click(button);
        expect(mockPostProtected).toHaveBeenCalledTimes(1);

        resolveRun?.({ ok: true, data: { translations: [] } });
    });

    it('announces the per-field region while it changes', async () => {
        // The per-field notes ARE the feature. Without a live region a screen
        // reader gets nothing for the whole run, and then an alert telling it to
        // "check the per-field detail" it was never given.
        mockPostProtected.mockResolvedValue(CLEAN_RUN);

        const { container } = renderPanel(PARTIALLY_TRANSLATED);
        const region = container.querySelector('[aria-live="polite"]');

        expect(region).not.toBeNull();
        // The button is `disabled`-free and therefore in the a11y tree, but the
        // region that mutates is this one, so that is where `aria-busy` belongs.
        fireEvent.click(screen.getByRole('button', { name: GENERATE_BUTTON }));
        await waitFor(() => expect(region).toHaveAttribute('aria-busy', 'true'));

        await waitFor(() => expect(region).toHaveAttribute('aria-busy', 'false'));
    });

    it('does not report a failure when the backend simply had nothing left to do', async () => {
        // Filtering `anyTranslationPersisted` to the requested fields made
        // "nothing persisted" mean two different things: every requested pair
        // FAILED, or every requested pair was SKIPPED because someone filled it
        // between the page render and this click. Reporting the second as
        // "no translation could be generated" invents a failure and invites
        // another 90-second paid run.
        mockPostProtected.mockResolvedValue({
            ok: true,
            data: {
                translations: [
                    {
                        fieldType: 'richDescription',
                        locale: 'en',
                        success: true,
                        translatedText: 'Rich EN'
                    }
                ]
            }
        });

        renderPanel(PARTIALLY_TRANSLATED);
        fireEvent.click(screen.getByRole('button', { name: GENERATE_BUTTON }));

        await waitFor(() => {
            expect(screen.getByText(/No había traducciones pendientes/i)).toBeInTheDocument();
        });
        expect(
            screen.queryByText(/No se pudo generar ninguna traducción/i)
        ).not.toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('keeps offering the refresh after a later run fails outright', async () => {
        // Run 1 writes `name`. Run 2 retries and everything fails. Deriving the
        // offer from the CURRENT run's outcomes takes it away here — stranding the
        // host with no route to what run 1 genuinely saved.
        mockPostProtected.mockResolvedValueOnce({
            ok: true,
            data: {
                translations: [
                    { fieldType: 'name', locale: 'en', success: true, translatedText: 'Name EN' },
                    { fieldType: 'name', locale: 'pt', success: true, translatedText: 'Nome PT' },
                    { fieldType: 'summary', locale: 'en', success: false, error: 'provider' },
                    { fieldType: 'summary', locale: 'pt', success: false, error: 'provider' }
                ]
            }
        });

        renderPanel(PARTIALLY_TRANSLATED);
        fireEvent.click(screen.getByRole('button', { name: GENERATE_BUTTON }));

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: /Actualizar la página/i })
            ).toBeInTheDocument();
        });

        mockPostProtected.mockResolvedValueOnce({
            ok: true,
            data: {
                translations: [
                    { fieldType: 'summary', locale: 'en', success: false, error: 'provider' },
                    { fieldType: 'summary', locale: 'pt', success: false, error: 'provider' }
                ]
            }
        });

        fireEvent.click(screen.getByRole('button', { name: GENERATE_BUTTON }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(
                /No se pudo generar ninguna traducción/i
            );
        });
        expect(screen.getByRole('button', { name: /Actualizar la página/i })).toBeInTheDocument();
    });

    it('ignores a success for a field the panel does not show', async () => {
        // The request carries no field selection, so the backend translates
        // richDescription too — a field this non-entitled host neither sees nor
        // can use. Counting it reported partial success with nothing to show.
        mockPostProtected.mockResolvedValue({
            ok: true,
            data: {
                translations: [
                    { fieldType: 'name', locale: 'en', success: false, error: 'provider' },
                    { fieldType: 'name', locale: 'pt', success: false, error: 'provider' },
                    { fieldType: 'summary', locale: 'en', success: false, error: 'provider' },
                    { fieldType: 'summary', locale: 'pt', success: false, error: 'provider' },
                    {
                        fieldType: 'richDescription',
                        locale: 'en',
                        success: true,
                        translatedText: 'Rich EN'
                    }
                ]
            }
        });

        renderPanel(PARTIALLY_TRANSLATED);
        fireEvent.click(screen.getByRole('button', { name: GENERATE_BUTTON }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(
                /No se pudo generar ninguna traducción/i
            );
        });
        expect(
            screen.queryByRole('button', { name: /Actualizar la página/i })
        ).not.toBeInTheDocument();
    });
});
