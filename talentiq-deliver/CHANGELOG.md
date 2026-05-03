# TalentIQ Changelog

All notable changes to this project are recorded here.
Format: `[YYYY-MM-DD] — <summary>` followed by bullet details.

---

## [2026-04-27] — Initial modular refactor + AI matching

**Modularisation**
- Split monolithic `App.jsx` (558 lines) into 11 focused files:
  `theme.js`, `utils/excel.js`, `utils/skillUtils.js`, `utils/llmMatch.js`,
  `components/ui.jsx`, `components/UploadModal.jsx`,
  `pages/DashboardPage.jsx`, `pages/SkillMappingPage.jsx`,
  `pages/SummaryTab.jsx`, `pages/ResourceMatchesTab.jsx`,
  `pages/ConfidenceOverviewTab.jsx`

**Summary tab**
- Moved to full-width layout (was crammed into right column of a 2-pane grid)
- Skill demand table now shows top 12 skills with "View all" popout

**Resource Matches tab**
- Position search (job search) moved into this tab — no longer global/shared across tabs
- Bench resource shore filter now auto-enforces based on selected position's location

**Confidence Overview tab**
- Excel export fixed: now exports every position × every bench resource with no score floor
- Two-sheet workbook: "Full Mapping" + "Position Summary"
- Positions with zero bench resources no longer silently dropped from export

**AI Matching (`✦ Match with AI`)**
- New button in Resource Matches tab when a position is selected
- Calls `claude-sonnet-4` via Vite dev-server proxy (avoids CORS)
- API key stored in `.env` as `ANTHROPIC_API_KEY`, never shipped in browser bundle
- Returns: overall bench summary, top recommendation, per-resource reasoning, strengths, gaps
- Toggle between Algorithmic and AI result views
- Animated skeleton loading state

**CORS fixes (iterative)**
- v1: switched from `configure` callback to `headers` object in Vite proxy config
- v2: added `anthropic-dangerous-direct-browser-access: true` header required when `Origin` is forwarded

---

## [2026-04-29] — Sortable table, collapsible cards, req detail popup, changelog

**Confidence Overview — sortable columns**
- All 10 column headers are now clickable to sort ascending / descending
- Active sort column highlighted; sort direction shown with ↑ / ↓ indicator
- Clicking the same column toggles direction; clicking a new column resets to descending
- Row hover now uses `teal50` to hint clickability (navigates to Resource Matches tab)

**Confidence Overview → Resource Matches navigation**
- Clicking any row selects that position and switches to the Resource Matches tab
- Selected position card is auto-scrolled into view and auto-expanded

**Resource Matches — collapsible Position cards**
- Cards are collapsed by default; click header row to expand/collapse
- Collapsed state shows: chevron indicator, role name, Grade badge, Offshore/Onshore badge
- "Selected" pill appears on the active card in collapsed state
- "Expand all / Collapse all" controls above the list
- First click on a card → selects it (loads matches on the right) and expands it
- Second click on the already-selected card → opens Req Detail popup

**Resource Matches — collapsible Resource cards**
- Same pattern as position cards
- Collapsed state shows: chevron, name, Grade badge, Offshore/Onshore badge, match score badge
- Expanded state adds: bench duration, skill coverage bar, matched skill chips
- "Best Match" pill visible in collapsed state for top result
- "Expand all / Collapse all" controls above the results list

**Req Detail Popup (double-click on selected position)**
- Full-screen modal with two-column layout
- Left panel: action buttons + required skills + confidence summary
  - "📬 Contact RMG" — expands inline message textarea with Send button
  - "🔍 Potential Candidates" — expands links to ATS / LinkedIn search
- Right panel: Job Description editor (blank textarea — placeholder for future JD data)
  - Dashed border; turns solid teal when content is added
  - "Save JD" button appears when text is present (session-only for now)
  - "Awaiting JD" badge shown until JDs are wired up

**Changelog**
- This file (`CHANGELOG.md`) added to track all future Claude Code sessions

---

## [2026-04-29] — Bug fixes: collapsible cards, sort cycle, resource panel scroll

**Fix 1 — Position card chevron collapse**
- The `›` chevron arrow now has its own `onClick` with `e.stopPropagation()` — clicking it only toggles expand/collapse, it no longer triggers selection or the popup
- Clicking the role title / badges area still handles selection (first click) and popup (second click on selected card)
- `PosCard` now receives an explicit `onToggle` prop wired to the parent's `togglePosExpand`

**Fix 2 — Confidence Overview sort: 3-state cycle + readable active column**
- Sort now cycles through 3 states on the same column: ↓ desc → ↑ asc → (reset to original order)
- Third click resets `sortCol` to `null` so the original data order is restored
- Active column background changed from `rgba(255,255,255,0.12)` (nearly invisible against slate700) to `C.teal600` — clearly visible teal highlight with white text
- Active column also gets a bottom border in `C.teal400` for extra emphasis
- SortIcon updated: shows `⇅` (neutral) when unsorted, `↑`/`↓` only when active

