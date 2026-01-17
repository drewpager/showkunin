# Performance Optimization Checklist

## Critical (High Impact)

- [ ] **1. Compress large assets**
- [ ] **2. Remove `unoptimized` from static images**
- [ ] **3. Increase React Query `staleTime`**

## Medium Impact

- [ ] **4. Dynamic import heavy modal components**
- [ ] **5. Dynamic import Recorder component** 
- [ ] **6. Tree-shake lucide-react icons** - ALREADY OPTIMIZED (using named imports)
- [ ] **7. Enable SSR prefetching for key pages** - DEFERRED (requires architectural changes; existing caching is sufficient)

## Low Impact / Quick Wins

- [ ] **8. Add `display: 'swap'` to font config** - COMPLETED
- [ ] **9. Memoize VideoCard component** - COMPLETED
- [ ] **10. Add preconnect hints** - COMPLETED

---

## Completed Tasks

### 1. Compress large assets
- `support usecase.png`: 6.17MB → 68KB (98.9% reduction)
- `logo-lrg.png`: 2.03MB → 111KB (94.7% reduction)
- `logo.png`: 314KB → 31KB (89.9% reduction)
- `use-case.png`: 144KB → 27KB (81.0% reduction)
- `workflow-min.png`: 262KB → 44KB (83.0% reduction)
- **Total savings: 8.89MB → 0.27MB (96.9% reduction)**

### 2. Remove `unoptimized` from static images
- Removed `unoptimized` from logo in `tasks.tsx:163`
- Other usages correctly kept `unoptimized` for S3 signed URLs and external user images
- Static logo images now benefit from Next.js automatic WebP/AVIF conversion

### 3. Increase React Query staleTime
- `tasks.tsx`: Changed staleTime from 0 to 5 minutes (300,000ms)
- `examples.tsx`: Added staleTime of 10 minutes (600,000ms) for public examples
- Reduces unnecessary network requests while keeping data reasonably fresh

### 4 & 5. Dynamic import heavy modal components
Converted to `next/dynamic` with `ssr: false`:
- `tasks.tsx`: VideoRecordModal, VideoUploadModal, Paywall
- `index.tsx`: VideoRecordModal, Paywall, VideoModal
- `task/[videoId].tsx`: VideoRecordModal, VideoPlayer, VideoAnalysis, Paywall
- `pricing.tsx`: VideoRecordModal

This defers loading of heavy dependencies (RecordRTC, Vidstack, Stripe) until modals are opened.

### 6. Tree-shake lucide-react icons
- Already optimized - using named/destructured imports
- `sign-in.tsx`: `import { Eye, EyeOff } from "lucide-react"`
- `buttons.tsx`: Imports only 9 specific icons
- No changes needed - tree-shaking is automatic with this pattern

### 10. Add preconnect hints
- Created `_document.tsx` with preconnect and dns-prefetch hints
- Added `<link rel="preconnect" href="https://storage.googleapis.com" />` for GCS video/image assets
- Added `<link rel="dns-prefetch" href="https://storage.googleapis.com" />` as fallback for older browsers
- This reduces connection latency when loading videos and thumbnails from GCS
