# Debugging & DevTools Guide

Complete guide to debugging and development tools for the Hospeda Admin Dashboard.

---

## 📖 Overview

Effective debugging is crucial for development productivity. This guide covers all the tools and techniques available for debugging TanStack Start applications, from browser DevTools to framework-specific debugging utilities.

**What you'll learn:**

- TanStack Router DevTools
- TanStack Query DevTools
- React DevTools
- Chrome DevTools for SSR debugging
- Debugging SSR vs client-side code
- Common error patterns and solutions
- Performance profiling
- Network debugging
- Console debugging techniques
- VS Code debugging setup

**Prerequisites:**

- Basic understanding of JavaScript debugging
- Familiarity with browser DevTools
- Read [Architecture Overview](../architecture.md)

---

## 🎯 Quick Start

### Enable DevTools

DevTools are automatically enabled in development:

```tsx
// src/routes/__root.tsx
import { TanstackDevtools } from '@tanstack/react-devtools';

export const Route = createRootRoute({
  component: () => (
    <RootDocument>
      <Outlet />
      {process.env.NODE_ENV === 'development' && <TanstackDevtools />}
    </RootDocument>
  ),
});
```

### Quick Debugging

```tsx
// Add console.log for quick debugging
export function MyComponent() {
  console.log('[MyComponent] Rendering');

  const data = useQuery({
    queryKey: ['data'],
    queryFn: fetchData,
  });

  console.log('[MyComponent] Query state:', data);

  return <div>{data.data?.name}</div>;
}
```

---

## 🔍 TanStack Router DevTools

### Overview

TanStack Router DevTools provides real-time inspection of:

- Current route and parameters
- Route tree structure
- Search params
- Loader data
- Navigation history

### Opening DevTools

**Floating button:**

- Click the TanStack logo in the bottom-right corner
- Or press `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac)

### Features

**Route Explorer:**

```text
View current route:
- Path: /accommodations/123/edit
- Params: { id: '123' }
- Search: { tab: 'details' }
- Loader data: { accommodation: {...} }
```

**Route Tree:**

```text
See all registered routes:
└── __root
    ├── index (/)
    ├── auth/
    │   ├── signin
    │   └── signup
    └── _authed/
        ├── dashboard
        └── accommodations/
            ├── index
            ├── $id
            └── $id/edit
```

**Navigation History:**

```text
Track navigation:
1. / → /auth/signin
2. /auth/signin → /dashboard
3. /dashboard → /accommodations
4. /accommodations → /accommodations/123
```

### Debugging Routes

**Check if route is registered:**

```tsx
// If route doesn't load, check DevTools
// Make sure file path matches route definition
```

**Inspect route data:**

```tsx
// View loader data in DevTools
export const Route = createFileRoute('/accommodations/$id')({
  loader: async ({ params }) => {
    const accommodation = await getAccommodation(params.id);
    // Check in DevTools: Route > Loader Data
    return { accommodation };
  },
  component: AccommodationDetail,
});
```

**Debug navigation issues:**

```tsx
// Check Navigation History in DevTools
// See why navigation didn't work
navigate({
  to: '/accommodations/$id',
  params: { id: accommodationId },
});
// DevTools will show if navigation was blocked or redirected
```

---

## 📊 TanStack Query DevTools

### Overview

TanStack Query DevTools shows:

- All queries and their state
- Query cache contents
- Mutation status
- Refetch triggers
- Stale/fresh status

### Opening DevTools

**Integrated with Router DevTools:**

- Open Router DevTools
- Switch to "Query" tab

### Features

**Query Inspector:**

```text
View query details:
- Query Key: ['accommodations', '123']
- Status: success | loading | error
- Data: { accommodation: {...} }
- Last Updated: 2 minutes ago
- Is Stale: false
- Observers: 1
```

**Cache Explorer:**

```text
See all cached queries:
├── ['accommodations'] (list)
├── ['accommodations', '123'] (detail)
├── ['users', 'me'] (current user)
└── ['settings'] (app settings)
```

**Mutation Tracker:**

```text
Track mutations:
- updateAccommodation
  Status: idle
  Last run: 30 seconds ago
  Result: success
```

### Debugging Queries

**Check query status:**

```tsx
export function AccommodationDetail() {
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['accommodations', id],
    queryFn: () => getAccommodation(id),
  });

  // Open Query DevTools to see:
  // - Why query is loading
  // - If query is cached
  // - When data was last updated
  // - If query is stale

  return <div>{data?.name}</div>;
}
```

**Debug cache invalidation:**

```tsx
const mutation = useMutation({
  mutationFn: updateAccommodation,
  onSuccess: () => {
    // Check DevTools to see if cache was invalidated
    queryClient.invalidateQueries({ queryKey: ['accommodations'] });
  },
});

