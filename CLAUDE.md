# Infoverse Backend - Claude Instructions

## Current Priorities
<!-- Update this section each session -->
- Bug Report Feature (implemented, needs deployment & testing)

## Nia Indexed Resources
- ✅ `InfoverseDigitalEd/backend` - re-indexed 2026-01-29 (private, via GitHub app)
- ✅ `InfoverseDigitalEd/frontend` - re-indexed 2026-01-29 (private, via GitHub app)

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
Last updated: 2026-01-30
Status: Bug Report Feature implemented (backend + frontend)

### Completed This Session (2026-01-30):
- **Bug Report Feature - Full Implementation:**
  - Backend: `BugReport` model, `bugReportLimiter` (5/hr/IP), `POST /public/bug-report` endpoint, email worker job
  - Frontend: `BugReportModal`, `BugReportButton` (floating, bottom-left), `useFeedbackTimer` hook (7-day interval), integrated into `LayoutWrapper`
  - Includes: honeypot spam filter, auto-populated email/userId from auth, star rating, type selector
  - Backend commit: `4aca376` on `main`
  - Frontend commit: `564100c` on `main`

### Deployment Status:
- Frontend: ✅ Deployed to https://infoversedigitaleducation.net (needs redeploy for bug report feature)
- Backend: ✅ Deployed (Jan 16 build) - needs redeploy for bug report feature

### Notes for Next Session:
- **Deploy both repos** to get bug report feature live
- **Test the feature end-to-end** after deployment (see verification steps in plan)
- Oak API cache TTL: 12h for units, 24h for subjects/lessons
