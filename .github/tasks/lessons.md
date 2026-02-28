# Agent Lessons

## Subagent Handoff Verification

**Lesson (TWM-105, Subagent B → C):** When a subagent reports "done", verify that the key artifact types were actually created by doing a targeted grep before dispatching the next subagent. Subagent B added poll blocks and API routes for 6 Finnhub tiles but silently omitted ALL 6 data function implementations — the code compiled only because TypeScript can't catch undeclared functions in the same module scope until it processes the whole file. The next subagent (C) had to fix this.

**Rule:** After each subagent completes multi-file work in `api/server.ts`, run:
```
grep "async function dataXxx" api/server.ts | wc -l
```
and compare against expected count before dispatching the next subagent.

## Missing oldString Context

**Lesson (TWM-104, Subagents A/B/C):** Some edits resulted in lines being joined together (e.g. `'alphavantage-forex-rates':      { w: 560, h: 280, title: 'Forex Rates' },  'alphavantage-commodities':`) because the subagent's `oldString` did not match exactly and the tool fell through to a partial match. 

**Rule:** When replacing in TileConfig.ts or similar densely-packed files, include the newline after the line being inserted-after as part of the `oldString`. Check for merged lines in TileConfig.ts after each batch.

## useSseChannel Import Path and API Pattern

**Lesson (TWM-106):** Subagent used wrong import path and destructuring for tiles. Correct patterns:
- Import: `import { useSseChannel } from '../../ui/useSseChannel';`
- Usage: `const { data: store, loading, error } = useSseChannel<MyData>('event', default);`

**Rule:** Before writing tile component code for any provider, check an existing tile file in the same provider folder for the correct useSseChannel import path and destructuring. SolidJS style objects also require kebab-case CSS properties, not camelCase (e.g. 'margin-bottom' not marginBottom).

## Verify CSS classes before using them in new components

**Lesson (TWM-108/110):** Used field__error CSS class in new modal components without checking if it existed. Rule: grep for any new CSS class before using it; add it to base.css if missing.

**Rule:** When adding a new UI component that uses CSS classes not already in existing similar components, grep for those classes first: grep -n 'field__error' src/styles/base.css. If missing, add the class definition alongside related classes.

## New todos always go at the end of todo.md

**Lesson (TWM-129/130):** Added a SAML todo as TWM-129 by inserting it mid-file after TWM-128, but TWM-129 was already taken by an existing task. The correct entry ended up as TWM-130 and had to be re-added at the end.

**Rule:** Before adding a new todo, always read the last ~20 lines of `.github/tasks/todo.md` to find the current highest TWM number, increment it by 1, and append the new entry at the very end of the file. Never insert mid-file.

