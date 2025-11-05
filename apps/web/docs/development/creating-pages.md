# Creating Pages Tutorial

Step-by-step tutorial for creating a new page in Hospeda Web App.

---

## 📖 Tutorial Overview

This tutorial will walk you through creating an **Event Detail Page** from scratch.

**What you'll learn**:

- File-based routing
- Data fetching
- Layout integration
- SEO optimization
- Testing pages

**Time**: ~20 minutes

---

## 🎯 Goal

Create a page that displays event details at `/eventos/[slug]`

**Features**:

- Dynamic route with slug parameter
- Fetch event data from service
- Display event information
- SEO-optimized
- Responsive design

---

## Step 1: Create the Page File

### Location

```bash
src/pages/eventos/[slug].astro
```

### Initial File

Create the file with basic structure:

```astro
---
// src/pages/eventos/[slug].astro
import MainLayout from '../../layouts/MainLayout.astro';

const { slug } = Astro.params;
---

<MainLayout title="Event">
  <h1>Event: {slug}</h1>
</MainLayout>
```

**Test**: Visit `http://localhost:4321/eventos/test-event`

**Expected**: Page displays "Event: test-event"

---

## Step 2: Add getStaticPaths

### Import Service

```astro
---
import type { GetStaticPaths } from 'astro';
import { EventService } from '@repo/service-core';
import MainLayout from '../../layouts/MainLayout.astro';

export const getStaticPaths = (async () => {
  const service = new EventService();
  const result = await service.findAll();

  if (!result.success) {
    return [];
  }

  return result.data.items.map(event => ({
    params: { slug: event.slug },
    props: { event }
  }));
}) satisfies GetStaticPaths;

const { slug } = Astro.params;
const { event } = Astro.props;
---

<MainLayout title={event.name}>
  <h1>{event.name}</h1>
</MainLayout>
```

**What this does**:

- Fetches all events at build time
- Generates a static page for each event
- Passes event data as prop

---

## Step 3: Display Event Information

### Add Event Details

```astro
---
// ... previous code ...
import { formatDate } from '@repo/utils';
---

<MainLayout title={event.name} description={event.description}>
  <article class="event-detail">
    <!-- Header -->
    <header>
      <h1 class="text-4xl font-bold">{event.name}</h1>

      <div class="event-meta">
        <time datetime={event.startDate}>
          {formatDate(event.startDate)}
        </time>
        <span class="location">{event.location}</span>
      </div>
    </header>

    <!-- Main Image -->
    {event.imageUrl && (
      <img
        src={event.imageUrl}
        alt={event.name}
        class="event-image"
      />
    )}

    <!-- Description -->
    <section class="description">
      <h2>About this Event</h2>
      <p>{event.description}</p>
    </section>

    <!-- Details -->
    <section class="details">
      <h3>Event Details</h3>
      <dl>
        <dt>Date & Time</dt>
        <dd>{formatDate(event.startDate)} - {formatDate(event.endDate)}</dd>

        <dt>Location</dt>
        <dd>{event.location}</dd>

        {event.price && (
          <>
            <dt>Price</dt>
            <dd>${event.price}</dd>
          </>
        )}
      </dl>
    </section>
  </article>
</MainLayout>

<style>
  .event-detail {
    @apply max-w-4xl mx-auto px-4 py-8;
  }

  .event-meta {
    @apply flex gap-4 text-gray-600 mt-2;
  }

  .event-image {
    @apply w-full rounded-lg shadow-md my-8;
  }

  .description {
    @apply my-8;
  }

  .details dl {
    @apply grid grid-cols-1 md:grid-cols-2 gap-4;
  }

  .details dt {
    @apply font-semibold;
  }
</style>
```

---

## Step 4: Add SEO Optimization

### Enhanced Meta Tags

