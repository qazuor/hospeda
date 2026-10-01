/**
 * Bot / crawler / automated-tooling detection by User-Agent.
 *
 * Single source of truth shared by the API (view and partner-logo-click
 * capture drop bot traffic) and the web app (the cookie consent banner is not
 * shown to automated agents). Keeping ONE regex matters: if the copies drifted,
 * one surface would quietly start treating crawlers as people while the other
 * did not.
 *
 * @module bot-user-agent
 */

/**
 * Regex that matches User-Agent strings from known bots, crawlers, and
 * headless tooling. The pattern is intentionally broad — false-positive
 * matches (a real user with "bot" in their UA) are acceptable because every
 * consumer treats a match as "skip a soft, non-critical behavior" (a telemetry
 * row, a consent banner), never as "deny access".
 *
 * Covered families (case-insensitive):
 *   - Generic crawl/spider/bot/preview substrings
 *   - Common CLI tools: curl, wget
 *   - Major SEO crawlers: Googlebot, Bingbot, Baiduspider, DuckDuckBot,
 *     YandexBot, Slurp (Yahoo), AhrefsBot, SemrushBot, MJ12bot, DotBot,
 *     PetalBot, bytespider, GPTBot, ClaudeBot, PerplexityBot
 *   - Performance auditing: Lighthouse / PageSpeed Insights, whose UA carries
 *     `Chrome-Lighthouse` and none of the substrings above
 */
export const BOT_UA_REGEX =
    /bot|crawl|spider|preview|curl|wget|lighthouse|googlebot|bingbot|baiduspider|duckduckbot|yandexbot|slurp|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|bytespider|gptbot|claudebot|perplexitybot/i;

/**
 * Returns `true` when the given User-Agent string matches a known bot or is
 * absent/empty. A missing UA is treated as a bot so headless clients that omit
 * the header are not mistaken for people.
 *
 * @param ua - The raw User-Agent value (may be undefined or empty).
 * @returns Whether the agent should be treated as automated.
 */
export function isBotUserAgent(ua: string | undefined): boolean {
    if (!ua || ua.trim().length === 0) return true;
    return BOT_UA_REGEX.test(ua);
}
