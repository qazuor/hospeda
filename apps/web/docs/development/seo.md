# SEO Best Practices Guide

Complete guide to Search Engine Optimization (SEO) in Hospeda Web App.

---

## 📖 Overview

Hospeda Web App is optimized for **search engines** using Astro's built-in SEO features and best practices.

**Key SEO Features**:

- 🏗️ Static Site Generation (SSG) for fast indexing
- 📄 Server-Side Rendering (SSR) for dynamic content
- 🏷️ Comprehensive meta tags
- 📊 Structured data (JSON-LD)
- 🗺️ XML sitemaps
- 🤖 Robots.txt configuration
- 🖼️ Optimized images
- ⚡ Performance optimization

**Target**: Rank well for tourism-related searches in Argentina's Litoral region.

---

## 🏷️ Meta Tags

### Basic Meta Tags

```astro
---
// src/layouts/MainLayout.astro
interface Props {
  title: string;
  description: string;
  image?: string;
  noindex?: boolean;
}

const {
  title,
  description,
  image = `${import.meta.env.PUBLIC_SITE_URL}/og-default.jpg`,
  noindex = false
} = Astro.props;

const canonicalUrl = new URL(Astro.url.pathname, import.meta.env.PUBLIC_SITE_URL);
---

<!DOCTYPE html>
<html lang="es">
<head>
  <!-- Essential Meta Tags -->
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Title & Description -->
  <title>{title} | Hospeda</title>
  <meta name="description" content={description} />

  <!-- Canonical URL -->
  <link rel="canonical" href={canonicalUrl} />

  <!-- Robots -->
  {noindex && <meta name="robots" content="noindex, nofollow" />}

  <!-- More meta tags below... -->
</head>
```markdown

### Open Graph (Facebook, LinkedIn)

```astro
<!-- Open Graph / Facebook -->
<meta property="og:type" content="website" />
<meta property="og:url" content={canonicalUrl} />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:image" content={image} />
<meta property="og:site_name" content="Hospeda" />
<meta property="og:locale" content="es_AR" />
```markdown

### Twitter Card

```astro
<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content={canonicalUrl} />
<meta name="twitter:title" content={title} />
<meta name="twitter:description" content={description} />
<meta name="twitter:image" content={image} />
<meta name="twitter:creator" content="@hospeda_ar" />
```markdown

### Page-Specific Meta Tags

```astro
---
// src/pages/alojamientos/[slug].astro
import { AccommodationService } from '@repo/service-core';

const { slug } = Astro.params;
const service = new AccommodationService();
const result = await service.findBySlug(slug);

if (!result.success) {
  return Astro.redirect('/404');
}

const accommodation = result.data;

const pageTitle = `${accommodation.name} - ${accommodation.destination.name}`;
const pageDescription = accommodation.description.slice(0, 160);
const pageImage = accommodation.images[0]?.url || '/default-og.jpg';
---

<MainLayout
  title={pageTitle}
  description={pageDescription}
  image={pageImage}
>
  <!-- Page content -->
</MainLayout>
```text

---

## 📊 Structured Data (JSON-LD)

### What is Structured Data?

Structured data helps search engines understand your content and display **rich results** (rich snippets, knowledge graphs, etc.).

**Format**: JSON-LD (JavaScript Object Notation for Linked Data)

### Organization Schema

```astro
---
// src/components/seo/OrganizationSchema.astro
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  "name": "Hospeda",
  "description": "Plataforma de alojamientos turísticos en el Litoral Argentino",
  "url": import.meta.env.PUBLIC_SITE_URL,
  "logo": `${import.meta.env.PUBLIC_SITE_URL}/logo.png`,
  "address": {
    "@type": "PostalAddress",
    "addressRegion": "Entre Ríos",
    "addressCountry": "AR"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+54-123-456-7890",
    "contactType": "customer service",
    "availableLanguage": ["Spanish", "English"]
  },
  "sameAs": [
    "https://facebook.com/hospeda",
    "https://instagram.com/hospeda",
    "https://twitter.com/hospeda_ar"
  ]
};
---

<script type="application/ld+json" set:html={JSON.stringify(organizationSchema)} />
```markdown

### Accommodation Schema (Hotel)

