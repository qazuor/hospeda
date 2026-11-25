/**
 * @file hos-2611-thread-and-empty-states.source.test.ts
 * @description HOS-2611 guards over source: the inquiry thread pages use the kit
 * breadcrumbs for parent navigation (no PageHeader `back` link), the Mi cuenta empty
 * states carry an icon, and the publish/provider controls no longer use the
 * legacy gradient or pill button styles.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string): string => readFileSync(resolve(__dirname, '../../src', rel), 'utf8');

describe('inquiry thread pages', () => {
    it.each([
        'pages/[lang]/mi-cuenta/consultas/[conversationId].astro',
        'pages/[lang]/mi-cuenta/consultas-propietario/[conversationId].astro'
    ])('%s renders shared account breadcrumbs', (page) => {
        // Arrange
        const source = read(page);

        // Assert
        expect(source).toContain('breadcrumbs={buildAccountBreadcrumbs(');
        expect(source).not.toContain('href={back.href}');
        expect(source).not.toMatch(/back=\{back\}/);
    });
});

describe('Mi cuenta empty states carry an icon', () => {
    it.each([
        ['components/account/MySubscriptions.astro', /CreditCardIcon slot="icon"/],
        ['components/billing/addon-purchase/AddonPurchaseGate.client.tsx', /<PackageIcon/],
        ['components/billing/recurring-addons/RecurringAddonWithdrawal.client.tsx', /<PackageIcon/],
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

describe('legacy primary button styles are gone from Mi cuenta controls', () => {
    it.each([
        'components/host/PublishButton.client.tsx',
        'components/host/CreatePropertyMiniForm.client.tsx',
        'components/host/ImportFromUrl.client.tsx',
        'components/host/PublishPrecheckPanel.astro',
        'components/event/editor/EventCreateForm.client.tsx',
        'components/post/editor/PostCreateForm.client.tsx',
        'components/host/host-trades/ProviderUsagesPanel.client.tsx',
        'components/host/host-trades/ProviderQrPanel.client.tsx',
        'components/host/host-trades/ProviderReviewsPanel.client.tsx',
        'components/host/host-trades/ReviewReplyForm.tsx',
        'components/host/host-trades/ReviewFormDialog.client.tsx'
    ])('%s', (file) => {
        const source = read(file);
        expect(source).not.toMatch(/btn-gradient/);
        expect(source).not.toMatch(/styles\.(primaryAction|secondaryAction)/);
    });
});
