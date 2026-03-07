import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Source file reads
// ---------------------------------------------------------------------------

const accountDir = resolve(__dirname, '../../../src/components/account');

const activeAddonsContent = readFileSync(resolve(accountDir, 'ActiveAddons.client.tsx'), 'utf8');

const invoiceHistoryContent = readFileSync(
    resolve(accountDir, 'InvoiceHistory.client.tsx'),
    'utf8'
);

const paymentHistoryContent = readFileSync(
    resolve(accountDir, 'PaymentHistory.client.tsx'),
    'utf8'
);

const reviewEditFormContent = readFileSync(
    resolve(accountDir, 'ReviewEditForm.client.tsx'),
    'utf8'
);

const usageOverviewContent = readFileSync(resolve(accountDir, 'UsageOverview.client.tsx'), 'utf8');

const subscriptionCardUtilsContent = readFileSync(
    resolve(accountDir, 'subscription-card.utils.ts'),
    'utf8'
);

// ---------------------------------------------------------------------------
// ActiveAddons.client.tsx
// ---------------------------------------------------------------------------

describe('ActiveAddons.client.tsx', () => {
    describe('Named export', () => {
        it('should use named export for the component', () => {
            expect(activeAddonsContent).toContain('export function ActiveAddons');
        });

        it('should export the props interface', () => {
            expect(activeAddonsContent).toContain('export interface ActiveAddonsProps');
        });
    });

    describe('Props interface', () => {
        it('should have readonly locale prop', () => {
            expect(activeAddonsContent).toContain('readonly locale: SupportedLocale');
        });
    });

    describe('i18n', () => {
        it('should use useTranslation hook', () => {
            expect(activeAddonsContent).toContain('useTranslation');
        });

        it('should call t() for translations', () => {
            expect(activeAddonsContent).toContain('t(');
        });

        it('should import SupportedLocale type', () => {
            expect(activeAddonsContent).toContain('SupportedLocale');
        });
    });

    describe('Design tokens', () => {
        it('should use bg-muted for skeleton animation', () => {
            expect(activeAddonsContent).toContain('bg-muted');
        });

        it('should use text-foreground for headings', () => {
            expect(activeAddonsContent).toContain('text-foreground');
        });

        it('should use border-border for borders', () => {
            expect(activeAddonsContent).toContain('border-border');
        });

        it('should use bg-card for list items', () => {
            expect(activeAddonsContent).toContain('bg-card');
        });

        it('should use bg-primary for the retry button', () => {
            expect(activeAddonsContent).toContain('bg-primary');
        });

        it('should use semantic status tokens for status badges', () => {
            expect(activeAddonsContent).toContain('bg-success/10');
            expect(activeAddonsContent).toContain('bg-warning/10');
            expect(activeAddonsContent).toContain('bg-destructive/10');
        });

        it('should NOT use hardcoded hex colors', () => {
            expect(activeAddonsContent).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });
    });

    describe('Error handling', () => {
        it('should have a try/catch block for the fetch call', () => {
            expect(activeAddonsContent).toContain('try {');
            expect(activeAddonsContent).toContain('} catch {');
        });

        it('should have a hasError state', () => {
            expect(activeAddonsContent).toContain('hasError');
        });

        it('should have error handling for cancel operation', () => {
            expect(activeAddonsContent).toContain('handleCancel');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-labelledby on the section', () => {
            expect(activeAddonsContent).toContain('aria-labelledby="addons-heading"');
        });

        it('should have aria-busy on loading state', () => {
            expect(activeAddonsContent).toContain('aria-busy="true"');
        });

        it('should have aria-busy on cancel button when cancelling', () => {
            expect(activeAddonsContent).toContain('aria-busy={isCancelling}');
        });
    });

    describe('Code quality', () => {
        it('should NOT contain console.log', () => {
            expect(activeAddonsContent).not.toContain('console.log');
        });

        it('should NOT use any type', () => {
            expect(activeAddonsContent).not.toMatch(/:\s*any\b/);
        });

        it('should use as const for STATUS_STYLES', () => {
            expect(activeAddonsContent).toContain('as const');
        });
    });
});

// ---------------------------------------------------------------------------
// InvoiceHistory.client.tsx
// ---------------------------------------------------------------------------

