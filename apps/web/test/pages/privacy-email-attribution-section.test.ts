/**
 * @file privacy-email-attribution-section.test.ts
 * @description HOS-2359 §6.E.1 (OD-7, AC-21): the privacy page renders the
 * "email and campaigns" section right after the session-recording one, read
 * from `privacy.sections.emailAttribution` with no inline fallback (HOS-2681),
 * so a missing key can never show different legal text. The copy itself is
 * guarded in `packages/i18n/test/email-attribution-legal-copy.guard.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/legal/privacidad/index.astro'),
    'utf8'
);

describe('privacy page — email and campaigns section (HOS-2359)', () => {
    it('declares the section with its i18n key', () => {
        expect(src).toContain("{ id: 'email-y-campanas', key: 'emailAttribution' }");
    });

    it('places it right after the session-recording section', () => {
        const ids = [...src.matchAll(/\{ id: '([a-z-]+)'/g)].map((match) => match[1]);
        expect(ids.indexOf('grabaciones')).toBeGreaterThan(-1);
        expect(ids.indexOf('email-y-campanas')).toBe(ids.indexOf('grabaciones') + 1);
    });
});
