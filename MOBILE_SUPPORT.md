# Mobile Support Improvement Plan

## Current Issues

Based on testing, the current mobile implementation has several usability problems:

1. **Circular chart is not properly centered** - Main feature of the app is hard to use
2. **Horizontal scrolling occurs** - Creates poor UX, elements overflow viewport
3. **Sidebar approach is clunky** - Takes up too much space when open, not intuitive
4. **Elements not optimally sized** - Some elements too small, others too large
5. **Footer visibility** - Footer might be interfering with content

---

## Mobile-First Design Goals

### Priority 1: Circular Chart (The Core Feature)
- **Must be perfectly centered** on the screen
- **Must never cause horizontal scrolling**
- **Must scale to fit viewport width** with proper padding
- **Must be the dominant visual element** on mobile
- All interactions must work smoothly with touch

### Priority 2: Navigation
- **Remove sidebar completely on mobile** - not suitable for small screens
- Replace with **bottom navigation bar** (industry standard for mobile apps)
  - 3-4 icons at bottom: Schedule Editor, My Schedules, Settings
  - Always visible, doesn't take up much space
  - Easy thumb access on phones

### Priority 3: Layout & Viewport
- **No horizontal scrolling anywhere**
- **Vertical scrolling only** for timeline/content areas
- **Sticky header** with minimal height
- **Remove or minimize footer** on mobile (or make it absolutely positioned at bottom)

### Priority 4: Controls & Actions
- **Compact header controls** - smaller, icon-only where possible
- **Floating Action Button (FAB)** for primary actions like "Save"
- **View toggle** (Linear/Circular) should be compact icons, not text buttons

---

## Detailed Implementation Plan

### 1. Circular Chart Component (src/components/CircularChart.tsx)

**Changes:**
```
- Calculate chart size based on viewport width
- Add horizontal padding: 16px on mobile, 24px on tablet
- Center chart using flex container
- Prevent overflow with: overflow-x: hidden on parent
- Max width: min(100vw - 32px, 500px) for chart container
- Position absolutely within centered container
```

**Layout:**
```html
<div className="flex-1 overflow-y-auto overflow-x-hidden">
  <div className="flex items-center justify-center min-h-full p-4">
    <div className="w-full max-w-[500px]">
      <!-- Circular Chart Here -->
    </div>
  </div>
</div>
```

### 2. Timeline Component (src/components/Timeline.tsx)

**Changes:**
```
- Full width on mobile (no side padding that causes overflow)
- Vertical scrolling only
- Time labels positioned carefully to not overflow
- Hour markers on left with negative margin: careful sizing
```

**Layout:**
```html
<div className="flex-1 overflow-y-auto overflow-x-hidden px-4">
  <div className="max-w-3xl mx-auto">
    <!-- Timeline content -->
  </div>
</div>
```

### 3. Navigation - Bottom Nav Bar (New Approach)

**Create: src/components/BottomNav.tsx**

```typescript
// Bottom navigation bar for mobile only
// Shown only on screens < 1024px (lg breakpoint)
// 3 main tabs: Schedule Editor, My Schedules, Settings
// Icons with labels below
// Active state highlighting
// Fixed to bottom of screen
```

**Design:**
```
- Fixed position at bottom
- White background with top border shadow
- Height: 64px
- 3 equal-width buttons
- Icon (24px) + Label (10px text)
- Active: blue color, inactive: gray
- Safe area padding for iOS notch
```

**Example:**
```html
<nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 lg:hidden z-50 safe-area-pb">
  <div className="flex items-center justify-around h-16">
    <button>Schedule Editor</button>
    <button>Schedules</button>
    <button>Settings</button>
  </div>
</nav>
```

### 4. Dashboard Layout Restructure (src/components/Dashboard.tsx)

**Mobile Layout (< 1024px):**
```
┌─────────────────────┐
│   Compact Header    │ ← Minimal height, essential controls only
├─────────────────────┤
│                     │
│   Main Content      │ ← Chart/Timeline fills space
│   (Scrollable)      │
│                     │
├─────────────────────┤
│  Bottom Nav Bar     │ ← Fixed at bottom (mobile only)
└─────────────────────┘
```

**Desktop Layout (≥ 1024px):**
```
┌───────┬─────────────────────┐
│       │      Header         │
│ Side  ├─────────────────────┤
│ bar   │                     │
│       │   Main Content      │
│       │                     │
└───────┴─────────────────────┘
```

**Changes:**
```
- Remove sidebar on mobile entirely (not even hamburger menu)
- Remove mobile sidebar backdrop/overlay
- Remove hamburger button
- Add bottom navigation component
- Header: much more compact on mobile
- Footer: hidden on mobile OR absolutely positioned
- Main content: flex-1 with proper overflow handling
```

### 5. Header Improvements (Mobile)

**Current Issues:**
- Too tall on mobile
- Controls take up too much space
- Schedule dropdown is clunky

**Mobile Header Design:**
```
Height: 48px (down from current ~60px)
Layout:
  - Left: Page title (small, 16px font)
  - Right: Compact controls (icon buttons only)

View toggle: Icon-only buttons (☰ for linear, ⭕ for circular)
Save button: Icon-only (💾) or FAB instead
Schedule selector: Icon/chevron only, opens bottom sheet
```

### 6. Footer Handling

**Options:**

**Option A: Hide on Mobile**
```css
.footer {
  @apply hidden lg:block;
}
```

