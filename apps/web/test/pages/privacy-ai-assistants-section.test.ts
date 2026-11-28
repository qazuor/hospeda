/**
 * @file privacy-ai-assistants-section.test.ts
 * @description HOS-2184 T-037: the privacy page carries the "connect an AI
 * assistant" section, read from `privacy.sections.aiAssistants` with no inline
 * fallback (HOS-2681), and the es/en/pt copy states the facts the policy must
 * state, including the 12-month audit retention.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import enPrivacy from '../../../../packages/i18n/src/locales/en/privacy.json';
import esPrivacy from '../../../../packages/i18n/src/locales/es/privacy.json';
import ptPrivacy from '../../../../packages/i18n/src/locales/pt/privacy.json';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/legal/privacidad/index.astro'),
    'utf8'
);

describe('privacy page, AI assistants section (HOS-2184)', () => {
    it('declares the section with its i18n key and no inline fallback', () => {
        expect(src).toContain("{ id: 'asistentes-ia', key: 'aiAssistants' }");
        expect(src).not.toMatch(/\w+Fb:/);
    });

    it('shows the updated date', () => {
        expect(src).toContain('lastUpdated="2026-11-28"');
    });

    it.each([
        ['es', esPrivacy, '12 meses'],
        ['en', enPrivacy, '12 months'],
        ['pt', ptPrivacy, '12 meses']
    ] as const)('states the required facts in %s', (_locale, file, retention) => {
        const { body } = file.sections.aiAssistants;
        for (const needle of ['ChatGPT', 'Claude', 'Gemini', 'OpenAI', 'Anthropic', 'OAuth']) {
            expect(body).toContain(needle);
        }
        expect(body).toContain('/mi-cuenta/asistentes-ia/');
        expect(body).toContain(retention);
    });
});
