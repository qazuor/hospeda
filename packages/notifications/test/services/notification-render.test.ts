/**
 * Unit tests for the pure notification render extracted from
 * `NotificationService` (HOS-2519 D6). The service-level behaviour is pinned by
 * the existing, unedited `notification.service*.test.ts` and
 * `subject-placeholders.test.ts` suites (AC-4.5); these cover the extracted
 * functions directly.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    NOTIFICATION_TYPES_WITH_TEMPLATE,
    renderNotificationEmail,
    resolveNotificationSubject
} from '../../src/services/notification-render';
import { PartnerRevoked } from '../../src/templates/index';
import {
    type NotificationPayload,
    NotificationType,
    type PartnerRevokedPayload
} from '../../src/types/notification.types';
import { SAFE_FALLBACK_SUBJECT } from '../../src/utils/subject-builder';

const base = {
    recipientEmail: 'aliado@example.com',
    recipientName: 'Aliado de Ejemplo',
    userId: 'user-example-1'
};

const partnerRevoked: PartnerRevokedPayload = {
    ...base,
    type: NotificationType.PARTNER_REVOKED,
    partnerName: 'Comercio de Ejemplo',
    reason: 'Motivo de ejemplo'
};

describe('renderNotificationEmail', () => {
    it('returns the resolved subject and the selected template element', () => {
        // Act
        const result = renderNotificationEmail({
            payload: partnerRevoked,
            siteUrl: 'https://hospeda.com.ar'
        });

        // Assert
        expect(result.subject).toBe(
            'Comercio de Ejemplo ya no aparece entre los aliados de Hospeda'
        );
        expect(result.unresolvedPlaceholders).toEqual([]);
        expect(result.react.type).toBe(
            PartnerRevoked({ recipientName: '', partnerName: '', reason: '' }).type
        );
        expect(renderToStaticMarkup(result.react)).toContain('Motivo de ejemplo');
    });

    it('falls back to the generic subject and reports the unresolved placeholder', () => {
        // Arrange — the producer forgot `partnerName`.
        const payload = {
            ...partnerRevoked,
            partnerName: undefined
        } as unknown as NotificationPayload;

        // Act
        const result = renderNotificationEmail({ payload, siteUrl: 'https://hospeda.com.ar' });

        // Assert
        expect(result.subject).toBe(SAFE_FALLBACK_SUBJECT);
        expect(result.unresolvedPlaceholders).toEqual(['partnerName']);
    });

    it('throws for a type without a template before building any subject', () => {
        // Arrange
        const payload = {
            ...base,
            type: NotificationType.NEWSLETTER_CAMPAIGN
        } as unknown as NotificationPayload;

        // Act & Assert
        expect(() =>
            renderNotificationEmail({ payload, siteUrl: 'https://hospeda.com.ar' })
        ).toThrow('No template found for notification type: newsletter_campaign');
    });
});

describe('resolveNotificationSubject', () => {
    it('matches the subject renderNotificationEmail returns', () => {
        expect(resolveNotificationSubject({ payload: partnerRevoked }).subject).toBe(
            renderNotificationEmail({ payload: partnerRevoked, siteUrl: 'https://x.example' })
                .subject
        );
    });
});

describe('NOTIFICATION_TYPES_WITH_TEMPLATE', () => {
    it('lists the 49 types with a template and none of the six sent elsewhere', () => {
        expect(NOTIFICATION_TYPES_WITH_TEMPLATE).toHaveLength(49);
        for (const type of [
            NotificationType.TRIAL_ENDING_2D,
            NotificationType.TRIAL_ENDING_TODAY,
            NotificationType.TRIAL_WIN_BACK_15D,
            NotificationType.NEWSLETTER_VERIFICATION,
            NotificationType.NEWSLETTER_WELCOME,
            NotificationType.NEWSLETTER_CAMPAIGN
        ]) {
            expect(NOTIFICATION_TYPES_WITH_TEMPLATE).not.toContain(type);
        }
    });
});
