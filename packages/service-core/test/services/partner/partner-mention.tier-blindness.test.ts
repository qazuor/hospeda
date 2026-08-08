/**
 * HOS-377 T-031 / AC-4 — the mentions log is TIER-BLIND.
 *
 * ## What AC-4 actually promises
 *
 * A gold partner and a silver partner see the SAME log, rendered the same way.
 * Tier decides how often the ops team populates the log — a business rhythm, not
 * a software behaviour — and nothing in this feature may branch on it. R-4 adds
 * bronze: it must not diverge or crash either, even though bronze partners are
 * not currently promoted on a cadence at all.
 *
 * ## Why this is asserted on the SERVICE, not on a component
 *
 * The tier lives on `partners`, and the only way it could reach the rendered log
 * is through the payload. If two tiers produce byte-identical payloads there is
 * nothing for a component to branch on — the property is established at the
 * source rather than re-checked at each of the two surfaces that consume it.
 *
 * The static half matters as much as the fixture half: a payload comparison
 * passes trivially if the code simply never had a tier branch to begin with, and
 * it would keep passing if somebody added one downstream. So this also scans the
 * feature's source for tier references, which is the assertion that survives a
 * change nobody thought to re-run the fixtures against.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PartnerMentionModel, PartnerModel } from '@repo/db';
import { PartnerMentionChannelEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { PartnerMentionService } from '../../../src/services/partner/partner-mention.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();
const PARTNER_ID = getMockId('attraction', 'pm-tier-partner');
const OWNER_ID = getMockId('user', 'pm-tier-owner');
const BATCH_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AUG_01 = new Date('2026-08-01T12:00:00.000Z');

const ownerActor = createActor({ id: OWNER_ID, permissions: [], roles: [RoleEnum.USER] });
const adminActor = createActor({ permissions: [PermissionEnum.PARTNER_MANAGE] });

/** The same three-channel campaign, whatever tier the partner is on. */
const MENTIONS = [
    {
        id: 'c1',
        partnerId: PARTNER_ID,
        batchId: BATCH_ID,
        channel: PartnerMentionChannelEnum.INSTAGRAM,
        url: 'https://ig.test/1',
        mentionedAt: AUG_01,
        internalNote: 'internal',
        createdAt: AUG_01,
        updatedAt: AUG_01,
        createdById: null,
        updatedById: null,
        deletedAt: null,
        deletedById: null
    },
    {
        id: 'c2',
        partnerId: PARTNER_ID,
        batchId: BATCH_ID,
        channel: PartnerMentionChannelEnum.NEWSLETTER,
        url: 'https://hospeda.test/n/8',
        mentionedAt: AUG_01,
        internalNote: 'internal',
        createdAt: AUG_01,
        updatedAt: AUG_01,
        createdById: null,
        updatedById: null,
        deletedAt: null,
        deletedById: null
    },
    {
        id: 'c3',
        partnerId: PARTNER_ID,
        batchId: BATCH_ID,
        channel: PartnerMentionChannelEnum.WHATSAPP,
        url: null,
        mentionedAt: AUG_01,
        internalNote: 'internal',
        createdAt: AUG_01,
        updatedAt: AUG_01,
        createdById: null,
        updatedById: null,
        deletedAt: null,
        deletedById: null
    }
];

/** Builds the service for a partner sitting on one specific tier. */
function makeServiceForTier(tier: string) {
    const model = {
        findByPartner: vi.fn(async () => MENTIONS),
        countByPartner: vi.fn(async () => MENTIONS.length),
        findById: vi.fn(async () => MENTIONS[0]),
        update: vi.fn(async () => MENTIONS[0])
    } as unknown as PartnerMentionModel;

    const partnerModel = {
        findOne: vi.fn(async () => ({ id: PARTNER_ID, ownerUserId: OWNER_ID, tier }))
    } as unknown as PartnerModel;

    return new PartnerMentionService({ logger: mockLogger, model, partnerModel });
}

