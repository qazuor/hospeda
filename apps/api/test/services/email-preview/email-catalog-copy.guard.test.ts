/**
 * HOS-2580 §G: copy guards over every Spanish scenario of the email catalog, rendered
 * through the production pipeline (subject, preview text, HTML body and text part).
 *
 * 1. **Voseo.** No tú form from {@link TUTEO_FORMS} may appear. Some of those words are
 *    also valid third-person verbs or adjectives ("Este correo confirma el pago", "tu
 *    ficha completa"); each such phrase is listed in {@link ALLOWED_PHRASES} with its
 *    reason and removed before matching. A new phrase needs a new, justified entry.
 * 2. **Danger callouts.** `tone="danger"` is for real failures and losses only (owner
 *    decision, 2026-11-24). The set of entries that render one is frozen in
 *    {@link DANGER_ENTRIES}; a routine notice ("if you didn't request this", "your link
 *    expires") uses `warning`.
 */
import { EMAIL_CATALOG, renderEmailCatalogScenario } from '@repo/notifications';
import { describe, expect, it } from 'vitest';
import { buildEmailPreviewDeps } from '../../../src/services/email-preview/email-preview-deps.js';

const deps = buildEmailPreviewDeps({
    siteUrl: 'https://hospeda.com.ar',
    adminUrl: 'https://admin.example.com'
});

/** tú imperatives and second-person forms voseo replaces. Word-bounded, case-insensitive. */
const TUTEO_FORMS = [
    'tienes',
    'puedes',
    'quieres',
    'necesitas',
    'debes',
    'deseas',
    'eres',
    'sabes',
    'haz',
    'hazlo',
    'revisa',
    'copia',
    'pega',
    'ingresa',
    'verifica',
    'confirma',
    'completa',
    'elige',
    'actualiza',
    'contacta',
    'contáctanos',
    'escríbenos',
    'comunícate',
    'restablece',
    'recuerda',
    'olvides',
    'intenta',
    'accede',
    'descarga',
    'responde',
    'visita',
    'asegúrate',
    'dudes'
] as const;

/** Lookarounds instead of `\b`: `\b` is ASCII-only and splits words at accented letters. */
const TUTEO = new RegExp(`(?<![\\p{L}])(${TUTEO_FORMS.join('|')})(?![\\p{L}])`, 'giu');

/** Phrases where a listed word is NOT a tú form. Each one carries its reason. */
const ALLOWED_PHRASES: ReadonlyArray<{ readonly phrase: string; readonly why: string }> = [
    { phrase: 'leerla completa', why: 'adjective: the whole review' },
    { phrase: 'bitácora completa', why: 'adjective: the whole log' },
    { phrase: 'publicación completa', why: 'adjective: the whole listing' },
    { phrase: 'ficha completa', why: 'adjective: the whole listing' },
    { phrase: 'este correo confirma', why: 'third person: the mail confirms' },
    { phrase: 'el equipo te confirma', why: 'third person: the team confirms' },
    { phrase: 'no responde', why: 'third person, inside the feedback sample a user wrote' }
];

/** Catalog keys that render a `danger` callout, and the real failure or loss behind it. */
const DANGER_ENTRIES: Readonly<Record<string, string>> = {
    'notification.payment_failure': 'a charge was declined',
    'notification.payment_retry_warning': 'a renewal charge failed and is being retried',
    'notification.feedback_report': 'staff report of a real application error'
};

const SPANISH_CASES = EMAIL_CATALOG.flatMap((entry) =>
    entry.scenarios
        .filter((scenario) => scenario.locale === 'es')
        .map((scenario) => [entry.key, scenario.id] as const)
);

/** Subject, then the whole body (preview text included) as text, then the text part. */
async function renderParts(input: { readonly key: string; readonly scenarioId: string }) {
    const rendered = await renderEmailCatalogScenario({ ...input, deps });
    const body = rendered.html
        .replace(/<head[\s\S]*?<\/head>/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ');
    return { html: rendered.html, parts: [rendered.subject, body, rendered.text] };
}

function tuteoHits(text: string): readonly string[] {
    let cleaned = text.toLowerCase().replace(/\s+/g, ' ');
    for (const { phrase } of ALLOWED_PHRASES) cleaned = cleaned.split(phrase).join(' ');
    return [...cleaned.matchAll(TUTEO)].map((match) => match[0]);
}

describe('HOS-2580 email catalog copy guards', () => {
    it('has every Spanish scenario to check', () => {
        // Non-vacuity: an empty or truncated catalog would make it.each pass on nothing.
        expect(SPANISH_CASES.length).toBeGreaterThanOrEqual(200);
    });

    it('detects a tú form and lets the allowlisted phrases through', () => {
        expect(tuteoHits('Haz clic. Si necesitas ayuda, contáctanos.')).toEqual([
            'haz',
            'necesitas',
            'contáctanos'
        ]);
        expect(tuteoHits('Hacé clic, revisá y contactanos. Tu ficha completa sigue.')).toEqual([]);
        expect(tuteoHits('Elegí un plan')).toEqual([]);
    });

    it.each(SPANISH_CASES)('%s / %s speaks in voseo', async (key, scenarioId) => {
        // Act
        const { parts } = await renderParts({ key, scenarioId });

        // Assert
        for (const part of parts) expect(tuteoHits(part)).toEqual([]);
    });

    it('renders a danger callout only in the frozen set of real failures', async () => {
        // Act
        const withDanger = new Set<string>();
        for (const [key, scenarioId] of SPANISH_CASES) {
            const { html } = await renderParts({ key, scenarioId });
            if (html.includes('data-callout-tone="danger"')) withDanger.add(key);
        }

        // Assert
        expect([...withDanger].sort()).toEqual(Object.keys(DANGER_ENTRIES).sort());
    });
});
