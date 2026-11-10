import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES = ['es', 'en', 'pt'] as const;
const LOCALES_DIR = path.resolve(__dirname, '../../../../../packages/i18n/src/locales');
const VENUE_EDITOR_BLOCKS = [
    'owner.editor.menuManager',
    'owner.editor.dailySpecials',
    'owner.editor.venueEventsManager'
] as const;
const COMPONENT_FALLBACK_FILES = [
    '../../../src/components/venue/VenueMenuManager.client.tsx',
    '../../../src/components/venue/VenueMenuPlanNotice.client.tsx',
    '../../../src/components/venue/VenueMenuTranslationFields.client.tsx',
    '../../../src/components/venue/VenueSectionLockedPanel.client.tsx',
    '../../../src/components/venue/VenueDailySpecialsManager.client.tsx',
    '../../../src/components/venue/VenueEventsManager.client.tsx'
] as const;

function readJson(filePath: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
}

function getPath(value: unknown, dottedPath: string): unknown {
    return dottedPath.split('.').reduce<unknown>((current, key) => {
        if (!current || typeof current !== 'object') return undefined;
        return (current as Record<string, unknown>)[key];
    }, value);
}

function collectStrings(value: unknown): string[] {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.flatMap(collectStrings);
    if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
    return [];
}

function planNames(): string[] {
    return [
        ...new Set(
            LOCALES.flatMap((locale) => {
                const plans = readJson(path.join(LOCALES_DIR, locale, 'billing.json')).plan;
                if (!plans || typeof plans !== 'object') return [];
                return Object.values(plans as Record<string, unknown>).flatMap((plan) =>
                    plan &&
                    typeof plan === 'object' &&
                    typeof (plan as Record<string, unknown>).name === 'string'
                        ? [(plan as Record<string, string>).name]
                        : []
                );
            })
        )
    ].filter((name) => name.length > 1);
}

function fallbackStrings(source: string): string[] {
    const matches = [
        ...source.matchAll(
            /\b(?:messageFallback|noPlanMessageFallback|preTrialMessageFallback|fallback|noPlanFallback)\s*[:=]\s*['"]([^'"]+)['"]/g
        ),
        ...source.matchAll(/\bt\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]/g)
    ];
    return matches.map((match) => match[1] ?? '').filter(Boolean);
}

describe('venue editor upsell copy never hardcodes a catalog plan name', () => {
    it('keeps plan names out of the menu editor locale strings and component fallbacks', () => {
        const targets = LOCALES.flatMap((locale) => {
            const venue = readJson(path.join(LOCALES_DIR, locale, 'venue.json'));
            return VENUE_EDITOR_BLOCKS.flatMap((block) =>
                collectStrings(getPath(venue, block)).map(
                    (text) => `${locale}/venue.json ${block}: ${text}`
                )
            );
        });
        const sources = COMPONENT_FALLBACK_FILES.flatMap((relativePath) => {
            const filePath = path.resolve(__dirname, relativePath);
            return fallbackStrings(fs.readFileSync(filePath, 'utf-8')).map(
                (text) => `${path.basename(filePath)} fallback: ${text}`
            );
        });
        const copy = [...targets, ...sources];
        const hits = planNames().flatMap((name) => {
            const pattern = new RegExp(
                `\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`,
                'i'
            );
            return copy.filter((text) => pattern.test(text)).map((text) => `${name}: ${text}`);
        });

        expect(
            hits,
            `Hardcoded plan names found in venue editor upsells:\n${hits.join('\n')}`
        ).toEqual([]);
    });
});
