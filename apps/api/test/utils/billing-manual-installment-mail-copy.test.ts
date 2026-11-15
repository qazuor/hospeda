import { describe, expect, it } from 'vitest';
import enAccount from '../../../../packages/i18n/src/locales/en/account.json';
import esAccount from '../../../../packages/i18n/src/locales/es/account.json';
import esNotifications from '../../../../packages/i18n/src/locales/es/notifications.json';
import ptAccount from '../../../../packages/i18n/src/locales/pt/account.json';
import { resolveManualInstallmentMailCopy } from '../../src/utils/billing-manual-installment-mail-copy.js';

const accounts = { es: esAccount, en: enAccount, pt: ptAccount } as const;
const base = {
    locale: 'es' as const,
    planSlug: 'partner-gold',
    planName: 'Plan X',
    amountMinor: 3_000_000,
    currency: 'ARS' as const,
    dueAt: new Date('2026-10-16T02:00:00.000Z'),
    firstInstallment: true
};

describe('HOS-2130 manual installment mail copy', () => {
    it('formats a whole amount without decimals like the partner card', () => {
        // Arrange
        // Act
        const copy = resolveManualInstallmentMailCopy(base);
        // Assert
        expect(copy.paragraphs[2]?.replace(/ /g, ' ')).toBe('Monto: $ 30.000');
    });

    it('keeps the cents when the amount has them', () => {
        // Arrange
        // Act
        const esCopy = resolveManualInstallmentMailCopy({ ...base, amountMinor: 3_000_050 });
        const enCopy = resolveManualInstallmentMailCopy({ ...base, locale: 'en' });
        // Assert
        expect(esCopy.paragraphs[2]?.replace(/ /g, ' ')).toBe('Monto: $ 30.000,50');
        expect(enCopy.paragraphs[2]?.replace(/ /g, ' ')).toBe('Amount: ARS 30,000');
    });

    it('says the team confirms the amount when it is unknown', () => {
        // Arrange
        // Act
        const copy = resolveManualInstallmentMailCopy({
            ...base,
            amountMinor: null,
            currency: null
        });
        // Assert
        expect(copy.paragraphs[2]).toBe(esAccount.partner.installment.amountPending);
    });

    it('names the plan from the catalog copy and falls back to the stored name', () => {
        // Arrange
        // Act
        const catalog = resolveManualInstallmentMailCopy(base);
        const fallback = resolveManualInstallmentMailCopy({ ...base, planSlug: 'not-a-plan' });
        // Assert
        expect(catalog.paragraphs[1]).toBe('Plan: Gold');
        expect(fallback.paragraphs[1]).toBe('Plan: Plan X');
    });

    it('shows the due day in the market time zone', () => {
        // Arrange
        // Act
        const copy = resolveManualInstallmentMailCopy(base);
        // Assert
        expect(copy.paragraphs[3]).toBe('Vence el 15 de octubre de 2026');
    });

    it.each([
        'es',
        'en',
        'pt'
    ] as const)('tells how to pay with the exact text of the partner card in %s', (locale) => {
        // Arrange
        // Act
        const copy = resolveManualInstallmentMailCopy({ ...base, locale });
        // Assert
        expect(copy.paragraphs[4]).toBe(accounts[locale].partner.installment.howToPay);
    });

    it('opens with the first-installment or renewal intro', () => {
        // Arrange
        // Act
        const first = resolveManualInstallmentMailCopy(base);
        const renewal = resolveManualInstallmentMailCopy({ ...base, firstInstallment: false });
        // Assert
        expect(first.paragraphs[0]).toBe(esNotifications.manualInstallmentOpened.introFirst);
        expect(renewal.paragraphs[0]).toBe(esNotifications.manualInstallmentOpened.introRenewal);
        expect(first.subject).toBe(esNotifications.manualInstallmentOpened.subject);
        expect(first.heading).toBe(esNotifications.manualInstallmentOpened.heading);
        expect(first.cta).toBe(esNotifications.manualInstallmentOpened.cta);
        expect(first.preview).toBe(esNotifications.manualInstallmentOpened.heading);
    });
});
