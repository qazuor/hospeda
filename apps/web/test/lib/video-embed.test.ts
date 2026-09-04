import { describe, expect, it } from 'vitest';
import { resolveVideoEmbed } from '@/lib/video-embed';

describe('resolveVideoEmbed', () => {
    describe('YouTube — accepted forms', () => {
        it('resolves a watch?v= URL', () => {
            expect(
                resolveVideoEmbed({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
            ).toEqual({
                provider: 'youtube',
                videoId: 'dQw4w9WgXcQ',
                embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
            });
        });

        it('resolves a bare youtube.com host (no www)', () => {
            expect(resolveVideoEmbed({ url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' })).toEqual({
                provider: 'youtube',
                videoId: 'dQw4w9WgXcQ',
                embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
            });
        });

        it('resolves a youtu.be short link', () => {
            expect(resolveVideoEmbed({ url: 'https://youtu.be/dQw4w9WgXcQ' })).toEqual({
                provider: 'youtube',
                videoId: 'dQw4w9WgXcQ',
                embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
            });
        });

        it('resolves an already-embed URL', () => {
            expect(resolveVideoEmbed({ url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' })).toEqual(
                {
                    provider: 'youtube',
                    videoId: 'dQw4w9WgXcQ',
                    embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
                }
            );
        });

        it('resolves a /shorts/ URL', () => {
            expect(
                resolveVideoEmbed({ url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ' })
            ).toEqual({
                provider: 'youtube',
                videoId: 'dQw4w9WgXcQ',
                embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
            });
        });

        it('accepts a youtube-nocookie.com host directly', () => {
            expect(
                resolveVideoEmbed({ url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' })
            ).toEqual({
                provider: 'youtube',
                videoId: 'dQw4w9WgXcQ',
                embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
            });
        });

        it('ignores extra query params on a watch URL', () => {
            const result = resolveVideoEmbed({
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=abc'
            });
            expect(result?.videoId).toBe('dQw4w9WgXcQ');
        });
    });

    describe('YouTube — rejected forms (trap cases)', () => {
        it('rejects a host where youtube.com is a userinfo decoy', () => {
            expect(
                resolveVideoEmbed({ url: 'https://youtube.com@evil.com/watch?v=dQw4w9WgXcQ' })
            ).toBeNull();
        });

        it('rejects a host where youtube.com is a subdomain of another domain', () => {
            expect(
                resolveVideoEmbed({ url: 'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ' })
            ).toBeNull();
        });

        it('rejects an id shorter than 11 characters', () => {
            expect(resolveVideoEmbed({ url: 'https://www.youtube.com/watch?v=short' })).toBeNull();
        });

        it('rejects an id containing characters outside the base64url alphabet', () => {
            expect(
                resolveVideoEmbed({ url: 'https://www.youtube.com/watch?v=dQw4w9Wg@cQ' })
            ).toBeNull();
        });

        it('rejects a watch URL with no v= param', () => {
            expect(resolveVideoEmbed({ url: 'https://www.youtube.com/watch' })).toBeNull();
        });
    });

    describe('Vimeo', () => {
        it('resolves a plain vimeo.com/<id> URL', () => {
            expect(resolveVideoEmbed({ url: 'https://vimeo.com/76979871' })).toEqual({
                provider: 'vimeo',
                videoId: '76979871',
                embedUrl: 'https://player.vimeo.com/video/76979871'
            });
        });

        it('resolves a player.vimeo.com/video/<id> URL', () => {
            expect(resolveVideoEmbed({ url: 'https://player.vimeo.com/video/76979871' })).toEqual({
                provider: 'vimeo',
                videoId: '76979871',
                embedUrl: 'https://player.vimeo.com/video/76979871'
            });
        });

        it('rejects a non-numeric vimeo id', () => {
            expect(resolveVideoEmbed({ url: 'https://vimeo.com/not-a-number' })).toBeNull();
        });

        it('rejects a vimeo.com subdomain decoy', () => {
            expect(resolveVideoEmbed({ url: 'https://vimeo.com.evil.com/76979871' })).toBeNull();
        });
    });

    describe('Dailymotion', () => {
        it('resolves a dailymotion.com/video/<id> URL', () => {
            expect(resolveVideoEmbed({ url: 'https://www.dailymotion.com/video/x7tgad0' })).toEqual(
                {
                    provider: 'dailymotion',
                    videoId: 'x7tgad0',
                    embedUrl: 'https://www.dailymotion.com/embed/video/x7tgad0'
                }
            );
        });

        it('resolves a dai.ly/<id> short link', () => {
            expect(resolveVideoEmbed({ url: 'https://dai.ly/x7tgad0' })).toEqual({
                provider: 'dailymotion',
                videoId: 'x7tgad0',
                embedUrl: 'https://www.dailymotion.com/embed/video/x7tgad0'
            });
        });

        it('resolves an already-embed dailymotion URL', () => {
            expect(
                resolveVideoEmbed({ url: 'https://www.dailymotion.com/embed/video/x7tgad0' })
            ).toEqual({
                provider: 'dailymotion',
                videoId: 'x7tgad0',
                embedUrl: 'https://www.dailymotion.com/embed/video/x7tgad0'
            });
        });

        it('rejects a dailymotion.com subdomain decoy', () => {
            expect(
                resolveVideoEmbed({ url: 'https://www.dailymotion.com.evil.com/video/x7tgad0' })
            ).toBeNull();
        });
    });

    describe('Universal rejections', () => {
        it('rejects an empty string', () => {
            expect(resolveVideoEmbed({ url: '' })).toBeNull();
        });

        it('rejects a javascript: URL', () => {
            expect(resolveVideoEmbed({ url: 'javascript:alert(1)' })).toBeNull();
        });

        it('rejects a data: URL', () => {
            expect(
                resolveVideoEmbed({ url: 'data:text/html,<script>alert(1)</script>' })
            ).toBeNull();
        });

        it('rejects a malformed URL string', () => {
            expect(resolveVideoEmbed({ url: 'not a url at all' })).toBeNull();
        });

        it('rejects an unrecognized host entirely', () => {
            expect(
                resolveVideoEmbed({ url: 'https://example.com/watch?v=dQw4w9WgXcQ' })
            ).toBeNull();
        });

        it('rejects a scheme-relative URL', () => {
            expect(resolveVideoEmbed({ url: '//www.youtube.com/watch?v=dQw4w9WgXcQ' })).toBeNull();
        });
    });
});
