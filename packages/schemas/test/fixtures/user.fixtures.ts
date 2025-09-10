import { faker } from '@faker-js/faker';
import type { RoleEnum } from '@repo/types';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseContactFields,
    createBaseIdFields,
    createBaseLifecycleFields,
    createBaseModerationFields,
    createBaseVisibilityFields,
    createInvalidEmail,
    createTooLongString,
    createTooShortString
} from './common.fixtures.js';

/**
 * User fixtures for testing
 */

export const createValidUser = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createBaseLifecycleFields(),
    ...createBaseModerationFields(),
    ...createBaseVisibilityFields(),
    ...createBaseContactFields(),
    ...createBaseAdminFields(),

    // User-specific required fields
    slug: faker.lorem.slug(3),
    authProvider: faker.helpers.arrayElement(['CLERK', 'AUTH0', 'CUSTOM']),
    displayName: faker.person.fullName(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    birthDate: faker.date.birthdate({ min: 18, max: 80, mode: 'age' }),
    role: faker.helpers.arrayElement(['USER', 'ADMIN', 'SUPER_ADMIN']) as RoleEnum,

    // Permissions - using valid permission strings from the enum
    permissions: faker.helpers.multiple(
        () =>
            faker.helpers.arrayElement([
                'accommodation.create',
                'accommodation.update.own',
                'user.read.all',
                'post.create',
                'destination.create'
            ]),
        { count: { min: 2, max: 4 } }
    ),

    // Profile
    profile: {
        avatar: faker.helpers.maybe(() => faker.image.avatar(), { probability: 0.7 }),
        bio: faker.helpers.maybe(() => faker.lorem.paragraph(), { probability: 0.6 }),
        location: faker.helpers.maybe(() => faker.location.city(), { probability: 0.5 }),
        website: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.4 }),
        interests: faker.helpers.maybe(
            () => faker.helpers.multiple(() => faker.lorem.word(), { count: { min: 2, max: 8 } }),
            { probability: 0.6 }
        ),
        languages: faker.helpers.maybe(
            () =>
                faker.helpers.multiple(
                    () => faker.helpers.arrayElement(['en', 'es', 'fr', 'de', 'it']),
                    { count: { min: 1, max: 3 } }
                ),
            { probability: 0.7 }
        )
    },

    // Settings
    settings: {
        notifications: {
            enabled: faker.datatype.boolean(),
            allowEmails: faker.datatype.boolean(),
            allowSms: faker.datatype.boolean(),
            allowPush: faker.datatype.boolean()
        },
        privacy: faker.helpers.maybe(
            () => ({
                profileVisibility: faker.helpers.arrayElement(['PUBLIC', 'PRIVATE', 'FRIENDS']),
                showEmail: faker.datatype.boolean(),
                showPhone: faker.datatype.boolean(),
                allowMessages: faker.datatype.boolean()
            }),
            { probability: 0.8 }
        ),
        preferences: faker.helpers.maybe(
            () => ({
                language: faker.helpers.arrayElement(['en', 'es', 'fr']),
                timezone: faker.location.timeZone(),
                currency: faker.helpers.arrayElement(['USD', 'EUR', 'GBP', 'ARS']),
                theme: faker.helpers.arrayElement(['LIGHT', 'DARK', 'AUTO'])
            }),
            { probability: 0.8 }
        )
    },

    // Bookmarks
    bookmarks: faker.helpers.maybe(
        () =>
            faker.helpers.multiple(
                () => ({
                    ...createBaseIdFields(),
                    ...createBaseAuditFields(),
                    ...createBaseLifecycleFields(),
                    ...createBaseAdminFields(),
                    userId: faker.string.uuid(),
                    entityType: faker.helpers.arrayElement([
                        'ACCOMMODATION',
                        'DESTINATION',
                        'POST',
                        'EVENT'
                    ]),
                    entityId: faker.string.uuid(),
                    name: faker.helpers.maybe(() => faker.lorem.words(3), { probability: 0.6 }),
                    description: faker.helpers.maybe(() => faker.lorem.sentence(), {
                        probability: 0.4
                    })
                }),
                { count: { min: 1, max: 3 } }
            ),
        { probability: 0.6 }
    )
});

export const createMinimalUser = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createBaseLifecycleFields(),
    ...createBaseModerationFields(),
    ...createBaseVisibilityFields(),

    // Required user fields
    slug: faker.lorem.slug(3),
    authProvider: 'CLERK',
    displayName: faker.person.fullName(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    birthDate: faker.date.birthdate({ min: 18, max: 80, mode: 'age' }),
    role: 'USER' as RoleEnum,
    permissions: []
});