// DevTools will show:
// - Which queries were invalidated
// - Which queries refetched
// - New data in cache
```

**Inspect refetch behavior:**

```tsx
const { data, refetch } = useQuery({
  queryKey: ['accommodations'],
  queryFn: getAccommodations,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// DevTools will show:
// - When query becomes stale
// - Automatic refetch triggers (window focus, reconnect)
// - Manual refetch calls
```

---

## ⚛️ React DevTools

### Installation

**Browser Extension:**

- Chrome: [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
- Firefox: [React Developer Tools](https://addons.mozilla.org/en-US/firefox/addon/react-devtools/)

### Features

**Component Tree:**

```text
View component hierarchy:
└── App
    ├── ClerkProvider
    │   └── QueryClientProvider
    │       └── AuthedLayout
    │           ├── Header
    │           ├── Sidebar
    │           └── AccommodationDetail
    │               ├── AccommodationInfo
    │               └── EditButton
```

**Props Inspector:**

```tsx
// Click component in DevTools to see props
<AccommodationDetail
  accommodation={{
    id: '123',
    name: 'Beach House',
    price: 150,
  }}
/>

// DevTools shows:
// Props:
//   accommodation: { id: '123', name: 'Beach House', ... }
```

**State Inspector:**

```tsx
export function MyComponent() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');

  // DevTools shows:
  // Hooks:
  //   State: 0
  //   State: ""

  return <div>{count}</div>;
}
```

**Profiler:**

```tsx
// Measure component performance
// React DevTools > Profiler tab
// Click "Record" → Interact with app → Click "Stop"

// Shows:
// - Render time for each component
// - Why component re-rendered
// - Render count
```

### Debugging Components

**Find component causing re-renders:**

```tsx
// Use Profiler to see which components render
// Look for unexpected renders

// Common causes:
// 1. Inline object/array creation
const MyComponent = () => {
  return <Child data={{ name: 'test' }} />; // ❌ New object every render
};

// 2. Missing dependencies
useEffect(() => {
  fetchData(userId);
}, []); // ❌ Missing userId dependency

// 3. Context value changes
<MyContext.Provider value={{ user, theme }}>
  {/* ❌ New object every render */}
</MyContext.Provider>
```

**Check hook values:**

```tsx
export function MyComponent() {
  const { data } = useQuery({ queryKey: ['data'], queryFn: fetchData });
  const [count, setCount] = useState(0);

  // In React DevTools:
  // 1. Select component
  // 2. View Hooks section
  // 3. See current values
  // 4. Edit values to test different states

  return <div>{data?.name}</div>;
}
```

---

## 🌐 Chrome DevTools

### Network Tab

**Monitor API requests:**

```text
1. Open DevTools (F12)
2. Go to Network tab
3. Filter: Fetch/XHR
4. Interact with app
5. Click request to see:
   - Headers
   - Request payload
   - Response
   - Timing
```

**Debug failed requests:**

```tsx
// Failed request shows:
// Status: 404 Not Found
// Response: { error: 'Accommodation not found' }

// Check:
// 1. Request URL is correct
// 2. Headers include auth token
// 3. Request payload is valid
// 4. Response error message
```

**Check request timing:**

```text
Request timing breakdown:
- Queueing: 0.5ms
- Stalled: 2.3ms
- DNS Lookup: 0ms (cached)
- Initial connection: 0ms (cached)
- SSL: 0ms (cached)
- Request sent: 0.1ms
- Waiting (TTFB): 150ms ← Server processing time
- Content Download: 5ms

Slow requests? Check:
- Server response time (TTFB)
- Payload size
- Network conditions
```

### Console

**Structured logging:**

```tsx
// Use console methods effectively
console.log('Simple message');
console.info('Info message');
console.warn('Warning message');
console.error('Error message');

// Group related logs
console.group('User Authentication');
console.log('User ID:', userId);
console.log('Role:', role);
console.log('Permissions:', permissions);
console.groupEnd();

// Log objects
console.log('User:', user);
console.table(users); // Table view for arrays
console.dir(element); // DOM element details

// Time operations
console.time('fetchData');
await fetchData();
console.timeEnd('fetchData'); // fetchData: 150ms
```

**Debug helpers:**

```tsx
// Add to window for console access
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.debug = {
    queryClient,
    router,
    user: () => window.Clerk?.user,
  };
}

// In console:
// debug.queryClient.getQueryCache()
// debug.router.state.location
// debug.user()
```

### Sources Tab

**Set breakpoints:**

```tsx
// 1. Open Sources tab
// 2. Find file in tree
// 3. Click line number to add breakpoint
// 4. Interact with app
// 5. Debugger pauses at breakpoint

export function MyComponent() {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    debugger; // Programmatic breakpoint
    setCount(count + 1);
  };

  return <button onClick={handleClick}>Count: {count}</button>;
}
```

**Step through code:**

```text
When paused at breakpoint:
- Step Over (F10): Execute current line, move to next
- Step Into (F11): Enter function call
- Step Out (Shift+F11): Exit current function
- Continue (F8): Resume execution
```

**Watch variables:**

```tsx
// Add variables to watch
// While debugging:
// 1. Right-click variable
// 2. Add to watch
// 3. See value update as you step through
```

---

## 🔥 SSR Debugging

### Server vs Client

**Understanding where code runs:**

```tsx
// This runs on SERVER and CLIENT
export const Route = createFileRoute('/accommodations/$id')({
  loader: async ({ params }) => {
    console.log('[LOADER] Running on:', typeof window === 'undefined' ? 'server' : 'client');
    return { accommodation: await getAccommodation(params.id) };
  },
  component: AccommodationDetail,
});

