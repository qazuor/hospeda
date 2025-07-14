import { UserBookmarkSchema } from '@repo/schemas/entities/user/user.bookmark.schema';
import { EntityTypeEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Input para listar bookmarks de un usuario
 */
export const ListBookmarksByUserInputSchema = z.object({
    userId: z.string().uuid(),
    pagination: z
        .object({
            page: z.number().int().min(1).default(1),
            pageSize: z.number().int().min(1).max(100).default(20)
        })
        .optional()
});

/**
 * Input para listar bookmarks de una entidad
 */
export const ListBookmarksByEntityInputSchema = z.object({
    entityId: z.string().uuid(),
    entityType: z.nativeEnum(EntityTypeEnum),
    pagination: z
        .object({
            page: z.number().int().min(1).default(1),
            pageSize: z.number().int().min(1).max(100).default(20)
        })
        .optional()
});

/**
 * Input para contar bookmarks de una entidad
 */
export const CountBookmarksForEntityInputSchema = z.object({
    entityId: z.string().uuid(),
    entityType: z.nativeEnum(EntityTypeEnum)
});

/**
 * Input para contar bookmarks de un usuario
 */
export const CountBookmarksForUserInputSchema = z.object({
    userId: z.string().uuid()
});

export type ListBookmarksByUserInput = z.infer<typeof ListBookmarksByUserInputSchema>;
export type ListBookmarksByEntityInput = z.infer<typeof ListBookmarksByEntityInputSchema>;
export type CountBookmarksForEntityInput = z.infer<typeof CountBookmarksForEntityInputSchema>;
export type CountBookmarksForUserInput = z.infer<typeof CountBookmarksForUserInputSchema>;

export type UserBookmarkOutput = z.infer<typeof UserBookmarkSchema>;

/**
 * Schema para crear un bookmark (sin campos server-generated)
 */
export const CreateUserBookmarkSchema = UserBookmarkSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true,
    lifecycleState: true,
    adminInfo: true
}).strict();

/**
 * Schema para actualizar un bookmark (todos opcionales, pero requiere userId+entityId+entityType para identificar)
 */
export const UpdateUserBookmarkSchema = CreateUserBookmarkSchema.partial().extend({
    userId: z.string().uuid(),
    entityId: z.string().uuid(),
    entityType: z.nativeEnum(EntityTypeEnum)
});

export type CreateUserBookmarkInput = z.infer<typeof CreateUserBookmarkSchema>;
export type UpdateUserBookmarkInput = z.infer<typeof UpdateUserBookmarkSchema>;
