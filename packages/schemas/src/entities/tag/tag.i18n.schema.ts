import { z } from 'zod';

/**
 * Schema describing the expected i18n key shape for the `tags` and `postTags`
 * namespaces in the tag UI (admin panel only, per D-024).
 *
 * This schema is used by i18n validation tooling to assert that all locale
 * files (es/en/pt) contain the same complete set of translation keys. It does
 * NOT hold translation content — tag names and descriptions are never i18n'd
 * (D-015). Only UI chrome strings (labels, placeholders, errors shown to admin
 * panel operators) are covered here.
 *
 * Namespaces covered:
 * - `tags.type`      — display names for each TagTypeEnum value
 * - `tags.lifecycle` — display names for each lifecycle state
 * - `tags.errors`    — user-facing error messages shown in the admin panel
 * - `tags.picker`    — tag picker UI strings
 * - `tags.manager`   — own-tag manager UI strings
 * - `tags.admin`     — admin tag management page strings
 * - `tags.delete`    — delete confirmation dialog strings
 * - `postTags.admin` — PostTag admin CRUD page strings
 *
 * @see SPEC-086 decisions D-015, D-024
 * @see AC-F19
 */
export const TagI18nKeysSchema = z.object({
    tags: z.object({
        /**
         * Display names for each TagTypeEnum value shown in the admin UI.
         */
        type: z.object({
            /** Label for INTERNAL tags (admin/super-admin only). */
            INTERNAL: z.string(),
            /** Label for SYSTEM tags (usable by any authenticated user). */
            SYSTEM: z.string(),
            /** Label for USER tags (private to the tag creator). */
            USER: z.string()
        }),

        /**
         * Display names for each lifecycle state shown in the admin UI.
         */
        lifecycle: z.object({
            /** Label for ACTIVE lifecycle state. */
            ACTIVE: z.string(),
            /** Label for INACTIVE lifecycle state. */
            INACTIVE: z.string(),
            /** Label for ARCHIVED lifecycle state. */
            ARCHIVED: z.string()
        }),

        /**
         * User-facing error messages displayed in the admin panel.
         */
        errors: z.object({
            /** Shown when a USER's tag quota is exceeded. */
            quotaExceeded: z.string(),
            /** Shown when a tag with the same name already exists for the actor. */
            nameConflict: z.string(),
            /** Shown when an INTERNAL tag is not visible to the current actor. */
            internalNotVisible: z.string(),
            /** Shown when the target entity is not accessible to the actor. */
            entityNotAccessible: z.string(),
            /** Generic not-found error for a tag lookup. */
            notFound: z.string()
        }),

        /**
         * Tag picker component UI strings (displayed when applying tags to an entity).
         */
        picker: z.object({
            /** Picker panel/modal title. */
            title: z.string(),
            /** Placeholder text for the search input inside the picker. */
            searchPlaceholder: z.string(),
            /** Message shown when no tags match the current search. */
            empty: z.string(),
            /** Label for the "create new tag" action. */
            createNew: z.string(),
            /** Message shown when the actor has reached their USER tag quota. */
            quotaReached: z.string(),
            /** Group header for SYSTEM tags in the picker list. */
            groupSystem: z.string(),
            /** Group header for INTERNAL tags in the picker list. */
            groupInternal: z.string(),
            /** Group header for USER tags in the picker list. */
            groupUser: z.string()
        }),

        /**
         * Own-tag manager UI strings (allows users to manage their USER tags).
         */
        manager: z.object({
            /** Manager panel title. */
            title: z.string(),
            /** Quota indicator label (e.g. "5 / 50 tags used"). */
            quotaIndicator: z.string(),
            /** Message shown when the user has no USER tags yet. */
            emptyState: z.string(),
            /** Confirmation prompt before deleting a tag. */
            deleteConfirm: z.string()
        }),

        /**
         * Admin tag management page strings (INTERNAL/SYSTEM tag CRUD).
         */
        admin: z.object({
            /** Page title. */
            title: z.string(),
            /** Label for the "create tag" action button. */
            createButton: z.string(),
            /** Label for the type filter dropdown. */
            filterByType: z.string(),
            /** Label for the lifecycle filter dropdown. */
            filterByLifecycle: z.string()
        }),

        /**
         * Delete confirmation dialog strings.
         */
        delete: z.object({
            /** Dialog title. */
            title: z.string(),
            /** Label for the confirm-delete button. */
            confirmButton: z.string(),
            /** Label for the cancel button. */
            cancelButton: z.string(),
            /** Label showing how many entity assignments will be removed on delete. */
            impactCount: z.string()
        })
    }),

    postTags: z.object({
        /**
         * PostTag admin CRUD page strings.
         */
        admin: z.object({
            /** Page title. */
            title: z.string(),
            /** Label for the "create PostTag" action button. */
            createButton: z.string(),
            /** Label for the slug input field. */
            slugLabel: z.string(),
            /** Inline error shown when the slug is already taken. */
            duplicateSlugError: z.string()
        })
    })
});

/**
 * TypeScript type inferred from {@link TagI18nKeysSchema}.
 *
 * Represents the complete set of i18n keys required in every locale file that
 * covers the tag UI namespace. Use this type when building locale objects in
 * tests or tooling to get compile-time guarantees.
 */
export type TagI18nKeys = z.infer<typeof TagI18nKeysSchema>;
