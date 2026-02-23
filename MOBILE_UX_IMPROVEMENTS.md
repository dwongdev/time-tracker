# Mobile UX Improvement Plan

## Current Status
- Chart is centered and not cut off ✅
- Bottom action bar implemented ✅
- Desktop recommendation message added ✅

## Issues to Fix

### 1. **Desktop Scrolling Broken** 🔴 CRITICAL
- Desktop cannot scroll at all, stuck
- Likely caused by `overflow-auto` being conditionally applied in CircularChart
- **Fix**: Ensure desktop keeps `overflow-auto`, only remove on mobile
- **Location**: `src/components/CircularChart.tsx:542`

### 2. **Make Chart Bigger on Mobile** 🟡
**Options:**
- **Option A**: Reduce label margins further (from 28px to 24px)
- **Option B**: Move hour labels to inner circle (more complex)
- **Option C**: Show only key times (12 AM, 6 AM, 12 PM, 6 PM) and remove others
- **Recommended**: Option A (quick win) + Option C (better UX)

**Changes needed**:
- Reduce `baseLabelMargin` from 28px to 24px
- Update `renderHourLabels()` to only show [0, 6, 12, 18] hours on mobile
- This saves ~8px around the circle = ~16px more chart diameter

### 3. **Contextual Bottom Message** 🟢
**Current**: "For best experience and to save schedules, use desktop"

**New (contextual)**:
- **Guest users**: "Sign in on desktop to save schedules"
- **Authenticated users**: "Use desktop to manage multiple schedules"

**Location**: `src/components/Dashboard.tsx:694`

### 4. **Add Save Button for Authenticated Mobile Users** 🟢
**Current**: Only showing "Delete All" for signed-in users

**New**: Replace layout for authenticated users:
```
[ Save Schedule ] [ Delete All ]
```

**Behavior**:
- Save button triggers `handleSaveSchedule()`
- Works the same as desktop (prompts for name, saves to Firebase)
- Users can save but cannot view/switch schedules on mobile

**Location**: `src/components/Dashboard.tsx:669-693`

### 5. **Schedule Dropdown on Mobile** 🔵 OPTIONAL
**Decision needed**: Should we add schedule management to mobile?

**If YES**:
- Add schedule dropdown button in top section
- Show current schedule name
- Allow switching between schedules
- Keep UI minimal

**If NO**:
- Just allow saving
- Users must use desktop to switch/manage schedules

**Recommendation**: Start with just Save button, add dropdown later if needed

## Implementation Order

### Phase 1: Critical Fixes
1. ✅ Fix desktop scrolling issue
2. ✅ Add Save button for authenticated users
3. ✅ Make message contextual

### Phase 2: Polish
4. ✅ Make chart bigger (reduce margins + show fewer time labels)
5. ⏸️ (Optional) Add schedule dropdown on mobile

## Technical Details

### Chart Size Calculation (iPhone XR: 414 × 896px)
**Current**:
- Height offset: 190px
- Label margin: 28px each side
- Available width: 414 - 8 - 56 = 350px
- Chart diameter: ~350px

**Proposed**:
- Height offset: 190px (keep same)
- Label margin: 24px each side (reduced)
- Available width: 414 - 8 - 48 = 358px
- Chart diameter: ~358px (+2.3% bigger)

### Hour Labels
**Current**: Shows all [0, 3, 6, 9, 12, 15, 18, 21]
**Proposed Mobile**: Show only [0, 6, 12, 18] (cardinal directions)

This provides cleaner look and more space for the actual chart.

## Files to Modify

1. `src/components/CircularChart.tsx`
   - Fix desktop scrolling (line 542)
   - Reduce mobile label margins (line 56)
   - Update renderHourLabels() to show fewer labels on mobile (line 247)

2. `src/components/Dashboard.tsx`
   - Add Save button for authenticated users (line 669-693)
   - Make message contextual based on auth status (line 694)

## Success Criteria

- [ ] Desktop scrolling works normally
- [ ] Chart is ~8-10px bigger on mobile
- [ ] Authenticated users can save schedules on mobile
- [ ] Bottom message changes based on auth status
- [ ] All changes only affect mobile (<1024px)
- [ ] Desktop experience unchanged
