/**
 * @file privacy-email-attribution-section.test.ts
 * @description HOS-2359 §6.E.1 (OD-7, AC-21): the privacy page renders the
 * "email and campaigns" section right after the session-recording one, and its
 * Spanish fallbacks are identical to `es/privacy.json` (so a missing key never
 * shows different legal text). The copy itself is guarded in
 * `packages/i18n/test/email-attribution-legal-copy.guard.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import esPrivacy from '../../../../packages/i18n/src/locales/es/privacy.json';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/legal/privacidad/index.astro'),
    'utf8'
);

describe('privacy page — email and campaigns section (HOS-2359)', () => {
    const entry = src.match(/\{ id: 'email-y-campanas'[^\n]*\}/)?.[0] ?? '';

    it('declares the section with its i18n keys', () => {
        expect(entry).toContain("titleKey: 'privacy.sections.emailAttribution.title'");
        expect(entry).toContain("contentKey: 'privacy.sections.emailAttribution.body'");
    });

    it('places it right after the session-recording section', () => {
        const ids = [...src.matchAll(/\{ id: '([a-z-]+)'/g)].map((match) => match[1]);
        expect(ids.indexOf('email-y-campanas')).toBe(ids.indexOf('grabaciones') + 1);
    });

    it('uses Spanish fallbacks identical to es/privacy.json', () => {
        const { title, body } = esPrivacy.sections.emailAttribution;
        expect(entry).toContain(`titleFb: '${title}'`);
        expect(entry).toContain(`contentFb: '${body}'`);
    });
});
