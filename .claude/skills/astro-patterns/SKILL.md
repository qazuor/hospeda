---
name: astro-patterns
description: Astro patterns for island architecture, routing, content collections, and SSR/SSG. Use when building content-driven websites with Astro.
---

# Astro Framework Patterns

## Purpose

Provide patterns for building content-driven websites with Astro, including island architecture, file-based routing, content collections, view transitions, SSR/SSG strategies, and integration with UI frameworks like React, Vue, and Svelte.

## Project Structure

```
src/
  components/       # Astro and framework components
  content/          # Content collections (Markdown/MDX)
    blog/
      post-1.md
    config.ts        # Collection schemas
  layouts/          # Page layouts
  pages/            # File-based routing
    index.astro
    blog/
      [slug].astro
  styles/           # Global styles
  utils/            # Utility functions
astro.config.mjs
```

## Island Architecture

Interactive components are hydrated selectively using client directives:

```astro
---
// page.astro
import StaticHeader from "../components/Header.astro";
import SearchBar from "../components/SearchBar.tsx";
import Newsletter from "../components/Newsletter.tsx";
import Analytics from "../components/Analytics.tsx";
---

<!-- No JS shipped (static) -->
<StaticHeader />

<!-- Hydrated on page load -->
<SearchBar client:load />

<!-- Hydrated when visible in viewport -->
<Newsletter client:visible />

<!-- Hydrated when browser is idle -->
<Analytics client:idle />

<!-- Hydrated only on specific media query -->
<MobileMenu client:media="(max-width: 768px)" />
```

## Content Collections

### Schema Definition

```typescript
// src/content/config.ts
import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const authors = defineCollection({
  type: "data",
  schema: z.object({
    name: z.string(),
    bio: z.string(),
    avatar: z.string(),
  }),
});

export const collections = { blog, authors };
```

### Querying Collections

```astro
---
// src/pages/blog/index.astro
import { getCollection } from "astro:content";

const posts = await getCollection("blog", ({ data }) => !data.draft);
const sortedPosts = posts.sort(
  (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
);
---

<ul>
  {sortedPosts.map((post) => (
    <li>
      <a href={`/blog/${post.slug}`}>
        <h2>{post.data.title}</h2>
        <time datetime={post.data.pubDate.toISOString()}>
          {post.data.pubDate.toLocaleDateString()}
        </time>
      </a>
    </li>
  ))}
</ul>
```

### Dynamic Routes

```astro
---
// src/pages/blog/[slug].astro
import { getCollection } from "astro:content";

export async function getStaticPaths() {
  const posts = await getCollection("blog");
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await post.render();
---

<article>
  <h1>{post.data.title}</h1>
  <Content />
</article>
```

## View Transitions

```astro
---
// src/layouts/BaseLayout.astro
import { ViewTransitions } from "astro:transitions";
---

<html>
  <head>
    <ViewTransitions />
  </head>
  <body>
    <nav transition:persist>
      <a href="/">Home</a>
      <a href="/blog">Blog</a>
    </nav>
    <main transition:animate="slide">
      <slot />
    </main>
  </body>
</html>
```

## API Routes (SSR)

```typescript
// src/pages/api/search.ts
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get("q");
  if (!query) {
    return new Response(JSON.stringify({ error: "Query required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results = await searchContent(query);
  return new Response(JSON.stringify({ data: results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const result = await createEntry(body);
  return new Response(JSON.stringify({ data: result }), { status: 201 });
};
```

## Middleware

```typescript
// src/middleware.ts
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const start = Date.now();

  // Add data to locals (available in components)
  context.locals.requestId = crypto.randomUUID();

  const response = await next();

  // Modify response headers
  response.headers.set("X-Response-Time", `${Date.now() - start}ms`);
  return response;
});
```

## Integration Configuration

```javascript
// astro.config.mjs
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://example.com",
  output: "hybrid",
  integrations: [react(), tailwind(), mdx(), sitemap()],
  markdown: {
    shikiConfig: { theme: "github-dark" },
  },
});
```

## Best Practices

- Use `client:visible` as the default hydration directive for below-the-fold components
- Use `client:load` only for components that must be interactive immediately
- Define strict Zod schemas for all content collections
- Filter drafts in collection queries: `getCollection("blog", ({ data }) => !data.draft)`
- Use `transition:persist` for elements that should survive page navigations
- Use `output: "hybrid"` to mix static and server-rendered pages
- Place reusable Astro components in `src/components/` and layouts in `src/layouts/`
- Use API routes for server-side logic; return proper HTTP status codes
- Use middleware for cross-cutting concerns (logging, auth, request IDs)
- Prefer `.astro` components for static content; use framework components only when interactivity is needed
