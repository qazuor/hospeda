/**
 * Regression guard for the SPEC-212 TranslationSection API wiring.
 *
 * A browser smoke found that the admin "Translate now" / override actions used a
 * raw, RELATIVE `fetch('/api/v1/...')` — which resolves against the admin origin,
 * not the API server (admin and API are separate origins), and pointed at a
 * non-existent `POST /api/v1/admin/ai/translate` endpoint. Both actions were
 * therefore broken in any real deployment.
 *
 * These source-level assertions lock in the fix: the component must use the
 * `fetchApi` client (which targets the API base URL) and the correct endpoints.
 *
 * @module features/content/components/__tests__/TranslationSection.api
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveTranslationFieldStates, TRANSLATABLE_FIELDS } from '../translation-section.fields';

const src = readFileSync(resolve(__dirname, '../TranslationSection.tsx'), 'utf8');

describe('TranslationSection API wiring (SPEC-212)', () => {
    it('uses the fetchApi client (targets the API server), not raw fetch', () => {
        expect(src).toContain("import { fetchApi } from '@/lib/api/client'");
        expect(src).toContain('await fetchApi(');
        // No raw relative fetch() to /api — that hits the admin origin, not the API.
        expect(src).not.toMatch(/fetch\(\s*['"]\/api\//);
    });

    it('translates a single entity via the admin translate endpoint (POST)', () => {
        expect(src).toContain("path: '/api/v1/admin/ai/translate'");
        expect(src).toContain("method: 'POST'");
    });

    it('saves a manual override via the override endpoint (PUT)', () => {
        expect(src).toContain("path: '/api/v1/admin/ai/translate/override'");
        expect(src).toContain("method: 'PUT'");
    });
});

describe('TranslationSection venue and experience (HOS-2658 AC-30)', () => {
    it('lists the vertical field set: entryNote only on venue', () => {
        expect(TRANSLATABLE_FIELDS.venue).toEqual([
            'name',
            'summary',
            'description',
            'richDescription',
            'entryNote'
        ]);
        expect(TRANSLATABLE_FIELDS.experience).toEqual([
            'name',
            'summary',
            'description',
            'richDescription'
        ]);
        expect(TRANSLATABLE_FIELDS.accommodation).not.toContain('entryNote');
    });

    it('derives the venue entryNote pair from entryNoteI18n and its meta', () => {
        // Arrange
        const entity = {
            nameI18n: { es: 'La Parrilla', en: 'The Grill', pt: '' },
            entryNoteI18n: { es: 'Gratis hasta la 1', en: 'Free until 1am', pt: '' },
            translationMeta: {
                entryNote: {
                    en: { autoTranslated: false, translatedAt: '2026-11-20T10:00:00.000Z' }
                }
            }
        };

        // Act
        const states = deriveTranslationFieldStates({ entityType: 'venue', entity });

        // Assert
        expect(states.map((state) => state.fieldType)).toEqual(TRANSLATABLE_FIELDS.venue);
        expect(states.find((state) => state.fieldType === 'entryNote')).toEqual({
            fieldType: 'entryNote',
            locales: {
                en: {
                    value: 'Free until 1am',
                    autoTranslated: false,
                    translatedAt: '2026-11-20T10:00:00.000Z'
                },
                pt: { value: '', autoTranslated: false, translatedAt: undefined }
            }
        });
        expect(states.find((state) => state.fieldType === 'name')).toEqual({
            fieldType: 'name',
            locales: {
                en: { value: 'The Grill', autoTranslated: true, translatedAt: undefined },
                pt: { value: '', autoTranslated: false, translatedAt: undefined }
            }
        });
    });

    it('renders an experience with no i18n columns as four empty fields', () => {
        // Act
        const states = deriveTranslationFieldStates({ entityType: 'experience', entity: {} });

        // Assert
        expect(states).toHaveLength(4);
        for (const state of states) {
            expect(state.locales).toEqual({
                en: { value: '', autoTranslated: false, translatedAt: undefined },
                pt: { value: '', autoTranslated: false, translatedAt: undefined }
            });
        }
    });

    it('is mounted on the admin venue and experience edit pages', () => {
        // Arrange
        const venuePage = readFileSync(
            resolve(__dirname, '../../../../routes/_authed/venues/$id_.edit.tsx'),
            'utf8'
        );
        const experiencePage = readFileSync(
            resolve(__dirname, '../../../../routes/_authed/experiences/$id_.edit.tsx'),
            'utf8'
        );

        // Assert
        expect(venuePage).toMatch(/<TranslationSection\s+entityType="venue"/);
        expect(experiencePage).toMatch(/<TranslationSection\s+entityType="experience"/);
    });
});
