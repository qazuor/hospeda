import type { EntityConfig } from '@/components/entity-form/types/entity-config.types';
import { AccommodationCoreSchema } from '@repo/schemas';
import { PermissionEnum } from '@repo/types';
import { basicInfoSectionConfig, createBasicInfoSectionConfig } from './sections/basic-info.config';
import {
    contactInfoSectionConfig,
    createContactInfoSectionConfig
} from './sections/contact-info.config';
import { createLocationSectionConfig, locationSectionConfig } from './sections/location.config';
import { createStatesSectionConfig, statesSectionConfig } from './sections/states.config';

/**
 * Complete accommodation entity configuration
 *
 * This configuration defines the complete structure for accommodation
 * view and edit pages, including all sections, permissions, and validation.
 *
 * Currently includes basic sections:
 * - Basic Info: Core identification and properties
 * - Contact Info: Communication details
 * - Location: Address and geographic information
 * - States: Administrative and moderation fields
 *
 * Future sections (Phase 8+):
 * - Services: Features and amenities
 * - Price & Schedule: Pricing and availability
 * - Media: Images and galleries
 * - FAQs: Frequently asked questions
 * - Admin Info: Internal administrative data
 */

/**
 * Creates the complete accommodation entity configuration with hook support
 * Use this when you need dynamic enum options and search functions
 */
export const createAccommodationEntityConfig = (): EntityConfig => {
    return {
        id: 'accommodation',
        entityType: 'accommodation',
        entityName: 'accommodation.entity.name',
        entityNamePlural: 'accommodation.entity.namePlural',
        title: 'accommodation.entity.title',
        description: 'accommodation.entity.description',

        // Entity-level permissions
        permissions: {
            view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
            edit: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
            create: [PermissionEnum.ACCOMMODATION_CREATE],
            delete: [PermissionEnum.ACCOMMODATION_DELETE_ANY]
        },

        // Main validation schema
        validation: {
            // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
            entitySchema: AccommodationCoreSchema as any
        },

        // Route configuration
        routes: {
            base: '/accommodations',
            view: '/accommodations/$id',
            edit: '/accommodations/$id/edit',
            create: '/accommodations/new',
            sections: {
                'basic-info': '/accommodations/$id/basic-info',
                'contact-info': '/accommodations/$id/contact-info',
                location: '/accommodations/$id/location',
                states: '/accommodations/$id/states'
            },
            editSections: {
                'basic-info': '/accommodations/$id/edit/basic-info',
                'contact-info': '/accommodations/$id/edit/contact-info',
                location: '/accommodations/$id/edit/location',
                states: '/accommodations/$id/edit/states'
            }
        },

        // Combined sections array (all sections in display order)
        sections: [
            createBasicInfoSectionConfig(),
            createContactInfoSectionConfig(),
            createLocationSectionConfig(),
            createStatesSectionConfig()
        ],

        // Mode-specific section configurations (for backward compatibility)
        viewSections: [
            createBasicInfoSectionConfig(),
            createContactInfoSectionConfig(),
            createLocationSectionConfig(),
            createStatesSectionConfig()
        ],

        editSections: [
            createBasicInfoSectionConfig(),
            createContactInfoSectionConfig(),
            createLocationSectionConfig(),
            createStatesSectionConfig()
        ]
    };
};

/**
 * Static accommodation entity configuration
 * Use this for immediate access without hook dependencies
 *
 * Note: This version has limited functionality for enum options and search functions
 * as it cannot use React hooks. Use createAccommodationEntityConfig() when possible.
 */
export const accommodationEntityConfig: Omit<
    EntityConfig,
    'sections' | 'viewSections' | 'editSections'
> & {
    sections: (typeof basicInfoSectionConfig)[];
    viewSections: (typeof basicInfoSectionConfig)[];
    editSections: (typeof basicInfoSectionConfig)[];
} = {
    id: 'accommodation',
    entityType: 'accommodation',
    entityName: 'accommodation.entity.name',
    entityNamePlural: 'accommodation.entity.namePlural',
    title: 'accommodation.entity.title',
    description: 'accommodation.entity.description',

    // Entity-level permissions
    permissions: {
        view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
        edit: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
        create: [PermissionEnum.ACCOMMODATION_CREATE],
        delete: [PermissionEnum.ACCOMMODATION_DELETE_ANY]
    },

    // Main validation schema
    validation: {
        // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
        entitySchema: AccommodationCoreSchema as any
    },

    // Route configuration
    routes: {
        base: '/accommodations',
        view: '/accommodations/$id',
        edit: '/accommodations/$id/edit',
        create: '/accommodations/new',
        sections: {
            'basic-info': '/accommodations/$id/basic-info',
            'contact-info': '/accommodations/$id/contact-info',
            location: '/accommodations/$id/location',
            states: '/accommodations/$id/states'
        },
        editSections: {
            'basic-info': '/accommodations/$id/edit/basic-info',
            'contact-info': '/accommodations/$id/edit/contact-info',
            location: '/accommodations/$id/edit/location',
            states: '/accommodations/$id/edit/states'
        }
    },

    // Combined sections array (all sections in display order)
    sections: [
        basicInfoSectionConfig,
        contactInfoSectionConfig,
        locationSectionConfig,
        statesSectionConfig
    ],

    // Mode-specific section configurations (for backward compatibility)
    viewSections: [
        basicInfoSectionConfig,
        contactInfoSectionConfig,
        locationSectionConfig,
        statesSectionConfig
    ],

    editSections: [
        basicInfoSectionConfig,
        contactInfoSectionConfig,
        locationSectionConfig,
        statesSectionConfig
    ]
};

/**
 * Accommodation section configurations by ID
 * Useful for accessing individual sections
 */
export const accommodationSections = {
    'basic-info': basicInfoSectionConfig,
    'contact-info': contactInfoSectionConfig,
    location: locationSectionConfig,
    states: statesSectionConfig
} as const;

/**
 * Accommodation section IDs
 * Useful for type-safe section references
 */
export type AccommodationSectionId = keyof typeof accommodationSections;

/**
 * Get accommodation section configuration by ID
 */
export const getAccommodationSection = (sectionId: AccommodationSectionId) => {
    return accommodationSections[sectionId];
};

/**
 * Get all accommodation section IDs in display order
 */
export const getAccommodationSectionIds = (): AccommodationSectionId[] => {
    return ['basic-info', 'contact-info', 'location', 'states'];
};

/**
 * Check if a section ID is valid for accommodation
 */
export const isValidAccommodationSection = (
    sectionId: string
): sectionId is AccommodationSectionId => {
    return sectionId in accommodationSections;
};