**Fix 3 — Resource Matches panel: scrollable layout + visible cards + name fallback**
- Both left (positions) and right (resources) columns are now `flex-column` with `maxHeight: calc(100vh - 280px)` — independently scrollable within the viewport
- Fixed filters / search inputs remain pinned above the scroll area; only the card lists scroll
- `ResCard` collapsed header now always shows something: `r.name || r.id || "Unknown"` — prevents blank collapsed cards when the `Name` column in MSD is empty
- All skill arrays guarded with `(r.skills || [])` to prevent `.map` errors on undefined
- Right panel now shows a helpful empty-state message when no position is selected
- Match count displayed next to the selected position title in the right panel sub-header

---

## [2026-04-29] — Fix: blank resource cards (name field not populating)

**Root cause**
- `processMSDData` was looking up MSD columns with rigid hardcoded keys (`r.Name`, `r["Grade as per HRIS"]`, etc.). JavaScript object access is case- and whitespace-sensitive — if the actual Excel header was `"name"`, `"Employee Name"`, `"Full Name"`, or even `"Name "` with a trailing space, the field came back `undefined` and the resource card rendered with no name visible.

**Fix in `src/dataProcessor.js`**
- Added a `pickField(row, ...candidates)` helper that:
  - First tries each candidate header exactly
  - Then falls back to a case-insensitive, whitespace-normalised scan of the row's own keys
- Re-implemented `processMSDData` to use `pickField` for every resource attribute (id, name, grade, designation, location, division, lob, vertical, skillsets, L3, L4, bench days, allocation start, project name)
- `name` now matches: `"Name"`, `"Employee Name"`, `"Full Name"`, `"Resource Name"`, `"Emp Name"`, `"Employee_Name"`, `"Resource"`
- `grade` now matches: `"Grade as per HRIS"`, `"Grade"`, `"HRIS Grade"`, `"Current Grade"`, `"Band"`
- `designation` now matches: `"Designation as per HRIS"`, `"Designation"`, `"Job Title"`, `"Title"`, `"Role"`
- `location` (Onshore/Offshore) now matches: `"Onshore/Offshore"`, `"Onshore Offshore"`, `"Shore"`, `"Location Type"` (case-insensitive)
- `parseBenchEmployeeIds` rewritten with the same robust lookup pattern
- Added one-time console logs:
  - `[MSD] Available columns in first row: [...]` — useful for diagnosing future field mismatches
  - `[MSD] Sample resource: {...}` — confirms what was extracted for the first bench resource
  - Reports how many resources are missing critical fields (name, grade)

**Fix in `src/pages/ResourceMatchesTab.jsx` (`ResCard`)**
- Collapsed header now has `minHeight: 44` — guarantees the card is visibly tall even if every field is empty
- Display name uses `r.name?.trim() || r.id || "Unnamed Resource"` — always shows something
- When name is empty, the card shows the ID in italic + a subtle `(no name in data)` hint to make the issue obvious instead of silent
- `LocationBadge` now also guarded with `{r.location && ...}` to prevent rendering an empty pill
- Expanded body shows ID prominently in teal-700 weight 600 even when name is missing
- Empty skills list now renders an italic "No skills listed" instead of just nothing

**How to verify the fix worked**
- Open browser dev tools → Console after uploading MSD
- Look for `[MSD] Available columns in first row: [...]` — this lists every header in your file
- Look for `[MSD] Sample resource: {...}` — confirms `name` was extracted (or shows it as empty if the column name is something exotic)
- If still blank, copy the column array from the log and paste it into chat — the candidate list can be extended

---

## [2026-04-29] — Defensive: ResCard always visible + DataInspector for debugging

After the previous fix users still reported blank thin cards. Two probable causes:
1. Browser/dev-server caching the old build — stale code
2. Data really has empty fields beyond just `name` (e.g. id also empty)

**Defensive improvements**
- `ResCard` outer wrapper now also has `minHeight: 52` and `flexShrink: 0` — defence-in-depth so the card is impossible to collapse below visible height even if every internal field is empty
- Inner header row bumped from `minHeight: 44` to `minHeight: 50` with larger padding (14px 16px) and font size 14
- Cards now physically cannot render below ~52px regardless of CSS context

**`DataInspector` (new, in `ResourceMatchesTab.jsx`)**
- Inline diagnostic strip rendered at the top of the algorithmic matches list
- Shows the first matched resource's `id`, `name`, `grade`, `designation`, `location`, `benchDays`, `score`, and `skills count` in monospace
- Empty/missing fields are highlighted in red, present fields in slate
- Background turns amber if 3+ fields are empty (clear visual indicator something is wrong upstream)
- Dismissible with ✕; auto-shows again when a different position is selected

