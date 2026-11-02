/**
 * Helpers for recorders that run logged in against a Hospeda site (staging): login with a
 * password taken from the environment, and the clean-view check every settled position runs.
 */
import { join } from 'node:path';
import type { Page } from 'playwright';
import { resolveAssetPaths } from '../../config/asset-paths';
import { HEADER_OFFSET, sleep } from './take';

/** Hostnames a logged-in (writing) recorder must refuse. */
const PRODUCTION_HOSTS: readonly string[] = ['hospeda.com.ar', 'www.hospeda.com.ar'];

/**
 * Folder with the photos a recorder uploads: `<VCn>_PHOTOS_DIR` when set, otherwise
 * `<assets>/fotos/<video>/upload` under `HOSPEDA_MARKETING_ASSETS_DIR`.
 *
 * @param input.video - Lower-case video id (`vc1`, `vc3`, ...).
 * @returns The absolute photos directory.
 */
export const photosDirOf = ({ video }: { readonly video: string }): string =>
    process.env[`${video.toUpperCase()}_PHOTOS_DIR`] ??
    join(resolveAssetPaths().assetsDir, 'fotos', video, 'upload');

/**
 * Signs in through the real form. The password comes from `VIDEO_LOGIN_PASSWORD` and is never
 * logged or written anywhere.
 *
 * @param input.page - Page of the recording browser.
 * @param input.web - Site origin.
 * @param input.email - Account email (a seeded host, never a super admin).
 * @param input.video - Video id, for the error message.
 */
export const login = async ({
    page,
    web,
    email,
    video
}: {
    readonly page: Page;
    readonly web: string;
    readonly email: string;
    readonly video: string;
}): Promise<void> => {
    // These recorders publish listings: never let a WEB_URL override point them at production.
    if (PRODUCTION_HOSTS.includes(new URL(web).hostname)) {
        throw new Error(`${video} writes data: record it on staging, not on ${web}.`);
    }
    const password = process.env.VIDEO_LOGIN_PASSWORD;
    if (!password) throw new Error(`Set VIDEO_LOGIN_PASSWORD to record ${video}.`);
    // Wait for hydration: submitting before React attaches posts the native form as a GET.
    await page.goto(`${web}/es/auth/signin/`, { waitUntil: 'networkidle' });
    await sleep(1000);
    await page.locator('#signin-email').fill(email);
    await page.locator('#signin-password').fill(password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForURL((u) => !u.pathname.includes('/auth/'), { timeout: 30_000 });
};

/**
 * Fails the take when the viewport shows a price or names another listing platform: price
 * labels with a value, currency amounts, long numeric inputs. The brand words are built at
 * runtime so the recorders do not spell them either.
 *
 * @param input.page - Page of the recording browser.
 * @param input.where - Name of the position, for the error message.
 */
export const assertCleanView = async ({
    page,
    where
}: {
    readonly page: Page;
    readonly where: string;
}): Promise<void> => {
    const hits = (await page.evaluate(`(() => {
        const bad = /precio (base|convertido)|\\$\\s?\\d|US\\$|${['air', 'bnb'].join('')}|${['boo', 'king'].join('')}/i;
        const out = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const node = walker.currentNode;
            const text = node.textContent.trim();
            if (!text || !bad.test(text)) continue;
            const el = node.parentElement;
            if (!el || el.closest('[aria-hidden="true"]')) continue;
            const r = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none' || r.height === 0) continue;
            if (r.bottom > ${HEADER_OFFSET - 10} && r.top < innerHeight) out.push(text.slice(0, 60));
        }
        for (const input of document.querySelectorAll('input')) {
            const r = input.getBoundingClientRect();
            if (r.height > 0 && r.bottom > 0 && r.top < innerHeight && /^\\d{4,}$/.test(input.value))
                out.push('numeric input ' + input.value.length + ' digits');
        }
        return out;
    })()`)) as string[];
    if (hits.length > 0) throw new Error(`Unclean view at ${where}: ${hits.join(' | ')}`);
};

/**
 * Clicks an editor section's «Guardar» and waits for the «Cambios guardados» confirmation.
 *
 * @param input.page - Page of the recording browser.
 * @param input.where - Name of the section, for the error message.
 */
export const saveSection = async ({
    page,
    where
}: {
    readonly page: Page;
    readonly where: string;
}): Promise<void> => {
    await page.getByRole('button', { name: 'Guardar', exact: true }).last().click();
    await page
        .getByText('Cambios guardados')
        .first()
        .waitFor({ timeout: 30_000 })
        .catch(() => {
            throw new Error(`No save confirmation at ${where}.`);
        });
    await sleep(800);
};
