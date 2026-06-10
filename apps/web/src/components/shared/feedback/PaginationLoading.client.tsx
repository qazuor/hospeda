/**
 * @file PaginationLoading.client.tsx
 * @description Intercepts pagination anchor clicks and shows a loading spinner
 * overlay while the browser navigates to the new page. Attaches to elements
 * matching `.pagination__link` within `.pagination` containers on the page.
 * Cleans up on Astro view-transition navigation (astro:before-swap).
 */

import { useEffect } from 'react';

export function PaginationLoading() {
    useEffect(() => {
        let overlay: HTMLDivElement | null = null;

        function showOverlay() {
            if (overlay) return;
            overlay = document.createElement('div');
            overlay.setAttribute('role', 'status');
            overlay.setAttribute('aria-label', 'Cargando');
            overlay.style.cssText = [
                'position:fixed',
                'inset:0',
                'z-index:9999',
                'display:flex',
                'align-items:center',
                'justify-content:center',
                'background:var(--core-background-a70)',
                'backdrop-filter:blur(2px)',
                '-webkit-backdrop-filter:blur(2px)'
            ].join(';');

            const spinner = document.createElement('div');
            spinner.style.cssText = [
                'width:40px',
                'height:40px',
                'border:3px solid var(--brand-primary-a25)',
                'border-top-color:var(--brand-primary,#3b82f6)',
                'border-radius:50%',
                'animation:pag-spin 0.7s linear infinite'
            ].join(';');

            if (!document.getElementById('pag-spin-style')) {
                const style = document.createElement('style');
                style.id = 'pag-spin-style';
                style.textContent = '@keyframes pag-spin{to{transform:rotate(360deg)}}';
                document.head.appendChild(style);
            }

            overlay.appendChild(spinner);
            document.body.appendChild(overlay);
        }

        function removeOverlay() {
            overlay?.remove();
            overlay = null;
        }

        function onClick(e: MouseEvent) {
            const target = e.currentTarget as HTMLAnchorElement;
            if (!target.href || target.getAttribute('aria-disabled') === 'true') return;
            showOverlay();
        }

        function attachListeners() {
            const links = document.querySelectorAll<HTMLAnchorElement>(
                '.pagination a.pagination__link'
            );
            for (const link of links) {
                link.addEventListener('click', onClick);
            }
        }

        function detachListeners() {
            const links = document.querySelectorAll<HTMLAnchorElement>(
                '.pagination a.pagination__link'
            );
            for (const link of links) {
                link.removeEventListener('click', onClick);
            }
        }

        attachListeners();

        document.addEventListener('astro:before-swap', removeOverlay);
        document.addEventListener('astro:page-load', () => {
            removeOverlay();
            detachListeners();
            attachListeners();
        });

        return () => {
            detachListeners();
            removeOverlay();
            document.removeEventListener('astro:before-swap', removeOverlay);
        };
    }, []);

    return null;
}
