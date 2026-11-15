import { formatDate, type Locale, trans } from '@repo/i18n';
import type { PartnerMailCopy, PartnerMailCopyResolver } from '@repo/notifications';

function readCopy(locale: Locale, key: string): string {
    const value = trans[locale][key];
    if (typeof value !== 'string') throw new Error(`Missing notification copy key: ${key}`);
    return value;
}

function interpolate(value: string, replacements: Readonly<Record<string, string>>): string {
    return value.replace(/\{\{(partnerName|date)\}\}/g, (placeholder, name: string) => {
        const replacement = replacements[name];
        return replacement === undefined ? placeholder : replacement;
    });
}

/** Resolves partner application mail copy from the shared notification locale files. */
export const resolvePartnerMailCopy: PartnerMailCopyResolver = (input): PartnerMailCopy => {
    if (input.kind === 'claim-notice') {
        const replacements = { partnerName: input.partnerName };
        return {
            subject: readCopy(input.locale, 'notifications.partnerApplication.claimNotice.subject'),
            preview: interpolate(
                readCopy(input.locale, 'notifications.partnerApplication.claimNotice.preview'),
                replacements
            ),
            heading: interpolate(
                readCopy(input.locale, 'notifications.partnerApplication.claimNotice.heading'),
                replacements
            ),
            paragraphs: [
                readCopy(input.locale, 'notifications.partnerApplication.claimNotice.body'),
                readCopy(input.locale, 'notifications.partnerApplication.claimNotice.singleUse'),
                readCopy(input.locale, 'notifications.partnerApplication.claimNotice.ignore')
            ],
            cta: readCopy(input.locale, 'notifications.partnerApplication.claimNotice.cta')
        };
    }
    const date = formatDate({
        date: input.reapplyAfter,
        locale: input.locale,
        options: { dateStyle: 'long', timeZone: 'America/Argentina/Buenos_Aires' }
    });
    return {
        subject: readCopy(input.locale, 'notifications.partnerApplication.rejected.subject'),
        preview: readCopy(input.locale, 'notifications.partnerApplication.rejected.preview'),
        heading: readCopy(input.locale, 'notifications.partnerApplication.rejected.heading'),
        paragraphs: [
            readCopy(input.locale, 'notifications.partnerApplication.rejected.body'),
            interpolate(
                readCopy(input.locale, 'notifications.partnerApplication.rejected.reapply'),
                { date }
            )
        ]
    };
};