```astro
---
// ... previous code ...
const canonicalUrl = `${import.meta.env.PUBLIC_SITE_URL}/eventos/${event.slug}`;
---

<MainLayout
  title={event.name}
  description={event.description}
  image={event.imageUrl}
>
  <Fragment slot="head">
    <!-- Canonical URL -->
    <link rel="canonical" href={canonicalUrl} />

    <!-- Open Graph -->
    <meta property="og:title" content={event.name} />
    <meta property="og:description" content={event.description} />
    <meta property="og:image" content={event.imageUrl} />
    <meta property="og:url" content={canonicalUrl} />
    <meta property="og:type" content="event" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={event.name} />
    <meta name="twitter:description" content={event.description} />
    <meta name="twitter:image" content={event.imageUrl} />

    <!-- Structured Data (JSON-LD) -->
    <script type="application/ld+json" set:html={JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Event",
      "name": event.name,
      "description": event.description,
      "startDate": event.startDate,
      "endDate": event.endDate,
      "location": {
        "@type": "Place",
        "name": event.location
      },
      "image": event.imageUrl,
      "url": canonicalUrl
    })} />
  </Fragment>

  <!-- ... page content ... -->
</MainLayout>
```

---

## Step 5: Add Interactive Features

### Booking Button (React Island)

Create React component:

```tsx
// src/components/event/BookingButton.tsx
import { useState } from 'react';

interface BookingButtonProps {
  eventId: string;
  eventName: string;
}

export function BookingButton({ eventId, eventName }: BookingButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleBooking = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId })
      });

      if (response.ok) {
        window.location.href = '/bookings/success';
      }
    } catch (error) {
      alert('Booking failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleBooking}
      disabled={loading}
      className="btn-primary"
    >
      {loading ? 'Booking...' : 'Book Now'}
    </button>
  );
}
```

Use in page:

```astro
---
import { BookingButton } from '../../components/event/BookingButton';
// ... rest of imports ...
---

<MainLayout ...>
  <!-- ... event details ... -->

  <!-- Interactive booking button -->
  <BookingButton
    client:load
    eventId={event.id}
    eventName={event.name}
  />
</MainLayout>
```

---

## Step 6: Error Handling

### Handle Missing Events

```astro
---
export const getStaticPaths = (async () => {
  const service = new EventService();
  const result = await service.findAll();

  if (!result.success) {
    console.error('Failed to fetch events:', result.error);
    return [];
  }

  return result.data.items.map(event => ({
    params: { slug: event.slug },
    props: { event }
  }));
}) satisfies GetStaticPaths;

const { event } = Astro.props;

// Redirect if event not found
if (!event) {
  return Astro.redirect('/404');
}
---
```

---

## Step 7: Add Related Events

### Fetch and Display Related Events

```astro
---
// ... previous code ...

// Fetch related events
const service = new EventService();
const relatedResult = await service.findAll({
  filters: { category: event.category },
  limit: 3
});

const relatedEvents = relatedResult.success
  ? relatedResult.data.items.filter(e => e.id !== event.id).slice(0, 3)
  : [];
---

<MainLayout ...>
  <!-- ... event details ... -->

  <!-- Related Events -->
  {relatedEvents.length > 0 && (
    <section class="related-events">
      <h2>Related Events</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        {relatedEvents.map(relatedEvent => (
          <EventCard event={relatedEvent} />
        ))}
      </div>
    </section>
  )}
</MainLayout>
```

---

## Step 8: Testing

### Manual Testing

1. **Development server**:

   ```bash
   pnpm dev
   ```

2. **Test pages**:
   - Visit `/eventos/test-slug`
   - Check all event details display correctly
   - Test booking button interaction
   - Verify related events appear

3. **Test responsive**:
   - Test on mobile viewport (DevTools)
   - Test on tablet viewport
   - Test on desktop

### Build Testing

```bash
# Build for production
pnpm build

# Preview production build
pnpm preview
```

**Check**:

- All event pages generated
- No build errors
- Pages load quickly

---

## 📊 Complete Example

### Final File

