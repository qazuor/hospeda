import { z } from 'zod';

/**
 * Client-side accommodation schema
 *
 * This is a completely independent schema that doesn't rely on any
 * server-side dependencies or Node.js modules. It's designed specifically
 * for browser compatibility and form validation in the admin frontend.
 *
 * Note: This schema is intentionally separate from @repo/schemas to avoid
 * any potential circular dependencies or Node.js module issues.
 */
export const AccommodationClientSchema = z.object({
    // Core fields
    id: z.string().min(1, 'ID is required'),
    slug: z
        .string()
        .min(3, 'Slug must be at least 3 characters')
        .max(50, 'Slug must be at most 50 characters'),
    name: z
        .string()
        .min(3, 'Name must be at least 3 characters')
        .max(100, 'Name must be at most 100 characters'),
    summary: z
        .string()
        .min(10, 'Summary must be at least 10 characters')
        .max(300, 'Summary must be at most 300 characters'),
    description: z
        .string()
        .min(30, 'Description must be at least 30 characters')
        .max(2000, 'Description must be at most 2000 characters'),

    // Accommodation specific
    type: z.string().min(1, 'Accommodation type is required'),
    destinationId: z.string().min(1, 'Destination is required'),
    ownerId: z.string().min(1, 'Owner is required'),
    lifecycleState: z.string().min(1, 'Lifecycle state is required'),
    moderationState: z.string().min(1, 'Moderation state is required'),
    visibility: z.string().min(1, 'Visibility is required'),
    isFeatured: z.boolean().default(false),

    // Contact info
    email: z.string().email('Invalid email format').optional().or(z.literal('')),
    phone: z.string().optional(),
    website: z.string().url('Invalid website URL').optional().or(z.literal('')),
    contactPersonName: z.string().optional(),
    contactPersonEmail: z
        .string()
        .email('Invalid contact email format')
        .optional()
        .or(z.literal('')),
    contactPersonPhone: z.string().optional(),
    whatsapp: z.string().optional(),
    instagram: z.string().optional(),
    facebook: z.string().optional(),

    // Location
    address: z.string().min(1, 'Address is required when provided').optional().or(z.literal('')),
    city: z.string().min(1, 'City is required when provided').optional().or(z.literal('')),
    state: z.string().min(1, 'State is required when provided').optional().or(z.literal('')),
    country: z.string().min(1, 'Country is required when provided').optional().or(z.literal('')),
    postalCode: z.string().optional(),
    latitude: z.number().min(-90).max(90, 'Latitude must be between -90 and 90').optional(),
    longitude: z.number().min(-180).max(180, 'Longitude must be between -180 and 180').optional(),
    locationNotes: z.string().optional(),

    // Additional fields
    shortDescription: z.string().optional(),
    moderationNotes: z.string().optional(),
    assignedUserId: z.string().optional(),
    viewCount: z.number().int().min(0).default(0),
    bookingCount: z.number().int().min(0).default(0),
    internalNotes: z.string().optional(),
    internalTags: z.array(z.string()).optional(),
    priority: z.number().int().min(1).max(5).default(3),

    // Audit fields
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    deletedAt: z.coerce.date(),
    createdById: z.string(),
    updatedById: z.string(),
    deletedById: z.string(),

    // Review fields
    reviewsCount: z.number().int().min(0).default(0),
    averageRating: z.number().min(0).max(5).default(0)
});

/**
 * Schema for editing accommodations - excludes readonly and audit fields
 *
 * This schema is used for form validation in edit mode and only includes
 * fields that users can actually modify.
 */
export const AccommodationEditSchema = AccommodationClientSchema.omit({
    // Audit fields - managed by the system
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,

    // Auto-generated fields
    slug: true, // Generated from name

    // Computed/readonly fields
    reviewsCount: true,
    averageRating: true,
    viewCount: true,
    bookingCount: true
});

/**
 * Schema for viewing accommodations - includes all fields
 *
 * This schema is used for display purposes and includes all fields
 * including readonly, audit, and computed fields.
 */
export const AccommodationViewSchema = AccommodationClientSchema;

/**
 * Type inference for the schemas
 */
export type AccommodationClient = z.infer<typeof AccommodationClientSchema>;
export type AccommodationEdit = z.infer<typeof AccommodationEditSchema>;
export type AccommodationView = z.infer<typeof AccommodationViewSchema>;

/**
 * Alias for compatibility with existing code
 * Use this instead of importing AccommodationCore from @repo/schemas
 */
export type AccommodationCore = AccommodationClient;
