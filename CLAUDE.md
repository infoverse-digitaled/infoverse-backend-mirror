# Infoverse Backend - Claude Instructions

## Current Priorities
<!-- Update this section each session -->
- Science subject now live (deployed 2026-02-03)
- Bug Report Feature (needs frontend redeploy)

## Nia Indexed Resources
- ✅ `InfoverseDigitalEd/backend` - re-indexed 2026-01-29 (private, via GitHub app)
- ✅ `InfoverseDigitalEd/frontend` - re-indexed 2026-01-29 (private, via GitHub app)

## Known Issues / Context
- **KS4 Tiered Structure**: KS4 Maths and Science use Foundation/Higher tiers in Oak API. Fixed in Jan 2026 to parse `tiers` and `examSubjects` structures.
- **Keystage scrambling**: Was caused by wrong sequence selection + missing year filtering. Fixed in commit 7ce9997.
- **Oak API Authentication Required**: Unauthenticated requests to `/lessons/{slug}/assets` return empty arrays. Always include API key.
- **Paystack Live Mode**: Production is configured for live payments. Webhook must be enabled in Paystack dashboard.

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
Last updated: 2026-02-03
Status: Science subject unblocked and deployed

### Completed This Session (2026-02-03):
- **Paystack Investigation:**
  - Confirmed production is in LIVE mode (`PAYSTACK_MODE=live`)
  - Fixed webhook - was toggled OFF in Paystack dashboard, now enabled
  - Webhook URL: `https://infoverse-backend-84498540486.europe-west1.run.app/api/v1/payment/webhook`
  - Secret keys match between Cloud Run and Paystack dashboard

- **Oak API Science Investigation:**
  - Received email from Oak dev (Remy Sharp) - they CAN get videos for Science lessons
  - Discovered our Jan 15 audit was incorrect - Science has 100% video coverage
  - Root cause: likely intermittent API issues during audit, or unauthenticated requests returning empty assets
  - Key finding: Oak API returns empty assets array for unauthenticated requests

- **Science Subject Unblocked:**
  - Removed `'science'` from `BLOCKED_SUBJECTS` in `src/config/curriculum.ts`
  - Added `'science'` to `ALLOWED_SUBJECTS` for KS1, KS2, KS3, KS4
  - Verified 100% video coverage across all key stages (including KS4 tiers)
  - Commit: `dca034c`
  - Deployed: revision `infoverse-backend-00048-gv9`

### Deployment Status:
- Backend: ✅ Deployed (Feb 3, 2026) - Science now available
- Frontend: Needs redeploy for bug report feature

### Notes for Next Session:
- Reply to Oak (Remy Sharp) - confirm Science videos now working, apologize for confusion
- Frontend needs redeploy to get bug report feature live
- Consider re-running comprehensive audit with proper API authentication