export const createInvalidUser = () => ({
    slug: '', // Too short
    authProvider: 'INVALID_PROVIDER', // Invalid enum
    displayName: createTooShortString(), // Too short
    firstName: createTooLongString(100), // Too long
    lastName: createTooLongString(100), // Too long
    birthDate: faker.date.future(), // Future date
    role: 'INVALID_ROLE', // Invalid enum
    contact: {
        personalEmail: createInvalidEmail(),
        mobilePhone: 'invalid-phone',
        website: 'not-a-url'
    },
    profile: {
        avatar: 'not-a-url',
        website: 'invalid-url'
    },
    permissions: ['invalid.permission'] // Invalid permission
});

export const createUserWithComplexProfile = () => ({
    ...createValidUser(),

    profile: {
        avatar: faker.image.avatar(),
        bio: faker.lorem.paragraph().slice(0, 300),
        website: faker.internet.url(),
        occupation: faker.person.jobTitle()
    },

    settings: {
        notifications: {
            enabled: true,
            allowEmails: true,
            allowPush: true,
            allowSms: false
        },
        privacy: {
            profileVisibility: 'PUBLIC',
            showEmail: false,
            showPhone: false,
            allowMessages: true,
            showBookings: false,
            showReviews: true
        },
        preferences: {
            language: 'en',
            timezone: 'America/New_York',
            currency: 'USD',
            theme: 'AUTO',
            dateFormat: 'MM/DD/YYYY',
            measurementUnit: 'IMPERIAL'
        },
        accessibility: {
            highContrast: false,
            largeText: false,
            screenReader: false,
            keyboardNavigation: false
        }
    },

    bookmarks: faker.helpers.multiple(
        () => ({
            ...createBaseIdFields(),
            ...createBaseAuditFields(),
            ...createBaseLifecycleFields(),
            ...createBaseAdminFields(),
            userId: faker.string.uuid(),
            entityType: faker.helpers.arrayElement([
                'ACCOMMODATION',
                'DESTINATION',
                'POST',
                'EVENT'
            ]),
            entityId: faker.string.uuid(),
            name: faker.helpers.maybe(() => faker.lorem.words(3), { probability: 0.6 }),
            description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 })
        }),
        { count: { min: 5, max: 20 } }
    )
});

export const createAdminUser = () => ({
    ...createValidUser(),
    role: 'ADMIN' as RoleEnum,
    permissions: [
        'user.read.all',
        'user.create',
        'user.update.roles',
        'user.delete',
        'accommodation.view.private',
        'accommodation.create',
        'accommodation.update.any',
        'accommodation.delete.any',
        'post.view.private',
        'post.create',
        'post.update',
        'post.delete',
        'destination.view.private',
        'destination.create',
        'destination.update'
    ]
});

export const createSuperAdminUser = () => ({
    ...createValidUser(),
    role: 'SUPER_ADMIN' as RoleEnum,
    permissions: [
        'user.read.all',
        'user.create',
        'user.update.roles',
        'user.delete',
        'user.hardDelete',
        'accommodation.view.private',
        'accommodation.create',
        'accommodation.update.any',
        'accommodation.delete.any',
        'accommodation.hardDelete',
        'post.view.private',
        'post.create',
        'post.update',
        'post.delete',
        'post.hardDelete',
        'destination.view.private',
        'destination.create',
        'destination.update',
        'destination.delete',
        'access.panelAdmin',
        'system.maintenanceMode'
    ]
});

export const createUserEdgeCases = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createBaseLifecycleFields(),
    ...createBaseModerationFields(),
    ...createBaseVisibilityFields(),
    slug: 'edge-case-user',
    displayName: 'AB', // Minimum length (2 chars)
    firstName: 'A'.repeat(50), // Maximum length (50 chars)
    lastName: 'A'.repeat(50), // Maximum length (50 chars)
    birthDate: new Date('1900-01-01'), // Very old
    role: 'USER' as RoleEnum,
    permissions: [],
    contact: {
        personalEmail: 'a@b.co', // Minimum valid email
        mobilePhone: '+15550123'
    },
    profile: {
        bio: 'This is a minimum length bio for testing edge cases.', // Minimum valid bio
        interests: [], // Empty array
        languages: ['en'] // Single language
    },
    settings: {
        notifications: {
            enabled: false,
            allowEmails: false,
            allowPush: false,
            allowSms: false
        },
        privacy: {
            profileVisibility: 'PRIVATE',
            showEmail: false,
            showPhone: false,
            allowMessages: false
        },
        preferences: {
            language: 'en',
            timezone: 'UTC',
            currency: 'USD',
            theme: 'LIGHT'
        }
    },
    bookmarks: [] // Empty bookmarks
});
