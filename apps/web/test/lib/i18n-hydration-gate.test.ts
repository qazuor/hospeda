/**
 * @file i18n-hydration-gate.test.ts
 * @description The hydration gate the critical i18n asset installs (HOS-2572),
 * run against ASTRO'S OWN prebuilt directive scripts from the installed package.
 *
 * Why the real scripts and not a stand-in: the gate works by intercepting
 * `(self.Astro||(self.Astro={})).<directive>=fn` and the island runtime's
 * `Astro[directive]` lookup. Both are Astro internals. If an upgrade changes
 * either shape, the gate silently stops gating and every non-early island goes
 * back to hydrating against a half-loaded dictionary — raw keys, HOS-2388 again.
 * Executing the installed scripts here turns that into a red test.
 *
 * Each case runs in a fresh `node:vm` context with a hand-driven `document`, so
 * the moment `DOMContentLoaded` fires is under the test's control.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { buildHydrationGateScript, GATED_DIRECTIVES } from '@/lib/i18n-hydration-gate';

const ASTRO_DIR = resolve(__dirname, '../../node_modules/astro');

/** The prebuilt classic-script text Astro inlines for one directive. */
async function astroDirectiveScript(directive: string): Promise<string> {
    const mod = (await import(join(ASTRO_DIR, `dist/runtime/client/${directive}.prebuilt.js`))) as {
        default: string;
    };
    return mod.default;
}

type Directive = (
    load: () => Promise<() => Promise<void>>,
    opts: { name: string; value: string },
    el: unknown
) => unknown;

interface Harness {
    readonly astro: () => Record<string, Directive | undefined>;
    readonly run: (source: string) => void;
    readonly fireDomContentLoaded: () => void;
    readonly hydrate: (input: { directive: string; name: string }) => void;
    readonly hydrated: string[];
}

/**
 * A browser-ish global whose `requestIdleCallback`, IntersectionObserver and
 * `matchMedia` all fire IMMEDIATELY — the worst case, and the one the gate
 * exists for: every directive is ready to hydrate mid-parse.
 */
function createHarness(readyState: 'loading' | 'complete' = 'loading'): Harness {
    const listeners: Array<() => void> = [];
    const hydrated: string[] = [];
    const document = {
        readyState,
        addEventListener: (type: string, fn: () => void) => {
            if (type === 'DOMContentLoaded') listeners.push(fn);
        }
    };
    const sandbox: Record<string, unknown> = {
        document,
        Event: class {
            constructor(readonly type: string) {}
        },
        dispatchEvent: () => true,
        requestIdleCallback: (cb: () => void) => cb(),
        setTimeout: (cb: () => void) => cb(),
        matchMedia: () => ({ matches: true, addEventListener: () => undefined }),
        IntersectionObserver: class {
            constructor(private readonly cb: (entries: unknown[]) => void) {}
            observe(): void {
                this.cb([{ isIntersecting: true }]);
            }
            disconnect(): void {}
        },
        Promise
    };
    sandbox.window = sandbox;
    sandbox.self = sandbox;
    const context = createContext(sandbox);

    return {
        astro: () => sandbox.Astro as Record<string, Directive | undefined>,
        run: (source) => runInContext(source, context),
        fireDomContentLoaded: () => {
            document.readyState = 'interactive';
            for (const fn of listeners.splice(0)) fn();
        },
        hydrate: ({ directive, name }) => {
            const fn = (sandbox.Astro as Record<string, Directive | undefined>)[directive];
            if (!fn) throw new Error(`Astro.${directive} is not registered`);
            fn(
                async () => async () => {
                    hydrated.push(name);
                },
                { name, value: directive === 'media' ? '(min-width: 1px)' : '' },
                { children: [{}] }
            );
        },
        hydrated
    };
}

/** Lets every pending microtask (the directives' async `load`) settle. */
const flush = async (): Promise<void> => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
};

async function setUp(readyState: 'loading' | 'complete' = 'loading'): Promise<Harness> {
    const harness = createHarness(readyState);
    harness.run(buildHydrationGateScript({ earlyIslands: ['EarlyIsland'] }));
    for (const directive of GATED_DIRECTIVES) harness.run(await astroDirectiveScript(directive));
    return harness;
}