```astro
---
// src/pages/alojamientos/[slug].astro
const accommodationSchema = {
  "@context": "https://schema.org",
  "@type": "Hotel",
  "name": accommodation.name,
  "description": accommodation.description,
  "url": `${import.meta.env.PUBLIC_SITE_URL}/alojamientos/${accommodation.slug}`,
  "image": accommodation.images.map(img => img.url),
  "address": {
    "@type": "PostalAddress",
    "streetAddress": accommodation.address,
    "addressLocality": accommodation.destination.name,
    "addressRegion": "Entre Ríos",
    "postalCode": accommodation.postalCode,
    "addressCountry": "AR"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": accommodation.latitude,
    "longitude": accommodation.longitude
  },
  "priceRange": `$${accommodation.pricePerNight}`,
  "telephone": accommodation.phone,
  "starRating": {
    "@type": "Rating",
    "ratingValue": accommodation.stars
  },
  "amenityFeature": accommodation.amenities.map(amenity => ({
    "@type": "LocationFeatureSpecification",
    "name": amenity.name
  })),
  "aggregateRating": accommodation.reviewsCount > 0 ? {
    "@type": "AggregateRating",
    "ratingValue": accommodation.averageRating,
    "reviewCount": accommodation.reviewsCount
  } : undefined
};
---

<script type="application/ld+json" set:html={JSON.stringify(accommodationSchema)} />
```markdown

### Event Schema

```astro
---
// src/pages/eventos/[slug].astro
const eventSchema = {
  "@context": "https://schema.org",
  "@type": "Event",
  "name": event.name,
  "description": event.description,
  "startDate": event.startDate,
  "endDate": event.endDate,
  "location": {
    "@type": "Place",
    "name": event.location.name,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": event.location.city,
      "addressRegion": "Entre Ríos",
      "addressCountry": "AR"
    }
  },
  "image": event.imageUrl,
  "organizer": {
    "@type": "Organization",
    "name": event.organizer.name,
    "url": event.organizer.website
  },
  "offers": {
    "@type": "Offer",
    "url": `${import.meta.env.PUBLIC_SITE_URL}/eventos/${event.slug}`,
    "price": event.price || 0,
    "priceCurrency": "ARS",
    "availability": "https://schema.org/InStock"
  }
};
---

<script type="application/ld+json" set:html={JSON.stringify(eventSchema)} />
```markdown

### Breadcrumb Schema

```astro
---
// src/components/seo/BreadcrumbSchema.astro
interface Props {
  items: Array<{ name: string; url: string }>;
}

const { items } = Astro.props;

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": items.map((item, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": item.name,
    "item": `${import.meta.env.PUBLIC_SITE_URL}${item.url}`
  }))
};
---

<script type="application/ld+json" set:html={JSON.stringify(breadcrumbSchema)} />
```text

**Usage**:

```astro
<BreadcrumbSchema
  items={[
    { name: "Inicio", url: "/" },
    { name: "Alojamientos", url: "/alojamientos" },
    { name: accommodation.name, url: `/alojamientos/${accommodation.slug}` }
  ]}
/>
```text

---

## 🗺️ Sitemap

### Generate Sitemap

