/**
 * @file hos-2611-thread-and-empty-states.source.test.ts
 * @description HOS-2611 guards over source: the inquiry thread pages use the kit
 * LinkButton for «Volver» (no PageHeader `back` link), and the Mi cuenta empty
 * states carry an icon.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string): string => readFileSync(resolve(__dirname, '../../src', rel), 'utf8');

describe('inquiry thread pages', () => {
    it.each([
        'pages/[lang]/mi-cuenta/consultas/[conversationId].astro',
        'pages/[lang]/mi-cuenta/consultas-propietario/[conversationId].astro'
    ])('%s renders «Volver» as a kit LinkButton', (page) => {
        // Arrange
        const source = read(page);

        // Assert
        expect(source).toMatch(/<LinkButton slot="actions" variant="secondary"/);
        expect(source).not.toMatch(/back=\{back\}/);
    });
});

describe('Mi cuenta empty states carry an icon', () => {
    it.each([
        ['components/account/MySubscriptions.astro', /CreditCardIcon slot="icon"/],
        ['components/billing/addon-purchase/AddonPurchaseGate.client.tsx', /<PackageIcon/],
        ['components/host/host-trades/BenefitUsagesPanel.client.tsx', /<CheckCircleIcon/],
        ['components/listing/ai-questions/AiQuestionsPanel.client.tsx', /<ChatIcon/],
        ['components/listing/ListingFaqManager.client.tsx', /<FaqsIcon/],
        ['components/host/editor/FaqSection.client.tsx', /<FaqsIcon/],
        ['components/listing/TrafficStatsCards.client.tsx', /<BarChartIcon/],
        ['components/host/ExternalReputationSection.client.tsx', /<StarIcon/]
    ])('%s', (file, icon) => {
        expect(read(file)).toMatch(icon);
    });
});
