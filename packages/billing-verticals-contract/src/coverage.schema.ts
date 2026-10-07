/**
 * `coverage` (`cobertura(user, vertical)`, contract §2): its argument, its
 * response, and the rules a response must satisfy to be delivered.
 *
 * Vocabulary (contract → here): `cubierto` → `covered`; `fuentes` → `sources`;
 * `tipo` → `type` (`TRIAL`, `SUSCRIPCIÓN` → `SUBSCRIPTION`, `CORTESÍA` →
 * `COURTESY`, `GRANT`, `BASE`, `ADDON`); `referencia` → `reference`; `alcance` →
 * `scope`; `objetivo` → `target`; `desde` → `since`; `hasta` → `until`
 * (`fecha` → a `Date`, `NO_VENCE` → `NEVER_EXPIRES`, `SIN_FECHA_CONOCIDA` →
 * `NO_KNOWN_DATE`, `SIN_EMPEZAR` → `NOT_STARTED`); `cobrada` → `charged`;
 * `piso` → `floor`. "nada" (the field does not apply) is `null`.
 */
import { z } from 'zod';
import {
    AddonVersionIdSchema,
    InstantSchema,
    ListingIdSchema,
    PlanVersionIdSchema,
    UserVerticalArgsSchema
} from './primitives.schema';

/** The six source types (contract §2). */
export const CoverageSourceTypeSchema = z.enum([
    'TRIAL',
    'SUBSCRIPTION',
    'COURTESY',
    'GRANT',
    'BASE',
    'ADDON'
]);

/** A source type. */
export type CoverageSourceType = z.infer<typeof CoverageSourceTypeSchema>;

/** The four transport scopes (contract §2.7). */
export const CoverageScopeSchema = z.enum(['VERTICAL', 'LISTING', 'USER', 'GLOBAL']);

/** A transport scope. */
export type CoverageScope = z.infer<typeof CoverageScopeSchema>;

/** `desde`: the instant the source started covering, or `NOT_STARTED` (contract §2). */
export const CoverageSinceSchema = z.union([InstantSchema, z.literal('NOT_STARTED')]);

/** `hasta`: four values, none of them "no date" alone (contract §2.6). */
export const CoverageUntilSchema = z.union([
    InstantSchema,
    z.enum(['NEVER_EXPIRES', 'NO_KNOWN_DATE', 'NOT_STARTED'])
]);

/** The `hasta` value of a source, reduced to its kind: a `Date` is `DATE`. */
type UntilKind = 'DATE' | 'NEVER_EXPIRES' | 'NO_KNOWN_DATE' | 'NOT_STARTED';

/**
 * `referencia`: a pointer to the declaration of what the source grants, never
 * the values, and NOT nullable (contract §2.3).
 */
export const CoverageReferenceSchema = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('PLAN_VERSION'), planVersionId: PlanVersionIdSchema }),
    z.strictObject({ kind: z.literal('ADDON_VERSION'), addonVersionId: AddonVersionIdSchema })
]);

/**
 * The `hasta` kinds each type can carry: the 6 × 4 table of contract §2.4 (a
 * `—` cell is a combination no source is emitted with).
 */
const ALLOWED_UNTIL: Readonly<Record<CoverageSourceType, readonly UntilKind[]>> = {
    TRIAL: ['DATE', 'NOT_STARTED'],
    SUBSCRIPTION: ['DATE', 'NO_KNOWN_DATE'],
    COURTESY: ['DATE'],
    GRANT: ['NEVER_EXPIRES'],
    BASE: ['NEVER_EXPIRES'],
    ADDON: ['DATE', 'NO_KNOWN_DATE']
};

const untilKindOf = ({
    until
}: {
    readonly until: z.infer<typeof CoverageUntilSchema>;
}): UntilKind => (until instanceof Date ? 'DATE' : until);

const CoverageSourceShapeSchema = z.strictObject({
    type: CoverageSourceTypeSchema,
    reference: CoverageReferenceSchema,
    scope: CoverageScopeSchema,
    target: ListingIdSchema.nullable(),
    since: CoverageSinceSchema,
    until: CoverageUntilSchema,
    charged: z.boolean().nullable(),
    floor: PlanVersionIdSchema.nullable()
});

/**
 * One source (`fuente`), with the per-field rules of contract §2 checked: a
 * source that breaks one is not deliverable.
 */
