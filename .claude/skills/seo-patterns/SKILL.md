---
name: seo-patterns
description: SEO optimization patterns for web applications. Use when adding structured data, meta tags, Open Graph, sitemaps, or optimizing Core Web Vitals.
---

# SEO Patterns

## Purpose

Search engine optimization patterns for web applications. Covers structured data (JSON-LD), meta tags, Open Graph protocol, sitemaps, robots.txt, canonical URLs, and Core Web Vitals optimization.

## Activation

Use this skill when the user asks about:

- SEO best practices
- Meta tags and Open Graph
- Structured data / JSON-LD / Schema.org
- Sitemaps and robots.txt
- Core Web Vitals optimization
- Social media sharing previews
- Search engine indexing

## Meta Tags

### Essential Meta Tags

```html
<head>
  <!-- Primary -->
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Page Title - Site Name</title>
  <meta name="description" content="Compelling description under 155 characters that includes target keywords naturally." />

  <!-- Canonical URL (prevents duplicate content) -->
  <link rel="canonical" href="https://example.com/page" />

  <!-- Language alternatives -->
  <link rel="alternate" hreflang="en" href="https://example.com/en/page" />
  <link rel="alternate" hreflang="es" href="https://example.com/es/page" />
  <link rel="alternate" hreflang="x-default" href="https://example.com/page" />

  <!-- Robots -->
  <meta name="robots" content="index, follow" />
  <!-- Or for pages that should not be indexed: -->
  <!-- <meta name="robots" content="noindex, nofollow" /> -->

  <!-- Favicon -->
  <link rel="icon" href="/favicon.ico" sizes="32x32" />
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
</head>
```

### Next.js Metadata API

```typescript
// app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://example.com"),
  title: {
    template: "%s | MyApp",
    default: "MyApp - Build Something Great",
  },
  description: "A comprehensive platform for building modern web apps.",
  keywords: ["web development", "react", "nextjs"],
  authors: [{ name: "Author Name" }],
  creator: "Company Name",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
    languages: {
      "en-US": "/en",
      "es-ES": "/es",
    },
  },
};

// app/blog/[slug]/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug);

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.publishedAt,
      authors: [post.author.name],
      images: [
        {
          url: post.coverImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
  };
}
```

## Open Graph Protocol

### Open Graph Tags

```html
<!-- Basic Open Graph -->
<meta property="og:type" content="website" />
<meta property="og:url" content="https://example.com/page" />
<meta property="og:title" content="Page Title" />
<meta property="og:description" content="Page description for social sharing." />
<meta property="og:image" content="https://example.com/og-image.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Description of the image" />
<meta property="og:site_name" content="Site Name" />
<meta property="og:locale" content="en_US" />
<meta property="og:locale:alternate" content="es_ES" />

<!-- Article type (blog posts) -->
<meta property="og:type" content="article" />
<meta property="article:published_time" content="2024-07-15T00:00:00Z" />
<meta property="article:modified_time" content="2024-07-20T00:00:00Z" />
<meta property="article:author" content="https://example.com/authors/jane" />
<meta property="article:section" content="Technology" />
<meta property="article:tag" content="React" />
<meta property="article:tag" content="Next.js" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@company" />
<meta name="twitter:creator" content="@author" />
<meta name="twitter:title" content="Page Title" />
<meta name="twitter:description" content="Page description for Twitter." />
<meta name="twitter:image" content="https://example.com/twitter-card.jpg" />
<meta name="twitter:image:alt" content="Description of the image" />
```

### OG Image Best Practices

| Platform | Recommended Size | Aspect Ratio |
|---|---|---|
| Open Graph (Facebook, LinkedIn) | 1200 x 630 px | 1.91:1 |
| Twitter (summary_large_image) | 1200 x 628 px | ~1.91:1 |
| Twitter (summary) | 240 x 240 px | 1:1 |

Guidelines:

- Use `.jpg` or `.png` (not `.webp` for OG images)
- Keep text large and readable at small sizes
- Keep file size under 1MB
- Include brand logo or name
- Use high-contrast colors

### Dynamic OG Images (Next.js)

