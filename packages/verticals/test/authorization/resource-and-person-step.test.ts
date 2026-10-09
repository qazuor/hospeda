import { getCatalogKey, PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    FOREIGN_ADMITTING_STATES,
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

            it(`${operation} on foreign and guest ${publicationStatus} follows the foreign table`, () => {
                const expected = { allowed: false, reason: 'NOT_FOUND' };
                const foreignExpected = FOREIGN_ADMITTING_STATES[operation].includes(
                    publicationStatus
                )
                    ? { allowed: true }
                    : expected;
                expect(
                    resolveResourceStep({
                        actorId: 'other',
                        facts: { ownerId: 'owner', publicationStatus },
                        operation
                    })
                ).toEqual(foreignExpected);
                expect(
                    resolveResourceStep({
                        actorId: null,
                        facts: { ownerId: 'owner', publicationStatus },
                        operation
                    })
                ).toEqual(foreignExpected);
                expect(resolveResourceStep({ actorId: 'owner', facts: null, operation })).toEqual(
                    expected
                );
            });
        }
        it(`${operation} handles a legacy null status for its owner only`, () => {
            expect(
                resolveResourceStep({
                    actorId: 'owner',
                    facts: { ownerId: 'owner', publicationStatus: null },
                    operation
                })
            ).toEqual(
                operation === 'WRITE_ABOUT_LISTING'
                    ? { allowed: false, reason: 'NOT_FOUND' }
                    : { allowed: true }
            );
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

    it('does not treat an empty actor id as the owner', () => {
        expect(
            resolveResourceStep({
                actorId: '',
                facts: { ownerId: '', publicationStatus: PublicationStatusEnum.DRAFT },
                operation: 'READ_OWN'
            })
        ).toEqual({ allowed: false, reason: 'NOT_FOUND' });
    });

    it('permits public reading and writing about only published foreign listings', () => {
        expect(FOREIGN_ADMITTING_STATES.READ_PUBLIC).toEqual([PublicationStatusEnum.PUBLISHED]);
        expect(FOREIGN_ADMITTING_STATES.WRITE_ABOUT_LISTING).toEqual([
            PublicationStatusEnum.PUBLISHED
        ]);
        for (const operation of LISTING_OPERATIONS) {
            if (operation !== 'READ_PUBLIC' && operation !== 'WRITE_ABOUT_LISTING') {
                expect(FOREIGN_ADMITTING_STATES[operation]).toEqual([]);
            }
        }
    });
});

describe('step 2: closed email-unverified list', () => {
    it.each(EMAIL_UNVERIFIED_ALLOWED_OPERATIONS)('admits %s', (operation) => {
        expect(resolvePersonStateStep({ emailVerified: false, operation })).toEqual({
            allowed: true
        });
    });

    it('rejects an omitted or invented operation', () => {
        const refusal = { allowed: false, reason: 'EMAIL_NOT_VERIFIED' };
        expect(resolvePersonStateStep({ emailVerified: false })).toEqual(refusal);
        expect(
            resolvePersonStateStep({ emailVerified: false, operation: 'OTHER' as never })
        ).toEqual(refusal);
    });

    it('TEST:V5:3 rejects CHANGE_EMAIL with a Partner link and admits it without one', () => {
        expect(
            resolvePersonStateStep({
                emailVerified: false,
                operation: 'CHANGE_EMAIL',
                hasPartnerLink: true
            })
        ).toEqual({ allowed: false, reason: 'EMAIL_NOT_VERIFIED' });
        expect(
            resolvePersonStateStep({
                emailVerified: false,
                operation: 'CHANGE_EMAIL',
                hasPartnerLink: false
            })
        ).toEqual({ allowed: true });
    });

    it('admits verified and unspecified email state', () => {
        expect(resolvePersonStateStep({ emailVerified: true })).toEqual({ allowed: true });
        expect(resolvePersonStateStep({ emailVerified: undefined })).toEqual({ allowed: true });
    });
});

it('declares recover_own_listing as a BASE catalog key', () => {
    expect(getCatalogKey({ key: RECOVER_OWN_LISTING_KEY })?.keyClass).toBe('BASE');
});
