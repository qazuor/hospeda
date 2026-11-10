/**
 * Builds the PATCH body of the generic entity edit form.
 *
 * Extracted from `EntityPageBase.handleSave` so the whole save path (change
 * detection, unflattening and the per-column payload fixes) is testable
 * without mounting the page.
 */

import { pickChangedFields } from '@/components/entity-form/utils/changed-fields.utils';
import { nullifyClearedSocialNetworks } from '@/components/entity-form/utils/social-networks-payload.utils';
import { unflattenValues } from '@/components/entity-form/utils/unflatten-values.utils';

/**
 * Reads a (possibly dot-notation) field value from form values.
 *
 * Mirrors `EntityFormSection.readValue`: for dot-notation ids the nested copy
 * is authoritative (TanStack Form writes there), with the flat literal key
 * seeded by `prepareFormValues` as fallback. Returns `undefined` when neither
 * carries a value.
 *
 * @param source - Form values (live or as seeded).
 * @param id - Field id, dot-notation allowed.
 * @returns The field value, or `undefined`.
 */
export function readFieldValueForSave(source: Record<string, unknown>, id: string): unknown {
    if (!id.includes('.')) return source[id];
    let current: unknown = source;
    for (const part of id.split('.')) {
        if (current === null || current === undefined) {
            current = undefined;
            break;
        }
        current = (current as Record<string, unknown>)[part];
    }
    if (current !== undefined) return current;
    return source[id];
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date);

/**
 * Completes the nested objects of a `policies` patch with their stored keys.
 *
 * The API merges `policies` one top-level key deep (HOS-2060): a key the body
 * omits keeps its stored value, but a key it sends replaces the stored one
 * whole. The admin form edits only some keys of a nested rule (`pets.admission`
 * and `pets.extraCost`, never the owner's `pets.notes`), so sending the bare
 * fragment would erase the keys it does not show. Each nested object is sent
 * as the stored object with the edited keys on top.
 *
 * @param input.patch - The `policies` object about to be sent.
 * @param input.stored - The stored `policies` (as the form was seeded).
 * @returns `{ policies }`, the patch with its nested objects completed.
 */
export function completePoliciesPatch({
    patch,
    stored
}: {
    readonly patch: Readonly<Record<string, unknown>>;
    readonly stored: unknown;
}): { readonly policies: Record<string, unknown> } {
    const policies: Record<string, unknown> = { ...patch };
    if (!isPlainObject(stored)) return { policies };
    for (const [key, value] of Object.entries(patch)) {
        const storedValue = stored[key];
        if (isPlainObject(value) && isPlainObject(storedValue)) {
            policies[key] = { ...storedValue, ...value };
        }
    }
    return { policies };
}

/** Input of {@link buildEntityUpdatePayload}. */
export interface BuildEntityUpdatePayloadInput {
    /** Every editable field id of the form, dot-notation allowed. */
    readonly fieldIds: readonly string[];
    /** The live form values at submit time. */
    readonly values: Record<string, unknown>;
    /** The values the form was seeded with (`prepareFormValues` output). */
    readonly initialValues: Record<string, unknown>;
}

/**
 * Builds the update payload from what the user changed.
 *
 * Only changed fields travel (HOS-1493). Sending every editable field made a
 * support edit on somebody else's listing fail with 403.
 *
 * @param input - See {@link BuildEntityUpdatePayloadInput}.
 * @returns `{ payload }`, or `{ payload: null }` when nothing changed.
 */
export function buildEntityUpdatePayload(input: BuildEntityUpdatePayloadInput): {
    readonly payload: Record<string, unknown> | null;
} {
    const { fieldIds, values, initialValues } = input;

    const { changed } = pickChangedFields({
        fieldIds,
        readCurrent: (id) => readFieldValueForSave(values, id),
        readInitial: (id) => readFieldValueForSave(initialValues, id)
    });

    if (Object.keys(changed).length === 0) return { payload: null };

    // A cleared social network must travel as `null`: the column is merged
    // server-side, so an omitted (or empty-string) key would leave the stored
    // link in place, or fail URL validation (HOS-1262).
    const payload: Record<string, unknown> = {
        ...nullifyClearedSocialNetworks({ payload: unflattenValues(changed) })
    };

    if (isPlainObject(payload.policies)) {
        payload.policies = completePoliciesPatch({
            patch: payload.policies,
            stored: readFieldValueForSave(initialValues, 'policies')
        }).policies;
    }

    return { payload };
}
