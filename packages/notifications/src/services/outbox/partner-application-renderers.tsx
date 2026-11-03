import type { EmailOutboxRow } from '@repo/db';
import { PartnerApplicationRejected, PartnerClaimNotice } from '../../templates/index.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const LOCALES = ['es', 'en', 'pt'] as const;
type PartnerMailLocale = (typeof LOCALES)[number];

/** Input used to resolve localized partner-application mail copy. */
export type PartnerMailCopyInput =
    | {
          readonly kind: 'claim-notice';
          readonly locale: PartnerMailLocale;
          readonly partnerName: string;
      }
    | {
          readonly kind: 'rejected';
          readonly locale: PartnerMailLocale;
          readonly reapplyAfter: Date;
      };

/** Resolved copy consumed by partner-application mail templates. */
export interface PartnerMailCopy {
    readonly subject: string;
    readonly preview: string;
    readonly heading: string;
    readonly paragraphs: readonly string[];
    readonly cta?: string;
}

/** Resolves mail copy without coupling notifications to an i18n package. */
export type PartnerMailCopyResolver = (input: PartnerMailCopyInput) => PartnerMailCopy;

/** Issues a fresh secret and persists its hash for an unclaimed Partner. */
export type PartnerClaimSecretIssuer = (input: {
    readonly partnerId: string;
}) => Promise<{ readonly secret: string } | null>;

/** Indicates that a claim notice cannot be issued for this Partner. */
export class PartnerClaimNoticeNotIssuableError extends Error {
    /** Creates an error that identifies the Partner without exposing a secret. */
    constructor(partnerId: string) {
        super(`Partner ${partnerId} cannot receive a claim notice`);
        this.name = 'PartnerClaimNoticeNotIssuableError';
    }
}

function payloadObject(row: EmailOutboxRow): Record<string, unknown> {
    const payload: unknown = row.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError('El payload del aviso de postulación no es válido');
    }
    return payload as Record<string, unknown>;
}

function validLocale(value: unknown): value is PartnerMailLocale {
    return typeof value === 'string' && LOCALES.includes(value as PartnerMailLocale);
}

function validateExactKeys(data: Record<string, unknown>, expected: readonly string[]): void {
    if (
        Object.keys(data).length !== expected.length ||
        expected.some((key) => !Object.hasOwn(data, key))
    ) {
        throw new TypeError('El payload del aviso de postulación tiene campos no válidos');
    }
}

function readClaimPayload(row: EmailOutboxRow): {
    readonly partnerId: string;
    readonly partnerName: string;
    readonly locale: PartnerMailLocale;
} {
    const data = payloadObject(row);
    validateExactKeys(data, ['partnerId', 'partnerName', 'locale']);
    if (
        typeof data.partnerId !== 'string' ||
        data.partnerId.trim() === '' ||
        typeof data.partnerName !== 'string' ||
        data.partnerName.trim() === '' ||
        !validLocale(data.locale)
    ) {
        throw new TypeError('Faltan datos requeridos del aviso de reclamo');
    }
    return {
        partnerId: data.partnerId,
        partnerName: data.partnerName,
        locale: data.locale
    };
}

function readRejectedPayload(row: EmailOutboxRow): {
    readonly applicationId: string;
    readonly reapplyAfter: Date;
    readonly locale: PartnerMailLocale;
} {
    const data = payloadObject(row);
    validateExactKeys(data, ['applicationId', 'reapplyAfter', 'locale']);
    const instant =
        typeof data.reapplyAfter === 'string' && ISO_INSTANT.test(data.reapplyAfter)
            ? new Date(data.reapplyAfter)
            : null;
    if (
        typeof data.applicationId !== 'string' ||
        data.applicationId.trim() === '' ||
        !instant ||
        Number.isNaN(instant.getTime()) ||
        !validLocale(data.locale)
    ) {
        throw new TypeError('Faltan datos requeridos del aviso de rechazo');
    }
    return { applicationId: data.applicationId, reapplyAfter: instant, locale: data.locale };
}

/** Creates renderers for Partner application claim and rejection notices. */
export function createPartnerApplicationRenderers(input: {
    readonly siteUrl: string;
    readonly issueClaimSecret: PartnerClaimSecretIssuer;
    readonly resolveCopy: PartnerMailCopyResolver;
}): Readonly<Record<string, OutboxMailRenderer>> {
    const siteUrl = input.siteUrl.replace(/\/$/, '');
    return {
        'verticals.partner-claim-notice': async ({ row }) => {
            const data = readClaimPayload(row);
            const issued = await input.issueClaimSecret({ partnerId: data.partnerId });
            if (!issued) throw new PartnerClaimNoticeNotIssuableError(data.partnerId);
            const claimUrl = `${siteUrl}/${data.locale}/partners/reclamar/#partner=${data.partnerId}&secret=${encodeURIComponent(issued.secret)}`;
            const copy = input.resolveCopy({
                kind: 'claim-notice',
                locale: data.locale,
                partnerName: data.partnerName
            });
            if (!copy.cta) throw new TypeError('Falta el botón del aviso de reclamo');
            return {
                subject: copy.subject,
                react: (
                    <PartnerClaimNotice
                        preview={copy.preview}
                        heading={copy.heading}
                        paragraphs={copy.paragraphs}
                        cta={copy.cta}
                        claimUrl={claimUrl}
                    />
                )
            };
        },
        'verticals.partner-application-rejected': ({ row }) => {
            const data = readRejectedPayload(row);
            const copy = input.resolveCopy({
                kind: 'rejected',
                locale: data.locale,
                reapplyAfter: data.reapplyAfter
            });
            return {
                subject: copy.subject,
                react: (
                    <PartnerApplicationRejected
                        preview={copy.preview}
                        heading={copy.heading}
                        paragraphs={copy.paragraphs}
                    />
                )
            };
        }
    };
}