describe('AC-4 — gold and silver produce an identical partner-facing payload', () => {
    it('serializes byte-identically for gold and silver', async () => {
        const gold = await makeServiceForTier('GOLD').listForOwner(ownerActor);
        const silver = await makeServiceForTier('SILVER').listForOwner(ownerActor);

        // Byte comparison, not a field-by-field one: a field-by-field check only
        // covers the fields somebody remembered to list, and a tier-dependent
        // extra key would slip straight through it.
        expect(JSON.stringify(silver.data)).toBe(JSON.stringify(gold.data));
    });

    it('does not diverge or crash on BRONZE (R-4)', async () => {
        // Bronze partners are not promoted on a cadence today, so the log is
        // usually empty for them — but "usually empty" is not "a different
        // shape", and it must not be treated as one.
        const gold = await makeServiceForTier('GOLD').listForOwner(ownerActor);
        const bronze = await makeServiceForTier('BRONZE').listForOwner(ownerActor);

        expect(bronze.error).toBeUndefined();
        expect(JSON.stringify(bronze.data)).toBe(JSON.stringify(gold.data));
    });

    it('produces an identical ADMIN payload across tiers too', async () => {
        // The admin surface reads a different method with a different shape, so
        // its tier-blindness is a separate claim from the partner-facing one.
        const gold = await makeServiceForTier('GOLD').listForPartner(adminActor, {
            partnerId: PARTNER_ID
        });
        const silver = await makeServiceForTier('SILVER').listForPartner(adminActor, {
            partnerId: PARTNER_ID
        });

        expect(JSON.stringify(silver.data)).toBe(JSON.stringify(gold.data));
    });

    it('never reads the tier at all — it is absent from the payload', async () => {
        // The strongest form of "the UI cannot branch on tier": the value is
        // not in the data the UI receives.
        const result = await makeServiceForTier('GOLD').listForOwner(ownerActor);

        expect(JSON.stringify(result.data).toLowerCase()).not.toContain('gold');
        expect(JSON.stringify(result.data).toLowerCase()).not.toContain('tier');
    });
});

describe('AC-4 — no tier branch exists anywhere in the feature', () => {
    /**
     * Every file the mentions feature owns, across all four layers.
     *
     * Listed explicitly rather than globbed: a glob that silently matched
     * nothing (a moved directory, a renamed file) would make this pass by
     * checking an empty set, which is the exact failure a guard must not have.
     */
    const ROOT = resolve(__dirname, '../../../../..');
    const FEATURE_FILES = [
        'packages/service-core/src/services/partner/partner-mention.service.ts',
        'packages/service-core/src/services/partner/partner-mention.permissions.ts',
        'packages/db/src/models/partner/partner-mention.model.ts',
        'packages/schemas/src/entities/partner/partner-mention.schema.ts',
        'packages/schemas/src/entities/partner/partner-mention.create.schema.ts',
        'packages/schemas/src/entities/partner/partner-mention.update.schema.ts',
        'apps/api/src/routes/partners/admin/mentions/create.ts',
        'apps/api/src/routes/partners/admin/mentions/list.ts',
        'apps/api/src/routes/partners/admin/mentions/update.ts',
        'apps/api/src/routes/partners/admin/mentions/delete.ts',
        'apps/api/src/routes/partners/protected/mine-mentions.ts',
        'apps/admin/src/features/partners/components/PartnerMentionsSection.tsx',
        'apps/admin/src/features/partners/components/PartnerMentionRow.tsx',
        'apps/admin/src/features/partners/components/PartnerMentionForm.tsx',
        'apps/web/src/components/account/PartnerMentionsSection.astro'
    ] as const;

    /** Strips comments, so prose ABOUT tiers is not read as a branch ON them. */
    const stripComments = (source: string): string =>
        source
            .replace(/^\s*\/\/.*$/gm, '')
            .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
            .replace(/\/\*[\s\S]*?\*\//g, '');

    it('reads every listed feature file — none silently missing', () => {
        for (const file of FEATURE_FILES) {
            expect(
                () => readFileSync(resolve(ROOT, file), 'utf8'),
                `${file} is unreadable`
            ).not.toThrow();
        }
    });

    it('mentions no tier value in any executable line', () => {
        const offences: string[] = [];

        for (const file of FEATURE_FILES) {
            const code = stripComments(readFileSync(resolve(ROOT, file), 'utf8'));
            for (const term of ['GOLD', 'SILVER', 'BRONZE', 'tier']) {
                if (new RegExp(`\\b${term}\\b`).test(code)) {
                    offences.push(`  ${file} — references "${term}"`);
                }
            }
        }

        expect(
            offences,
            offences.length === 0
                ? ''
                : [
                      'AC-4: the mentions log must render identically for every tier.',
                      'Tier decides how often ops POPULATES the log, never what is',
                      'rendered from it. These files reference a tier in executable code:',
                      '',
                      ...offences
                  ].join('\n')
        ).toEqual([]);
    });
});