// This runs on CLIENT only
function AccommodationDetail() {
  useEffect(() => {
    console.log('[EFFECT] This only runs on client');
  }, []);

  return <div>Details</div>;
}
```

### Debugging Server Code

**Server console output:**

```bash
# Terminal shows server logs
pnpm dev

# Output:
[LOADER] Running on: server
[LOADER] Fetching accommodation: 123
[LOADER] Returned data: { id: '123', name: 'Beach House' }
```

**Add server-side logging:**

```tsx
export const Route = createFileRoute('/protected')({
  beforeLoad: async () => {
    console.log('[SERVER] Checking authentication');

    const { userId } = await getAuth();

    console.log('[SERVER] User ID:', userId);

    if (!userId) {
      console.log('[SERVER] No user, redirecting');
      throw redirect({ to: '/signin' });
    }

    console.log('[SERVER] User authenticated');
    return { userId };
  },
  component: ProtectedPage,
});
```

### Debugging Client Code

**Browser console output:**

```tsx
// This appears in browser console
function MyComponent() {
  console.log('[CLIENT] Component rendering');

  useEffect(() => {
    console.log('[CLIENT] Component mounted');
  }, []);

  return <div>Content</div>;
}
```

### SSR Hydration Issues

**Symptom:** Content flashes or changes after load

**Cause:** Server and client render different content

**Debug:**

```tsx
// ❌ Bad - different on server and client
function MyComponent() {
  const date = new Date().toISOString(); // Different each render!
  return <div>{date}</div>;
}

// ✅ Good - same on server and client
function MyComponent() {
  const [date, setDate] = useState<string | null>(null);

  useEffect(() => {
    setDate(new Date().toISOString());
  }, []);

  return <div>{date || 'Loading...'}</div>;
}
```

---

## 🔧 VS Code Debugging

### Launch Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/apps/admin/src",
      "sourceMapPathOverrides": {
        "webpack:///./src/*": "${webRoot}/*"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "cwd": "${workspaceFolder}/apps/admin",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Setting Breakpoints

```tsx
// 1. Open file in VS Code
// 2. Click left of line number (red dot appears)
// 3. Start debugging (F5)
// 4. Code pauses at breakpoint

export function MyComponent() {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount(count + 1); // Set breakpoint here
  };

  return <button onClick={handleClick}>Count: {count}</button>;
}
```

---

## 💡 Best Practices

### Structured Logging

**✅ DO:**

```tsx
// Use prefixes for context
console.log('[UserService] Fetching user:', userId);
console.log('[AuthCheck] User authenticated:', { userId, role });
console.error('[API] Request failed:', error);
```

**❌ DON'T:**

```tsx
// Unclear context
console.log('fetching');
console.log('error', error);
```

### Remove Debug Code

**✅ DO:**

```tsx
// Use debug flag
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  console.log('[DEBUG] Component state:', state);
}
```

**❌ DON'T:**

```tsx
// Leave console.log in production
console.log('user data:', user); // ❌ Will run in production
```

### Use Appropriate Tools

**✅ DO:**

```tsx
// Use React DevTools for component issues
// Use TanStack Query DevTools for data issues
// Use Chrome DevTools for network/performance
// Use VS Code debugger for complex logic
```

---

## 🐛 Common Issues

### Issue: "Cannot debug because source maps are missing"

**Solution:**

```tsx
// Ensure source maps are enabled
// vite.config.ts
export default defineConfig({
  build: {
    sourcemap: true,
  },
});
```

### Issue: "Breakpoints not hitting in VS Code"

**Solution:**

1. Check `launch.json` configuration
2. Verify `webRoot` path is correct
3. Restart debugging session
4. Try `debugger;` statement instead

### Issue: "Console.log not appearing"

**Cause:** Running on server, logs in terminal

**Solution:**

```tsx
// Check if server or client
if (typeof window === 'undefined') {
  console.log('[SERVER]', message); // Appears in terminal
} else {
  console.log('[CLIENT]', message); // Appears in browser console
}
```

---

## 📖 Additional Resources

### Official Documentation

- **[Chrome DevTools](https://developer.chrome.com/docs/devtools/)** - Complete guide
- **[React DevTools](https://react.dev/learn/react-developer-tools)** - React debugging
- **[TanStack Router DevTools](https://tanstack.com/router/latest/docs/framework/react/devtools)** - Router debugging
- **[TanStack Query DevTools](https://tanstack.com/query/latest/docs/framework/react/devtools)** - Query debugging

### Internal Resources

- **[Architecture Overview](../architecture.md)** - System architecture
- **[Routing Guide](./routing.md)** - Route debugging
- **[Queries Guide](./queries.md)** - Query debugging

---

⬅️ Back to [Development Documentation](./README.md)
