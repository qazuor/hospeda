/**
 * OpenAPI multipart/form-data overrides for media upload routes.
 *
 * Why this exists (SPEC-078-GAPS T-034 / GAP-078-072):
 * The route factory registers request bodies through `@hono/zod-openapi`'s
 * `createRoute` which auto-installs a JSON body validator. Declaring a
 * `multipart/form-data` body that way would make every real multipart
 * upload fail with HTTP 400 from the global default hook because the
 * validator cannot parse multipart payloads as JSON.
 *
 * Workaround: we keep the route definitions free of any body schema (the
 * handlers own multipart parsing) and patch the generated OpenAPI document
 * here, after the fact, so clients and the docs UI still see the actual
 * upload contract.
 *
 * Coverage:
 *   - POST /api/v1/admin/media/upload    (entity image upload)
 *   - POST /api/v1/protected/media/upload (avatar upload)
 *
 * @module utils/openapi-multipart-overrides
 */

/**
 * Multipart schema for the admin entity upload endpoint. Mirrors the
 * runtime contract enforced by `AdminUploadRequestSchema` in
 * `@repo/schemas` plus the explicit file-presence / size checks in the
 * handler. Keep these fields in sync with `apps/api/src/routes/media/admin/upload.ts`.
 */
const adminUploadMultipartSchema = {
    type: 'object',
    required: ['file', 'entityType', 'entityId', 'role'],
    properties: {
        file: {
            type: 'string',
            format: 'binary',
            description: 'Image binary (JPEG, PNG, WebP). Required.'
        },
        entityType: {
            type: 'string',
            enum: ['accommodation', 'destination', 'event', 'post'],
            description: 'Target entity type. Required.'
        },
        entityId: {
            type: 'string',
            format: 'uuid',
            description: 'Target entity UUID. Required.'
        },
        role: {
            type: 'string',
            enum: ['featured', 'gallery'],
            description: 'Image role on the entity. Required.'
        },
        tags: {
            type: 'string',
            description: 'Comma-separated list of Cloudinary tags. Optional.'
        },
        overwrite: {
            type: 'string',
            enum: ['true', 'false'],
            description: 'When "true", overwrite an existing asset at the resolved publicId.'
        }
    }
} as const;

/**
 * Multipart schema for the protected avatar upload endpoint. Mirrors the
 * handler-side validation in `apps/api/src/routes/media/protected/upload.ts`.
 */
const avatarUploadMultipartSchema = {
    type: 'object',
    required: ['file'],
    properties: {
        file: {
            type: 'string',
            format: 'binary',
            description: 'Avatar image binary (JPEG, PNG, or WebP, max 5MB). Required.'
        }
    }
} as const;

/**
 * Map of OpenAPI route key (path + method) to the multipart schema that
 * should be injected. Adding a new multipart endpoint is a one-line
 * change here — no factory or middleware changes needed.
 */
const MULTIPART_OVERRIDES: ReadonlyArray<{
    path: string;
    method: 'post' | 'put' | 'patch';
    schema: object;
}> = [
    {
        path: '/api/v1/admin/media/upload',
        method: 'post',
        schema: adminUploadMultipartSchema
    },
    {
        path: '/api/v1/protected/media/upload',
        method: 'post',
        schema: avatarUploadMultipartSchema
    }
];

interface OpenApiOperation {
    requestBody?: {
        required?: boolean;
        content?: Record<string, { schema?: unknown }>;
    };
    [key: string]: unknown;
}

interface OpenApiPathItem {
    [method: string]: OpenApiOperation | unknown;
}

interface OpenApiDocument {
    paths?: Record<string, OpenApiPathItem>;
    [key: string]: unknown;
}

/**
 * Applies multipart/form-data request body overrides to a generated
 * OpenAPI document. Mutates and returns the same document object for
 * convenience — the input is not deep-cloned to keep the post-processing
 * cost negligible on hot paths (`/docs/openapi.json` is hit by the docs
 * UI on every load).
 *
 * Routes that are not present in the document (e.g. when the API runs
 * with media routes disabled) are silently skipped so this helper stays
 * safe to call unconditionally.
 *
 * @param document Generated OpenAPI document from `app.getOpenAPIDocument()`
 * @returns The same document with multipart bodies injected on covered routes
 */
export const applyMediaMultipartOpenApiOverrides = (
    document: Record<string, unknown>
): Record<string, unknown> => {
    const doc = document as OpenApiDocument;
    if (!doc.paths) {
        return document;
    }

    for (const override of MULTIPART_OVERRIDES) {
        const pathItem = doc.paths[override.path];
        if (!pathItem) continue;
        const operation = pathItem[override.method] as OpenApiOperation | undefined;
        if (!operation) continue;

        operation.requestBody = {
            required: true,
            content: {
                'multipart/form-data': {
                    schema: override.schema
                }
            }
        };
    }

    return document;
};
