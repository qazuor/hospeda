import { describe, expect, it } from 'vitest';
import { isBotUserAgent } from '../src/bot-user-agent';

describe('isBotUserAgent', () => {
    it.each([
        ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
        ['GPTBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2'],
        ['ClaudeBot', 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)'],
        ['curl', 'curl/8.5.0'],
        [
            'Lighthouse / PSI',
            'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse'
        ]
    ])('flags %s', (_name, ua) => {
        expect(isBotUserAgent(ua)).toBe(true);
    });

    it('treats a missing or blank UA as a bot', () => {
        expect(isBotUserAgent(undefined)).toBe(true);
        expect(isBotUserAgent('   ')).toBe(true);
    });

    it.each([
        [
            'desktop Chrome',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        ],
        [
            'iPhone Safari',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
        ]
    ])('does not flag %s', (_name, ua) => {
        expect(isBotUserAgent(ua)).toBe(false);
    });
});
