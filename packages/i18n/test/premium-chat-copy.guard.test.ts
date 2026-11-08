/**
 * @file premium-chat-copy.guard.test.ts
 * @description HOS-2088 — since HOS-2077 the venue and experience Basico (20/month)
 * and Profesional (100/month) plans include the AI chat. The Premium card must
 * therefore not present the chat as something only Premium gives: it may sell
 * it as VOLUME ("many more chat queries"), never as a bare feature.
 *
 * Accommodation is out of scope: its chat was always on every tier.
 */

import { describe, expect, it } from 'vitest';
import enBilling from '../src/locales/en/billing.json';
import esBilling from '../src/locales/es/billing.json';
import ptBilling from '../src/locales/pt/billing.json';

const LOCALES = { es: esBilling, en: enBilling, pt: ptBilling } as const;
const PLAN_KEYS = ['venue-premium', 'experience-premium'] as const;

/** Per-locale word that must sit between the verb and "chat" to express volume. */
const VOLUME_WORD = {
    es: /\bmás\b.*\bchat\b/i,
    en: /\bmore\b.*\bchat\b/i,
    pt: /\bmais\b.*\bchat\b/i
} as const;
const BARE_CHAT = {
    es: /(?:y|con) (?:el )?chat con IA\.$/i,
    en: /and AI chat\.$/i,
    pt: /e o? ?chat com IA\.$/i
} as const;

describe('venue/experience Premium card copy does not sell chat as exclusive (HOS-2088)', () => {
    for (const [locale, json] of Object.entries(LOCALES) as [
        keyof typeof LOCALES,
        (typeof LOCALES)[keyof typeof LOCALES]
    ][]) {
        for (const planKey of PLAN_KEYS) {
            const description = (
                json as unknown as { plan: Record<string, { description: string }> }
            ).plan[planKey]?.description;

            it(`${locale}/${planKey} expresses chat as volume`, () => {
                expect(description).toBeTypeOf('string');
                expect(description).toMatch(VOLUME_WORD[locale]);
            });

            it(`${locale}/${planKey} does not list chat as a bare feature`, () => {
                expect(description).not.toMatch(BARE_CHAT[locale]);
            });
        }
    }
});

/**
 * Venue is "Comer y salir" (food AND nightlife), not only restaurants: no
 * locale may word the venue chat limit as a restaurant.
 */
describe('venue chat limit copy does not call a venue a restaurant (HOS-2088)', () => {
    const RESTAURANT = /restaurant|restaurante/i;

    for (const [locale, json] of Object.entries(LOCALES)) {
        it(`${locale} max_ai_chat_venue_per_month texts say venue, not restaurant`, () => {
            const raw = JSON.stringify(json);
            const matches = [
                ...raw.matchAll(
                    /"([^"]*max_ai_chat_venue_per_month[^"]*)":\s*("(?:[^"\\]|\\.)*"|\{[^{}]*\})/g
                )
            ];
            expect(matches.length).toBeGreaterThan(0);
            for (const match of matches) {
                expect(match[2]).not.toMatch(RESTAURANT);
            }
        });
    }
});