export const CoverageSourceSchema = CoverageSourceShapeSchema.superRefine((source, ctx) => {
    const fail = (message: string, path: string) =>
        ctx.addIssue({ code: 'custom', message, path: [path] });
    const isAddon = source.type === 'ADDON';

    // §2.3: an ADDON points at an addon version; every other type at a plan version.
    if (isAddon !== (source.reference.kind === 'ADDON_VERSION')) {
        fail(
            `a ${source.type} source references a ${isAddon ? 'addon' : 'plan'} version (§2.3)`,
            'reference'
        );
    }
    // §2.7: only an ADDON carries a scope other than VERTICAL.
    if (!isAddon && source.scope !== 'VERTICAL') {
        fail(`a ${source.type} source has scope VERTICAL (§2.7)`, 'scope');
    }
    // §2: `objetivo` is the listing when scope = LISTING, nothing in the other three.
    if ((source.scope === 'LISTING') !== (source.target !== null)) {
        fail('target is set exactly when scope is LISTING (§2)', 'target');
    }
    // §2.1: `cobrada` only on a SUBSCRIPTION.
    if ((source.type === 'SUBSCRIPTION') !== (source.charged !== null)) {
        fail('charged is set exactly on a SUBSCRIPTION source (§2.1)', 'charged');
    }
    // §2.1, §2.8: `piso` only on a GRANT.
    if ((source.type === 'GRANT') !== (source.floor !== null)) {
        fail('floor is set exactly on a GRANT source (§2.1)', 'floor');
    }
    // §2: a source whose clock did not start has since = until = NOT_STARTED.
    if ((source.since === 'NOT_STARTED') !== (source.until === 'NOT_STARTED')) {
        fail('since and until are NOT_STARTED together: the clock did not start (§2)', 'since');
    }
    // §2.4: the type x until table.
    const untilKind = untilKindOf({ until: source.until });
    if (!ALLOWED_UNTIL[source.type].includes(untilKind)) {
        fail(`a ${source.type} source is never emitted with until ${untilKind} (§2.4)`, 'until');
    }
});

/** One source (`fuente`). */
export type CoverageSource = z.infer<typeof CoverageSourceSchema>;

/** The three source classes (contract §2.4). Derived, never transported. */
export type CoverageSourceClass = 'TITLE' | 'BASE' | 'COMPLEMENT';

/**
 * The class of a source, derived from its `type` and its `until` (contract
 * §2.4): an ADDON is a COMPLEMENT; BASE, or any source whose clock did not
 * start, is BASE; the rest are TITLE.
 *
 * @param args.source - The source
 * @returns `{ sourceClass }`
 */
export function coverageSourceClassOf(args: {
    readonly source: Pick<CoverageSource, 'type' | 'until'>;
}): { readonly sourceClass: CoverageSourceClass } {
    const { type, until } = args.source;
    if (type === 'ADDON') return { sourceClass: 'COMPLEMENT' };
    if (type === 'BASE' || until === 'NOT_STARTED') return { sourceClass: 'BASE' };
    return { sourceClass: 'TITLE' };
}

/** The argument of `coverage`: the vertical is mandatory (contract §2). */
export const CoverageArgsSchema = UserVerticalArgsSchema;

/** The argument of `coverage`. */
export type CoverageArgs = z.infer<typeof CoverageArgsSchema>;

/**
 * The response of `coverage`. Besides each source's rules, two rules across
 * the list: `covered` is exactly "at least one source of class TITLE"
 * (contract §2.4), and there are never two SUBSCRIPTION sources of class
 * TITLE (contract §2.6).
 */
export const CoverageResponseSchema = z
    .strictObject({
        covered: z.boolean(),
        sources: z.array(CoverageSourceSchema)
    })
    .superRefine((response, ctx) => {
        const titles = response.sources.filter(
            (source) => coverageSourceClassOf({ source }).sourceClass === 'TITLE'
        );
        if (response.covered !== titles.length > 0) {
            ctx.addIssue({
                code: 'custom',
                path: ['covered'],
                message: `covered is ${response.covered} but the response carries ${titles.length} source(s) of class TITLE (§2.4)`
            });
        }
        if (titles.filter((source) => source.type === 'SUBSCRIPTION').length > 1) {
            ctx.addIssue({
                code: 'custom',
                path: ['sources'],
                message:
                    'two SUBSCRIPTION sources of class TITLE for one (user, vertical) are not possible (§2.6)'
            });
        }
    });

/** The response of `coverage`. */
export type CoverageResponse = z.infer<typeof CoverageResponseSchema>;