describe('InvoiceHistory.client.tsx', () => {
    describe('Named export', () => {
        it('should use named export for the component', () => {
            expect(invoiceHistoryContent).toContain('export function InvoiceHistory');
        });

        it('should export the props interface', () => {
            expect(invoiceHistoryContent).toContain('export interface InvoiceHistoryProps');
        });
    });

    describe('Props interface', () => {
        it('should have readonly locale prop', () => {
            expect(invoiceHistoryContent).toContain('readonly locale: SupportedLocale');
        });
    });

    describe('i18n', () => {
        it('should use useTranslation hook', () => {
            expect(invoiceHistoryContent).toContain('useTranslation');
        });

        it('should call t() for translations', () => {
            expect(invoiceHistoryContent).toContain('t(');
        });
    });

    describe('Design tokens', () => {
        it('should use bg-muted for skeleton and table header', () => {
            expect(invoiceHistoryContent).toContain('bg-muted');
        });

        it('should use text-foreground for text', () => {
            expect(invoiceHistoryContent).toContain('text-foreground');
        });

        it('should use border-border for borders', () => {
            expect(invoiceHistoryContent).toContain('border-border');
        });

        it('should use text-muted-foreground for secondary text', () => {
            expect(invoiceHistoryContent).toContain('text-muted-foreground');
        });

        it('should use semantic status token bg-success/10 for paid invoices', () => {
            expect(invoiceHistoryContent).toContain('bg-success/10');
        });

        it('should use semantic status token bg-warning/10 for pending invoices', () => {
            expect(invoiceHistoryContent).toContain('bg-warning/10');
        });

        it('should use semantic status token bg-destructive/10 for overdue invoices', () => {
            expect(invoiceHistoryContent).toContain('bg-destructive/10');
        });

        it('should NOT use hardcoded hex colors', () => {
            expect(invoiceHistoryContent).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });
    });

    describe('Error handling', () => {
        it('should have a try/catch block for the fetch call', () => {
            expect(invoiceHistoryContent).toContain('try {');
            expect(invoiceHistoryContent).toContain('} catch {');
        });

        it('should have a hasError state', () => {
            expect(invoiceHistoryContent).toContain('hasError');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-labelledby on the section', () => {
            expect(invoiceHistoryContent).toContain('aria-labelledby="invoices-heading"');
        });

        it('should have aria-busy on loading state', () => {
            expect(invoiceHistoryContent).toContain('aria-busy="true"');
        });

        it('should have scope="col" on table headers', () => {
            expect(invoiceHistoryContent).toContain('scope="col"');
        });
    });

    describe('Code quality', () => {
        it('should NOT contain console.log', () => {
            expect(invoiceHistoryContent).not.toContain('console.log');
        });

        it('should NOT use any type', () => {
            expect(invoiceHistoryContent).not.toMatch(/:\s*any\b/);
        });
    });
});

// ---------------------------------------------------------------------------
// PaymentHistory.client.tsx
// ---------------------------------------------------------------------------

describe('PaymentHistory.client.tsx', () => {
    describe('Named export', () => {
        it('should use named export for the component', () => {
            expect(paymentHistoryContent).toContain('export function PaymentHistory');
        });

        it('should export the props interface', () => {
            expect(paymentHistoryContent).toContain('export interface PaymentHistoryProps');
        });
    });

    describe('Props interface', () => {
        it('should have readonly locale prop', () => {
            expect(paymentHistoryContent).toContain('readonly locale: SupportedLocale');
        });
    });

    describe('i18n', () => {
        it('should use useTranslation hook', () => {
            expect(paymentHistoryContent).toContain('useTranslation');
        });

        it('should call t() for translations', () => {
            expect(paymentHistoryContent).toContain('t(');
        });
    });

    describe('Design tokens', () => {
        it('should use bg-muted for skeleton and table header', () => {
            expect(paymentHistoryContent).toContain('bg-muted');
        });

        it('should use text-foreground for primary text', () => {
            expect(paymentHistoryContent).toContain('text-foreground');
        });

        it('should use border-border for borders', () => {
            expect(paymentHistoryContent).toContain('border-border');
        });

        it('should use text-muted-foreground for secondary text', () => {
            expect(paymentHistoryContent).toContain('text-muted-foreground');
        });

        it('should use bg-card for table rows', () => {
            expect(paymentHistoryContent).toContain('bg-card');
        });

        it('should NOT use hardcoded hex colors', () => {
            expect(paymentHistoryContent).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });
    });

    describe('Error handling', () => {
        it('should have a try/catch block for the fetch call', () => {
            expect(paymentHistoryContent).toContain('try {');
            expect(paymentHistoryContent).toContain('} catch {');
        });

        it('should have a hasError state', () => {
            expect(paymentHistoryContent).toContain('hasError');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-labelledby on the section', () => {
            expect(paymentHistoryContent).toContain('aria-labelledby="payments-heading"');
        });

        it('should have aria-busy on loading state', () => {
            expect(paymentHistoryContent).toContain('aria-busy="true"');
        });

        it('should have scope="col" on table headers', () => {
            expect(paymentHistoryContent).toContain('scope="col"');
        });
    });

    describe('Code quality', () => {
        it('should NOT contain console.log', () => {
            expect(paymentHistoryContent).not.toContain('console.log');
        });

        it('should NOT use any type', () => {
            expect(paymentHistoryContent).not.toMatch(/:\s*any\b/);
        });
    });
});

