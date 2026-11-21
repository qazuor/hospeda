/**
 * HOS-2519 AC-4.2: the catalog's `outbox.*` entries and the production outbox
 * renderer registry name exactly the same templates. A renderer without an
 * entry (missing) and an entry without a renderer (stale) both fail.
 */
import { EMAIL_CATALOG } from '@repo/notifications';
import { describe, expect, it } from 'vitest';
import { buildOutboxRendererRegistry } from '../../../src/services/email-outbox/outbox-renderer-registry.js';
import {
    previewIssuePartnerClaimSecret,
    previewReadListingNames,
    previewReadReconciliationSubjects
} from '../../../src/services/email-preview/email-preview-deps.js';

describe('email catalog vs outbox renderer registry', () => {
    it('lists exactly the templates the registry renders', () => {
        // Arrange
        const registryKeys = Object.keys(
            buildOutboxRendererRegistry({
                siteUrl: 'https://hospeda.com.ar',
                readListingNames: previewReadListingNames,
                readReconciliationSubjects: previewReadReconciliationSubjects,
                issuePartnerClaimSecret: previewIssuePartnerClaimSecret
            })
        ).sort();
        const catalogIds = EMAIL_CATALOG.filter((entry) => entry.sendPath === 'outbox')
            .map((entry) => entry.id)
            .sort();

        // Assert
        expect(registryKeys.length).toBeGreaterThan(0);
        expect(
            registryKeys.filter((key) => !catalogIds.includes(key)),
            'renderers without a catalog entry'
        ).toEqual([]);
        expect(
            catalogIds.filter((id) => !registryKeys.includes(id)),
            'catalog entries without a renderer'
        ).toEqual([]);
        expect(catalogIds).toEqual(registryKeys);
    });
});