**Option B: Absolute Position**
```css
.footer {
  @apply absolute bottom-0 left-0 right-0 lg:relative;
  padding-bottom: env(safe-area-inset-bottom);
}
```

**Option C: Above Bottom Nav**
```css
.footer {
  @apply mb-16 lg:mb-0; /* 64px for bottom nav */
}
```

**Recommendation: Option A (Hide on mobile)** - Simplest, keeps focus on content

### 7. Responsive Breakpoints Strategy

```css
Mobile: < 640px (default styles)
  - Bottom nav visible
  - Sidebar hidden
  - Compact header
  - Chart: full width minus 32px padding
  - Icon-only controls

Tablet: 640px - 1023px (sm: to lg:)
  - Bottom nav visible
  - Sidebar hidden
  - Slightly larger header
  - Chart: max-width 500px, centered
  - Some text labels shown

Desktop: ≥ 1024px (lg:)
  - Bottom nav hidden
  - Sidebar visible (always shown)
  - Full header with text labels
  - Chart: flexible sizing
  - All features visible
```

### 8. Specific Component Updates

#### CircularChart.tsx
```
✓ Container: flex justify-center items-center
✓ Max width constraint
✓ Responsive sizing based on viewport
✓ Prevent horizontal overflow
✓ Center tooltip positioning
```

#### Timeline.tsx
```
✓ Full width within container
✓ Remove side overflow
✓ Time labels: careful positioning
✓ Blocks: proper touch targets (min 44px height)
```

#### Dashboard.tsx
```
✓ Remove sidebar for mobile
✓ Add BottomNav component
✓ Restructure layout with proper flex
✓ Add overflow-x-hidden to main container
✓ Make header compact on mobile
✓ Hide/reposition footer
```

#### Header Controls
```
✓ View toggle: sm:text-xs → icons only on mobile
✓ Save button: Consider FAB instead
✓ Schedule dropdown: Bottom sheet modal on mobile
```

---

## Implementation Order

### Phase 1: Layout Foundation (Critical)
1. Add `overflow-x-hidden` to main Dashboard container
2. Remove sidebar/hamburger on mobile (< lg)
3. Restructure Dashboard flex layout
4. Hide footer on mobile

### Phase 2: Bottom Navigation
1. Create BottomNav.tsx component
2. Add to Dashboard (mobile only)
3. Implement active state logic
4. Test navigation flow

### Phase 3: Chart Centering
1. Wrap CircularChart in flex centering container
2. Add max-width constraints
3. Calculate responsive sizing
4. Test on various mobile sizes (320px - 768px)

### Phase 4: Header Optimization
1. Reduce header height on mobile
2. Convert text buttons to icon-only
3. Simplify schedule selector
4. Test touch targets (min 44x44px)

### Phase 5: Timeline Optimization
1. Ensure no horizontal overflow
2. Improve vertical scrolling
3. Optimize time label positioning
4. Test block creation on mobile

### Phase 6: Polish & Testing
1. Test on real devices (iPhone, Android)
2. Test in Chrome DevTools mobile mode
3. Check all screen sizes: 320px, 375px, 390px, 414px, 768px
4. Verify no horizontal scrolling anywhere
5. Verify circular chart is perfectly centered
6. Test all touch interactions

---

## Testing Checklist

### Layout Tests
- [ ] No horizontal scrolling on any page
- [ ] Circular chart is perfectly centered
- [ ] Bottom nav is visible on mobile only
- [ ] Sidebar is hidden on mobile
- [ ] Footer doesn't interfere with content
- [ ] All pages use full viewport height

### Interaction Tests
- [ ] Tap navigation items in bottom nav
- [ ] Drag to create time blocks (circular)
- [ ] Drag to create time blocks (linear)
- [ ] Toggle between linear/circular views
- [ ] Save schedule
- [ ] Edit time blocks
- [ ] All buttons are tappable (44x44px minimum)

### Visual Tests
- [ ] Text is readable (min 14px on mobile)
- [ ] Colors have sufficient contrast
- [ ] Touch targets are appropriately sized
- [ ] Spacing feels comfortable
- [ ] No UI elements cut off or hidden
- [ ] Safe area padding on iPhone notch

### Device Tests
- [ ] iPhone SE (375x667) - smallest modern iPhone
- [ ] iPhone 12/13/14 (390x844)
- [ ] iPhone 14 Pro Max (430x932)
- [ ] Samsung Galaxy S21 (360x800)
- [ ] iPad Mini (768x1024)
- [ ] Test in both portrait and landscape

---

## Success Criteria

After implementation, mobile experience should have:

1. ✅ **Circular chart is the hero** - Perfectly centered, no scrolling to see it
2. ✅ **Zero horizontal scrolling** - Anywhere in the app
3. ✅ **Easy navigation** - Bottom nav is intuitive and thumb-friendly
4. ✅ **All features accessible** - Nothing hidden or hard to reach
5. ✅ **Smooth interactions** - Drag-to-create works flawlessly
6. ✅ **Professional feel** - Looks and feels like a native mobile app

---

## Notes

- **Don't use a hamburger menu** - Bottom nav is much better for mobile apps
- **Keep mobile simple** - Remove features if they clutter the UI
- **Touch targets matter** - Minimum 44x44px for all tappable elements
- **Test on real devices** - Emulators are good, but real devices are better
- **Consider gestures** - Swipe to switch between views could be cool (future)

This plan prioritizes the circular chart as the centerpiece of the mobile experience and removes friction from navigation and layout.