```ts
// src/pages/sitemap.xml.ts
import type { APIRoute } from 'astro';
import { AccommodationService, DestinationService, EventService } from '@repo/service-core';

export const GET: APIRoute = async () => {
  const siteUrl = import.meta.env.PUBLIC_SITE_URL;

  // Fetch all dynamic content
  const accService = new AccommodationService();
  const destService = new DestinationService();
  const eventService = new EventService();

  const [accResult, destResult, eventResult] = await Promise.all([
    accService.findAll({ limit: 1000 }),
    destService.findAll({ limit: 100 }),
    eventService.findAll({ limit: 500 })
  ]);

  const accommodations = accResult.success ? accResult.data.items : [];
  const destinations = destResult.success ? destResult.data.items : [];
  const events = eventResult.success ? eventResult.data.items : [];

  // Build sitemap XML
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Static pages -->
  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${siteUrl}/alojamientos</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${siteUrl}/destinos</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${siteUrl}/eventos</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- Accommodations -->
  ${accommodations.map(acc => `
  <url>
    <loc>${siteUrl}/alojamientos/${acc.slug}</loc>
    <lastmod>${acc.updatedAt}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  `).join('')}

  <!-- Destinations -->
  ${destinations.map(dest => `
  <url>
    <loc>${siteUrl}/destinos/${dest.slug}</loc>
    <lastmod>${dest.updatedAt}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  `).join('')}

  <!-- Events -->
  ${events.map(event => `
  <url>
    <loc>${siteUrl}/eventos/${event.slug}</loc>
    <lastmod>${event.updatedAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  `).join('')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    }
  });
};
```markdown

### Submit to Search Engines

Add sitemap reference to `robots.txt`:

```text
# public/robots.txt
User-agent: *
Allow: /

Sitemap: https://hospeda.com.ar/sitemap.xml
```text

**Submit URLs**:

- Google: <https://search.google.com/search-console>
- Bing: <https://www.bing.com/webmasters>

---

## 🤖 Robots.txt

### Basic Configuration

```text
# public/robots.txt
User-agent: *
Allow: /

# Disallow specific paths
Disallow: /admin/
Disallow: /api/
Disallow: /auth/

# Crawl-delay (optional, for specific bots)
User-agent: Googlebot
Crawl-delay: 0

User-agent: Bingbot
Crawl-delay: 1

# Sitemap
Sitemap: https://hospeda.com.ar/sitemap.xml
```markdown

### Dynamic robots.txt

```ts
// src/pages/robots.txt.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const siteUrl = import.meta.env.PUBLIC_SITE_URL;
  const env = import.meta.env.MODE;

  const robotsTxt = env === 'production' ? `
User-agent: *
Allow: /

Disallow: /admin/
Disallow: /api/
Disallow: /auth/

Sitemap: ${siteUrl}/sitemap.xml
` : `
# Development - Block all crawlers
User-agent: *
Disallow: /
`;

  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
};
```text

---

## 🔗 Canonical URLs

### Purpose

Prevents duplicate content penalties by indicating the "canonical" (preferred) version of a page.

### Implementation

```astro
---
// src/layouts/MainLayout.astro
const canonicalUrl = new URL(Astro.url.pathname, import.meta.env.PUBLIC_SITE_URL);

// Remove trailing slash (if not homepage)
if (canonicalUrl.pathname !== '/' && canonicalUrl.pathname.endsWith('/')) {
  canonicalUrl.pathname = canonicalUrl.pathname.slice(0, -1);
}
---

<head>
  <link rel="canonical" href={canonicalUrl.href} />
</head>
```markdown

### Multi-language Canonical

```astro
---
// For i18n sites
const currentLang = Astro.params.lang || 'es';
const alternateLanguages = ['es', 'en'];

const canonicalUrl = new URL(Astro.url.pathname, import.meta.env.PUBLIC_SITE_URL);
---

<head>
  <!-- Canonical for current language -->
  <link rel="canonical" href={canonicalUrl.href} />

  <!-- Alternate language versions -->
  {alternateLanguages.map(lang => {
    const altUrl = new URL(
      Astro.url.pathname.replace(`/${currentLang}/`, `/${lang}/`),
      import.meta.env.PUBLIC_SITE_URL
    );
    return (
      <link
        rel="alternate"
        hreflang={lang}
        href={altUrl.href}
      />
    );
  })}

  <!-- x-default for language selector -->
  <link
    rel="alternate"
    hreflang="x-default"
    href={new URL('/', import.meta.env.PUBLIC_SITE_URL).href}
  />
</head>
```text

---

## 🖼️ Image Optimization

### Astro Image Component

```astro
---
import { Image } from 'astro:assets';
import heroImage from '../assets/hero.jpg';
---

<!-- Optimized image with lazy loading -->
<Image
  src={heroImage}
  alt="Litoral Argentino - Turismo y Alojamientos"
  width={1200}
  height={600}
  format="webp"
  quality={80}
  loading="lazy"
/>
```markdown

### Dynamic Images

```astro
---
import { Image } from 'astro:assets';

const accommodation = Astro.props.accommodation;
---

<Image
  src={accommodation.imageUrl}
  alt={`${accommodation.name} - Alojamiento en ${accommodation.destination.name}`}
  width={800}
  height={600}
  format="webp"
  quality={80}
  loading="lazy"
/>
```markdown

### Image SEO Best Practices

```astro
<!-- ✅ Good: Descriptive alt text -->
<img
  src="/hotel-panorama.jpg"
  alt="Hotel Panorama vista al río Uruguay en Concepción del Uruguay"
  width="800"
  height="600"
/>

<!-- ❌ Bad: Missing or poor alt text -->
<img src="/image1.jpg" alt="imagen" />

<!-- ✅ Good: Structured file names -->
hotel-panorama-concepcion-del-uruguay.jpg

<!-- ❌ Bad: Generic file names -->
DSC_1234.jpg
image.png
```text

---

## ⚡ Performance SEO

### Core Web Vitals

Google uses **Core Web Vitals** as ranking signals:

- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1

### Optimize Loading Performance

```astro
---
// Preload critical resources
---

<head>
  <!-- Preload critical fonts -->
  <link
    rel="preload"
    href="/fonts/inter-var.woff2"
    as="font"
    type="font/woff2"
    crossorigin
  />

  <!-- Preconnect to external domains -->
  <link rel="preconnect" href="https://images.hospeda.com.ar" />

  <!-- DNS prefetch for third-party resources -->
  <link rel="dns-prefetch" href="https://www.google-analytics.com" />
</head>
```markdown

### Defer Non-Critical JavaScript

```astro
<!-- Critical: Load immediately -->
<SearchForm client:load />

<!-- Non-critical: Defer hydration -->
<Newsletter client:idle />
<ImageGallery client:visible />
<Analytics client:only="react" />
```markdown

### Minimize CSS

```astro
<style>
  /* Inline critical CSS */
  .hero {
    @apply bg-gradient-to-r from-primary to-secondary;
  }
</style>

<!-- Defer non-critical CSS -->
<link rel="stylesheet" href="/styles/non-critical.css" media="print" onload="this.media='all'" />
```text

---

## 📝 Content SEO

### Title Optimization

```astro
<!-- ✅ Good: Descriptive, keyword-rich -->
<title>Hotel Panorama en Concepción del Uruguay - Hospeda</title>

<!-- ❌ Bad: Generic, no keywords -->
<title>Detalles | Hospeda</title>
```text

**Best Practices**:

- Keep between 50-60 characters
- Include primary keyword near the beginning
- Include location if relevant
- Add brand name at the end
- Make it unique for each page

### Description Optimization

```astro
<!-- ✅ Good: Compelling, 150-160 characters -->
<meta
  name="description"
  content="Hotel Panorama ofrece alojamiento confortable con vista al río Uruguay en Concepción del Uruguay. Reserva tu estadía con desayuno incluido."
/>

<!-- ❌ Bad: Too short or generic -->
<meta name="description" content="Hotel en Concepción" />
```markdown

### Heading Hierarchy

```astro
<!-- ✅ Good: Proper hierarchy -->
<h1>Hotel Panorama - Alojamiento en Concepción del Uruguay</h1>
  <h2>Habitaciones</h2>
    <h3>Suite Deluxe</h3>
    <h3>Habitación Doble</h3>
  <h2>Servicios</h2>
    <h3>Desayuno Incluido</h3>

<!-- ❌ Bad: Skipping levels or multiple H1s -->
<h1>Título 1</h1>
<h3>Subtítulo</h3> <!-- Skipped H2 -->
<h1>Título 2</h1> <!-- Multiple H1s -->
```markdown

### Internal Linking

```astro
---
const relatedDestinations = await getRelatedDestinations();
---

<article>
  <h1>{accommodation.name}</h1>

  <!-- Link to destination page -->
  <p>
    Ubicado en <a href={`/destinos/${accommodation.destination.slug}`}>
      {accommodation.destination.name}
    </a>
  </p>

  <!-- Link to related accommodations -->
  <section>
    <h2>Alojamientos cercanos</h2>
    {relatedDestinations.map(dest => (
      <a href={`/destinos/${dest.slug}`}>{dest.name}</a>
    ))}
  </section>
</article>
```text

---

## ✅ SEO Checklist

### Every Page Should Have

- [ ] Unique, descriptive `<title>` (50-60 chars)
- [ ] Unique `<meta name="description">` (150-160 chars)
- [ ] Canonical URL (`<link rel="canonical">`)
- [ ] Open Graph tags (`og:title`, `og:description`, `og:image`)
- [ ] Twitter Card tags
- [ ] Proper heading hierarchy (one H1, logical H2-H6)
- [ ] Alt text for all images
- [ ] Structured data (JSON-LD) where applicable
- [ ] Mobile-responsive design
- [ ] Fast loading time (< 3s)

### Site-Wide Requirements

- [ ] XML Sitemap at `/sitemap.xml`
- [ ] Robots.txt at `/robots.txt`
- [ ] 404 page
- [ ] SSL certificate (HTTPS)
- [ ] Mobile-friendly test passes
- [ ] Core Web Vitals: Good
- [ ] Internal linking structure
- [ ] Clean, semantic HTML

---

## 🚫 Common SEO Mistakes

### Mistake 1: Duplicate Titles/Descriptions

```astro
<!-- ❌ Bad: Same title for all pages -->
<title>Hospeda - Alojamientos</title>

<!-- ✅ Good: Unique titles -->
<title>{accommodation.name} - Hospeda</title>
```markdown

### Mistake 2: Missing Alt Text

```astro
<!-- ❌ Bad: No alt text -->
<img src="/hotel.jpg" />

<!-- ✅ Good: Descriptive alt -->
<img
  src="/hotel.jpg"
  alt="Hotel Panorama vista frontal con jardín"
/>
```markdown

### Mistake 3: Blocking Search Engines

```html
<!-- ❌ Bad: Prevents indexing -->
<meta name="robots" content="noindex, nofollow" />

<!-- ✅ Good: Allow indexing (or omit tag) -->
<!-- No robots meta tag = allow indexing -->
```markdown

### Mistake 4: Slow Page Speed

```astro
<!-- ❌ Bad: Loads all components immediately -->
<HeavyComponent client:load />
<BigGallery client:load />

<!-- ✅ Good: Defer non-critical hydration -->
<HeavyComponent client:visible />
<BigGallery client:idle />
```markdown

### Mistake 5: Poor URL Structure

```text
❌ Bad URLs:
/page?id=123&type=hotel
/alojamientos/1234567890

✅ Good URLs:
/alojamientos/hotel-panorama-concepcion
/destinos/concepcion-del-uruguay
```text

---

## 🔧 SEO Testing Tools

### Google Tools

- **[Google Search Console](https://search.google.com/search-console)** - Monitor indexing and performance
- **[PageSpeed Insights](https://pagespeed.web.dev/)** - Test Core Web Vitals
- **[Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)** - Check mobile compatibility
- **[Rich Results Test](https://search.google.com/test/rich-results)** - Validate structured data

### Third-Party Tools

- **[Lighthouse](https://developer.chrome.com/docs/lighthouse/)** - Comprehensive audit (built into Chrome DevTools)
- **[Screaming Frog](https://www.screamingfrog.co.uk/seo-spider/)** - Crawl website and find issues
- **[Ahrefs](https://ahrefs.com/)** - Backlink analysis and keyword research
- **[SEMrush](https://www.semrush.com/)** - Competitor analysis and SEO audit

### Local Testing

```bash
# Run Lighthouse in CLI
npx lighthouse https://hospeda.com.ar --view

# Check specific page
npx lighthouse https://hospeda.com.ar/alojamientos/hotel-test --view

# Generate report
npx lighthouse https://hospeda.com.ar --output=html --output-path=./lighthouse-report.html
```

---

## 📖 Additional Resources

### Internal Documentation

- **[Performance Guide](performance.md)** - Optimize page speed
- **[Creating Pages](creating-pages.md)** - SEO-friendly page structure
- **[i18n Guide](i18n.md)** - Multi-language SEO

### External Resources

- **[Google Search Central](https://developers.google.com/search)** - Official SEO guidelines
- **[Astro SEO Guide](https://docs.astro.build/en/guides/integrations-guide/sitemap/)** - Astro-specific SEO
- **[Schema.org](https://schema.org/)** - Structured data reference
- **[Moz SEO Guide](https://moz.com/beginners-guide-to-seo)** - Comprehensive SEO tutorial

---

⬅️ Back to [Development Guide](README.md)