```astro
---
// src/pages/eventos/[slug].astro
import type { GetStaticPaths } from 'astro';
import { EventService } from '@repo/service-core';
import { formatDate } from '@repo/utils';
import MainLayout from '../../layouts/MainLayout.astro';
import { BookingButton } from '../../components/event/BookingButton';
import EventCard from '../../components/event/EventCard.astro';

export const getStaticPaths = (async () => {
  const service = new EventService();
  const result = await service.findAll();

  if (!result.success) {
    console.error('Failed to fetch events:', result.error);
    return [];
  }

  return result.data.items.map(event => ({
    params: { slug: event.slug },
    props: { event }
  }));
}) satisfies GetStaticPaths;

const { event } = Astro.props;

if (!event) {
  return Astro.redirect('/404');
}

// Related events
const service = new EventService();
const relatedResult = await service.findAll({
  filters: { category: event.category },
  limit: 4
});
const relatedEvents = relatedResult.success
  ? relatedResult.data.items.filter(e => e.id !== event.id).slice(0, 3)
  : [];

const canonicalUrl = `${import.meta.env.PUBLIC_SITE_URL}/eventos/${event.slug}`;
---

<MainLayout title={event.name} description={event.description}>
  <Fragment slot="head">
    <link rel="canonical" href={canonicalUrl} />
    <meta property="og:title" content={event.name} />
    <meta property="og:description" content={event.description} />
    <meta property="og:image" content={event.imageUrl} />
    <meta property="og:url" content={canonicalUrl} />

    <script type="application/ld+json" set:html={JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Event",
      "name": event.name,
      "description": event.description,
      "startDate": event.startDate,
      "endDate": event.endDate,
      "location": {
        "@type": "Place",
        "name": event.location
      },
      "image": event.imageUrl,
      "url": canonicalUrl
    })} />
  </Fragment>

  <article class="event-detail">
    <header>
      <h1 class="text-4xl font-bold">{event.name}</h1>
      <div class="event-meta">
        <time datetime={event.startDate}>
          {formatDate(event.startDate)}
        </time>
        <span class="location">{event.location}</span>
      </div>
    </header>

    {event.imageUrl && (
      <img
        src={event.imageUrl}
        alt={event.name}
        class="event-image"
      />
    )}

    <section class="description">
      <h2>About this Event</h2>
      <p>{event.description}</p>
    </section>

    <section class="details">
      <h3>Event Details</h3>
      <dl>
        <dt>Date & Time</dt>
        <dd>{formatDate(event.startDate)} - {formatDate(event.endDate)}</dd>

        <dt>Location</dt>
        <dd>{event.location}</dd>

        {event.price && (
          <>
            <dt>Price</dt>
            <dd>${event.price}</dd>
          </>
        )}
      </dl>
    </section>

    <div class="booking-section">
      <BookingButton
        client:load
        eventId={event.id}
        eventName={event.name}
      />
    </div>

    {relatedEvents.length > 0 && (
      <section class="related-events">
        <h2>Related Events</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          {relatedEvents.map(relatedEvent => (
            <EventCard event={relatedEvent} />
          ))}
        </div>
      </section>
    )}
  </article>
</MainLayout>

<style>
  .event-detail {
    @apply max-w-4xl mx-auto px-4 py-8;
  }

  .event-meta {
    @apply flex gap-4 text-gray-600 mt-2;
  }

  .event-image {
    @apply w-full rounded-lg shadow-md my-8;
  }

  .description {
    @apply my-8;
  }

  .details dl {
    @apply grid grid-cols-1 md:grid-cols-2 gap-4;
  }

  .details dt {
    @apply font-semibold;
  }

  .booking-section {
    @apply my-8;
  }

  .related-events {
    @apply mt-12 pt-8 border-t;
  }
</style>
```

---

## ✅ Checklist

Before considering the page complete, verify:

- [ ] File created in correct location
- [ ] `getStaticPaths` implemented
- [ ] Data fetching works
- [ ] Layout integration complete
- [ ] SEO meta tags added
- [ ] Structured data added
- [ ] Interactive features work
- [ ] Error handling implemented
- [ ] Responsive design tested
- [ ] Build succeeds
- [ ] No TypeScript errors
- [ ] No accessibility issues

---

## 🎓 Key Takeaways

1. **File location determines URL** - `src/pages/eventos/[slug].astro` → `/eventos/:slug`
2. **`getStaticPaths` is required** for dynamic routes in SSG mode
3. **Layouts provide consistency** - Use layouts for all pages
4. **SEO is critical** - Always add meta tags and structured data
5. **Islands for interactivity** - Use React only where needed
6. **Test thoroughly** - Development and production builds

---

## 📖 Next Steps

- **[Component Organization](components.md)** - Organize reusable components
- **[Styling Guide](styling.md)** - Style your pages with Tailwind
- **[Pages & Routing](pages.md)** - Advanced routing patterns

---

⬅️ Back to [Development Guide](README.md)