**Console logging**
- Added `useEffect` that logs the first match's full object whenever matches change:
  `[Matches] 21 resources matched for Test Lead (46610). First match: {...}`
- Combined with the earlier `[MSD] Available columns in first row: [...]` log, this makes any future field-mismatch issue diagnosable in a single browser console glance

**To pick up these changes**
- Stop the dev server (Ctrl+C) and run `npm run dev` again — Vite caches the dependency graph aggressively
- Hard-refresh the browser (Ctrl+Shift+R / Cmd+Shift+R)

---

## [2026-04-29] — Sort fixes: Priority handles P0/P1/.., highlight clears on third click

**Priority sort now handles both data formats**
- The `priority` field can be either `"P0"`/`"P1"`/`"P2"`/`"P3"` (from `criticality` in the TA file) OR `"High"`/`"Medium"`/`"Low"` (when `criticality` is missing and the fallback in `dataProcessor.js` kicks in)
- Old accessor only mapped High/Medium/Low → returned the same fallback (`3`) for every P-format row, so sort had no effect
- New accessor: regex-matches `^P(\d+)$` and uses the numeric component (P0=0, P1=1, P2=2, ...). Falls back to High=0/Medium=1/Low=2 if neither pattern matches
- Result: Priority column now sorts P0 → P1 → P2 → P3 (descending) and reverse on second click

**Sort highlight now reliably clears on third click**
- Consolidated `sortCol` + `sortDir` into a single `sort = { col, dir }` state object → guarantees atomic updates (no transient state where col is set but dir is null)
- Tightened the active-column check to `sort.col === col.k && sort.dir != null` — defense in depth so even if state ever gets out of sync, the highlight only renders when both fields are populated
- `useMemo` dependency list updated to `[overviewData, sort.col, sort.dir]`

---

## [2026-04-29] — Sort fixes: Priority works, highlight resets cleanly

