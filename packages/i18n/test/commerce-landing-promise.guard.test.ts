/**
 * @file commerce-landing-promise.guard.test.ts
 * @description HOS-819 — the two commerce landings must not promise a callback
 * that no code performs.
 *
 * ## What broke, and why a list of assertions would not have caught it
 *
 * `/publicar-experiencia/` opened with «Contanos sobre las experiencias que
 * ofrecés y **te contactamos** para sumarte a Hospeda», and
 * `/publicar-restaurante/` with «Completá el formulario y **nos ponemos en
 * contacto**». Both sentences describe a lead form that HOS-690 deleted from
 * those pages: there is nowhere to tell us anything and nobody queued to reply.
 * Three blocks lower each page declares the flow it actually implements —
 * registrate, publicá, te encuentran — so the page contradicts itself, and a
 * reader who believes the top of it waits for a call that never comes.
 *
 * The repo rule this enforces is standing and not specific to these two keys:
 * copy never promises what the code does not do. A guard over the vocabulary
 * covers the string somebody writes next year; six equality assertions cover
 * only today's six strings and say nothing about a seventh.
 *
 * ## Scope, deliberately narrow
 *
 * Only `commerce.lead.subtitle` and `commerce.lead.experience.subtitle` — the
 * hero line of each landing, which is also the page's meta description. The
 * rest of the `commerce.lead.*` subtree still belongs to the `CommerceLead`
 * form component, which really does collect a lead and really is answered by a
 * human; banning the vocabulary there would be false.
 *
 * ## Where this runs
 *
 * Here, as a vitest test: CI runs `turbo run test`, which reaches `@repo/i18n`'s
 * suite. It is not registered as a `scripts/check-*.sh` guard, so it does not
 * appear in the workflow's Guards job — adding it to `check:guards` would not
 * put it in CI either (see `partner-mention-copy.guard.test.ts`'s note on that
 * distinction). The test suite is the path that executes it.
 *
 * @module test/commerce-landing-promise.guard
 */

import { describe, expect, it } from 'vitest';

import commerceEn from '../src/locales/en/commerce.json';
import commerceEs from '../src/locales/es/commerce.json';
import commercePt from '../src/locales/pt/commerce.json';

/**
 * The six hero subtitles under guard: two landings × three locales.
 *
 * Enumerated by hand rather than discovered. An auto-discovering version would
 * silently guard nothing the day a key is renamed, and a guard that quietly
 * stops guarding is the failure this exists to prevent.
 */
const SUBTITLES: ReadonlyArray<{ readonly label: string; readonly text: string }> = [
    { label: 'es commerce.lead.subtitle', text: commerceEs.lead.subtitle },
    { label: 'en commerce.lead.subtitle', text: commerceEn.lead.subtitle },
    { label: 'pt commerce.lead.subtitle', text: commercePt.lead.subtitle },
    { label: 'es commerce.lead.experience.subtitle', text: commerceEs.lead.experience.subtitle },
    { label: 'en commerce.lead.experience.subtitle', text: commerceEn.lead.experience.subtitle },
    { label: 'pt commerce.lead.experience.subtitle', text: commercePt.lead.experience.subtitle }
];

/**
 * Phrases that assert a human will reach out, or that a form is waiting to be
 * filled in. Both classes describe machinery these two pages no longer have.
 */
const BANNED: ReadonlyArray<{ readonly label: string; readonly pattern: RegExp }> = [
    { label: 'es: te contactamos', pattern: /te\s+contactamos/i },
    { label: 'es: nos ponemos en contacto', pattern: /nos\s+ponemos\s+en\s+contacto/i },
    { label: 'es: te escribimos / te llamamos', pattern: /te\s+(escribimos|llamamos)/i },
    { label: 'es: completá el formulario', pattern: /complet[aá]\s+el\s+formulario/i },
    { label: 'en: we will get in touch / reach out / contact you', pattern: /get\s+in\s+touch/i },
    { label: 'en: reach out', pattern: /reach\s+out/i },
    { label: 'en: contact you', pattern: /contact\s+you/i },
    { label: 'en: fill out the form', pattern: /fill\s+(out|in)\s+the\s+form/i },
    { label: 'pt: entraremos em contato', pattern: /entrar[eé]?mos\s+em\s+contato/i },
    { label: 'pt: preencha o formulário', pattern: /preencha\s+o\s+formul/i }
];

describe('HOS-819 — commerce landing heroes describe self-service', () => {
    it('has all six subtitles to check', () => {
        // Non-vacuity: an empty or short list would satisfy every loop below.
        expect(SUBTITLES).toHaveLength(6);
        for (const { label, text } of SUBTITLES) {
            expect(typeof text, label).toBe('string');
            expect(text.length, label).toBeGreaterThan(20);
        }
    });

    it('has a non-empty ban list', () => {
        expect(BANNED.length).toBeGreaterThan(5);
    });

    it('the ban list actually matches the copy it was written against', () => {
        // Control: without this, a typo'd regex would let every string through
        // and the suite would report a clean bill of health on a live bug.
        const historical =
            'Contanos sobre las experiencias que ofrecés y te contactamos para sumarte.';
        const matched = BANNED.filter(({ pattern }) => pattern.test(historical));
        expect(matched.map(({ label }) => label)).toContain('es: te contactamos');
    });

    for (const { label, text } of SUBTITLES) {
        it(`${label} promises no callback`, () => {
            const violations = BANNED.filter(({ pattern }) => pattern.test(text)).map(
                (banned) => banned.label
            );
            expect(violations, `${label} reads: ${text}`).toEqual([]);
        });
    }
});
