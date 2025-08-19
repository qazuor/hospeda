/**
 * Custom Page Transitions for Prerendered Pages
 * Provides smooth loading transitions that work with static pages
 */

class PageTransitions {
    constructor() {
        this.prefetchedPages = new Set();
        this.isTransitioning = false;
        this.init();
    }

    init() {
        this.createLoadingElements();
        this.bindEvents();
        this.setupPrefetch();
    }

    createLoadingElements() {
        // Create loading overlay
        const overlay = document.createElement('div');
        overlay.className = 'page-loading-overlay';
        overlay.innerHTML = `
      <div class="loading-spinner"></div>
    `;
        document.body.appendChild(overlay);
        this.overlay = overlay;

        // Create progress bar
        const progressBar = document.createElement('div');
        progressBar.className = 'page-progress-bar';
        document.body.appendChild(progressBar);
        this.progressBar = progressBar;
    }

    bindEvents() {
        // Intercept internal link clicks
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;

            const href = link.getAttribute('href');

            // Only handle internal links
            if (this.isInternalLink(href)) {
                // Show loading immediately
                this.showLoading();

                // Small delay to ensure loading state is visible
                setTimeout(() => {
                    window.location.href = href;
                }, 50);
            }
        });
    }

    setupPrefetch() {
        // Prefetch on hover with debounce
        let prefetchTimeout;
        document.addEventListener('mouseover', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;

            const href = link.getAttribute('href');
            if (this.isInternalLink(href) && !this.prefetchedPages.has(href)) {
                clearTimeout(prefetchTimeout);
                prefetchTimeout = setTimeout(() => {
                    this.prefetchPage(href);
                }, 100);
            }
        });
    }

    isInternalLink(href) {
        if (!href) return false;
        if (href.startsWith('#')) return false;
        if (href.startsWith('mailto:')) return false;
        if (href.startsWith('tel:')) return false;
        if (href.startsWith('http://') && !href.includes(window.location.hostname)) return false;
        if (href.startsWith('https://') && !href.includes(window.location.hostname)) return false;
        return true;
    }

    async prefetchPage(href) {
        try {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = href;
            document.head.appendChild(link);

            this.prefetchedPages.add(href);

            // Mark link as prefetched
            const links = document.querySelectorAll(`a[href="${href}"]`);
            for (const link of links) {
                link.setAttribute('data-prefetched', 'true');
            }
        } catch (_error) {
            console.debug('Prefetch failed for:', href);
        }
    }

    showLoading() {
        // Show overlay
        this.overlay.classList.add('active');

        // Show progress bar
        this.progressBar.classList.add('loading');

        // Add loading class to body
        document.body.classList.add('page-transitioning');
    }

    hideLoading() {
        // Hide overlay
        this.overlay.classList.remove('active');

        // Hide progress bar
        this.progressBar.classList.remove('loading');

        // Remove loading class from body
        document.body.classList.remove('page-transitioning');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new PageTransitions();
    });
} else {
    new PageTransitions();
}

// Hide loading when page loads
window.addEventListener('load', () => {
    const overlay = document.querySelector('.page-loading-overlay');
    const progressBar = document.querySelector('.page-progress-bar');

    if (overlay) overlay.classList.remove('active');
    if (progressBar) progressBar.classList.remove('loading');
    document.body.classList.remove('page-transitioning');
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Page became visible, hide any loading states
        const overlay = document.querySelector('.page-loading-overlay');
        const progressBar = document.querySelector('.page-progress-bar');

        if (overlay) overlay.classList.remove('active');
        if (progressBar) progressBar.classList.remove('loading');
        document.body.classList.remove('page-transitioning');
    }
});
