/**
 * A small JSON Schema validator for the sweep's structured-output checks
 * (HOS-2217). Pure: no I/O.
 *
 * It validates a model's object against the JSON Schema the provider was
 * constrained with (the AI SDK's own conversion of the production Zod schema,
 * see `sdk-json-schema.ts`). It covers only the keywords those schemas use and
 * THROWS on any other keyword, so a production schema that grows a new keyword
 * fails the guard test instead of being silently half-checked.
 *
 * `format` is not checked (the SDK emits a `pattern` next to it for uuids);
 * `default`, `description` and `$schema` are annotations.
 *
 * @module ai-core/scripts/ai-sweep/json-schema-check
 */

import type { JsonSchemaDocument } from './sdk-json-schema.js';

/** Keywords this validator understands. Anything else throws. */
export const SUPPORTED_KEYWORDS: ReadonlySet<string> = new Set([
    '$schema',
    'type',
    'properties',
    'required',
    'additionalProperties',
    'items',
    'enum',
    'const',
    'anyOf',
    'minimum',
    'maximum',
    'minLength',
    'maxLength',
    'minItems',
    'maxItems',
    'pattern',
    'format',
    'default',
    'description'
]);

type Node = Readonly<Record<string, unknown>>;

const isRecord = (v: unknown): v is Node =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

const typeOf = (v: unknown): string => {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
    return typeof v;
};

const typeMatches = (expected: string, value: unknown): boolean => {
    const actual = typeOf(value);
    return expected === actual || (expected === 'number' && actual === 'integer');
};

/**
 * Lists the keywords used anywhere in a schema that this validator does not
 * support (property NAMES are not keywords and are skipped).
 *
 * @param input.schema - The JSON Schema document.
 * @returns `{ unsupported }`, sorted and de-duplicated.
 */
export function findUnsupportedKeywords(input: { readonly schema: JsonSchemaDocument }): {
    readonly unsupported: readonly string[];
} {
    const found = new Set<string>();
    const walk = (node: unknown): void => {
        if (!isRecord(node)) return;
        for (const [key, value] of Object.entries(node)) {
            if (!SUPPORTED_KEYWORDS.has(key)) found.add(key);
            if (key === 'properties' && isRecord(value)) {
                for (const child of Object.values(value)) walk(child);
            } else if (key === 'items' || key === 'additionalProperties') {
                walk(value);
            } else if (key === 'anyOf' && Array.isArray(value)) {
                for (const child of value) walk(child);
            }
        }
    };
    walk(input.schema);
    return { unsupported: [...found].sort() };
}

/** Options that relax the check to mirror a looser downstream parser. */
export interface ValidateOptions {
    /**
     * Ignore `additionalProperties: false`. A non-strict Zod object (the
     * default) strips unknown keys instead of failing, so this mirrors what a
     * production `safeParse` accepts.
     */
    readonly ignoreAdditionalProperties?: boolean;
}

/**
 * Validates a value against a JSON Schema.
 *
 * @param input.schema - The JSON Schema document.
 * @param input.value - The value to check.
 * @param input.options - {@link ValidateOptions}.
 * @returns `{ valid, errors }`; each error is `<path>: <reason>`.
 * @throws When the schema uses a keyword outside {@link SUPPORTED_KEYWORDS}.
 */
export function validateJsonSchema(input: {
    readonly schema: JsonSchemaDocument;
    readonly value: unknown;
    readonly options?: ValidateOptions;
}): { readonly valid: boolean; readonly errors: readonly string[] } {
    const { unsupported } = findUnsupportedKeywords({ schema: input.schema });
    if (unsupported.length > 0) {
        throw new Error(`Unsupported JSON Schema keyword(s): ${unsupported.join(', ')}`);
    }
    const errors: string[] = [];
    const ignoreExtra = input.options?.ignoreAdditionalProperties === true;

    const check = (node: Node, value: unknown, path: string): void => {
        if (Array.isArray(node.anyOf)) {
            const ok = node.anyOf.some((option) => {
                const before = errors.length;
                if (isRecord(option)) check(option, value, path);
                const passed = errors.length === before;
                errors.length = before;
                return passed;
            });
            if (!ok) errors.push(`${path}: matches no anyOf option`);
            return;
        }
        if (node.type !== undefined) {
            const types = Array.isArray(node.type) ? node.type : [node.type];
            if (!types.some((t) => typeof t === 'string' && typeMatches(t, value))) {
                errors.push(`${path}: expected ${types.join('|')}, got ${typeOf(value)}`);
                return;
            }
        }
        if (Array.isArray(node.enum) && !node.enum.some((e) => e === value)) {
            errors.push(`${path}: ${JSON.stringify(value)} not in enum`);
        }
        if ('const' in node && node.const !== value) errors.push(`${path}: not the const value`);
        if (typeof value === 'number') {
            if (typeof node.minimum === 'number' && value < node.minimum)
                errors.push(`${path}: below minimum ${node.minimum}`);
            if (typeof node.maximum === 'number' && value > node.maximum)
                errors.push(`${path}: above maximum ${node.maximum}`);
        }
        if (typeof value === 'string') {
            if (typeof node.minLength === 'number' && value.length < node.minLength)
                errors.push(`${path}: shorter than ${node.minLength}`);
            if (typeof node.maxLength === 'number' && value.length > node.maxLength)
                errors.push(`${path}: longer than ${node.maxLength}`);
            if (typeof node.pattern === 'string' && !new RegExp(node.pattern, 'u').test(value))
                errors.push(`${path}: does not match pattern`);
        }
        if (Array.isArray(value)) {
            if (typeof node.minItems === 'number' && value.length < node.minItems)
                errors.push(`${path}: fewer than ${node.minItems} items`);
            if (typeof node.maxItems === 'number' && value.length > node.maxItems)
                errors.push(`${path}: more than ${node.maxItems} items`);
            if (isRecord(node.items)) {
                const items = node.items;
                for (const [i, item] of value.entries()) check(items, item, `${path}[${i}]`);
            }
        }
        if (isRecord(value)) {
            const props = isRecord(node.properties) ? node.properties : {};
            const required = Array.isArray(node.required) ? node.required : [];
            for (const key of required) {
                if (typeof key === 'string' && !(key in value))
                    errors.push(`${path}.${key}: required`);
            }
            for (const [key, child] of Object.entries(value)) {
                const sub = props[key];
                if (isRecord(sub)) check(sub, child, `${path}.${key}`);
                else if (node.additionalProperties === false && !ignoreExtra)
                    errors.push(`${path}.${key}: additional property`);
            }
        }
    };

    check(input.schema, input.value, '$');
    return { valid: errors.length === 0, errors };
}
