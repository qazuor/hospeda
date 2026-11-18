/**
 * Response shapes: which fields a response has and of which type, so a renamed
 * or retyped field is noticed without asserting on any value (HOS-1512).
 *
 * @module battery/shape
 */
import type { JsonValue, ShapeMap } from './types';

const ROOT = '$';

function typeOf(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value === 'object' ? 'object' : typeof value;
}

function join(args: { readonly parent: string; readonly key: string }): string {
    return args.parent === ROOT ? args.key : `${args.parent}.${args.key}`;
}

function walk(args: {
    readonly value: unknown;
    readonly path: string;
    readonly seen: Map<string, Set<string>>;
}): void {
    const { value, path, seen } = args;
    const types = seen.get(path) ?? new Set<string>();
    types.add(typeOf(value));
    seen.set(path, types);
    if (Array.isArray(value)) {
        for (const item of value) walk({ value: item, path: `${path}[]`, seen });
    } else if (value !== null && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            walk({ value: child, path: join({ parent: path, key }), seen });
        }
    }
}

/**
 * Flattens a response body into `path -> types`. Array elements share one path
 * (`items[]`) and merge their types, so the shape does not depend on how many
 * elements a response happens to carry.
 *
 * @param args.body - The parsed body; `undefined` (not JSON) yields `{ $: 'non-json' }`
 * @returns The shape
 */
export function shapeOf(args: { readonly body: unknown }): ShapeMap {
    if (args.body === undefined) return { [ROOT]: 'non-json' };
    const seen = new Map<string, Set<string>>();
    walk({ value: args.body, path: ROOT, seen });
    const shape: Record<string, string> = {};
    for (const path of [...seen.keys()].sort()) {
        shape[path] = [...(seen.get(path) ?? [])].sort().join('|');
    }
    return shape;
}

/** Types of one path without `null`, which the provider sends for absent fields. */
function concreteTypes(types: string): readonly string[] {
    return types.split('|').filter((type) => type !== 'null');
}

const CONTAINER_TYPES = ['object', 'array'] as const;

function isContainer(types: string): boolean {
    return concreteTypes(types).some((type) =>
        (CONTAINER_TYPES as readonly string[]).includes(type)
    );
}

function isOnlyNull(types: string): boolean {
    return concreteTypes(types).length === 0;
}

function isChildOf(args: { readonly path: string; readonly parent: string }): boolean {
    return args.path.startsWith(`${args.parent}.`) || args.path.startsWith(`${args.parent}[]`);
}

/**
 * Compares two shapes of the same response.
 *
 * A field that only goes between `null` and a scalar type is NOT a change: the provider sends
 * `null` for absent fields. A field that goes between `null` and an object or an array IS one,
 * reported as ONE line for the field; its children are not listed as added or removed one by one.
 * Everything else is a change too: a path that disappeared, a path that appeared (a rename shows
 * as both) or a retyped path.
 *
 * @param args.previous - The shape of the previous run
 * @param args.current - The shape of this run
 * @returns One line per difference; empty when the shapes agree
 */
export function diffShapes(args: {
    readonly previous: ShapeMap;
    readonly current: ShapeMap;
}): readonly string[] {
    const { previous, current } = args;
    const lines: string[] = [];
    const expanded: string[] = [];
    const collapsed: string[] = [];
    for (const path of Object.keys(previous).sort()) {
        const before = previous[path];
        const after = current[path];
        if (before === undefined) continue;
        if (collapsed.some((parent) => isChildOf({ path, parent }))) continue;
        if (after === undefined) {
            lines.push(`removed: ${path} (${before})`);
            continue;
        }
        if (isContainer(before) && isOnlyNull(after)) {
            lines.push(`collapsed: ${path} (${before} -> ${after})`);
            collapsed.push(path);
            continue;
        }
        if (isOnlyNull(before) && isContainer(after)) {
            lines.push(`expanded: ${path} (${before} -> ${after})`);
            expanded.push(path);
            continue;
        }
        const beforeTypes = concreteTypes(before);
        const afterTypes = concreteTypes(after);
        if (beforeTypes.length === 0 || afterTypes.length === 0) continue;
        if (beforeTypes.join('|') !== afterTypes.join('|')) {
            lines.push(`retyped: ${path} (${before} -> ${after})`);
        }
    }
    for (const path of Object.keys(current).sort()) {
        const after = current[path];
        if (expanded.some((parent) => isChildOf({ path, parent }))) continue;
        if (previous[path] === undefined && after !== undefined) {
            lines.push(`added: ${path} (${after})`);
        }
    }
    return lines;
}

/** One request label whose shape differs between the accepted baseline and an observation. */
export interface MeasurementShapeDifference {
    readonly label: string;
    /** What changed, without the label. */
    readonly details: readonly string[];
    /** The same lines as the admin review shows them: field changes carry the label as a prefix. */
    readonly formatted: readonly string[];
}

/**
 * Compares ALL the shapes of one measurement with its accepted baseline: a label that changed, a
 * label that is NEW (a request the measurement did not send before) and a label that is GONE.
 * The engine alerts with it and the admin review lists with it, so both always agree.
 *
 * @param args.accepted - The accepted shapes, by request label
 * @param args.observed - The shapes this run observed, by request label
 * @returns One entry per label that differs; empty when they agree
 */
export function diffMeasurementShapes(args: {
    readonly accepted: Readonly<Record<string, ShapeMap>>;
    readonly observed: Readonly<Record<string, ShapeMap>>;
}): readonly MeasurementShapeDifference[] {
    const out: MeasurementShapeDifference[] = [];
    for (const [label, observed] of Object.entries(args.observed)) {
        const accepted = args.accepted[label];
        if (accepted === undefined) {
            const line = `new request: ${label}`;
            out.push({ label, details: [line], formatted: [line] });
            continue;
        }
        const details = diffShapes({ previous: accepted, current: observed });
        if (details.length > 0) {
            out.push({ label, details, formatted: details.map((line) => `${label}: ${line}`) });
        }
    }
    for (const label of Object.keys(args.accepted)) {
        if (args.observed[label] === undefined) {
            const line = `request no longer observed: ${label}`;
            out.push({ label, details: [line], formatted: [line] });
        }
    }
    return out;
}

/**
 * Structural equality of two JSON values, independent of key order.
 *
 * @param args.left - One value
 * @param args.right - The other value
 * @returns Whether they are equal
 */
export function jsonEqual(args: { readonly left: JsonValue; readonly right: JsonValue }): boolean {
    const { left, right } = args;
    if (left === right) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length)
            return false;
        return left.every((item, index) =>
            jsonEqual({ left: item, right: right[index] as JsonValue })
        );
    }
    if (left === null || right === null) return false;
    if (typeof left !== 'object' || typeof right !== 'object') return false;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    if (leftKeys.join('\u0000') !== rightKeys.join('\u0000')) return false;
    return leftKeys.every((key) =>
        jsonEqual({
            left: (left as Record<string, JsonValue>)[key] as JsonValue,
            right: (right as Record<string, JsonValue>)[key] as JsonValue
        })
    );
}