// ---------------------------------------------------------------------------
// ReviewEditForm.client.tsx
// ---------------------------------------------------------------------------

describe('ReviewEditForm.client.tsx', () => {
    describe('Named export', () => {
        it('should use named export for the component', () => {
            expect(reviewEditFormContent).toContain('export function ReviewEditForm');
        });

        it('should export the EditFormState interface', () => {
            expect(reviewEditFormContent).toContain('export interface EditFormState');
        });

        it('should export ReviewEditFormMessages interface', () => {
            expect(reviewEditFormContent).toContain('export interface ReviewEditFormMessages');
        });

        it('should export ReviewEditFormReview interface', () => {
            expect(reviewEditFormContent).toContain('export interface ReviewEditFormReview');
        });
    });

    describe('Props interface', () => {
        it('should have readonly review prop', () => {
            expect(reviewEditFormContent).toContain('readonly review: ReviewEditFormReview');
        });

        it('should have readonly messages prop', () => {
            expect(reviewEditFormContent).toContain('readonly messages: ReviewEditFormMessages');
        });

        it('should have readonly onSave callback', () => {
            expect(reviewEditFormContent).toContain('readonly onSave:');
        });

        it('should have readonly onCancel callback', () => {
            expect(reviewEditFormContent).toContain('readonly onCancel: () => void');
        });

        it('should have readonly isSaving prop', () => {
            expect(reviewEditFormContent).toContain('readonly isSaving: boolean');
        });

        it('should default locale to es', () => {
            expect(reviewEditFormContent).toContain("locale = 'es'");
        });
    });

    describe('i18n', () => {
        it('should import SupportedLocale type', () => {
            expect(reviewEditFormContent).toContain('SupportedLocale');
        });

        it('should use useTranslation hook', () => {
            expect(reviewEditFormContent).toContain('useTranslation');
        });
    });

    describe('Design tokens', () => {
        it('should use border-border for input borders', () => {
            expect(reviewEditFormContent).toContain('border-border');
        });

        it('should use bg-primary for submit button', () => {
            expect(reviewEditFormContent).toContain('bg-primary');
        });

        it('should use text-primary-foreground for button text', () => {
            expect(reviewEditFormContent).toContain('text-primary-foreground');
        });

        it('should use focus:ring-primary for focus rings', () => {
            expect(reviewEditFormContent).toContain('focus:ring-primary');
        });

        it('should NOT use hardcoded hex colors', () => {
            // Exclude HTML entities like &#9733; - only match CSS-style hex colors (#fff, #123abc)
            const withoutEntities = reviewEditFormContent.replace(/&#\d+;/g, '');
            expect(withoutEntities).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
        });
    });

    describe('Accessibility', () => {
        it('should have role="radiogroup" for the star rating', () => {
            expect(reviewEditFormContent).toContain('role="radiogroup"');
        });

        it('should have aria-checked on star buttons', () => {
            expect(reviewEditFormContent).toContain('aria-checked={form.rating === star}');
        });

        it('should have aria-label on star buttons', () => {
            expect(reviewEditFormContent).toContain('aria-label={tUi(');
        });

        it('should have htmlFor labels for inputs', () => {
            expect(reviewEditFormContent).toContain('htmlFor={`edit-title-${review.id}`}');
            expect(reviewEditFormContent).toContain('htmlFor={`edit-content-${review.id}`}');
        });

        it('should have aria-hidden on icons', () => {
            expect(reviewEditFormContent).toContain('aria-hidden="true"');
        });
    });

    describe('Form behavior', () => {
        it('should import icons from @repo/icons', () => {
            expect(reviewEditFormContent).toContain("from '@repo/icons'");
        });

        it('should handle form submit with e.preventDefault()', () => {
            expect(reviewEditFormContent).toContain('e.preventDefault()');
        });

        it('should disable controls when isSaving', () => {
            expect(reviewEditFormContent).toContain('disabled={isSaving}');
        });

        it('should have maxLength on title input', () => {
            expect(reviewEditFormContent).toContain('maxLength={200}');
        });

        it('should have maxLength on content textarea', () => {
            expect(reviewEditFormContent).toContain('maxLength={2000}');
        });
    });

    describe('Code quality', () => {
        it('should NOT contain console.log', () => {
            expect(reviewEditFormContent).not.toContain('console.log');
        });

        it('should NOT use any type', () => {
            expect(reviewEditFormContent).not.toMatch(/:\s*any\b/);
        });
    });
});

// ---------------------------------------------------------------------------
// UsageOverview.client.tsx
// ---------------------------------------------------------------------------

describe('UsageOverview.client.tsx', () => {
    describe('Named export', () => {
        it('should use named export for the component', () => {
            expect(usageOverviewContent).toContain('export function UsageOverview');
        });

        it('should export the props interface', () => {
            expect(usageOverviewContent).toContain('export interface UsageOverviewProps');
        });

        it('should export getUsagePercent helper', () => {
            expect(usageOverviewContent).toContain('function getUsagePercent');
        });

        it('should export getBarColor helper', () => {
            expect(usageOverviewContent).toContain('function getBarColor');
        });

        it('should export getTextColor helper', () => {
            expect(usageOverviewContent).toContain('function getTextColor');
        });
    });

    describe('Props interface', () => {
        it('should have readonly locale prop', () => {
            expect(usageOverviewContent).toContain('readonly locale: SupportedLocale');
        });
    });

    describe('i18n', () => {
        it('should use useTranslation hook', () => {
            expect(usageOverviewContent).toContain('useTranslation');
        });

        it('should call t() for translations', () => {
            expect(usageOverviewContent).toContain('t(');
        });
    });

    describe('Design tokens', () => {
        it('should use bg-muted for skeleton', () => {
            expect(usageOverviewContent).toContain('bg-muted');
        });

        it('should use text-foreground for primary text', () => {
            expect(usageOverviewContent).toContain('text-foreground');
        });

        it('should use border-border for error card border', () => {
            expect(usageOverviewContent).toContain('border-border');
        });

        it('should use bg-destructive for danger progress bars', () => {
            expect(usageOverviewContent).toContain('bg-destructive');
        });

        it('should use bg-warning for warning progress bars', () => {
            expect(usageOverviewContent).toContain('bg-warning');
        });

        it('should use bg-primary for normal progress bars', () => {
            expect(usageOverviewContent).toContain('bg-primary');
        });

        it('should use text-destructive for at-limit messages', () => {
            expect(usageOverviewContent).toContain('text-destructive');
        });

        it('should NOT use hardcoded hex colors', () => {
            expect(usageOverviewContent).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });
    });

    describe('Threshold constants', () => {
        it('should define THRESHOLD_WARNING at 80', () => {
            expect(usageOverviewContent).toContain('THRESHOLD_WARNING = 80');
        });

        it('should define THRESHOLD_DANGER at 90', () => {
            expect(usageOverviewContent).toContain('THRESHOLD_DANGER = 90');
        });
    });

    describe('Error handling', () => {
        it('should have a try/catch block for the fetch call', () => {
            expect(usageOverviewContent).toContain('try {');
            expect(usageOverviewContent).toContain('} catch {');
        });

        it('should have a hasError state', () => {
            expect(usageOverviewContent).toContain('hasError');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-labelledby on the section', () => {
            expect(usageOverviewContent).toContain('aria-labelledby="usage-heading"');
        });

        it('should have aria-busy on loading state', () => {
            expect(usageOverviewContent).toContain('aria-busy="true"');
        });

        it('should use role="progressbar" on progress bars', () => {
            expect(usageOverviewContent).toContain('role="progressbar"');
        });

        it('should have aria-valuenow on progress bar', () => {
            expect(usageOverviewContent).toContain('aria-valuenow={limit.current}');
        });

        it('should have aria-valuemin on progress bar', () => {
            expect(usageOverviewContent).toContain('aria-valuemin={0}');
        });

        it('should have aria-valuemax on progress bar', () => {
            expect(usageOverviewContent).toContain('aria-valuemax={limit.max');
        });
    });

    describe('Code quality', () => {
        it('should NOT contain console.log', () => {
            expect(usageOverviewContent).not.toContain('console.log');
        });

        it('should NOT use any type', () => {
            expect(usageOverviewContent).not.toMatch(/:\s*any\b/);
        });
    });
});

// ---------------------------------------------------------------------------
// subscription-card.utils.ts
// ---------------------------------------------------------------------------

describe('subscription-card.utils.ts', () => {
    describe('Named exports', () => {
        it('should export formatLocalDate function', () => {
            expect(subscriptionCardUtilsContent).toContain('export function formatLocalDate');
        });

        it('should export formatArsPrice function', () => {
            expect(subscriptionCardUtilsContent).toContain('export function formatArsPrice');
        });

        it('should export computeTrialDaysRemaining function', () => {
            expect(subscriptionCardUtilsContent).toContain(
                'export function computeTrialDaysRemaining'
            );
        });
    });

    describe('formatLocalDate', () => {
        it('should accept dateString and locale params', () => {
            expect(subscriptionCardUtilsContent).toContain(
                'formatLocalDate(dateString: string, locale: string)'
            );
        });

        it('should use formatDate from @repo/i18n', () => {
            expect(subscriptionCardUtilsContent).toContain('formatDate(');
        });

        it('should use toBcp47Locale for locale conversion', () => {
            expect(subscriptionCardUtilsContent).toContain('toBcp47Locale(locale)');
        });

        it('should use long month format options', () => {
            expect(subscriptionCardUtilsContent).toContain("month: 'long'");
        });
    });

    describe('formatArsPrice', () => {
        it('should accept amount and locale params', () => {
            expect(subscriptionCardUtilsContent).toContain(
                'formatArsPrice(amount: number, locale: string)'
            );
        });

        it('should use formatCurrency from @repo/i18n', () => {
            expect(subscriptionCardUtilsContent).toContain('formatCurrency(');
        });

        it('should format as ARS currency', () => {
            expect(subscriptionCardUtilsContent).toContain("currency: 'ARS'");
        });

        it('should append /mes suffix', () => {
            expect(subscriptionCardUtilsContent).toContain('`${formatted}/mes`');
        });
    });

    describe('computeTrialDaysRemaining', () => {
        it('should accept trialEndsAt param', () => {
            expect(subscriptionCardUtilsContent).toContain(
                'computeTrialDaysRemaining(trialEndsAt: string)'
            );
        });

        it('should return a non-negative number', () => {
            expect(subscriptionCardUtilsContent).toContain('Math.max(0, remaining)');
        });

        it('should use Math.ceil for day rounding', () => {
            expect(subscriptionCardUtilsContent).toContain('Math.ceil(');
        });
    });

    describe('Code quality', () => {
        it('should NOT contain console.log', () => {
            expect(subscriptionCardUtilsContent).not.toContain('console.log');
        });

        it('should NOT use any type', () => {
            expect(subscriptionCardUtilsContent).not.toMatch(/:\s*any\b/);
        });

        it('should have JSDoc comments on all exported functions', () => {
            // Each export should be preceded by a JSDoc block
            expect(subscriptionCardUtilsContent).toContain('* @param dateString');
            expect(subscriptionCardUtilsContent).toContain('* @param amount');
            expect(subscriptionCardUtilsContent).toContain('* @param trialEndsAt');
        });
    });
});
