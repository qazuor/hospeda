import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/suscripcion/index.astro'),
    'utf8'
);

describe('HOS-2064 declined signup notice page', () => {
    it('mounts one SubscriptionReturn per declined signup outside the return-id guard', () => {
        // Arrange
        const noticeMap = SOURCE.indexOf('selectDeclinedNoticesToShow(');
        const returnGuard = SOURCE.indexOf('{returnSubscriptionId && <SubscriptionReturn');
        // Act
        const noticeSource = SOURCE.slice(noticeMap);
        // Assert
        expect(noticeMap).toBeGreaterThan(returnGuard);
        expect(noticeSource).toContain('initialStatus="CHARGE_DECLINED"');
        expect(noticeSource).toContain('.map((notice) => (');
    });

    it('passes the declared email and the option of the declined attempt', () => {
        // Arrange
        const noticeMap = SOURCE.indexOf('selectDeclinedNoticesToShow(');
        const noticeSource = SOURCE.slice(noticeMap);
        // Act
        const hasDeclaredEmail = noticeSource.includes(
            'declaredPayerEmail={notice.declaredPayerEmail}'
        );
        const hasBillingOption = noticeSource.includes('billingOptionId={notice.billingOptionId}');
        // Assert
        expect(hasDeclaredEmail).toBe(true);
        expect(hasBillingOption).toBe(true);
    });
});
