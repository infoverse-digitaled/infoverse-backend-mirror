# Infoverse Backend - Claude Instructions

## Current Priorities
<!-- Update this section each session -->
- Science subject now live (deployed 2026-02-03)
- Bug Report Feature (needs frontend redeploy)

## Nia Indexed Resources
- ✅ `InfoverseDigitalEd/backend` - re-indexed 2026-01-29 (private, via GitHub app)
- ✅ `InfoverseDigitalEd/frontend` - re-indexed 2026-01-29 (private, via GitHub app)

## Known Issues / Context
- **Oak API Silent Slug Changes**: Oak periodically restructures their content, changing unit slugs without notice (e.g., `counting-to-and-from-20` → `numbers-to-20-82de`). Auto-invalidation logic added in commit 9f1b21a handles this. If units 404, clear production cache via `DELETE /api/v1/oak/cache`.
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

## Cloud Run Deployment
- **GCP Project**: `project-cf7deeae-1ca2-4144-81a` (project number: `84498540486`)
- **Region**: `europe-west1`
- **Service**: `infoverse-backend`
- **Deploy command**: `gcloud run deploy infoverse-backend --source . --region europe-west1`
- **GitHub clone auth**: Personal Access Token for `Hafeedh-lab` with `repo` scope

## Session Handoff Notes
<!-- Claude should update this before session ends -->
Last updated: 2026-02-09
Status: Fixed Oak API 404 errors caused by stale unit slugs

### Completed This Session (2026-02-09):
- **Oak API 404 Investigation & Fix:**
  - Users reported "Error Loading Unit" with 404s for Maths KS1 units (`counting-to-and-from-20`, `review-strategies-for-adding-and-subtracting-across-10`)
  - Root cause: Oak restructured their content, changing unit slugs silently (e.g., `counting-to-and-from-20` → `numbers-to-20-82de` with hash suffixes)
  - Oak API versioning page shows no announced breaking change — they treat slug changes as data updates, not API changes
  - Cleared production Redis cache via `DELETE /api/v1/oak/cache` (1 key deleted)
  - Added `handleStaleUnitSlug()` auto-invalidation in `oakApiService.ts` — on 404, clears stale unit cache + all unit listing caches so next browse gets fresh data
  - Committed as `9f1b21a` and pushed to main
  - User deploying from Cloud Shell (pending)

### Unresolved:
- **Deployment pending**: User deploying from Cloud Shell — verify it completes successfully
- **403 on Science lessons** (from previous session): Still need to determine if user has valid subscription
- **Test infrastructure**: Unit tests fail due to missing env vars (MONGO_URI, JWT_SECRET) — no .env.test file exists

### Deployment Status:
- Backend: Deploying (Feb 9, 2026) - stale slug auto-invalidation
- Frontend: Still needs redeploy for bug report feature

### Notes for Next Session:
- Verify deployment succeeded and 404s are resolved on production
- Contact Oak (Remy Sharp) about notifying API consumers when unit slugs change
- Frontend needs redeploy to get bug report feature live
- 4 Dependabot vulnerabilities on GitHub (1 high, 1 moderate, 2 low)
- Consider setting up .env.test for local test runs

### Current Subject Availability:
- English: ✅ Available (all key stages)
- Maths: ✅ Available (all key stages)
- Science: ✅ Available (all key stages) - Unblocked 2026-02-03

### Technical Notes:
- Premium lesson endpoints (`/lessons/:slug/quiz`, `/transcript`, `/assets`) require `requireActiveSubscription`
- Subscription statuses that allow access: `active`, `trialing` (if trial not expired)
- Subscription statuses that block: `free`, `cancelled`, `past_due`, `inactive`, or no subscription
- `handleStaleUnitSlug()` at `oakApiService.ts:524` — self-healing cache invalidation on Oak slug 404s