**Priority sort now functions**
- The accessor previously only knew `{ High: 0, Medium: 1, Low: 2 }` — every `P0`/`P1`/`P2`/`P3` row hit the fallback `99`, so they all sorted equal (i.e. didn't sort at all).
- Updated `COL_KEYS["Priority"]` to parse `P0..P9` numerically with regex `/^P\s*(\d+)/` (loose enough to handle `"P0"`, `"P0 - Critical"`, `"P 0"`, etc.).
- Lower number = higher priority by convention (P0 > P1 > P2).
- Both `P#` and `High/Medium/Low` formats are supported via the same accessor.

**Per-column initial sort direction**
- Added `initialDir` to column definitions (defaults to `"desc"`).
- Priority now uses `initialDir: "asc"` so the first click puts P0 (most urgent) at the top — which is what users intuitively expect for priorities.
- 3-state cycle now: `initialDir` → opposite → reset.
  - For most columns: ↓ desc → ↑ asc → reset
  - For Priority: ↑ asc → ↓ desc → reset

**Highlight reset on third click**
- Was already implemented but combined into a single atomic `useState({ col, dir })` to eliminate any chance of `col` and `dir` being out of sync mid-render. The `isActive` check is strict: `sort.col === col.k && sort.dir != null`. When click 3 sets both to `null`, the teal highlight, white text, bottom border, and bold weight all clear simultaneously.

---

## [2026-04-29] — Dashboard chart improvements

**Status by Client — stacked bars + total label + visible client names**
- Converted the side-by-side `Open` / `Offered` bars into a single stacked bar per client (`Open` at the bottom, `Offered` stacked on top), reducing visual clutter
- Added a total label above each stack (sum of `Open + Offered`) in slate-700 weight 600
- X-axis tick labels now angled at -32° with `interval={0}` and `textAnchor="end"` so every client name renders without overlap
- Chart container resized: changed grid from `1fr 1fr` to `2fr 1fr` so the (longer) Status by Client chart gets twice the width while the (smaller) Aging Pipeline chart sits compact next to it
- Increased bottom margin to 50px to leave room for the angled labels
- Removed the redundant per-bar `LabelList` for `Open`/`Offered` segments — total above is enough; stack segments still tooltip on hover

**Aging Pipeline — angled bucket labels**
- Same -25° angle treatment on the bucket labels (`Pre-appr.`, `1-30 d`, etc.) so they don't get cropped in the narrower container
- Tick font slightly reduced (10 → 9.5) to balance the smaller container width
- Added `cursor` styling to the tooltip for cleaner hover state

**Aging donut — labels inside slices in white bold**
- Labels now positioned at the radial midpoint of each slice (`(innerRadius + outerRadius) / 2`) instead of outside the ring
- Rendered in `#FFFFFF`, font size 12, weight 700 — readable on every slice color (teal, slate, amber, red)
- Slices smaller than 4% of total (`percent < 0.04`) hide their label to avoid cramping
- `labelLine={false}` removes the leader lines that previously connected outside labels back to the slice
- `pointerEvents: "none"` on the text so hover tooltips on small slices still work

---

## [2026-04-29] — Dashboard chart polish: white in-bar labels + horizontal x-axis

**Status by Client**
- Removed the -32° angle on the x-axis client labels — they're now horizontal
- X-axis tick `fontSize` reduced from 10 → 9 so all client names fit on one line without overlap
- Bottom margin reduced from 50 → 8; XAxis `height` from 56 → 28 — bars now sit much closer to the bottom of the card with no wasted whitespace
- Total label moved OUT of above-the-bar position; instead each segment shows its own count INSIDE the segment in white bold (Open count inside the teal portion, Offered count inside the orange portion)
- Per-segment labels auto-hide when the segment is too short (`height < 14`) to avoid overflow

**Aging Pipeline Distribution**
- Same treatment: removed -25° angle, horizontal labels at fontSize 9.5, bottom margin reduced
- Bar value labels moved INSIDE the bar in white bold for tall bars; tiny bars (height < 16) keep the slate label above so the number is still readable

---

## [2026-04-29] — Total label on stacked bar + Confidence Overview ↔ Matches consistency fix

**Status by Client — total label floating on top**
- Re-added the floating total label above each stacked bar in slate-700 weight 700, fontSize 11
- The in-segment counts (white bold for Open and Offered) remain — so each bar now shows: Open count inside teal + Offered count inside orange + total floating above
- Both LabelLists are attached to the topmost (Offered) `<Bar>` segment so the total is positioned correctly relative to the stack height

**Confidence Overview row click — matches now appear for ALL requisitions**
- ROOT CAUSE: `overviewData` (which drives the Confidence table counts) was scoring positions against ALL bench resources globally, but `ResourceMatchesTab` filters bench resources by the position's shore. Result: the Confidence table promised, say, "14 High matches" for a position, but clicking the row took you to Matches view where the shore filter eliminated those resources, showing "no matches"
- Fixed in `SkillMappingPage.jsx` `overviewData` useMemo: added `posShore !== resShore` skip rule so the Confidence counts now reflect what users will actually see in the Matches view
- Both views now use identical scoring + filtering logic — they will never disagree
- Hardened `filteredBench` in `ResourceMatchesTab.jsx`: if `selectedPos.location` is undefined/null, the shore filter falls back to "all" instead of crashing on `selectedPos.location.toLowerCase()` or filtering by empty string (which would match nothing). Defensive against legacy reqs missing the location field
- Improved console diagnostic: when 0 matches are found, logs `console.warn` with the position's location, skills, filtered bench size, minScore, and tenure filter — so future "why no matches" issues are diagnosable in one console line

---

## [2026-04-29] — Sort highlight stickiness fix + wrapping client labels

**Confidence Overview — sort highlight stays clean across columns**
- Removed the `transition: "background 0.15s, border-color 0.15s"` from the `<th>` style
- During the 150ms fade animation, the previously-active column appeared "stuck" with teal still partially visible — especially when clicking rapidly between columns. With the transition removed, the active highlight now snaps cleanly: only the newly-clicked column shows teal, every other column is plain
- The `isActive` check (`sort.col === col.k && sort.dir != null`) was already strict enough that exactly one column can be active per render — the visual artifact was purely due to CSS animation overlap

**Status by Client — wrapping x-axis labels (no slant)**
- Custom tick renderer for the XAxis: splits client names on whitespace and renders each word on its own line via `<text>` with separate `<tspan>`-style positioning
- "PNC Bank" → "PNC" / "Bank", "American Honda" → "American" / "Honda", "JNC Research" → "JNC" / "Research"
- Labels remain horizontal — no slant or rotation
- For names with 3+ words, the first word goes on line 1 and the remainder is joined onto line 2 (capped at 2 lines so chart height stays consistent)
- XAxis `height` increased from 28 → 42 to fit the second line
- Single-word names ("Verizon", "LPL", "Cetera", "Internal", "Genentech", "Syneos") render unchanged on a single line

---

## [2026-04-29] — Status by Client labels: split on hyphens too

- Tick renderer's split regex broadened from `/\s+/` (whitespace only) to `/[\s\-_]+/` (whitespace, hyphens, and underscores)
- "Hi-Tech_Internal" → "Hi" / "Tech Internal" instead of staying on one line and overlapping its neighbours
- Naming with mixed separators (e.g. "Walgreens-Boots Alliance", "JNC-Research") now also wraps cleanly
- Underscores included since they show up in internal/system-generated client identifiers
