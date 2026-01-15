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
Last updated: 2026-01-15
Status: Session complete - Fixed Oak API rate limiting, deployed frontend

### Completed This Session:
- Fixed Oak API 429 rate limiting error by pre-warming Redis cache
- Started backend and frontend dev servers
- Pre-warmed cache for all 12 subject/keystage combinations (Maths, English, Science × KS1-4)
- Deployed frontend to Netlify successfully
- Backend deployment failed due to SSL/network issues (gcloud CLI)

### Deployment Status:
- Frontend: ✅ Deployed to https://infoversedigitaleducation.net
- Backend: ✅ Running (Jan 13 build) - new deploy failed due to SSL errors
- Production backend verified working at https://infoverse-backend-84498540486.europe-west1.run.app

### Uncommitted Changes:
- Backend: package.json, curriculum.ts, oakApiService.ts (minor changes)
- Frontend: login page, home page, KeyStageSelector, SideLogo component

### Notes for Next Session:
- Backend needs redeployment when network is stable (has uncommitted changes)
- SSL errors with gcloud CLI - try different network or deploy from Cloud Console
- Oak API cache TTL: 12h for units, 24h for subjects/lessons
