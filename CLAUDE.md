# Infoverse Backend - Claude Instructions

## Current Priorities
<!-- Update this section each session -->
- No pending tasks

## Known Issues / Context
- **KS4 Tiered Structure**: KS4 Maths and Science use Foundation/Higher tiers in Oak API. Fixed in Jan 2026 to parse `tiers` and `examSubjects` structures.
- **Keystage scrambling**: Was caused by wrong sequence selection + missing year filtering. Fixed in commit 7ce9997.

## Architecture Decisions
- Oak API caching: 12-24 hours TTL in Redis
- Frontend SWR: 30s deduping, no revalidate on focus
- Payment: Paystack with test/live mode switching

## API Endpoints Reference
- Units: `GET /api/v1/oak/subjects/:keyStage/:subjectSlug/units`
- Lessons: `GET /api/v1/oak/units/:unitSlug/lessons`
- Lesson details (premium): `GET /api/v1/oak/lessons/:lessonSlug`

## Pre-Deployment Checklist (Oak API Changes)

**Before deploying ANY changes to Oak API integration:**

1. [ ] Run integration tests: `npm run test:integration`
2. [ ] Manually verify KS1 ≠ KS2 data:
   ```bash
   curl localhost:5001/api/v1/oak/subjects/ks1/maths/units | jq '.[0:2]'
   curl localhost:5001/api/v1/oak/subjects/ks2/maths/units | jq '.[0:2]'
   # Should return DIFFERENT data
   ```
3. [ ] Verify year ranges are correct:
   - KS1 units should have year 1-2 only
   - KS2 units should have year 3-6 only
   - KS3 units should have year 7-9 only
   - KS4 units should have year 10-11 only
4. [ ] Clear Redis cache after deployment
5. [ ] Test production endpoints after deployment

**Why this exists:** On Dec 4 2025, a bug was deployed where KS1/KS2 returned identical data. This checklist would have caught it.

## Session Handoff Notes
<!-- Claude should update this before session ends -->
Last updated: 2026-01-13
Status: Session complete - Science subject added, KS4 tier selection implemented

### Completed This Session:
- Added Science subject for all key stages (KS1-KS4)
- Implemented KS4 Maths tier selection UI (Foundation/Higher cards)
- Implemented KS4 Science exam subject + tier selection UI
  - Exam subjects: Combined Science, Biology, Chemistry, Physics
  - Each with Foundation/Higher tiers
- Fixed Back button navigation to preserve key stage selection
- Browse page now uses URL params (?ks=4) to persist key stage tab
- Removed grade descriptions from tier selection cards
- Verified trial counter, inactivity-based countdown, and Paystack live mode

### Verified Systems:
- Trial day counter: Working correctly (7 days from account creation)
- Trial based on account creation, NOT user activity: Confirmed
- Paystack mode: LIVE (with live plan codes)

### Commits Made:
- Backend: `c0a35fd` - feat: Add Science subject for all key stages
- Frontend: `de72b56` - feat: Add Science, KS4 tier selection, improved navigation

### Notes for Next Session:
- Science now available alongside English and Maths
- KS4 subjects have tier/exam subject selection before viewing units
- No pending tasks
