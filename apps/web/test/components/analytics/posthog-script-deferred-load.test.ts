/**
 * @file posthog-script-deferred-load.test.ts
 * @description Behavioural regression test for the DEFERRED array.js fetch in
 * `PostHogScript.astro` (HOS-369).
 *
 * Why this executes the snippet instead of asserting on its source text:
 * the sibling `posthog-script.test.ts` asserts on strings, and a string
 * assertion cannot tell "the deferral is declared" from "the deferral works".
 * The whole mechanism here hinges on a runtime property — that a <script>
 * inserted into a detached DocumentFragment does not start loading — which no
 * amount of source matching can verify. So the snippet is extracted, its
 * build-time `${...}` interpolations are substituted, and it is EXECUTED in
 * jsdom against the real DOM.
 *
 * The two failure modes this pins down:
 * 1. Regression to an eager fetch (someone passes `document` back to the stub
 *    instead of the proxy) — caught by "does not request array.js before idle".
 * 2. Deferring too much: if the stub itself were deferred, `window.posthog`
 *    would have no `capture` method during the wait and `@repo/analytics`
 *    would SILENTLY DROP every early event (its `capture()` returns early on a
 *    falsy client, inside a try/catch). Caught by "queues capture() calls
 *    synchronously".
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SOURCE_PATH = resolve(__dirname, '../../../src/components/analytics/PostHogScript.astro');
const source = readFileSync(SOURCE_PATH, 'utf8');

const TEST_KEY = 'phc_test_key';
const TEST_HOST = 'https://us.i.posthog.com';
const EXPECTED_SRC = 'https://us-assets.i.posthog.com/static/array.js';

/**
 * Extract the `snippetBody` template literal and resolve it into executable
 * JavaScript by substituting the build-time interpolations Astro would fill in.
 * Throws loudly if the file no longer has the expected shape, so this test can
 * never pass by silently executing nothing.
 */
function buildExecutableSnippet(): string {
    const OPEN = 'const snippetBody = `';
    const start = source.indexOf(OPEN);
    if (start === -1) {
        throw new Error('PostHogScript.astro no longer declares `const snippetBody = `');
    }
    const bodyStart = start + OPEN.length;
    const end = source.indexOf('\n`;', bodyStart);
    if (end === -1) {
        throw new Error(
            'PostHogScript.astro `snippetBody` has no closing backtick on its own line'
        );
    }

    const body = source
        .slice(bodyStart, end)
        // Astro resolves these at build time from import.meta.env.
        .replaceAll('${JSON.stringify(posthogKey)}', JSON.stringify(TEST_KEY))
        .replaceAll('${JSON.stringify(posthogHost)}', JSON.stringify(TEST_HOST))
        .replaceAll('${JSON.stringify(appVersion)}', JSON.stringify('test'))
        // Template-literal escapes become plain characters once Astro evaluates it.
        .replaceAll('\\`', '`');

    if (body.includes('${')) {
        throw new Error(
            `PostHogScript.astro snippet has an unhandled \${...} interpolation; this test would ` +
                'execute a template placeholder as code. Add it to buildExecutableSnippet().'
        );
    }
    return body;
}

const executableSnippet = buildExecutableSnippet();

/**
 * Run the snippet exactly as the browser would run the inline <script>.
 *
 * The input is this repository's own source file, never user input — executing
 * it is the entire point of the test.
 */
function runSnippet(): void {
    new Function(executableSnippet)();
}

function arrayJsScripts(): ReadonlyArray<HTMLScriptElement> {
    return Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]')).filter((el) =>
        el.src.includes('array.js')
    );
}

type IdleCallback = () => void;

let idleCallbacks: Array<{ callback: IdleCallback; timeout?: number }> = [];

beforeEach(() => {
    vi.useFakeTimers();
    idleCallbacks = [];
    document.head.innerHTML = '';
    // The snippet guards on these globals; a leftover value from a previous
    // test would make the snippet no-op and the assertions vacuous.
    Reflect.deleteProperty(window, '__hospeda_posthog_initialized');
    Reflect.deleteProperty(window, '__hospeda_posthog_script_flushed');
    Reflect.deleteProperty(window, 'posthog');
    Reflect.deleteProperty(window, 'requestIdleCallback');
});

