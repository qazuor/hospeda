/**
 * The JSON Schema the AI SDK sends for a Zod output schema (HOS-2217).
 *
 * Production passes a Zod schema to `generateObject` through `zodSchema()`
 * (see `src/providers/vercel-openai.adapter.ts`). The SDK's conversion is not
 * plain `z.toJSONSchema` (it uses input semantics and adds
 * `additionalProperties: false`), so it must not be re-implemented: this module
 * calls the SDK itself.
 *
 * It lives in ai-core because `ai` is an ai-core dependency. The apps/api
 * generator (`apps/api/scripts/ai-sweep/render-sweep-tasks.ts`) imports it by
 * relative path to serialize the output schemas that live in apps/api, and its
 * parity test re-runs it against the live schemas.
 *
 * @module ai-core/scripts/ai-sweep/sdk-json-schema
 */

import { zodSchema } from 'ai';

/** A JSON Schema document as plain data. */
export type JsonSchemaDocument = Readonly<Record<string, unknown>>;

/**
 * Converts a Zod schema to the JSON Schema the AI SDK sends to the provider.
 *
 * @param input.schema - A Zod schema (typed `unknown`: apps/api and ai-core may
 *   resolve different Zod patch versions, the same boundary the adapters cast).
 * @returns `{ jsonSchema }`, a deep copy safe to serialize.
 */
export function toSdkJsonSchema(input: { readonly schema: unknown }): {
    readonly jsonSchema: JsonSchemaDocument;
} {
    const converted = zodSchema(input.schema as Parameters<typeof zodSchema>[0]).jsonSchema;
    return { jsonSchema: JSON.parse(JSON.stringify(converted)) as JsonSchemaDocument };
}
