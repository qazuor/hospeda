import { AccommodationSchema } from '@repo/schemas';

// Schema for creating an accommodation (creation input)
export const NewAccommodationInputSchema = AccommodationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
});

// Schema for updating an accommodation (update input)
export const UpdateAccommodationInputSchema = NewAccommodationInputSchema.partial();