describe('the gate, against Astro’s installed directive scripts', () => {
    it('lets an early island hydrate mid-parse, under every directive', async () => {
        const harness = await setUp();

        for (const directive of GATED_DIRECTIVES) {
            harness.hydrate({ directive, name: 'EarlyIsland' });
        }
        await flush();

        expect(harness.hydrated).toEqual(GATED_DIRECTIVES.map(() => 'EarlyIsland'));
    });

    it('holds every other island until DOMContentLoaded, under every directive', async () => {
        const harness = await setUp();

        for (const directive of GATED_DIRECTIVES) {
            harness.hydrate({ directive, name: `Gated_${directive}` });
        }
        await flush();

        // Non-vacuity of the "held" half: with IO / idle / media all firing
        // immediately in this harness, an ungated directive WOULD have
        // hydrated by now — the first case proves it.
        expect(harness.hydrated).toEqual([]);

        harness.fireDomContentLoaded();
        await flush();

        expect([...harness.hydrated].sort()).toEqual(
            GATED_DIRECTIVES.map((d) => `Gated_${d}`).sort()
        );
    });

    it('hydrates immediately once DOMContentLoaded has fired', async () => {
        const harness = await setUp();
        harness.fireDomContentLoaded();

        harness.hydrate({ directive: 'load', name: 'LateIsland' });
        await flush();

        expect(harness.hydrated).toEqual(['LateIsland']);
    });

    it('is open from the start when installed after parsing (soft navigation)', async () => {
        const harness = await setUp('complete');

        harness.hydrate({ directive: 'idle', name: 'AnyIsland' });
        await flush();

        expect(harness.hydrated).toEqual(['AnyIsland']);
    });

    it('reports a directive as missing until Astro registers it', () => {
        // The island runtime waits for `astro:<directive>` when the lookup is
        // `undefined`. A getter that returned a wrapper around nothing would
        // break that handshake and the island would never start.
        const harness = createHarness();
        harness.run(buildHydrationGateScript({ earlyIslands: [] }));

        for (const directive of GATED_DIRECTIVES) {
            expect(harness.astro()[directive], directive).toBeUndefined();
        }
    });

    it('keeps and gates a directive Astro registered before the gate was installed', async () => {
        // Not the normal order (the gate is in <head>, directives in <body>),
        // but a gate that dropped an existing directive would leave its
        // islands waiting forever for an `astro:<directive>` event already sent.
        const harness = createHarness();
        harness.run(await astroDirectiveScript('idle'));
        harness.run(buildHydrationGateScript({ earlyIslands: [] }));

        harness.hydrate({ directive: 'idle', name: 'Gated' });
        await flush();
        expect(harness.hydrated).toEqual([]);

        harness.fireDomContentLoaded();
        await flush();
        expect(harness.hydrated).toEqual(['Gated']);
    });

    it('a second install is a no-op and keeps the first allowlist', async () => {
        const harness = await setUp();
        harness.run(buildHydrationGateScript({ earlyIslands: ['OtherIsland'] }));

        harness.hydrate({ directive: 'load', name: 'OtherIsland' });
        harness.hydrate({ directive: 'load', name: 'EarlyIsland' });
        await flush();

        expect(harness.hydrated).toEqual(['EarlyIsland']);
    });

    it('a directive that throws while queued rejects its own island and releases the rest', async () => {
        // Astro's island `start()` wraps each `await Astro[t](...)` in its own
        // try/catch. The gate must keep that per-island isolation: one throw
        // (e.g. an invalid IntersectionObserver rootMargin) may neither strand
        // the islands queued after it nor leave its own promise pending.
        const harness = createHarness();
        harness.run(buildHydrationGateScript({ earlyIslands: [] }));
        harness.run(
            '(self.Astro||(self.Astro={})).visible=function(load,opts){' +
                'if(opts.name==="Boom")throw new Error("boom");' +
                'return load().then(function(h){return h();});};'
        );
        const visible = harness.astro().visible;
        if (!visible) throw new Error('Astro.visible is not registered');
        const island = (name: string): unknown =>
            visible(
                async () => async () => {
                    harness.hydrated.push(name);
                },
                { name, value: '' },
                {}
            );

        const before = island('Before');
        const boom = island('Boom');
        const after = island('After');
        harness.fireDomContentLoaded();
        await flush();

        await expect(boom).rejects.toThrow('boom');
        await expect(before).resolves.toBeUndefined();
        await expect(after).resolves.toBeUndefined();
        expect(harness.hydrated).toEqual(['Before', 'After']);
    });

    it('does not treat inherited object keys as allowlisted names', async () => {
        const harness = await setUp();

        harness.hydrate({ directive: 'load', name: 'constructor' });
        harness.hydrate({ directive: 'load', name: '__proto__' });
        await flush();

        expect(harness.hydrated).toEqual([]);
    });
});

describe('the Astro internals the gate depends on (installed version)', () => {
    it('the island runtime looks the directive up on the global at hydration time and passes opts', async () => {
        const mod = (await import(
            join(ASTRO_DIR, 'dist/runtime/server/astro-island.prebuilt.js')
        )) as {
            default: string;
        };
        const source = mod.default;

        // `let e=JSON.parse(this.getAttribute(`opts`)),t=this.getAttribute(`client`);
        //  if(Astro[t]===void 0) …wait for `astro:${t}`… else await Astro[t](load, e, this)`
        const opts = /(\w+)=JSON\.parse\(this\.getAttribute\(`opts`\)\)/.exec(source)?.[1];
        const directive = /(\w+)=this\.getAttribute\(`client`\)/.exec(source)?.[1];
        expect(opts, 'opts are no longer parsed from the island attribute').toBeTruthy();
        expect(directive, 'the directive is no longer read from the island attribute').toBeTruthy();
        expect(source).toContain(`Astro[${directive}]===void 0`);
        expect(source).toMatch(
            new RegExp(`await Astro\\[${directive}\\]\\([\\s\\S]*?\\},${opts},this\\)`)
        );
    });

    it('serializes the island tag name as opts.name', () => {
        const source = readFileSync(join(ASTRO_DIR, 'dist/runtime/server/hydration.js'), 'utf8');

        expect(source).toMatch(/name:\s*metadata\.displayName/);
    });
});
