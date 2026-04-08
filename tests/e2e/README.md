# EventDocs E2E Test Suite

Playwright tests for all deployed features (PROJ-24 through PROJ-34).

## Quick start

1. **Get your organizer token** from Supabase:
   - Dashboard → Project `xqopetmpzjbxksonmhjw` → Table Editor → `members`
   - Find the row with `role = organizer`
   - Copy the `token` value

2. **Add it to `.env.local`**:
   ```
   E2E_TOKEN=<paste-token-here>
   ```

3. **Run the full suite against Production**:
   ```
   npm run test:e2e
   ```

   Or against localhost:
   ```
   npm run test:e2e:local
   ```

   Or interactively (Playwright UI):
   ```
   npm run test:e2e:ui
   ```

## What's covered

| Spec | PROJ | Covers |
|------|------|--------|
| `smoke.spec.ts` | 24, 25, 27, 28, 31, 32, 33 | Critical happy path (runs on Desktop + iPhone 14) |
| `auth.spec.ts` | 24 | Invalid tokens, protected-route redirects, unauth API |
| `capture.spec.ts` | 27 | Text capture UI + validation + API sad paths |
| `pool.spec.ts` | 28 | Empty state, listing, ordering |
| `reactions.spec.ts` | 31 | Emoji add/remove, dedupe, invalid emoji |
| `comments.spec.ts` | 32 | Post/fetch, empty/oversized, XSS, foreign-delete |
| `admin-curation.spec.ts` | 33 | Draft save, publish toggle, foreign-content rejection |
| `slideshow.spec.ts` | 34 | **Real Claude Haiku call**, storyboard, rate-limit, edit |

## Important flags

- **`RUN_SLIDESHOW_TESTS=1`** — Required on CI to run `slideshow.spec.ts`
  (each run costs ~$0.02 in Claude API). Runs by default locally.
- **`BASE_URL`** — Defaults to `https://frank-lernt.vercel.app`.
  Override with `BASE_URL=http://localhost:3000`.

## How it works

- **`auth.setup.ts`** runs once at the start, calls `/join/<E2E_TOKEN>`,
  and saves the `member_token` cookie to `.auth/organizer.json`.
  All other tests reuse this storage state (fast, no re-login per test).
- Each spec creates its **own test event** in `beforeAll` and deletes it
  in `afterAll` (CASCADE cleans up content, reactions, comments, reports).
- Content is marked with a unique `E2E-<label>-<timestamp>-<rand>` string
  so leaked data can be identified and cleaned manually if needed.

## When a test fails

- **HTML report**: `npx playwright show-report`
- **Traces** (retained on failure): `playwright-report/data/*.zip`
- **Screenshots + videos**: `test-results/`

## Adding a new test

1. Put the file in `tests/e2e/<feature>.spec.ts`
2. Import helpers: `createTestEvent`, `deleteTestEvent`, `createTextContent`,
   `testMarker` from `./helpers`
3. Always clean up in `afterAll` — don't pollute Production data
4. Prefer API assertions over UI where possible (faster + more reliable)
5. UI assertions: use `getByRole` / `getByText` (no `data-testid` in the app)

## Known limitations

- **Photo/video/audio capture** can't be tested through the UI (browser
  permission prompts). Covered at API level via `createTextContent`
  pattern — extend `helpers.ts` with `createPhotoContent` if needed.
- **Realtime (Supabase channels)** is not explicitly tested — tests reload
  pages instead of waiting for websocket events.
- **Mobile viewport** only runs `smoke.spec.ts` (iPhone 14 profile) to save
  runtime. Add other specs to the `mobile-safari` project in
  `playwright.config.ts` if you need broader mobile coverage.
