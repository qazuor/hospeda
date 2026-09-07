/**
 * Unit tests for the stale-banner guard (HOS-837, guarding HOS-816).
 *
 * These pin the guard's PREDICATE, not the repository's current state: each
 * one feeds a synthetic source string to the matcher and asserts the verdict.
 * The repo-wide run is the CI step; this is what stops the predicate from
 * silently becoming unable to fail — including the two ways it is most likely
 * to: prose about `handleApiError` being read as code, and a rename of the
 * submit handler taking the file out of scope.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    checkAnchorIntact,
    collectSourceFiles,
    discoverAlertBannerIdents,
    findNullableStatePairs,
    HOOK_FILE,
    inspectSource,
    MIN_EXPECTED_BANNER_CONSUMERS,
    MIN_EXPECTED_CONSUMERS,
    REPO_ROOT,
    scanBannerSources,
    scanSources,
    stripComments
} from '../check-form-error-cleared-on-submit.js';

// ---------------------------------------------------------------------------
// Throwaway trees, so the fixtures cannot be confused with the real repo
// ---------------------------------------------------------------------------

const dirs: string[] = [];

afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Writes `files` (repo-relative paths) into a throwaway repo root. */
function makeTree(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'fecs-'));
    dirs.push(root);
    for (const [rel, content] of Object.entries(files)) {
        const full = join(root, rel);
        mkdirSync(join(full, '..'), { recursive: true });
        writeFileSync(full, content, 'utf8');
    }
    return root;
}

/** A minimal, well-formed consumer: clears, then handles. */
function goodForm(handlerName = 'handleSubmit'): string {
    return `
import { useZodForm } from '@/lib/forms/use-zod-form';
export function Form() {
    const { formError, validate, handleApiError, setFormError } = useZodForm({ schema, t });
    async function ${handlerName}(e) {
        e.preventDefault();
        setFormError(null);
        const parsed = validate({});
        if (!parsed.success) return;
        const res = await api.create({});
        if (!res.ok) handleApiError(res.error, 'boom');
    }
    return null;
}
`;
}

// ---------------------------------------------------------------------------
// Comment stripping
// ---------------------------------------------------------------------------

describe('stripComments', () => {
    it('blanks a line comment without moving any other offset', () => {
        const src = 'const a = 1; // handleApiError(x)\nconst b = 2;';
        const out = stripComments(src);
        expect(out).toHaveLength(src.length);
        expect(out).toContain('const a = 1;');
        expect(out).toContain('const b = 2;');
        expect(out).not.toContain('handleApiError');
    });

    it('blanks a block comment while preserving its newlines', () => {
        const src = '/**\n * handleApiError(x) in prose\n */\nconst a = 1;';
        const out = stripComments(src);
        expect(out).toHaveLength(src.length);
        expect(out.split('\n')).toHaveLength(4);
        expect(out).not.toContain('handleApiError');
        expect(out).toContain('const a = 1;');
    });

    it('does not treat a // inside a string or template as a comment', () => {
        const src = `const u = 'https://x.test/a'; handleApiError(e);`;
        expect(stripComments(src)).toContain('handleApiError(e)');
        const tpl = 'const u = `https://x.test/a`;\nsetFormError(null);';
        expect(stripComments(tpl)).toContain('setFormError(null)');
    });

    it('does not let a regex literal containing slashes swallow the rest of the line', () => {
        const src = 'const re = /https:\\/\\//; setFormError(null); handleApiError(e);';
        const out = stripComments(src);
        expect(out).toContain('setFormError(null)');
        expect(out).toContain('handleApiError(e)');
    });

    it('reads a slash after an identifier as division, not a regex', () => {
        const src = 'const half = total / 2; setFormError(null);';
        expect(stripComments(src)).toContain('setFormError(null)');
    });
});

// ---------------------------------------------------------------------------
// Scope selection
// ---------------------------------------------------------------------------

