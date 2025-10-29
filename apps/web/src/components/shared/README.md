# FavoriteButton Component

A reusable favorite/bookmark button that works with any entity type. Handles API calls and optimistic updates.

## Features

- ✅ **Reusable**: Works with any entity type (ACCOMMODATION, DESTINATION, EVENT, POST, USER)
- ✅ **Optimistic updates**: UI responds immediately
- ✅ **Loading states**: Visual feedback during API calls
- ✅ **Error handling**: Graceful fallback if API fails
- ✅ **Accessibility**: Proper ARIA labels and keyboard support
- ✅ **TypeScript**: Fully typed with proper interfaces

## Usage

### Basic Usage

```astro
---
import { FavoriteButton } from '@/components/shared/FavoriteButton.client';
---

<FavoriteButton 
    client:only
    entityId="123"
    entityType="ACCOMMODATION"
    initialBookmarked={false}
    size={20}
/>
```

### With Callback

```astro
<FavoriteButton 
    client:only
    entityId={accommodation.id}
    entityType="ACCOMMODATION"
    initialBookmarked={accommodation.isBookmarked}
    size={24}
    onToggle={(bookmarked) => {
        console.log(`Accommodation ${accommodation.id} ${bookmarked ? 'bookmarked' : 'unbookmarked'}`);
        // Could trigger analytics, notifications, etc.
    }}
/>
```

### Disabled State

```astro
<FavoriteButton 
    client:only
    entityId="123"
    entityType="DESTINATION"
    disabled={true}
    size={20}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `entityId` | `string` | **Required** | The ID of the entity to bookmark |
| `entityType` | `'ACCOMMODATION' \| 'DESTINATION' \| 'EVENT' \| 'POST' \| 'USER'` | **Required** | Type of entity |
| `initialBookmarked` | `boolean` | `false` | Initial bookmark state |
| `size` | `number` | `24` | Icon size in pixels |
| `onToggle` | `(bookmarked: boolean) => void` | `undefined` | Callback when bookmark state changes |
| `disabled` | `boolean` | `false` | Whether the button is disabled |

## API Integration

The component calls the `/api/bookmarks` endpoint with the following payload:

```typescript
{
  entityId: string;
  entityType: 'ACCOMMODATION' | 'DESTINATION' | 'EVENT' | 'POST' | 'USER';
  action: 'ADD' | 'REMOVE';
}
```

## Examples by Entity Type

### Accommodation

```astro
<FavoriteButton 
    client:only
    entityId={accommodation.id}
    entityType="ACCOMMODATION"
    initialBookmarked={accommodation.isBookmarked}
/>
```

### Destination

```astro
<FavoriteButton 
    client:only
    entityId={destination.id}
    entityType="DESTINATION"
    initialBookmarked={destination.isBookmarked}
/>
```

### Event

```astro
<FavoriteButton 
    client:only
    entityId={event.id}
    entityType="EVENT"
    initialBookmarked={event.isBookmarked}
/>
```

### Post

```astro
<FavoriteButton 
    client:only
    entityId={post.id}
    entityType="POST"
    initialBookmarked={post.isBookmarked}
/>
```

## Styling

The component uses Tailwind CSS classes and includes:

- **Default state**: Gray outline heart
- **Bookmarked state**: Red filled heart
- **Hover effects**: Color transitions
- **Loading state**: Opacity reduction
- **Disabled state**: Cursor not-allowed

## Accessibility

- Proper `aria-label` that changes based on state
- Keyboard navigation support
- Screen reader friendly with loading announcements
- Focus management

## Error Handling

If the API call fails:

1. The optimistic update is reverted
2. An error is logged to console
3. The user can try again
4. Future enhancement: Show toast notification

## Future Enhancements

- [ ] Toast notifications for success/error states
- [ ] Clerk authentication integration
- [ ] Offline support with queue
- [ ] Bulk operations
- [ ] Animation effects