```typescript
// app/api/og/route.tsx
import { ImageResponse } from "next/og";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "Default Title";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          color: "white",
          fontFamily: "Inter",
        }}
      >
        <h1 style={{ fontSize: 64, margin: 0 }}>{title}</h1>
        <p style={{ fontSize: 28, color: "#888" }}>example.com</p>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

## Structured Data (JSON-LD)

### Organization

```typescript
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Company Name",
  url: "https://example.com",
  logo: "https://example.com/logo.png",
  sameAs: [
    "https://twitter.com/company",
    "https://linkedin.com/company/company",
    "https://github.com/company",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+1-555-555-5555",
    contactType: "customer service",
    availableLanguage: ["English", "Spanish"],
  },
};
```

### Article / Blog Post

```typescript
const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Article Title",
  description: "Article description",
  image: "https://example.com/article-image.jpg",
  datePublished: "2024-07-15T00:00:00Z",
  dateModified: "2024-07-20T00:00:00Z",
  author: {
    "@type": "Person",
    name: "Jane Doe",
    url: "https://example.com/authors/jane",
  },
  publisher: {
    "@type": "Organization",
    name: "Company Name",
    logo: {
      "@type": "ImageObject",
      url: "https://example.com/logo.png",
    },
  },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": "https://example.com/blog/article-slug",
  },
};
```

### Product

```typescript
const productSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Product Name",
  image: "https://example.com/product.jpg",
  description: "Product description",
  brand: {
    "@type": "Brand",
    name: "Brand Name",
  },
  offers: {
    "@type": "Offer",
    url: "https://example.com/products/slug",
    priceCurrency: "USD",
    price: "49.99",
    availability: "https://schema.org/InStock",
    seller: {
      "@type": "Organization",
      name: "Company Name",
    },
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.5",
    reviewCount: "127",
  },
};
```

### FAQ Page

```typescript
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is your return policy?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We offer a 30-day money-back guarantee on all products.",
      },
    },
    {
      "@type": "Question",
      name: "How long does shipping take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Standard shipping takes 5-7 business days. Express shipping is 1-2 business days.",
      },
    },
  ],
};
```

### Breadcrumb

```typescript
const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://example.com",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Blog",
      item: "https://example.com/blog",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Article Title",
      item: "https://example.com/blog/article-slug",
    },
  ],
};
```

### Injecting JSON-LD in Next.js

```tsx
function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// Usage in page
export default function BlogPost({ post }: { post: Post }) {
  return (
    <>
      <JsonLd data={articleSchema} />
      <article>
        <h1>{post.title}</h1>
        {/* ... */}
      </article>
    </>
  );
}
```

## Sitemap

### Static Sitemap

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com</loc>
    <lastmod>2024-07-20</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/about</loc>
    <lastmod>2024-06-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/blog</loc>
    <lastmod>2024-07-20</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
```

### Dynamic Sitemap (Next.js)

```typescript
// app/sitemap.ts
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts();

  const blogEntries = posts.map((post) => ({
    url: `https://example.com/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: "https://example.com",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://example.com/about",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...blogEntries,
  ];
}
```

## robots.txt

### Standard Configuration

```
# robots.txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /private/
Disallow: /_next/
Disallow: /search?*

# Sitemaps
Sitemap: https://example.com/sitemap.xml
```

### Next.js robots.ts

```typescript
// app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/private/"],
      },
      {
        userAgent: "GPTBot",
        disallow: "/",              // Block AI crawlers if desired
      },
    ],
    sitemap: "https://example.com/sitemap.xml",
  };
}
```

## Core Web Vitals Optimization

### Key Metrics

| Metric | Good | Needs Improvement | Poor |
|---|---|---|---|
| **LCP** (Largest Contentful Paint) | < 2.5s | 2.5s - 4.0s | > 4.0s |
| **INP** (Interaction to Next Paint) | < 200ms | 200ms - 500ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | < 0.1 | 0.1 - 0.25 | > 0.25 |

### LCP Optimization

```tsx
// 1. Preload hero image
<link rel="preload" as="image" href="/hero.webp" fetchPriority="high" />

// 2. Priority hints for above-the-fold images
<Image
  src="/hero.webp"
  alt="Hero"
  width={1200}
  height={600}
  priority              // Next.js: adds fetchpriority="high" and preload
  sizes="100vw"
/>

// 3. Avoid lazy loading above-the-fold content
// BAD: loading="lazy" on hero image
// GOOD: loading="lazy" only on below-the-fold images

// 4. Use modern formats
<picture>
  <source srcSet="/image.avif" type="image/avif" />
  <source srcSet="/image.webp" type="image/webp" />
  <img src="/image.jpg" alt="Fallback" />
</picture>
```

### CLS Prevention

```tsx
// 1. Always set width/height or aspect-ratio on images
<Image src="/photo.jpg" alt="" width={800} height={600} />

// 2. Reserve space for dynamic content
<div style={{ minHeight: "300px" }}>
  {isLoading ? <Skeleton /> : <Content />}
</div>

// 3. Avoid inserting content above existing content
// BAD: Banner that pushes content down after load
// GOOD: Reserve space or use overlay

// 4. Use CSS contain for layout stability
.sidebar {
  contain: layout;
}

// 5. Set explicit dimensions on embeds/iframes
<iframe width="560" height="315" src="..." />
```

### INP Optimization

```typescript
// 1. Defer non-critical JavaScript
<script src="/analytics.js" defer />

// 2. Use web workers for heavy computation
const worker = new Worker("/heavy-task.js");
worker.postMessage(data);

// 3. Break up long tasks
async function processItems(items: Item[]) {
  for (const item of items) {
    await processItem(item);
    // Yield to main thread
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// 4. Use startTransition for non-urgent updates
import { startTransition } from "react";
startTransition(() => {
  setSearchResults(results);  // Low priority update
});
```

## SEO Checklist

- [ ] Unique `<title>` per page (50-60 characters)
- [ ] Unique `<meta description>` per page (120-155 characters)
- [ ] Canonical URLs on all pages
- [ ] Open Graph tags for social sharing
- [ ] Twitter Card tags
- [ ] JSON-LD structured data for relevant content types
- [ ] sitemap.xml submitted to Google Search Console
- [ ] robots.txt configured correctly
- [ ] All images have descriptive `alt` text
- [ ] Heading hierarchy (single `<h1>`, logical `<h2>`-`<h6>` nesting)
- [ ] Internal linking between related pages
- [ ] Mobile-responsive design
- [ ] HTTPS everywhere
- [ ] Fast loading (LCP < 2.5s)
- [ ] No layout shifts (CLS < 0.1)
- [ ] Responsive to interaction (INP < 200ms)
- [ ] `hreflang` tags for multi-language sites
- [ ] 404 page returns proper HTTP status code
- [ ] Redirects use 301 for permanent, 308 for permanent with method preservation
