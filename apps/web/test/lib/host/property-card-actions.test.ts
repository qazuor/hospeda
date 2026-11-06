/**
 * @file property-card-actions.test.ts
 * @description The host accommodation card's actions per publication state
 * (HOS-1641, H11; Coord-351 F4: a `PURGED` listing offers none). One case per
 * `PublicationStatusEnum` value, so a new state cannot be added without an
 * explicit answer here.
 */

import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    hasAnyPropertyCardAction,
    type PropertyCardActions,
    resolvePropertyCardActions,
    resolveRepublishOffer
} from '../../../src/lib/host/property-card-actions';
import type { PublishAffordance } from '../../../src/lib/publish/subscribe-button';

const EXPECTED: Readonly<Record<PublicationStatusEnum, PropertyCardActions>> = {
    [PublicationStatusEnum.DRAFT]: {
        edit: true,
        viewOnSite: false,
        publish: true,
        republish: false,
        unpublish: false,
        delete: true,
        qrBlock: true,
        canPrintQrSheet: false
    },
    [PublicationStatusEnum.PUBLISHED]: {
        edit: true,
        viewOnSite: true,
        publish: false,
        republish: false,
        unpublish: true,
        delete: true,
        qrBlock: true,
        canPrintQrSheet: true
    },
    [PublicationStatusEnum.UNPUBLISHED_BY_BILLING]: {
        edit: true,
        viewOnSite: false,
        publish: false,
        republish: true,
        unpublish: false,
        delete: true,
        qrBlock: true,
        canPrintQrSheet: false
    },
    [PublicationStatusEnum.ARCHIVED]: {
        edit: true,
        viewOnSite: false,
        publish: false,
        republish: false,
        unpublish: false,
        delete: true,
        qrBlock: true,
        canPrintQrSheet: false
    },
    [PublicationStatusEnum.MODERATED]: {
        edit: true,
        viewOnSite: false,
        publish: false,
        republish: false,
        unpublish: false,
        delete: true,
        qrBlock: true,
        canPrintQrSheet: false
    },
    [PublicationStatusEnum.PURGED]: {
        edit: false,
        viewOnSite: false,
        publish: false,
        republish: false,
        unpublish: false,
        delete: false,
        qrBlock: false,
        canPrintQrSheet: false
    }
};

describe('resolvePropertyCardActions (HOS-1641, H11)', () => {
    it.each(Object.values(PublicationStatusEnum))('%s renders exactly its actions', (status) => {
        // Arrange
        const publicationStatus = status as PublicationStatusEnum;

        // Act
        const actions = resolvePropertyCardActions({ publicationStatus });

        // Assert
        expect(actions).toEqual(EXPECTED[publicationStatus]);
    });

    it('PURGED renders no action at all: no edit, view, publish, unpublish, delete or QR', () => {
        const actions = resolvePropertyCardActions({
            publicationStatus: PublicationStatusEnum.PURGED
        });

        expect(Object.values(actions).every((value) => value === false)).toBe(true);
        expect(hasAnyPropertyCardAction({ actions })).toBe(false);
    });

    it('only PUBLISHED can print the QR sheet', () => {
        const printable = Object.values(PublicationStatusEnum).filter(
            (publicationStatus) => resolvePropertyCardActions({ publicationStatus }).canPrintQrSheet
        );

        expect(printable).toEqual([PublicationStatusEnum.PUBLISHED]);
    });

    it('an unknown state fails closed: no action', () => {
        const actions = resolvePropertyCardActions({
            publicationStatus: 'ACTIVE' as PublicationStatusEnum
        });

        expect(hasAnyPropertyCardAction({ actions })).toBe(false);
        expect(actions.qrBlock).toBe(false);
    });

    it.each(
        Object.values(PublicationStatusEnum).filter((s) => s !== PublicationStatusEnum.PURGED)
    )('%s has at least one action', (publicationStatus) => {
        expect(
            hasAnyPropertyCardAction({
                actions: resolvePropertyCardActions({ publicationStatus })
            })
        ).toBe(true);
    });
});

describe('resolveRepublishOffer (HOS-1977)', () => {
    const kinds = {
        publish: { kind: 'publish', canPublish: true, startsTrial: true, trialDays: 30 },
        covered: { kind: 'covered', canPublish: true, startsTrial: false, trialDays: null },
        checkout: { kind: 'checkout', canPublish: false, startsTrial: false, trialDays: null },
        noPlans: { kind: 'noPlans', canPublish: false, startsTrial: false, trialDays: null },
        unknown: { kind: 'unknown', canPublish: false, startsTrial: false, trialDays: null }
    } as const satisfies Record<PublishAffordance['kind'], PublishAffordance>;
    const billingActions = resolvePropertyCardActions({
        publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING
    });

    it.each([
        ['publish', true],
        ['checkout', true],
        ['noPlans', true],
        ['unknown', true],
        ['covered', true]
    ] as const)('billing-unpublished card with %s affordance -> %s', (kind, expected) => {
        expect(resolveRepublishOffer({ actions: billingActions, affordance: kinds[kind] })).toBe(
            expected
        );
    });

    it.each(
        Object.values(PublicationStatusEnum).filter(
            (status) => status !== PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        )
    )('%s never offers republish, whatever the affordance', (status) => {
        const actions = resolvePropertyCardActions({ publicationStatus: status });
        for (const affordance of Object.values(kinds)) {
            expect(resolveRepublishOffer({ actions, affordance })).toBe(false);
        }
    });
});
