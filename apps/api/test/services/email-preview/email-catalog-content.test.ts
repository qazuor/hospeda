/**
 * HOS-2565 PR-3: catalog-wide content checks (US-3).
 *
 * Every scenario of every catalog entry is rendered through the preview dependencies (the
 * same pipeline the admin previewer and the inbox use) and checked for:
 * - AC-3.1: a Spanish scenario has no English sentence, no raw enum value, no raw code
 *   and no ISO timestamp in its subject or its text. Provider values shown verbatim carry
 *   `data-raw-value` and are exempt.
 * - AC-3.2: a scenario whose input carries a `locale` declares the same one.
 * - AC-3.3: the billing cycle reads "Mensual" / "Anual" and an unknown one as received.
 * - AC-3.4: no URL is printed as text in the 8 templates of spec 2.4, and each former
 *   URL is the `href` of a `Button` or a `Link` with the label of spec 7.4.
 * - AC-3.5: the 11 user mails of spec 7.5 carry a `Button` to the right place.
 * - AC-3.6 to AC-3.8, AC-3.10: the reconciliation summary and the four staff mails.
 * - Spec 7.2: no raw `COBRO_DUPLICADO`, `monthly` or uuid-joined string in a Spanish render.
 */
import { EMAIL_BUTTON_CLASS } from '@repo/email';
import {
    EMAIL_CATALOG,
    type EmailCatalogRenderDeps,
    readInputLocale,
    renderEmailCatalogScenario
} from '@repo/notifications';
import { describe, expect, it } from 'vitest';
import { buildEmailPreviewDeps } from '../../../src/services/email-preview/email-preview-deps.js';

const SITE = 'https://hospeda.com.ar';
const ADMIN = 'https://admin.example.com';

const deps: EmailCatalogRenderDeps = buildEmailPreviewDeps({ siteUrl: SITE, adminUrl: ADMIN });
const depsWithoutAdmin: EmailCatalogRenderDeps = buildEmailPreviewDeps({ siteUrl: SITE });

const MARK_ID = '00000000-0000-4000-8000-000000000203';
const SUBSCRIPTION_ID = '00000000-0000-4000-8000-000000000201';

/** Words that mean a sentence is English (spec AC-3.1). */
const ENGLISH_WORDS = /\b(the|your|you|and|will|access|cancellation|choose|reactivate|Hi)\b/i;
/** Raw stored values that must never reach a Spanish render (spec AC-3.1). */
const RAW_VALUES = /\b(monthly|annual|quarterly|semiannual|subscription|addon_instance)\b/;
/** Raw enum or reason codes, e.g. `COBRO_DUPLICADO`. */
const RAW_CODE = /[A-Z]{3,}_[A-Z_]+/;
/** An ISO instant. */
const ISO_INSTANT = /\d{4}-\d{2}-\d{2}T\d{2}:/;
/** Two uuids or ids joined with a middle dot, the old fallback line. */
const UUID_JOINED = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}[^\s]*\s·\s/;

interface Anchor {
    readonly href: string;
    readonly text: string;
    readonly isButton: boolean;
    readonly tag: string;
}

