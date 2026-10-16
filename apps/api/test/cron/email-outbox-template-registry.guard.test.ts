/** TEST:1675:2 production sender render coverage. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { EmailOutboxRow } from '@repo/db';
import { OutboxTemplateNotRegisteredError } from '@repo/notifications';
import { BEFORE_CANCEL_TEMPLATE_BY_KIND } from '@repo/service-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildOutboxSenderRender } from '../../src/cron/jobs/email-outbox-sender.job.js';
import { TRIAL_CAMPAIGN_TEMPLATES } from '../../src/utils/trial/trial-campaign-outbox.js';

const REPO_ROOT = resolve(import.meta.dirname, '../../../..');

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const file = join(dir, name);
        return statSync(file).isDirectory()
            ? sourceFiles(file)
            : /\.tsx?$/.test(name)
              ? [file]
              : [];
    });
}

/** Removes line and block comments while preserving quoted strings and template contents. */
function stripComments(source: string): string {
    let result = '';
    let state: 'code' | 'single' | 'double' | 'template' | 'line' | 'block' = 'code';
    for (let i = 0; i < source.length; i++) {
        const char = source[i]!;
        const next = source[i + 1];
        if (state === 'line') {
            if (char === '\n') {
                result += char;
                state = 'code';
            }
            continue;
        }
        if (state === 'block') {
            if (char === '*' && next === '/') {
                state = 'code';
                i++;
            }
            continue;
        }
        if (state !== 'code') {
            result += char;
            if (char === '\\') {
                result += next ?? '';
                i++;
                continue;
            }
            if (
                (state === 'single' && char === "'") ||
                (state === 'double' && char === '"') ||
                (state === 'template' && char === '`')
            )
                state = 'code';
            continue;
        }
        if (char === '/' && next === '/') {
            state = 'line';
            i++;
            continue;
        }
        if (char === '/' && next === '*') {
            state = 'block';
            i++;
            continue;
        }
        if (char === "'") state = 'single';
        else if (char === '"') state = 'double';
        else if (char === '`') state = 'template';
        result += char;
    }
    return result;
}

const ENQUEUE_SITES: Readonly<
    Record<
        string,
        readonly string[] | 'BEFORE_CANCEL_TEMPLATE_BY_KIND' | 'TRIAL_CAMPAIGN_TEMPLATES'
    >
> = {
    'apps/api/src/routes/billing-subscription/before-cancel-notice.ts':
        'BEFORE_CANCEL_TEMPLATE_BY_KIND',
    'apps/api/src/utils/trial/trial-campaign-outbox.ts': 'TRIAL_CAMPAIGN_TEMPLATES',
    'apps/api/src/utils/listing-publication/ports.ts': ['verticals.listing-restitution'],
    'packages/verticals/src/publication/archive-inactive-listing.ts': [
        'verticals.listing-archived'
    ],
    'packages/verticals/src/publication/coverage-recalculation.ts': [
        'verticals.listing-restitution'
    ],
    'packages/verticals/src/publication/fix-request.ts': [
        'verticals.listing-fix-requested',
        'verticals.listing-moderation-lifted'
    ],
    'packages/verticals/src/publication/lift-moderation.ts': [
        'verticals.listing-moderation-level-changed',
        'verticals.listing-moderation-lifted'
    ],
    'packages/verticals/src/publication/moderate-listing.ts': [
        'verticals.listing-moderated',
        'verticals.listing-moderation-level-changed'
    ],
    'packages/verticals/src/publication/purge-inactive-listing.ts': [
        'verticals.price-alert-closed'
    ],
    'packages/verticals/src/publication/purge-listing.ts': [
        'verticals.listing-purged',
        'verticals.price-alert-closed'
    ],
    'packages/service-core/src/services/billing/reconciliation/summary/run-summary-tick.service.ts':
        ['billing.reconciliation-summary'],
    'packages/service-core/src/services/billing/reconciliation/immediate-notice.ts': [
        'billing.duplicate-charge-detected'
    ],
    'packages/service-core/src/services/billing/reconciliation/escalation-notice.ts': [
        'billing.mark-escalated'
    ],
    'packages/service-core/src/services/billing/subscription/signup-confirmed-notice.ts': [
        'billing.signup-confirmed'
    ],
    'packages/service-core/src/services/billing/subscription/signup-incomplete-notice.ts': [
        'billing.signup-incomplete'
    ],
    'packages/service-core/src/services/billing/subscription/renewal-notice.ts': [
        'billing.renewal-upcoming'
    ],
    'packages/service-core/src/services/billing/subscription/signup-declined-notice.ts': [
        'billing.signup-declined'
    ],
    'packages/service-core/src/services/billing/subscription/grace-started-notice.ts': [
        'billing.grace-started'
    ],
    'packages/service-core/src/services/billing/payment/credit-payment.service.ts': [
        'billing.payment-credited'
    ],
    'packages/service-core/src/services/listing/listing-support-edit.ts': [
        'verticals.listing-content-edited-by-support'
    ]
};