describe('scope selection', () => {
    it('ignores a file that only names useZodForm in prose (field-ids, helpers)', () => {
        const src = `
/** Ids consumed by \`useZodForm\`'s fieldIdPrefix; see handleApiError for errors. */
export const FIELD_IDS = { name: 'name' } as const;
`;
        expect(inspectSource(src).inScope).toBe(false);
    });

    it('ignores a form whose validation is client-side only (no API banner)', () => {
        const src = `
import { useZodForm } from '@/lib/forms/use-zod-form';
export function Row() {
    const { fieldErrors, validate, clearError } = useZodForm({ schema, t });
    return null;
}
`;
        expect(inspectSource(src).inScope).toBe(false);
    });

    it('selects a form that calls useZodForm and names handleApiError', () => {
        expect(inspectSource(goodForm()).inScope).toBe(true);
    });

    it('selects a consumer that reads the result off an object instead of destructuring', () => {
        const src = `
import { useZodForm } from '@/lib/forms/use-zod-form';
export function Form() {
    const form = useZodForm({ schema, t });
    function onSave() {
        form.setFormError(null);
        form.handleApiError(err, 'boom');
    }
    return null;
}
`;
        const verdict = inspectSource(src);
        expect(verdict.inScope).toBe(true);
        expect(verdict.violation).toBeNull();
    });

    it('is not fooled into scope by a comment that spells the call form', () => {
        const src = `
import { useZodForm } from '@/lib/forms/use-zod-form';
export function Row() {
    // Errors are surfaced by the parent, never by handleApiError(err) here.
    const { fieldErrors, validate } = useZodForm({ schema, t });
    return null;
}
`;
        expect(inspectSource(src).inScope).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

describe('clear detection', () => {
    it('accepts a form that clears before handling', () => {
        expect(inspectSource(goodForm()).violation).toBeNull();
    });

    it('rejects a form that never clears', () => {
        const src = goodForm().replace('        setFormError(null);\n', '');
        const verdict = inspectSource(src);
        expect(verdict.inScope).toBe(true);
        expect(verdict.violation).toMatch(/never calls setFormError\(null\)/);
    });

    it('rejects a clear that only runs after the failure branch set a banner', () => {
        const src = `
import { useZodForm } from '@/lib/forms/use-zod-form';
export function Form() {
    const { handleApiError, setFormError } = useZodForm({ schema, t });
    async function handleSubmit() {
        const res = await api.create({});
        if (!res.ok) { handleApiError(res.error, 'boom'); return; }
        setFormError(null);
    }
    return null;
}
`;
        expect(inspectSource(src).violation).toMatch(/only AFTER handleApiError/);
    });

    it('does not accept a clear that lives in a comment', () => {
        const src = goodForm().replace(
            '        setFormError(null);\n',
            '        // TODO: setFormError(null);\n'
        );
        expect(inspectSource(src).violation).toMatch(/never calls setFormError\(null\)/);
    });

    it('does not accept reset() as a clear', () => {
        const src = goodForm().replace('        setFormError(null);\n', '        reset();\n');
        expect(inspectSource(src).violation).toMatch(/never calls setFormError\(null\)/);
    });

    it('tolerates any spacing in the clear call', () => {
        const src = goodForm().replace('setFormError(null);', 'setFormError( null );');
        expect(inspectSource(src).violation).toBeNull();
    });

    // The whole point of anchoring on the hook's API instead of the handler's
    // name: renaming the handler must not take the file out of scope, and must
    // not turn a real violation green.
    it('keeps evaluating a form whose submit handler was renamed', () => {
        for (const name of ['onSave', 'submitSection', 'doTheThing']) {
            expect(inspectSource(goodForm(name)).violation).toBeNull();

            const broken = goodForm(name).replace('        setFormError(null);\n', '');
            const verdict = inspectSource(broken);
            expect(verdict.inScope).toBe(true);
            expect(verdict.violation).toMatch(/never calls setFormError\(null\)/);
        }
    });
});

// ---------------------------------------------------------------------------
// Anchor-rot detection
// ---------------------------------------------------------------------------

describe('checkAnchorIntact', () => {
    const HOOK = `
export interface UseZodFormResult<T> {
    readonly handleApiError: (e: unknown) => void;
    readonly setFormError: (m: string | null) => void;
}
`;

    it('passes when the hook declares both members', () => {
        expect(checkAnchorIntact(makeTree({ [HOOK_FILE]: HOOK }))).toEqual([]);
    });

    it('fails when handleApiError was renamed away', () => {
        const root = makeTree({
            [HOOK_FILE]: HOOK.replace('handleApiError', 'onApiFailure')
        });
        expect(checkAnchorIntact(root).join('\n')).toMatch(/no longer declares "handleApiError"/);
    });

    it('fails when setFormError was renamed away', () => {
        const root = makeTree({ [HOOK_FILE]: HOOK.replace('setFormError', 'setBanner') });
        expect(checkAnchorIntact(root).join('\n')).toMatch(/no longer declares "setFormError"/);
    });

    it('fails when the hook file is gone entirely', () => {
        expect(checkAnchorIntact(makeTree({})).join('\n')).toMatch(/does not exist/);
    });
});

// ---------------------------------------------------------------------------
// Collection + repo scan
// ---------------------------------------------------------------------------

describe('collectSourceFiles', () => {
    it('skips tests, type declarations and the hook itself', () => {
        const root = makeTree({
            'apps/web/src/components/A.client.tsx': goodForm(),
            'apps/web/src/components/A.test.tsx': goodForm(),
            'apps/web/src/types.d.ts': 'export {};',
            'apps/web/src/node_modules/pkg/index.ts': goodForm(),
            [HOOK_FILE]: 'export {};'
        });
        const found = collectSourceFiles(root).map((f) => f.slice(root.length + 1));
        expect(found).toEqual(['apps/web/src/components/A.client.tsx']);
    });
});

describe('scanSources', () => {
    it('reports only the offending consumer, by repo-relative path', () => {
        const root = makeTree({
            'apps/web/src/components/Good.client.tsx': goodForm(),
            'apps/web/src/components/Bad.client.tsx': goodForm().replace(
                '        setFormError(null);\n',
                ''
            ),
            'apps/web/src/components/field-ids.ts': '/** useZodForm handleApiError */ export {};'
        });
        const { consumers, violations } = scanSources(root, collectSourceFiles(root));

        expect(consumers).toEqual([
            'apps/web/src/components/Bad.client.tsx',
            'apps/web/src/components/Good.client.tsx'
        ]);
        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatch(/Bad\.client\.tsx/);
    });
});

// ---------------------------------------------------------------------------
// Anchor 2 — hand-rolled banners, selected by shape and never by name
// ---------------------------------------------------------------------------

/** A hand-rolled form that renders its own banner and can clear it. */
function goodBanner(
    state = 'formError',
    setter = 'setFormError',
    handler = 'handleSubmit'
): string {
    return `
export function Form() {
    const [${state}, ${setter}] = useState<string | null>(null);
    async function ${handler}(e) {
        e.preventDefault();
        ${setter}(null);
        const res = await api.send();
        if (!res.ok) ${setter}('boom');
    }
    return (
        <form onSubmit={${handler}}>
            {${state} && (
                <p className={styles.formError} role="alert">
                    {${state}}
                </p>
            )}
        </form>
    );
}
`;
}

describe('discoverAlertBannerIdents', () => {
    it('finds a bare identifier rendered as an alert banner', () => {
        expect(discoverAlertBannerIdents(goodBanner())).toEqual(new Set(['formError']));
    });

    it('finds it under ANY name — the shape is the anchor, not the name', () => {
        expect(discoverAlertBannerIdents(goodBanner('banner', 'raiseBanner'))).toEqual(
            new Set(['banner'])
        );
        expect(discoverAlertBannerIdents(goodBanner('oopsMsg', 'setOopsMsg'))).toEqual(
            new Set(['oopsMsg'])
        );
    });

    it('ignores a per-field message, which is a member expression', () => {
        const src = '{fieldErrors.email && (\n<p role="alert">{fieldErrors.email}</p>\n)}';
        expect(discoverAlertBannerIdents(src).size).toBe(0);
    });

    it('ignores a conditional render that is not an alert', () => {
        const src = '{isLoading && (\n<p className={styles.hint}>{isLoading}</p>\n)}';
        expect(discoverAlertBannerIdents(src).size).toBe(0);
    });
});

describe('findNullableStatePairs', () => {
    it('reads BOTH names off the destructuring, never by capitalising', () => {
        expect(
            findNullableStatePairs('const [banner, raiseBanner] = useState<string | null>(null);')
        ).toEqual([{ state: 'banner', setter: 'raiseBanner' }]);
    });

    it('ignores non-nullable state — a textarea is not a banner', () => {
        expect(findNullableStatePairs("const [message, setMessage] = useState('');")).toEqual([]);
        expect(findNullableStatePairs('const [count, setCount] = useState(0);')).toEqual([]);
    });

    it('accepts an untyped null initialiser', () => {
        expect(findNullableStatePairs('const [err, setErr] = useState(null);')).toEqual([
            { state: 'err', setter: 'setErr' }
        ]);
    });
});

describe('scanBannerSources', () => {
    it('accepts a hand-rolled form that can retire its banner', () => {
        const root = makeTree({ 'apps/web/src/components/A.client.tsx': goodBanner() });
        const { consumers, violations } = scanBannerSources(root, collectSourceFiles(root));
        expect(consumers).toEqual(['apps/web/src/components/A.client.tsx [formError]']);
        expect(violations).toEqual([]);
    });

    it('rejects a banner that can be raised and never taken down', () => {
        const root = makeTree({
            'apps/web/src/components/A.client.tsx': goodBanner().replace(
                '        setFormError(null);\n',
                ''
            )
        });
        const { violations } = scanBannerSources(root, collectSourceFiles(root));
        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatch(/never calls `setFormError\(null\)`/);
    });

    // The whole point of a shape anchor: no name appears in the guard, so an
    // unconventionally named banner is caught exactly like a conventional one.
    it('catches an unconventionally named banner just the same', () => {
        const root = makeTree({
            'apps/web/src/components/A.client.tsx': goodBanner('oopsMsg', 'showOops').replace(
                '        showOops(null);\n',
                ''
            )
        });
        const { consumers, violations } = scanBannerSources(root, collectSourceFiles(root));
        expect(consumers).toEqual(['apps/web/src/components/A.client.tsx [oopsMsg]']);
        expect(violations[0]).toMatch(/never calls `showOops\(null\)`/);
    });

    it('keeps evaluating when the submit handler is renamed', () => {
        for (const handler of ['onSave', 'persistThing']) {
            const root = makeTree({
                'apps/web/src/components/A.client.tsx': goodBanner(
                    'formError',
                    'setFormError',
                    handler
                ).replace('        setFormError(null);\n', '')
            });
            const { consumers, violations } = scanBannerSources(root, collectSourceFiles(root));
            expect(consumers).toHaveLength(1);
            expect(violations).toHaveLength(1);
        }
    });

    // use-video-section.ts owns the state, VideoSection.client.tsx draws it.
    // Without the hand-out clause that pair falls between two chairs.
    it('covers a hook that owns a banner rendered by a sibling component', () => {
        const root = makeTree({
            'apps/web/src/components/use-thing.ts':
                'export function useThing() {\n' +
                '    const [formError, setFormError] = useState<string | null>(null);\n' +
                "    const onSave = () => { setFormError('boom'); };\n" +
                '    return { formError, onSave };\n}\n',
            'apps/web/src/components/Thing.client.tsx':
                'export function Thing() {\n' +
                '    const { formError } = useThing();\n' +
                '    return (<div>{formError && (\n' +
                '        <p role="alert">{formError}</p>\n' +
                '    )}</div>);\n}\n'
        });
        const { consumers, violations } = scanBannerSources(root, collectSourceFiles(root));
        expect(consumers).toEqual(['apps/web/src/components/use-thing.ts [formError]']);
        expect(violations).toHaveLength(1);
    });

    it('does not drag in one-shot state that merely shares a banner name', () => {
        // `errorMessage` IS a banner name in the other file, but this one
        // neither renders it as an alert nor hands it out, so it stays out.
        const root = makeTree({
            'apps/web/src/components/Banner.client.tsx': goodBanner('errorMessage', 'setErrMsg'),
            'apps/web/src/components/Verify.client.tsx':
                'export function Verify() {\n' +
                '    const [errorMessage, setErrorMessage] = useState<string | null>(null);\n' +
                "    useEffect(() => { setErrorMessage('nope'); }, []);\n" +
                '    return <p className={styles.stateMessage}>{errorMessage}</p>;\n}\n'
        });
        const { consumers, violations } = scanBannerSources(root, collectSourceFiles(root));
        expect(consumers).toEqual(['apps/web/src/components/Banner.client.tsx [errorMessage]']);
        expect(violations).toEqual([]);
    });

    it('ignores a banner rendered off a prop, whose setter lives elsewhere', () => {
        const root = makeTree({
            'apps/web/src/components/View.client.tsx':
                'export function View({ formError }) {\n' +
                '    return (<div>{formError && (\n' +
                '        <p role="alert">{formError}</p>\n' +
                '    )}</div>);\n}\n'
        });
        expect(scanBannerSources(root, collectSourceFiles(root)).consumers).toEqual([]);
    });
});

describe('the real repository', () => {
    it('has every hook consumer clearing its banner, with headroom over the rot floor', () => {
        const { consumers, violations } = scanSources(REPO_ROOT, collectSourceFiles(REPO_ROOT));

        expect(violations).toEqual([]);
        // The floor is a rot alarm, not an inventory: it must sit strictly
        // below the real population, or deleting one form breaks CI.
        expect(consumers.length).toBeGreaterThan(MIN_EXPECTED_CONSUMERS);
        expect(checkAnchorIntact(REPO_ROOT)).toEqual([]);
    });

    it('has every hand-rolled banner retirable, with headroom over its own floor', () => {
        const { consumers, violations } = scanBannerSources(
            REPO_ROOT,
            collectSourceFiles(REPO_ROOT)
        );

        expect(violations).toEqual([]);
        expect(consumers.length).toBeGreaterThan(MIN_EXPECTED_BANNER_CONSUMERS);
    });

    it('reaches many differently-named banners, not just the house convention', () => {
        const { consumers } = scanBannerSources(REPO_ROOT, collectSourceFiles(REPO_ROOT));
        const names = new Set(consumers.map((c) => c.replace(/^.*\[(.+)\]$/, '$1')));
        // A `formError`-only anchor was measured at 16 of 50 renders. If this
        // ever collapses toward one name, the shape stopped doing the work.
        expect(names.size).toBeGreaterThan(5);
    });
});
