/**
 * @file privacy-ai-assistants-section.test.ts
 * @description HOS-2184 T-037: the privacy page carries the "connect an AI
 * assistant" section, its Spanish fallbacks equal `es/privacy.json`, and the
 * es/en/pt copy states the facts the policy must state.
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
    const entry = src.match(/\{ id: 'asistentes-ia'[^\n]*\}/)?.[0] ?? '';

    it('declares the section with its i18n keys', () => {
        expect(entry).toContain("titleKey: 'privacy.sections.aiAssistants.title'");
        expect(entry).toContain("contentKey: 'privacy.sections.aiAssistants.body'");
    });

    it('uses Spanish fallbacks identical to es/privacy.json', () => {
        const { title, body } = esPrivacy.sections.aiAssistants;
        expect(entry).toContain(`titleFb: '${title}'`);
        expect(entry).toContain(`contentFb: '${body}'`);
    });

    it('shows the updated date', () => {
        expect(src).toContain('lastUpdated="2026-11-26"');
    });

    it.each([
        ['es', esPrivacy],
        ['en', enPrivacy],
        ['pt', ptPrivacy]
    ] as const)('states the required facts in %s', (_locale, file) => {
        const { body } = file.sections.aiAssistants;
        for (const needle of ['ChatGPT', 'Claude', 'Gemini', 'OpenAI', 'Anthropic', 'OAuth']) {
            expect(body).toContain(needle);
        }
        expect(body).toContain('/mi-cuenta/asistentes-ia/');
    });
});
