/**
 * @file i18n-hydration-gate.ts
 * @description The classic-script source that holds island hydration back
 * until the deferred half of the client dictionary has run (HOS-2572).
 *
 * It is prepended to the parser-blocking CRITICAL i18n asset, so it executes in
 * `<head>` before any `<astro-island>` exists. See `./i18n-critical-prefixes`
 * for why every hydration directive can otherwise fire before a `defer` script.
 *
 * ## How it hooks hydration
 *
 * Astro 7.4's island runtime looks up the directive at hydration time as
 * `Astro[directive]` on the global, and each directive's inline script
 * registers itself with `(self.Astro||(self.Astro={})).<directive>=fn`. The gate
 * pre-creates `window.Astro` with an accessor per directive: the setter keeps
 * Astro's function, the getter hands the runtime a wrapper that
 *
 *  - calls it straight away for an island whose `opts.name` (the tag name in the
 *    `.astro` template) is in the early allowlist, or once the gate is open;
 *  - otherwise queues the call until `DOMContentLoaded`.
 *
 * `DOMContentLoaded` is the release signal because the HTML spec fires it only
 * after every deferred script has executed — or failed to load, so a 404 on the
 * deferred asset during a rollout (HOS-2080) still releases the islands, onto
 * their fallbacks, instead of leaving them dead.
 *
 * Both Astro shapes it relies on are pinned against the installed runtime by
 * `test/lib/i18n-hydration-gate.test.ts`, which runs Astro's own prebuilt
 * directive scripts through the gate. An Astro upgrade that changes either one
 * fails that test instead of silently un-gating every island.
 *
 * A second run (a `<ClientRouter />` soft navigation into another locale links
 * a second critical script) is a no-op: the first gate is already installed,
 * and after `DOMContentLoaded` it is open anyway.
 *
 * @module lib/i18n-hydration-gate
 */

/** Every hydration directive Astro ships; all of them pass through the gate. */
export const GATED_DIRECTIVES = ['load', 'only', 'idle', 'visible', 'media'] as const;

/**
 * Builds the gate's classic-script source.
 *
 * @param input.earlyIslands - Tag names that hydrate without waiting.
 * @returns ES2017 source, safe to concatenate before other statements (it ends
 *   with `;`).
 */
export function buildHydrationGateScript(input: {
    readonly earlyIslands: readonly string[];
}): string {
    const early = JSON.stringify(Object.fromEntries(input.earlyIslands.map((name) => [name, 1])));
    const directives = JSON.stringify(GATED_DIRECTIVES);
    return [
        '(function(w,d){',
        'if(w.__HOSPEDA_HYDRATION_GATE__)return;',
        'w.__HOSPEDA_HYDRATION_GATE__=1;',
        `var early=${early},open=d.readyState!=="loading",queue=[];`,
        'if(!open)d.addEventListener("DOMContentLoaded",function(){',
        // No `<` anywhere in this source: the asset keeps the "no raw `<`"
        // property its JSON half gets from escaping, so a loop is `forEach`.
        'open=true;queue.splice(0).forEach(function(f){f();});',
        '},{once:true});',
        'var astro=w.Astro||(w.Astro={});',
        `${directives}.forEach(function(name){`,
        'var real=astro[name];',
        'Object.defineProperty(astro,name,{configurable:true,enumerable:true,',
        'set:function(fn){real=fn;},',
        'get:function(){return real&&function(load,opts,el){',
        'if(open||(opts&&early[opts.name]===1))return real(load,opts,el);',
        // Each queued call catches its own throw and rejects, so one failing
        // directive neither strands the islands queued after it nor hides the
        // error from Astro's per-island catch in `start()`.
        'return new Promise(function(resolve,reject){queue.push(function(){try{resolve(real(load,opts,el));}catch(e){reject(e);}});});',
        '};}});',
        '});',
        '})(window,document);'
    ].join('');
}