const enqueuePattern =
    /emailOutboxModel\.enqueue\b|\benqueueOrMergeScheduledEmail\(|\.enqueueListingNotice\(|\.enqueueRestitutionNotice\(/;
const sourceRoots = [
    ...readdirSync(join(REPO_ROOT, 'packages'))
        .map((name) => join(REPO_ROOT, 'packages', name, 'src'))
        .filter((dir) => {
            try {
                return statSync(dir).isDirectory();
            } catch {
                return false;
            }
        }),
    join(REPO_ROOT, 'apps/api/src')
];
const allSourceFiles = sourceRoots.flatMap(sourceFiles).filter((file) => {
    const rel = relative(REPO_ROOT, file).replaceAll('\\', '/');
    return (
        !/\.test\.tsx?$/.test(file) &&
        !/(^|\/)(test|__tests__)(\/|$)/.test(rel) &&
        !rel.startsWith('packages/db/src/models/email-outbox/')
    );
});
const sourceByPath = new Map(
    allSourceFiles.map((file) => [
        relative(REPO_ROOT, file).replaceAll('\\', '/'),
        stripComments(readFileSync(file, 'utf8'))
    ])
);
const templateConstants = new Map<string, string>();
for (const source of sourceByPath.values()) {
    for (const match of source.matchAll(/\bconst ([A-Z][A-Z0-9_]*_TEMPLATE)\s*=\s*'([^']+)'/g)) {
        templateConstants.set(match[1]!, match[2]!);
    }
}
const expandedTemplateLists = Object.values(ENQUEUE_SITES).flatMap((entry) => {
    if (Array.isArray(entry)) return entry;
    if (entry === 'BEFORE_CANCEL_TEMPLATE_BY_KIND')
        return Object.values(BEFORE_CANCEL_TEMPLATE_BY_KIND);
    return Object.values(TRIAL_CAMPAIGN_TEMPLATES).flatMap((campaign) => Object.values(campaign));
});
const TEMPLATES = [
    ...new Set([
        ...expandedTemplateLists,
        ...templateConstants.values(),
        ...Object.values(BEFORE_CANCEL_TEMPLATE_BY_KIND),
        ...Object.values(TRIAL_CAMPAIGN_TEMPLATES).flatMap((campaign) => Object.values(campaign))
    ])
].sort();

function row(template: string, payload: Record<string, unknown>): EmailOutboxRow {
    return {
        id: 'outbox-test',
        recipientUserId: 'user-test',
        recipientEmail: 'ana@example.test',
        template,
        channel: 'email',
        payload,
        sendAfter: null,
        status: 'processing',
        dedupKey: 'dedup-test',
        lockedBy: 'test',
        lockedUntil: new Date('2026-10-07T12:05:00.000Z'),
        attempts: 0,
        providerMessageId: null,
        lastError: null,
        correlationId: null,
        createdAt: new Date('2026-10-07T12:00:00.000Z'),
        updatedAt: new Date('2026-10-07T12:00:00.000Z')
    };
}

async function assertTemplateHasRenderer(template: string): Promise<void> {
    const render = buildOutboxSenderRender({
        siteUrl: 'https://hospeda.test',
        readListingNames: async () => new Map()
    });
    try {
        await render({ row: row(template, {}) });
    } catch (error) {
        expect(
            error,
            `${template} has no production renderer; register it in buildOutboxSenderRender`
        ).not.toBeInstanceOf(OutboxTemplateNotRegisteredError);
    }
}

describe('TEST:1675:2 AC:1675:1 the four pending templates render through the production sender', () => {
    const readListingNames = async ({ ids }: { readonly ids: readonly string[] }) =>
        new Map(ids.map((id) => [id, 'Cabañas del Río'] as const));
    const render = buildOutboxSenderRender({ siteUrl: 'https://hospeda.test', readListingNames });

    it.each([
        [
            'billing.signup-declined',
            {
                subscriptionId: 'private-subscription',
                vertical: 'accommodation',
                declineReason: null,
                successionPredecessor: false
            },
            'No se te cobró nada'
        ],
        [
            'billing.grace-started',
            {
                subscriptionId: 'private-grace-subscription',
                vertical: 'gastronomy',
                graceEndsAt: '2026-10-20T02:00:00.000Z'
            },
            'Tu servicio sigue activo'
        ],
        [
            'billing.payment-credited',
            {
                paymentId: 'private-payment',
                subscriptionId: 'private-payment-subscription',
                amountMinor: 1800000,
                currency: 'ARS',
                receiptId: 'private-receipt',
                receiptNumber: 42
            },
            'comprobante no fiscal'
        ],
        [
            'verticals.listing-content-edited-by-support',
            {
                vertical: 'experience',
                listingId: 'private-listing',
                listingName: 'Kayak al atardecer',
                editedAt: '2026-10-20T12:00:00.000Z',
                parts: ['texts']
            },
            'No se publicó, no se destacó ni se borró por eso'
        ]
    ])('renders %s with a subject, distinctive body and no payload identifiers', async (template, payload, phrase) => {
        const result = await render({ row: row(template, payload) });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject.trim()).not.toBe('');
        expect(html).toContain(phrase);
        for (const value of Object.values(payload)) {
            if (typeof value === 'string' && value.startsWith('private-'))
                expect(html).not.toContain(value);
        }
    });
});

/**
 * Protects Coord-283: an outbox row without a renderer ends as failed and the email never goes out.
 * When adding an enqueue site or template, declare it in ENQUEUE_SITES in the same PR and register
 * its renderer in buildOutboxSenderRender. A new enqueue primitive outside the four censused calls
 * escapes this inventory; its author must add that primitive to the census regex.
 */
describe('TEST:1675:3 AC:1675:2 every template the outbox enqueues has a production renderer', () => {
    const enqueuedFiles = [...sourceByPath.entries()]
        .filter(([, source]) => enqueuePattern.test(source))
        .map(([file]) => file)
        .sort();

    it('declares exactly every source file that enqueues outbox mail', () => {
        const declared = Object.keys(ENQUEUE_SITES).sort();
        const undeclared = enqueuedFiles.filter((file) => !declared.includes(file));
        const stale = declared.filter((file) => !enqueuedFiles.includes(file));
        expect(
            { undeclared, stale },
            `sitio nuevo sin declarar: ${undeclared.join(', ') || '(ninguno)'}; declaralo con sus plantillas y registrá su renderer; sitios declarados que faltan: ${stale.join(', ') || '(ninguno)'}`
        ).toEqual({ undeclared: [], stale: [] });
    });

    it('matches each enqueue site to its declared template literals and constants', () => {
        for (const [file, entry] of Object.entries(ENQUEUE_SITES)) {
            if (!Array.isArray(entry)) continue;
            const source = sourceByPath.get(file)!;
            for (const identifier of source.matchAll(/\b[A-Z][A-Z0-9_]*_TEMPLATE\b/g)) {
                const template = templateConstants.get(identifier[0]);
                expect(
                    template,
                    `${file} usa ${identifier[0]}, que no está definida en las raíces`
                ).toBeDefined();
                expect(
                    entry,
                    `${file}: ${identifier[0]} resuelve a ${template}, fuera de su lista`
                ).toContain(template);
            }
            for (const literal of source.matchAll(/'(?:billing|verticals)\.[a-z0-9-]+'/g)) {
                expect(entry, `${file} encola ${literal[0]}, fuera de su lista`).toContain(
                    literal[0].slice(1, -1)
                );
            }
        }
    });

    it.each(
        TEMPLATES
    )('renders %s through the production sender or reaches its payload validation', async (template) => {
        await assertTemplateHasRenderer(template);
    });

    it('proves the registry probe is rejected and required template families are included', async () => {
        const render = buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' });
        await expect(
            render({ row: row('billing.__unregistered-probe__', {}) })
        ).rejects.toBeInstanceOf(OutboxTemplateNotRegisteredError);
        await expect(assertTemplateHasRenderer('billing.__unregistered-probe__')).rejects.toThrow(
            'billing.__unregistered-probe__ has no production renderer'
        );
        for (const template of [
            'billing.signup-declined',
            'billing.grace-started',
            'billing.payment-credited',
            'verticals.listing-content-edited-by-support',
            'billing.before-cancel',
            'trial_win_back_1d',
            'verticals.listing-archived',
            'verticals.price-alert-closed'
        ])
            expect(TEMPLATES).toContain(template);
        for (const root of [
            'apps/api/src',
            'packages/service-core/src',
            'packages/verticals/src'
        ]) {
            expect(
                enqueuedFiles.some((file) => file.startsWith(root)),
                `${root} has no enqueued site`
            ).toBe(true);
        }
    });

    it('ignores enqueue calls inside comments', () => {
        expect(stripComments('// emailOutboxModel.enqueue(\nconst active = true;')).not.toMatch(
            enqueuePattern
        );
    });
});