afterEach(() => {
    vi.useRealTimers();
});

function installIdleCallback(): void {
    Object.defineProperty(window, 'requestIdleCallback', {
        configurable: true,
        writable: true,
        value: (callback: IdleCallback, options?: { timeout?: number }) => {
            idleCallbacks.push({ callback, ...(options ?? {}) });
            return idleCallbacks.length;
        }
    });
}

describe('PostHogScript snippet — deferred array.js fetch (HOS-369)', () => {
    it('does not request array.js while the page is still loading', () => {
        installIdleCallback();
        runSnippet();

        expect(
            arrayJsScripts(),
            'array.js must NOT be in the document right after the snippet runs — it is ~79 KB ' +
                'from a third-party origin and would compete with the LCP image. The stub must ' +
                'receive the detached-fragment document proxy, not the real `document`.'
        ).toHaveLength(0);
    });

    it('queues capture() calls synchronously, before array.js is fetched', () => {
        installIdleCallback();
        runSnippet();

        const posthog = (window as unknown as { posthog?: { capture?: unknown } }).posthog;
        expect(
            typeof posthog?.capture,
            'window.posthog.capture must exist synchronously. @repo/analytics `capture()` ' +
                'no-ops silently on a client without it, so deferring the STUB (rather than ' +
                'only the array.js request) would drop early events with no error anywhere.'
        ).toBe('function');

        // The stub queues onto the posthog array itself; capturing must not throw
        // and must record the call for the real SDK to replay on load.
        const before = (window as unknown as { posthog: unknown[] }).posthog.length;
        (
            window as unknown as { posthog: { capture: (n: string, p?: unknown) => void } }
        ).posthog.capture('test_event', { a: 1 });
        expect((window as unknown as { posthog: unknown[] }).posthog.length).toBe(before + 1);
        expect(arrayJsScripts()).toHaveLength(0);
    });

    it('appends array.js to the head once the idle callback fires', () => {
        installIdleCallback();
        runSnippet();

        // jsdom reports readyState 'complete', so the snippet schedules immediately.
        expect(idleCallbacks).toHaveLength(1);
        expect(
            idleCallbacks[0]?.timeout,
            'the idle callback needs a timeout so the fetch still happens on a page that never ' +
                'goes idle'
        ).toBe(3000);

        idleCallbacks[0]?.callback();

        const scripts = arrayJsScripts();
        expect(scripts).toHaveLength(1);
        expect(scripts[0]?.src).toBe(EXPECTED_SRC);
        expect(scripts[0]?.async).toBe(true);
        expect(scripts[0]?.parentElement).toBe(document.head);
    });

    it('falls back to a timer when requestIdleCallback is unavailable', () => {
        // No installIdleCallback() here: Safari < 16.4 has no requestIdleCallback.
        runSnippet();
        expect(arrayJsScripts()).toHaveLength(0);

        vi.advanceTimersByTime(1000);

        const scripts = arrayJsScripts();
        expect(scripts).toHaveLength(1);
        expect(scripts[0]?.src).toBe(EXPECTED_SRC);
    });

    it('appends array.js exactly once even if the flush is triggered repeatedly', () => {
        installIdleCallback();
        runSnippet();

        idleCallbacks[0]?.callback();
        idleCallbacks[0]?.callback();
        vi.advanceTimersByTime(5000);

        expect(
            arrayJsScripts(),
            'the flush must be idempotent — a duplicate array.js would load the SDK twice'
        ).toHaveLength(1);
    });

    it('still fetches array.js when the stub does not inject where the proxy can capture it', () => {
        // Fail-safe path: simulate an upstream stub that stops creating the
        // <script> through the injected document (e.g. it starts using
        // `document.head.appendChild` directly). Analytics must degrade to
        // "loads slightly early", never to "never loads, no error".
        installIdleCallback();
        const neutered = executableSnippet.replace(
            '(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r)',
            'void 0'
        );
        expect(
            neutered,
            'the fail-safe test must actually mutate the stub, otherwise it proves nothing'
        ).not.toBe(executableSnippet);

        new Function(neutered)();
        idleCallbacks[0]?.callback();

        const scripts = arrayJsScripts();
        expect(scripts).toHaveLength(1);
        expect(scripts[0]?.src).toBe(EXPECTED_SRC);
    });
});