/** The visible text of an HTML body, without `data-raw-value` elements, head and style. */
function visibleText({ html, keepRaw = false }: { html: string; keepRaw?: boolean }): string {
    const withoutRaw = keepRaw
        ? html
        : html.replace(/<(\w+)\b[^>]*\bdata-raw-value="true"[^>]*>[\s\S]*?<\/\1>/g, ' ');
    return withoutRaw
        .replace(/<head[\s\S]*?<\/head>/g, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<style[\s\S]*?<\/style>/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Every `<a>` of the HTML, with its href, its text and whether it is a `Button`. */
function anchorsOf({ html }: { html: string }): readonly Anchor[] {
    return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => {
        const attrs = match[1] ?? '';
        return {
            href: (attrs.match(/\bhref="([^"]*)"/)?.[1] ?? '').replaceAll('&amp;', '&'),
            text: visibleText({ html: match[2] ?? '' }),
            isButton: attrs.includes(`class="${EMAIL_BUTTON_CLASS}"`),
            tag: attrs
        };
    });
}

/** An href without its query string and hash, so attribution UTMs do not matter. */
function bare(href: string): string {
    return href.split(/[?#]/)[0] ?? href;
}

async function render({
    key,
    scenarioId,
    withAdmin = true
}: {
    key: string;
    scenarioId: string;
    withAdmin?: boolean;
}) {
    return renderEmailCatalogScenario({
        key,
        scenarioId,
        deps: withAdmin ? deps : depsWithoutAdmin
    });
}

const spanishCases = EMAIL_CATALOG.flatMap((entry) =>
    entry.scenarios
        .filter((scenario) => scenario.locale === 'es')
        .map((scenario) => [entry.key, scenario.id] as const)
);

describe('email catalog: scenario locale (HOS-2565 D14, AC-3.2)', () => {
    it('resolves a locale on every scenario summary', () => {
        for (const entry of EMAIL_CATALOG) {
            for (const scenario of entry.scenarios) {
                expect(['es', 'en', 'pt'], `${entry.key}/${scenario.id}`).toContain(
                    scenario.locale
                );
            }
        }
    });

    it('declares the non-Spanish scenarios the audit found (the spec lists nine)', () => {
        // Arrange
        const nonSpanish = EMAIL_CATALOG.flatMap((entry) =>
            entry.scenarios
                .filter((scenario) => scenario.locale !== 'es')
                .map((scenario) => `${entry.key}/${scenario.id}:${scenario.locale}`)
        );

        // Assert
        expect(nonSpanish.sort()).toEqual(
            [
                'notification.ai_questions_weekly_digest/en-one-listing:en',
                'notification.listing_location_exception_approved/en:en',
                'notification.listing_location_exception_rejected/en-without-reason:en',
                'alert-digest.alerts-digest/english-locale:en',
                'outbox.billing.manual-installment-opened/en-first:en',
                'outbox.billing.late-payment-refunded/en:en',
                'outbox.billing.one-time-addon-activated/en-with-listing:en',
                'outbox.verticals.partner-claim-notice/application-en:en',
                'outbox.verticals.partner-application-rejected/pt:pt'
            ].sort()
        );
    });

    it('reads the locale of an input at the top level or inside the payload', () => {
        expect(readInputLocale({ locale: 'en' })).toBe('en');
        expect(readInputLocale({ payload: { locale: 'pt' } })).toBe('pt');
        expect(readInputLocale({ payload: { name: 'x' } })).toBeUndefined();
        expect(readInputLocale({ locale: 'fr' })).toBeUndefined();
        expect(readInputLocale(null)).toBeUndefined();
    });
});

describe('email catalog: Spanish renders are Spanish only (HOS-2565 AC-3.1)', () => {
    it('has Spanish scenarios to check', () => {
        // Fails on an empty or truncated catalog, which would make it.each vacuous.
        expect(spanishCases.length).toBeGreaterThanOrEqual(110);
    });

    it.each(
        spanishCases
    )('%s / %s has no English sentence, raw value, raw code or ISO timestamp', async (key, scenarioId) => {
        // Act
        const { subject, html } = await render({ key, scenarioId });
        const text = visibleText({ html });

        // Assert
        for (const [label, body] of [
            ['subject', subject],
            ['text', text]
        ] as const) {
            expect(body, `${label} English`).not.toMatch(ENGLISH_WORDS);
            expect(body, `${label} raw value`).not.toMatch(RAW_VALUES);
            expect(body, `${label} raw code`).not.toMatch(RAW_CODE);
            expect(body, `${label} ISO timestamp`).not.toMatch(ISO_INSTANT);
        }
    });

    it('exempts a value tagged data-raw-value and nothing else', () => {
        // Arrange
        const html = '<p>Esperaba</p><p data-raw-value="true">authorized</p><p>Obtuvo pending</p>';

        // Act
        const text = visibleText({ html });

        // Assert
        expect(text).not.toContain('authorized');
        expect(text).toContain('Obtuvo pending');
        expect(visibleText({ html, keepRaw: true })).toContain('authorized');
    });

    it('catches the three subjects that used to be English', async () => {
        // Arrange
        const keys = [
            'notification.subscription_cancel_confirmed',
            'notification.subscription_access_ending_soon',
            'notification.plan_being_retired'
        ];

        for (const key of keys) {
            const entry = EMAIL_CATALOG.find((candidate) => candidate.key === key);
            for (const scenario of entry?.scenarios ?? []) {
                // Act
                const { subject } = await render({ key, scenarioId: scenario.id });

                // Assert
                expect(subject).not.toMatch(ENGLISH_WORDS);
                expect(subject).not.toContain('{');
            }
        }
    });
});

describe('email catalog: billing cycle label (HOS-2565 AC-3.3)', () => {
    it.each([
        ['monthly', 'Mensual'],
        ['annual', 'Anual']
    ])('notification.subscription_purchase / %s shows "%s" in the Período row', async (scenarioId, label) => {
        // Act
        const { html } = await render({
            key: 'notification.subscription_purchase',
            scenarioId
        });

        // Assert
        expect(visibleText({ html })).toMatch(new RegExp(`Período\\s+${label}`));
        expect(visibleText({ html })).not.toMatch(/\b(monthly|annual)\b/);
    });
});

describe('email catalog: URLs are buttons or links, never text (HOS-2565 AC-3.4)', () => {
    const SUBSCRIPTION = `${SITE}/es/mi-cuenta/suscripcion/`;
    const cases: readonly {
        readonly key: string;
        readonly href: string | RegExp;
        readonly label: string;
        readonly button: boolean;
    }[] = [
        {
            key: 'outbox.billing.grace-reminder',
            href: SUBSCRIPTION,
            label: 'Ir a Mi Suscripción',
            button: true
        },
        {
            key: 'outbox.billing.grace-started',
            href: SUBSCRIPTION,
            label: 'Ir a Mi Suscripción',
            button: true
        },
        {
            key: 'outbox.billing.signup-declined',
            href: SUBSCRIPTION,
            label: 'Volver a intentarlo',
            button: true
        },
        {
            key: 'outbox.billing.chargeback-suspension',
            href: SUBSCRIPTION,
            label: 'Volver a suscribirme',
            button: true
        },
        {
            key: 'outbox.billing.paid-after-cancellation',
            href: SUBSCRIPTION,
            label: 'Ver Mi Suscripción',
            button: true
        },
        {
            key: 'outbox.verticals.listing-business-lines-changed',
            href: /\/es\/mi-cuenta\/(propiedades|comercio)\/$/,
            label: 'Ver mi ficha',
            button: true
        },
        {
            key: 'outbox.verticals.listing-business-lines-changed',
            href: `${SITE}/es/contacto/`,
            label: 'escribinos',
            button: false
        },
        {
            key: 'outbox.verticals.listing-content-edited-by-support',
            href: `${SITE}/es/contacto/`,
            label: 'escribinos',
            button: false
        }
    ];

    it.each(cases)('$key links "$label" ($href) and prints no URL', async ({
        key,
        href,
        label,
        button
    }) => {
        // Arrange
        const entry = EMAIL_CATALOG.find((candidate) => candidate.key === key);
        expect(entry, key).toBeDefined();

        for (const scenario of entry?.scenarios ?? []) {
            // Act
            const { html } = await render({ key, scenarioId: scenario.id });
            const anchor = anchorsOf({ html }).find((candidate) => candidate.text === label);

            // Assert
            expect(visibleText({ html }), `${key}/${scenario.id} prints a URL`).not.toMatch(
                /https?:\/\//
            );
            expect(anchor, `${key}/${scenario.id} has "${label}"`).toBeDefined();
            expect(anchor?.isButton).toBe(button);
            if (typeof href === 'string') expect(bare(anchor?.href ?? '')).toBe(href);
            else expect(bare(anchor?.href ?? '')).toMatch(href);
        }
    });
});

describe('email catalog: a CTA in every user mail that asks for an action (HOS-2565 AC-3.5)', () => {
    const SUBSCRIPTION = `${SITE}/es/mi-cuenta/suscripcion/`;
    const LISTING_PAGES = [`${SITE}/es/mi-cuenta/propiedades/`, `${SITE}/es/mi-cuenta/comercio/`];
    const cases: readonly {
        readonly key: string;
        readonly label: string;
        readonly targets: readonly string[];
    }[] = [
        {
            key: 'outbox.billing.grace-started',
            label: 'Ir a Mi Suscripción',
            targets: [SUBSCRIPTION]
        },
        {
            key: 'outbox.billing.grace-reminder',
            label: 'Ir a Mi Suscripción',
            targets: [SUBSCRIPTION]
        },
        {
            key: 'outbox.billing.signup-declined',
            label: 'Volver a intentarlo',
            targets: [SUBSCRIPTION]
        },
        {
            key: 'outbox.billing.chargeback-suspension',
            label: 'Volver a suscribirme',
            targets: [SUBSCRIPTION]
        },
        {
            key: 'outbox.billing.arrears-suspension',
            label: 'Volver a suscribirme',
            targets: [SUBSCRIPTION]
        },
        {
            key: 'outbox.billing.signup-incomplete',
            label: 'Volver a suscribirme',
            targets: [SUBSCRIPTION]
        },
        {
            key: 'outbox.billing.plan-migration-announced',
            label: 'Ver mi suscripción',
            targets: [SUBSCRIPTION]
        },
        {
            key: 'outbox.verticals.listing-retention-before-archive',
            label: 'Ir a mi ficha',
            targets: LISTING_PAGES
        },
        {
            key: 'outbox.verticals.listing-retention-before-deletion',
            label: 'Ir a mi ficha',
            targets: LISTING_PAGES
        },
        {
            key: 'outbox.verticals.listing-archived',
            label: 'Ir a mi ficha',
            targets: LISTING_PAGES
        },
        {
            key: 'outbox.verticals.listing-business-lines-changed',
            label: 'Ver mi ficha',
            targets: LISTING_PAGES
        }
    ];

    it('covers the 11 entries of spec 7.5', () => {
        expect(cases).toHaveLength(11);
    });

    it.each(cases)('$key has a "$label" button to the right place on every scenario', async ({
        key,
        label,
        targets
    }) => {
        // Arrange
        const entry = EMAIL_CATALOG.find((candidate) => candidate.key === key);
        expect(entry, key).toBeDefined();
        expect(entry?.audience).toBe('user');

        for (const scenario of entry?.scenarios ?? []) {
            // Act
            const { html } = await render({ key, scenarioId: scenario.id });
            const buttons = anchorsOf({ html }).filter((anchor) => anchor.isButton);

            // Assert
            expect(buttons.length, `${key}/${scenario.id} buttons`).toBeGreaterThanOrEqual(1);
            expect(
                buttons.some(
                    (button) => button.text === label && targets.includes(bare(button.href))
                ),
                `${key}/${scenario.id}: ${buttons.map((b) => `${b.text} -> ${b.href}`).join(' | ')}`
            ).toBe(true);
        }
    });

    it('keeps the verticals on their own account page without a branch per vertical', async () => {
        // Arrange: the venue scenario is the one that differs from accommodation
        const key = 'outbox.verticals.listing-archived';
        const entry = EMAIL_CATALOG.find((candidate) => candidate.key === key);
        const seen = new Set<string>();

        for (const scenario of entry?.scenarios ?? []) {
            // Act
            const { html } = await render({ key, scenarioId: scenario.id });
            for (const anchor of anchorsOf({ html }).filter((a) => a.isButton)) {
                seen.add(bare(anchor.href));
            }
        }

        // Assert
        expect([...seen].every((href) => LISTING_PAGES.includes(href))).toBe(true);
    });
});

describe('email catalog: reconciliation summary (HOS-2565 AC-3.6)', () => {
    it('renders one block per item with labeled rows and no " · " fallback line', async () => {
        // Act
        const { html, subject } = await render({
            key: 'outbox.billing.reconciliation-summary',
            scenarioId: 'populated'
        });
        const text = visibleText({ html });

        // Assert
        expect(subject).toContain('Resumen de conciliación');
        expect(text).not.toContain(' · ');
        expect(text).not.toContain('COBRO_DUPLICADO');
        expect(text).not.toMatch(UUID_JOINED);
        for (const lead of [
            'Marca abierta',
            'Marca sin resolver a tiempo',
            'Cobro por debajo del esperado',
            'Pausa que regaló días'
        ]) {
            expect(text, lead).toContain(lead);
        }
        for (const row of [
            'Motivo',
            'Titular',
            'Plan',
            'Suscripción',
            'Esperado',
            'Cobrado',
            'Diferencia',
            'Pago',
            'Período',
            'Próximo cobro',
            'Días de regalo'
        ]) {
            expect(text, row).toContain(row);
        }
        expect(text).toContain('Cobro duplicado');
        expect(text).toContain('… y 3 más');
        expect(text).toContain('Qué hacer');
    });

    it('ends with a button to the reconciliation list and a link per item', async () => {
        // Act
        const { html } = await render({
            key: 'outbox.billing.reconciliation-summary',
            scenarioId: 'populated'
        });
        const anchors = anchorsOf({ html });
        const button = anchors.find((anchor) => anchor.isButton);

        // Assert
        expect(button?.text).toBe('Abrir el listado de conciliación');
        expect(bare(button?.href ?? '')).toBe(`${ADMIN}/billing/reconciliation/`);
        expect(anchors.filter((anchor) => anchor.text === 'Abrir en el panel').length).toBe(5);
        expect(visibleText({ html })).not.toMatch(/https?:\/\//);
    });

    it('separates the items of a section with a hairline divider', async () => {
        // Act
        const { html } = await render({
            key: 'outbox.billing.reconciliation-summary',
            scenarioId: 'populated'
        });

        // Assert: two items in "Marcas abiertas" -> one divider there
        expect((html.match(/<hr\b/g) ?? []).length).toBeGreaterThanOrEqual(1);
    });

    it('has no button and the old sentence when there is no admin URL', async () => {
        // Act
        const { html } = await render({
            key: 'outbox.billing.reconciliation-summary',
            scenarioId: 'populated',
            withAdmin: false
        });

        // Assert
        expect(anchorsOf({ html }).filter((anchor) => anchor.isButton)).toEqual([]);
        expect(visibleText({ html })).toContain(
            'El listado accionable de marcas está en el panel de administración.'
        );
    });
});

describe('email catalog: the four staff mails (HOS-2565 AC-3.7, AC-3.8)', () => {
    const cases = [
        {
            key: 'outbox.billing.duplicate-charge-detected',
            scenarioId: 'subscription',
            path: `/billing/reconciliation/${MARK_ID}/events`,
            menu: 'Facturación → Conciliación',
            rows: ['Motivo', 'Sujeto', 'Titular', 'Plan', 'Pago', 'Abierta el']
        },
        {
            key: 'outbox.billing.mark-escalated',
            scenarioId: 'default',
            path: `/billing/reconciliation/${MARK_ID}/events`,
            menu: 'Facturación → Conciliación',
            rows: ['Motivo', 'Sujeto', 'Titular', 'Plan', 'Abierta el', 'Escaló el', 'Plazo']
        },
        {
            key: 'outbox.billing.revocation-refund-failed',
            scenarioId: 'revocation-payment',
            path: '/billing/reconciliation/refunds',
            menu: 'Facturación → Devoluciones propuestas',
            rows: ['Reembolso', 'Motivo del reembolso', 'Origen del pago', 'Sujeto', 'Monto']
        },
        {
            key: 'outbox.billing.manual-installment-unpaid',
            scenarioId: 'first-installment',
            path: `/billing/subscriptions/${SUBSCRIPTION_ID}`,
            menu: 'Facturación → Suscripciones',
            rows: ['Suscripción', 'Vertical', 'Cuota', 'Período desde', 'Abierta el', 'Titular']
        },
        {
            key: 'outbox.billing.provider-watch-alert',
            scenarioId: 'value-changed',
            path: '/billing/settings',
            menu: 'Facturación → Configuración',
            rows: ['Medición', 'Qué pasó', 'Esperaba', 'Obtuvo', 'Detalle']
        }
    ] as const;

    it.each(cases)('$key labels its rows and links $path', async ({
        key,
        scenarioId,
        path,
        rows
    }) => {
        // Act
        const { html } = await render({ key, scenarioId });
        const text = visibleText({ html, keepRaw: true });
        const button = anchorsOf({ html }).find((anchor) => anchor.isButton);

        // Assert
        for (const row of rows) expect(text, row).toContain(row);
        expect(bare(button?.href ?? '')).toBe(`${ADMIN}${path}`);
    });

    it.each(cases)('$key has no button and names the menu path without an admin URL', async ({
        key,
        scenarioId,
        menu
    }) => {
        // Act
        const { html } = await render({ key, scenarioId, withAdmin: false });

        // Assert
        expect(anchorsOf({ html }).filter((anchor) => anchor.isButton)).toEqual([]);
        expect(visibleText({ html })).toContain(menu);
    });

    it.each([
        'outbox.billing.duplicate-charge-detected',
        'outbox.billing.mark-escalated',
        'outbox.billing.revocation-refund-failed',
        'outbox.billing.manual-installment-unpaid'
    ])('%s renders at least 4 InfoRow rows on every scenario', async (key) => {
        // Arrange
        const entry = EMAIL_CATALOG.find((candidate) => candidate.key === key);

        for (const scenario of entry?.scenarios ?? []) {
            // Act
            const { html } = await render({ key, scenarioId: scenario.id });

            // Assert: an InfoRow is a two-column row, one label cell and one value cell
            const rowCount = (html.match(/<td[^>]*width:40%/g) ?? []).length;
            expect(rowCount, `${key}/${scenario.id}`).toBeGreaterThanOrEqual(4);
        }
    });

    it('shows a currency-less refund amount as "(moneda no registrada)", never "centavos"', async () => {
        // Act
        const { html } = await render({
            key: 'outbox.billing.revocation-refund-failed',
            scenarioId: 'one-time-addon-manual'
        });
        const text = visibleText({ html });

        // Assert
        expect(text).toContain('(moneda no registrada)');
        expect(text).not.toContain('centavos');
        expect(text).toContain('Revocación de complemento único');
        expect(text).toContain('Pago manual');
    });

    it('labels the subject type and the reason, never the raw values', async () => {
        // Act
        const { html } = await render({
            key: 'outbox.billing.duplicate-charge-detected',
            scenarioId: 'addon-without-payment'
        });
        const text = visibleText({ html });

        // Assert
        expect(text).toContain('Complemento');
        expect(text).toContain('Cobro duplicado');
        expect(text).not.toContain('addon_instance');
        expect(text).not.toContain('COBRO_DUPLICADO');
        expect(text).not.toMatch(/Pago\s+[0-9a-f]{8}/);
    });

    it('prints provider-watch values verbatim and only inside data-raw-value cells (AC-3.10)', async () => {
        // Act
        const { html } = await render({
            key: 'outbox.billing.provider-watch-alert',
            scenarioId: 'value-changed'
        });
        const outside = visibleText({ html });
        const everything = visibleText({ html, keepRaw: true });

        // Assert
        expect(outside).toContain('21/11/2026 09:00');
        expect(everything).not.toContain('2026-11-21T09:00:00-03:00');
        expect(outside).not.toContain('authorized');
        expect(outside).not.toContain('pending');
        expect(everything).toContain('authorized');
        expect(everything).toContain('pending');
        expect(html).toContain('data-raw-value="true"');
    });
});
