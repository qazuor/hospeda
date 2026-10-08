import { getCatalogKey, PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    LISTING_OPERATIONS,
    OWNER_ADMITTING_STATES,
    RECOVER_OWN_LISTING_KEY
} from '../../src/authorization/listing-operation';
import {
    EMAIL_UNVERIFIED_ALLOWED_OPERATIONS,
    resolvePersonStateStep
} from '../../src/authorization/person-state-step';
import { resolveResourceStep } from '../../src/authorization/resource-step';

describe('step 4: resource ownership and publication state', () => {
    for (const operation of LISTING_OPERATIONS) {
        for (const publicationStatus of Object.values(PublicationStatusEnum)) {
            it(`${operation} on ${publicationStatus} follows the owner's state table`, () => {
                const allowed = OWNER_ADMITTING_STATES[operation].includes(publicationStatus);
                expect(
                    resolveResourceStep({
                        actorId: 'owner',
                        facts: { ownerId: 'owner', publicationStatus },
                        operation
                    })
                ).toEqual(allowed ? { allowed: true } : { allowed: false, reason: 'NOT_FOUND' });
            });

            it(`${operation} on foreign ${publicationStatus} is indistinguishable from absence`, () => {
                const expected = { allowed: false, reason: 'NOT_FOUND' };
                expect(
                    resolveResourceStep({
                        actorId: 'other',
                        facts: { ownerId: 'owner', publicationStatus },
                        operation
                    })
                ).toEqual(expected);
                expect(
                    resolveResourceStep({
                        actorId: null,
                        facts: { ownerId: 'owner', publicationStatus },
                        operation
                    })
                ).toEqual(expected);
                expect(resolveResourceStep({ actorId: 'owner', facts: null, operation })).toEqual(
                    expected
                );
            });
        }
        it(`${operation} admits a legacy null status for its owner only`, () => {
            expect(
                resolveResourceStep({
                    actorId: 'owner',
                    facts: { ownerId: 'owner', publicationStatus: null },
                    operation
                })
            ).toEqual({ allowed: true });
            expect(
                resolveResourceStep({
                    actorId: 'other',
                    facts: { ownerId: 'owner', publicationStatus: null },
                    operation
                })
            ).toEqual({ allowed: false, reason: 'NOT_FOUND' });
        });
    }

    it('requires a non-null owner id', () => {
        expect(
            resolveResourceStep({
                actorId: 'owner',
                facts: {
                    ownerId: null,
                    publicationStatus: PublicationStatusEnum.ARCHIVED
                },
                operation: 'READ_OWN'
            })
        ).toEqual({ allowed: false, reason: 'NOT_FOUND' });
    });
});

describe('step 2: closed email-unverified list', () => {
    it.each(EMAIL_UNVERIFIED_ALLOWED_OPERATIONS)('admits %s', (operation) => {
        expect(resolvePersonStateStep({ emailVerified: false, operation })).toEqual({
            allowed: true
        });
    });

    it('rejects an omitted or invented operation and partner-linked email changes', () => {
        const refusal = { allowed: false, reason: 'EMAIL_NOT_VERIFIED' };
        expect(resolvePersonStateStep({ emailVerified: false })).toEqual(refusal);
        expect(
            resolvePersonStateStep({ emailVerified: false, operation: 'OTHER' as never })
        ).toEqual(refusal);
        expect(
            resolvePersonStateStep({
                emailVerified: false,
                operation: 'CHANGE_EMAIL',
                hasPartnerLink: true
            })
        ).toEqual(refusal);
    });

    it('admits verified and unspecified email state', () => {
        expect(resolvePersonStateStep({ emailVerified: true })).toEqual({ allowed: true });
        expect(resolvePersonStateStep({ emailVerified: undefined })).toEqual({ allowed: true });
    });
});

it('declares recover_own_listing as a BASE catalog key', () => {
    expect(getCatalogKey({ key: RECOVER_OWN_LISTING_KEY })?.keyClass).toBe('BASE');
});
