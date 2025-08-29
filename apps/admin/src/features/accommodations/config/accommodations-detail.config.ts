import type {
    EntityDetailConfig,
    FieldConfig,
    SectionConfig
} from '@/components/entity-detail/types';
import { FieldType, LayoutType } from '@/components/entity-detail/types';
import { AccommodationTypeEnum, LifecycleStatusEnum, VisibilityEnum } from '@repo/types';
import {
    type AccommodationDetail,
    AccommodationDetailSchema,
    type AccommodationEdit,
    AccommodationEditSchema
} from '../schemas/accommodations-detail.schemas';

/**
 * Form sections configuration
 */
const sections: readonly SectionConfig[] = [
    {
        id: 'basic',
        title: 'Basic Information',
        description: 'Essential details about the accommodation',
        order: 1
    },
    {
        id: 'ownership',
        title: 'Ownership & Location',
        description: 'Owner and destination information',
        order: 2
    },
    {
        id: 'capacity',
        title: 'Capacity',
        description: 'Room and guest capacity information',
        order: 3
    },
    {
        id: 'settings',
        title: 'Status & Settings',
        description: 'Visibility, lifecycle and feature settings',
        order: 4
    }
] as const;

/**
 * Form fields configuration
 */
const fields: readonly FieldConfig[] = [
    // Basic Information Section
    {
        name: 'name',
        label: 'Name',
        type: FieldType.TEXT,
        required: true,
        section: 'basic',
        order: 1,
        placeholder: 'Enter accommodation name',
        colSpan: 2
    },
    {
        name: 'summary',
        label: 'Summary',
        type: FieldType.TEXTAREA,
        required: true,
        section: 'basic',
        order: 2,
        placeholder: 'Brief summary of the accommodation',
        colSpan: 2,
        description: 'A short description that appears in search results'
    },
    {
        name: 'description',
        label: 'Description',
        type: FieldType.TEXTAREA,
        required: true,
        section: 'basic',
        order: 3,
        placeholder: 'Detailed description of the accommodation',
        colSpan: 2,
        description: 'Full description with amenities, location details, etc.'
    },
    {
        name: 'type',
        label: 'Type',
        type: FieldType.SELECT,
        required: true,
        section: 'basic',
        order: 4,
        options: Object.values(AccommodationTypeEnum).map((value) => ({
            value,
            label: value
                .replace('_', ' ')
                .toLowerCase()
                .replace(/\b\w/g, (l) => l.toUpperCase())
        }))
    },

    // Ownership & Location Section
    {
        name: 'destinationId',
        label: 'Destination',
        type: FieldType.RELATION,
        required: true,
        section: 'ownership',
        order: 1,
        relationConfig: {
            endpoint: '/api/v1/public/destinations',
            displayField: 'name',
            valueField: 'id',
            searchable: true
        }
    },
    {
        name: 'ownerId',
        label: 'Owner',
        type: FieldType.RELATION,
        required: true,
        section: 'ownership',
        order: 2,
        relationConfig: {
            endpoint: '/api/v1/public/users',
            displayField: 'displayName',
            valueField: 'id',
            searchable: true
        },
        description: 'The user who owns this accommodation'
    },

    // Capacity Section
    {
        name: 'extraInfo.capacity',
        label: 'Maximum Guests',
        type: FieldType.NUMBER,
        section: 'capacity',
        order: 1,
        placeholder: '2',
        description: 'Maximum number of guests allowed'
    },
    {
        name: 'extraInfo.bedrooms',
        label: 'Bedrooms',
        type: FieldType.NUMBER,
        section: 'capacity',
        order: 2,
        placeholder: '1',
        description: 'Number of bedrooms'
    },
    {
        name: 'extraInfo.beds',
        label: 'Beds',
        type: FieldType.NUMBER,
        section: 'capacity',
        order: 3,
        placeholder: '1',
        description: 'Total number of beds'
    },
    {
        name: 'extraInfo.bathrooms',
        label: 'Bathrooms',
        type: FieldType.NUMBER,
        section: 'capacity',
        order: 4,
        placeholder: '1',
        description: 'Number of bathrooms'
    },

    // Status & Settings Section
    {
        name: 'isFeatured',
        label: 'Featured',
        type: FieldType.BOOLEAN,
        section: 'settings',
        order: 1,
        description: 'Mark as featured accommodation (appears in highlights)'
    },
    {
        name: 'visibility',
        label: 'Visibility',
        type: FieldType.SELECT,
        section: 'settings',
        order: 2,
        options: Object.values(VisibilityEnum).map((value) => ({
            value,
            label: value.toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())
        })),
        description: 'Who can see this accommodation'
    },
    {
        name: 'lifecycleState',
        label: 'Lifecycle Status',
        type: FieldType.SELECT,
        section: 'settings',
        order: 3,
        options: Object.values(LifecycleStatusEnum).map((value) => ({
            value,
            label: value.toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())
        })),
        description: 'Current lifecycle state of the accommodation'
    }
] as const;

/**
 * Accommodations detail configuration
 */
export const accommodationsDetailConfig: EntityDetailConfig<
    AccommodationDetail,
    AccommodationEdit
> = {
    // Metadata
    name: 'accommodations',
    displayName: 'Accommodation',
    pluralDisplayName: 'Accommodations',

    // API endpoints
    getEndpoint: '/api/v1/public/accommodations/:id',
    updateEndpoint: '/api/v1/public/accommodations/:id',
    deleteEndpoint: '/api/v1/public/accommodations/:id',

    // Routes
    basePath: '/accommodations',
    viewPath: '/accommodations/$id',
    editPath: '/accommodations/$id/edit',

    // Schemas
    detailSchema: AccommodationDetailSchema,
    editSchema: AccommodationEditSchema,

    // Form configuration
    sections,
    fields,

    // Main layout configuration
    layout: {
        type: LayoutType.GRID,
        columns: {
            mobile: 1,
            tablet: 2,
            desktop: 2
        },
        gap: {
            x: 4,
            y: 6
        }
    },

    // Permissions
    permissions: {
        canView: true,
        canEdit: true,
        canDelete: true
    },

    // Layout configuration
    layoutConfig: {
        showBreadcrumbs: true,
        showBackButton: true,
        showEditButton: true,
        showDeleteButton: true
    }
};
