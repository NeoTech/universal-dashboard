# TWM Project - Task Tracking

## Completed ✅
- [x] TWM-1: Vite+TS scaffold
- [x] TWM-2: E2E infra (Vitest fetch-based)
- [x] TWM-3: CSS design tokens
- [x] TWM-4: ESLint + Prettier + CI
- [x] TWM-5: Fixture server
- [x] TWM-6: BSP tree data model
- [x] TWM-7: Layout engine worker
- [x] TWM-8: Tree mutations (setRatio, swapLeaves)
- [x] TWM-9: Serialization (versioned JSON)
- [x] TWM-10: Worker protocol extension
- [x] TWM-11: Solid.js renderer
- [x] TWM-12: Panel resize handles
- [x] TWM-13: Keyboard navigation (BSP tree-based)
- [x] TWM-14: HTMX panel content
- [x] TWM-15: SSE live reload (SseBridge)
- [x] TWM-16: Alpine.js status bar
- [x] TWM-17: Focus ring CSS (+ light theme tokens)
- [x] TWM-18: Drag-to-resize (pointer events on handles)
- [x] TWM-19: Workspace persistence (localStorage)
- [x] TWM-20: Multi-workspace (WorkspaceManager)
- [x] TWM-21: Panel title bar
- [x] TWM-22: Command palette (fuzzy search)
- [x] TWM-23: Config file (typed config + mergeConfig)
- [x] TWM-24: Keybindings (registry + dispatcher)
- [x] TWM-25: Panel lifecycle (mount/unmount hooks)
- [x] TWM-26: Context menu
- [x] TWM-27: Undo/redo (HistoryManager)
- [x] TWM-28: Panel content registry
- [x] TWM-29: Fullscreen panel (FullscreenManager)
- [x] TWM-30: Accessibility ARIA
- [x] TWM-31: Theme switching (dark/light + tokens)
- [x] TWM-32: Layout presets
- [x] TWM-33: App composition (App.tsx wires all subsystems)
- [x] TWM-34: Notification/toast system (ToastManager)
- [x] TWM-35: Panel switcher (content type selector)
- [x] TWM-36: Tab bar per panel (TabBar)
- [x] TWM-37: E2E integration (extended smoke tests, 5 e2e tests)
- [x] TWM-38: Window close confirmation (CloseGuard + beforeunload)
- [x] TWM-39: Bundle size audit (build test, JS < 500 KB, CSS < 100 KB)
- [x] TWM-40: Full app integration smoke (7 integration tests, App.tsx)
- [x] TWM-41: Final smoke pass (typecheck + lint + unit + e2e + build)
- [x] TWM-42: Stripe proxy server (api/server.ts, .env.example, all Stripe resources + SSE webhooks)
- [x] TWM-43: Typed Stripe browser client (src/data/stripe.ts + 11 tests)
- [x] TWM-44: Dashboard panel shell (DashboardPanel + PanelTree.renderPanel prop + App.tsx rewrite)
- [x] TWM-45: Tile engine (TileConfig + TileGrid drag/resize + tilePersistence)
- [x] TWM-46: Stripe tile components (7 tiles: payments/orders/products/subscriptions/customers/webhooks/revenue)
- [x] TWM-47: Visualisation primitives (Sparkline, Badge, Skeleton)
- [x] TWM-48: Add tile modal (2-step wizard: source kind to config)
- [x] TWM-49: REST tile source (RestTile.tsx - URL + headers + auto-detect display)
- [x] TWM-50: WebSocket tile source (WsTile.tsx - live stream + ring buffer)
- [x] TWM-51: Hints bar (HintsContext + StatusBar updated + HINTS_DEFAULT/HINTS_PALETTE)
- [x] TWM-52: Integration and final pass (313 tests / 44 files, typecheck ok, lint ok, e2e ok, build 0.84 KB JS / 13.22 KB CSS)
- [x] TWM-53: Blank screen fix — main.ts never called Solid render(); added render(App, DEFAULT_CONFIG) + removed require() in command handlers
- [x] TWM-54: Dashboard visual fixes — reactive VIEWPORT (window resize), tiles fill screen on first load, X button stop-propagates before titlebar pointer capture, TileGrid uses createStore+reconcile so tile components survive drag without API refetch (317 tests, typecheck ok, lint ok)
- [x] TWM-55: api/server.ts full rewrite — all mutation + retrieve routes (payments refund/capture/cancel, products CRUD + prices, subscriptions cancel/resume, customers list/detail/edit/delete, invoices finalize/pay/void/send, refunds list/create)
- [x] TWM-56: src/data/stripe.ts full rewrite — 8 new interfaces (StripePaymentDetail, StripePrice, StripeSubscriptionDetail, StripeCustomerListItem, StripeCustomerDetail, StripeInvoice, StripeInvoiceDetail, StripeRefund) + mutateResource helper + all read/mutation functions
- [x] TWM-57: Shared UI primitives — StripeDrawer (slide-in detail panel), useStripeAction (async hook with loading/error/reset), ConfirmDialog (destructive action modal)
- [x] TWM-58: PaymentsTile interactive — clickable rows → drawer with charge detail (billing, receipt URL, outcome) + Refund form (amount/reason + confirm) + Capture/Cancel actions
- [x] TWM-59: ProductsTile CRUD — card click → drawer with detail + prices table + archive price; Edit form; Archive/Restore toggle; Delete with confirm; + New Product modal; + Add Price inline form
- [x] TWM-60: SubscriptionsTile actions — row click → drawer with period/plan/trial details; Cancel at period end; Remove scheduled cancel; Cancel immediately (confirm); Resume (if paused)
- [x] TWM-61: CustomersTile full list — replaced KPI aggregate with fetchCustomerList() table; row click → drawer with full detail; Edit (name/email/phone); Delete with confirm
- [x] TWM-62: InvoicesTile (new) — list table with status badges; row click → drawer with line items + totals; Finalize (draft), Collect/Send/Void (open)
- [x] TWM-63: RefundsTile (new) — list table; + New Refund form (charge/PI ID, amount, reason)
- [x] TWM-64: Integration pass — TileType union + TILE_DEFAULTS (stripe-invoices, stripe-refunds); stripe/index.tsx factory registry; AddTileModal picker; base.css drawer/button/detail/toolbar CSS; 313 tests pass, typecheck clean, lint clean
- [x] TWM-65: ProductsTile filter chips — Active / Archived checkboxes in toolbar; both unchecked or both checked shows all products; count shows filtered/total
- [x] TWM-66: Fix resize-triggers-reload bug — root cause: PanelTree used Object.entries(rects()) causing new tuple references on every viewport change → Solid's For treated all panels as new → full DashboardPanel+tile unmount/remount+API refetch on every window resize. Fix: switch to Object.keys() (stable string IDs) with a reactive rect() accessor inside the callback. Also added untrack() around renderTile(tile) in TileGrid for defence.
- [x] TWM-67: OrdersTile interactive rewrite — clickable rows → StripeDrawer with full charge detail + refund/capture/cancel actions; stage pipeline (New→Processing→Packing→Shipped→Done) stored in SQLite (bun:sqlite, api/order-statuses.db); summary bar shows per-stage counts; done+failed rows struck through and dimmed; open orders fully interactive.
- [x] TWM-68: Vite proxy + shared api.ts — Vite dev-server now proxies /api/* and /health to localhost:3001 (single :8080 URL in browser); extracted fetchResource/mutateResource/TwmApiError into src/data/api.ts; stripe.ts now imports from api.ts; fetchOrderStatuses + updateOrderStatus migrated to shared helpers; .env.example documents VITE_API_URL override.
- [x] TWM-69: GitHub Actions tile — WorkflowRunsTile shows org-wide workflow runs (repo, workflow, branch, status/conclusion badge, time-ago); server handler GET /api/github/runs proxies GitHub API /orgs/{GITHUB_ORG}/actions/runs with GITHUB_TOKEN; src/data/github.ts types + fetch; TileType 'github-actions' added; startup log shows GitHub config status.
- [x] TWM-70: Cloudflare Pages tile — PagesTile shows projects table (name, env, deployment status badge, deployed-at); row click → drawer with last 8 deployments (status, branch, commit message, open link); server handler GET /api/cloudflare/pages + /api/cloudflare/pages/{project}/deployments proxies CF API; src/data/cloudflare.ts CFPagesProject/CFPagesDeployment types.
- [x] TWM-71: Cloudflare Workers tile — FunctionsTile shows scripts table (name, usage model badge, handlers, last modified); rows link to CF dashboard; server handler GET /api/cloudflare/workers; CFWorkerScript type; startup log shows CF config status.
- [x] TWM-72: PayPal transactions tile — TransactionsTile shows 30-day transactions (date, payer, amount, status badge) + balance summary bar; row click → drawer with full transaction detail (ID, status, amounts, fee, balance after, payer info); server handler GET /api/paypal/transactions + /api/paypal/balance with OAuth client_credentials token (in-memory cache, 8h TTL); src/data/paypal.ts full types.
- [x] TWM-73: Vercel + Netlify scaffolds — DeploymentsTile placeholder for each (coming soon message with token instructions); src/data/vercel.ts + src/data/netlify.ts with typed interfaces ready for implementation; stub API routes return 503; TileTypes 'vercel-deployments' + 'netlify-deployments' added.
- [x] TWM-74: renderTile + AddTileModal expansion — renderTile iterates all factory maps (Stripe, GitHub, Cloudflare, PayPal, Vercel, Netlify); AddTileModal source picker expanded to 8 providers with icons; all providers use unified typesForKind() lookup + single pickedType signal; CSS additions: .tile-coming-soon, .tr--link, .drawer-row, .drawer-dl, .tile-muted; 313/313 tests, typecheck clean.
- [x] TWM-75: Keyboard + command palette fixes — (1) CommandPalette: arrow key navigation (↑↓), Enter to run selected command, Escape to close, hover updates selection, overlay click to dismiss, complete palette CSS added (.command-palette-overlay/.command-palette/.command-palette__item--selected); (2) Keybinding defaults updated: splitHorizontal→Ctrl+Alt+H, splitVertical→Ctrl+Alt+V, +undo Ctrl+Z, +redo Ctrl+Shift+Z, +help ?; (3) App.tsx registers all 6 shortcuts + guards modifier-free shortcuts from firing inside input/textarea elements; (4) HintsContext HINTS_DEFAULT updated to show correct key strings; 313/313 tests, typecheck clean.
- [x] TWM-76: SSE push architecture — replaced per-tile HTTP polling with a single server-sent events channel; server maintains resource cache + per-provider poll loops (configurable via env vars) and broadcasts named events to all connected clients via GET /api/sse; browser shares one singleton EventSource (ref-counted, closes when last consumer cleans up) via useSseChannel hook; all 12 tiles (Stripe payments/products/subscriptions/customers/invoices/refunds/revenue/webhooks, GitHub runs, CF pages/workers, PayPal) converted to pure SSE receive with mutations retained as direct HTTP; OrdersTile uses SSE for orders list + onMount HTTP for local SQLite statuses; WebhooksTile merges SSE base list with dedicated live stream; .env.example updated with 7 poll-interval vars; vitest setup.ts adds MockEventSource global so jsdom tests pass; 313/313 tests, typecheck clean.
- [x] TWM-77: Multi-dashboard navigation — replaced split-horizontal / split-vertical commands with up to 4 independent dashboards; new DashboardManager (src/workspace/DashboardManager.ts) persists dashboard IDs + active index to localStorage; Ctrl+Right / Ctrl+Left navigate between dashboards (wrap-around); all dashboards kept mounted with CSS display:none so tile state survives switching; commands: New Dashboard, Close Dashboard, Go to Dashboard 1-4; StatusBar shows pip dot indicators (● ○ ○) with active dot highlighted; removed splitHorizontal/splitVertical from TwmKeybindings + DEFAULT_CONFIG; added nextDashboard/prevDashboard keybindings; HINTS_DEFAULT updated; 313/313 tests, typecheck clean.
- [x] TWM-78: AddTileModal UX restructure — replaced 2-step wizard with a single-screen tile picker that scales to 30+ providers; new tileRegistry.ts flat registry (TileDefinition: type, label, provider, icon, category, tags, status, description); search bar filters across all providers by label/provider/tags; 6-item category sidebar (All, Payments, Deployments, CI/Build, Infrastructure, Generic) filters tiles by domain group; 2-column tile card grid with icon + label grouped by provider section headers; coming-soon tiles (Vercel, Netlify) rendered as grayed disabled cards with SOON badge; REST/WebSocket config form shown as inline overlay when those tiles are clicked (Back button returns to grid); removed stripe-type-list/stripe-type-btn/source-type-list/source-type-btn CSS; added tile-picker__* + tile-card__* CSS system; modal widened to 480px; 14 new tests in add-tile-modal.test.tsx; 326/327 tests pass (1 pre-existing lint-guard timeout), typecheck clean, lint clean.

## TWM-79: Category system expansion
- [x] TWM-79-1: Add 'analytics' | 'finance' | 'security' | 'social' | 'comms' | 'productivity' to Category type in tileRegistry.ts
- [x] TWM-79-2: Add 6 entries to CATEGORIES array (Analytics���, Finance���, Security���, Social���, Comms���, Productivity���)

## TWM-80: Vercel full implementation (replace coming-soon stub)
- [x] TWM-80-1: Expand src/data/vercel.ts — VercelDeployment + VercelProject interfaces, fetchVercelDeployments()
- [x] TWM-80-2: Replace 503 stub GET /api/vercel/deployments in api/server.ts with real Vercel API proxy (Authorization: Bearer VERCEL_TOKEN)
- [x] TWM-80-3: Add optional /api/vercel/deployments/:id/events route for build logs
- [x] TWM-80-4: Register 'vercel-deployments' SSE poller in server.ts (30s interval)
- [x] TWM-80-5: Rewrite src/tiles/vercel/DeploymentsTile.tsx — table with state badges, time-ago, project name
- [x] TWM-80-6: Wire row click → StripeDrawer with build duration, branch, commit, link to Vercel
- [x] TWM-80-7: Mark vercel-deployments status: 'available' in tileRegistry.ts
- [x] TWM-80-8: Add VERCEL_TOKEN + VERCEL_TEAM_ID (optional) to .env.example
- [x] TWM-80-9: Add vercel-deployments to renderTile.tsx factory map

## TWM-81: Netlify full implementation (replace coming-soon stub)
- [x] TWM-81-1: Expand src/data/netlify.ts — NetlifySite + NetlifyDeploy interfaces, fetchNetlifyDeploys()
- [x] TWM-81-2: Replace 503 stub GET /api/netlify/deployments in api/server.ts — /api/netlify/sites + /api/netlify/sites/:id/deploys
- [x] TWM-81-3: Register 'netlify-deployments' SSE poller in server.ts (30s interval)
- [x] TWM-81-4: Rewrite src/tiles/netlify/DeploymentsTile.tsx — sites list with latest deploy per site, state badge
- [x] TWM-81-5: Wire row click → StripeDrawer with deploy title, branch, deploy URL, log link
- [x] TWM-81-6: Mark netlify-deployments status: 'available' in tileRegistry.ts
- [x] TWM-81-7: Add NETLIFY_TOKEN to .env.example
- [x] TWM-81-8: Add netlify-deployments to renderTile.tsx factory map

## TWM-82: CircleCI integration
- [x] TWM-82-1: Create src/data/circleci.ts — CircleCIPipeline + CircleCIWorkflow interfaces + fetchCircleCIPipelines()
- [x] TWM-82-2: Add GET /api/circleci/pipelines server route (header: Circle-Token) + GET /api/circleci/insights
- [x] TWM-82-3: Register 'circleci-pipelines' + 'circleci-insights' SSE pollers (60s)
- [x] TWM-82-4: Create src/tiles/circleci/PipelinesTile.tsx — table: pipeline name, workflow, branch, status badge, triggered-at
- [x] TWM-82-5: Create src/tiles/circleci/InsightsTile.tsx — success rate + duration trend per workflow
- [x] TWM-82-6: Create src/tiles/circleci/index.tsx factory barrel
- [x] TWM-82-7: Add TileTypes 'circleci-pipelines' | 'circleci-insights' to TileConfig.ts
- [x] TWM-82-8: Add TILE_DEFAULTS entries for circleci-pipelines / circleci-insights
- [x] TWM-82-9: Add CircleCI TileDefinitions to tileRegistry.ts (category: 'ci')
- [x] TWM-82-10: Add CIRCLECI_TOKEN + CIRCLECI_ORG_SLUG to .env.example
- [x] TWM-82-11: Add circleci entries to renderTile.tsx

## TWM-83: Travis CI integration
- [x] TWM-83-1: Create src/data/travisci.ts — TravisBuild interface + fetchTravisBuilds()
- [x] TWM-83-2: Add GET /api/travis/builds server route (Travis-API-Version: 3 header + Authorization: token)
- [x] TWM-83-3: Register 'travis-builds' SSE poller (60s)
- [x] TWM-83-4: Create src/tiles/travisci/BuildsTile.tsx — table: repo, branch, state badge, duration, committed-at
- [x] TWM-83-5: Create src/tiles/travisci/index.tsx factory barrel
- [x] TWM-83-6: Add TileType 'travis-builds' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-83-7: Add Travis CI TileDefinition to tileRegistry.ts (category: 'ci')
- [x] TWM-83-8: Add TRAVIS_TOKEN + TRAVIS_ORG to .env.example
- [x] TWM-83-9: Add travis entries to renderTile.tsx

## TWM-84: Bitrise integration
- [x] TWM-84-1: Create src/data/bitrise.ts — BitriseApp + BitriseBuild interfaces + fetchBitriseBuilds()
- [x] TWM-84-2: Add GET /api/bitrise/builds server route (Bitrise-Addon-Auth-Token or Authorization: token)
- [x] TWM-84-3: Register 'bitrise-builds' SSE poller (60s)
- [x] TWM-84-4: Create src/tiles/bitrise/BuildsTile.tsx — table: app title, branch, status badge, trigger time
- [x] TWM-84-5: Create src/tiles/bitrise/index.tsx factory barrel
- [x] TWM-84-6: Add TileType 'bitrise-builds' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-84-7: Add Bitrise TileDefinition to tileRegistry.ts (category: 'ci')
- [x] TWM-84-8: Add BITRISE_TOKEN to .env.example
- [x] TWM-84-9: Add bitrise entries to renderTile.tsx

## TWM-85: Docker Hub integration
- [x] TWM-85-1: Create src/data/dockerhub.ts — DockerHubRepo + DockerHubTag interfaces + fetchDockerHubRepos()
- [x] TWM-85-2: Add GET /api/dockerhub/repositories + /api/dockerhub/tags server routes (optional JWT auth)
- [x] TWM-85-3: Register 'dockerhub-repositories' SSE poller (5m)
- [x] TWM-85-4: Create src/tiles/dockerhub/RepositoriesTile.tsx — table: name, pull count, star count, last updated
- [x] TWM-85-5: Add row click → StripeDrawer with tag list
- [x] TWM-85-6: Create src/tiles/dockerhub/index.tsx factory barrel
- [x] TWM-85-7: Add TileTypes 'dockerhub-repositories' | 'dockerhub-tags' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-85-8: Add Docker Hub TileDefinitions to tileRegistry.ts (category: 'infrastructure')
- [x] TWM-85-9: Add DOCKERHUB_USERNAME + optional DOCKERHUB_PASSWORD to .env.example
- [x] TWM-85-10: Add dockerhub entries to renderTile.tsx

## TWM-86: SonarQube integration
- [x] TWM-86-1: Create src/data/sonarqube.ts — SonarProject + SonarQualityGate + SonarMeasure interfaces + fetch helpers
- [x] TWM-86-2: Add GET /api/sonarqube/quality (fan-out projects → quality gate) in server.ts (Authorization: Bearer)
- [x] TWM-86-3: Add GET /api/sonarqube/measures + /api/sonarqube/issues server routes
- [x] TWM-86-4: Register 'sonarqube-quality' + 'sonarqube-measures' SSE pollers (5m)
- [x] TWM-86-5: Create src/tiles/sonarqube/QualityTile.tsx — project list with gate status badge (OK/ERROR/WARN)
- [x] TWM-86-6: Create src/tiles/sonarqube/MeasuresTile.tsx — numeric measures (bugs, vulnerabilities, debt, coverage)
- [x] TWM-86-7: Create src/tiles/sonarqube/IssuesTile.tsx — issues table (severity badge, component, message)
- [x] TWM-86-8: Create src/tiles/sonarqube/index.tsx factory barrel
- [x] TWM-86-9: Add TileTypes 'sonarqube-quality' | 'sonarqube-measures' | 'sonarqube-issues' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-86-10: Add SonarQube TileDefinitions to tileRegistry.ts (category: 'ci')
- [x] TWM-86-11: Add SONARQUBE_URL + SONARQUBE_TOKEN to .env.example
- [x] TWM-86-12: Add sonarqube entries to renderTile.tsx

## TWM-87: Azure DevOps integration
- [x] TWM-87-1: Create src/data/azuredevops.ts — AzurePipeline + AzureRelease + AzureWorkItem interfaces + fetch helpers (Basic auth base64(:PAT))
- [x] TWM-87-2: Add GET /api/azuredevops/pipelines server route — top 5 projects → recent pipeline runs
- [x] TWM-87-3: Add GET /api/azuredevops/releases server route (vsrm.dev.azure.com base URL)
- [x] TWM-87-4: Add POST /api/azuredevops/workitems server route (WIQL query proxy)
- [x] TWM-87-5: Register 'azuredevops-pipelines' + 'azuredevops-releases' SSE pollers (60s)
- [x] TWM-87-6: Create src/tiles/azuredevops/PipelinesTile.tsx — table: project, pipeline name, result badge, finish time
- [x] TWM-87-7: Create src/tiles/azuredevops/ReleasesTile.tsx — table: release name, environment, status badge
- [x] TWM-87-8: Create src/tiles/azuredevops/WorkItemsTile.tsx — table: ID, title, type, state badge, assigned-to
- [x] TWM-87-9: Create src/tiles/azuredevops/index.tsx factory barrel
- [x] TWM-87-10: Add TileTypes 'azuredevops-pipelines' | 'azuredevops-releases' | 'azuredevops-workitems' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-87-11: Add Azure DevOps TileDefinitions to tileRegistry.ts (category: 'ci')
- [x] TWM-87-12: Add AZURE_DEVOPS_ORG + AZURE_DEVOPS_TOKEN to .env.example
- [x] TWM-87-13: Add azuredevops entries to renderTile.tsx

## TWM-88: npm Registry + jsDelivr integration
- [x] TWM-88-1: Create src/data/npm.ts — NpmPackage + NpmDownloads interfaces + fetchNpmDownloads() (no auth)
- [x] TWM-88-2: Add GET /api/npm/downloads server route — batch download counts for NPM_PACKAGES
- [x] TWM-88-3: Add GET /api/npm/metadata server route — package.json fields for each package
- [x] TWM-88-4: Register 'npm-downloads' SSE poller (5m)
- [x] TWM-88-5: Create src/tiles/npm/DownloadsTile.tsx — bar chart of weekly downloads per package
- [x] TWM-88-6: Create src/tiles/npm/MetadataTile.tsx — package cards (version, description, license, deps count)
- [x] TWM-88-7: Create src/tiles/npm/index.tsx factory barrel
- [x] TWM-88-8: Add TileTypes 'npm-downloads' | 'npm-metadata' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-88-9: Create src/data/jsdelivr.ts — JsDelivrHit interface + fetchJsDelivrStats()
- [x] TWM-88-10: Add GET /api/jsdelivr/hits server route — CDN hit stats per package
- [x] TWM-88-11: Create src/tiles/jsdelivr/HitsTile.tsx — table: package, version, hits, bandwidth
- [x] TWM-88-12: Create src/tiles/jsdelivr/index.tsx factory barrel
- [x] TWM-88-13: Add TileTypes 'jsdelivr-hits' | 'jsdelivr-versions' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-88-14: Add npm + jsDelivr TileDefinitions to tileRegistry.ts (category: 'analytics')
- [x] TWM-88-15: Add NPM_PACKAGES + JSDELIVR_PACKAGES to .env.example
- [x] TWM-88-16: Add npm + jsdelivr entries to renderTile.tsx

## TWM-89: WakaTime + Clockify integration
- [x] TWM-89-1: Create src/data/wakatime.ts — WakaTimeSummary + WakaTimeLanguage interfaces + fetchWakaTimeSummary() (Basic base64 key)
- [x] TWM-89-2: Add GET /api/wakatime/summary server route — single upstream call for today/week (shared by languages+projects)
- [x] TWM-89-3: Register 'wakatime-summary' SSE poller (5m)
- [x] TWM-89-4: Create src/ui/BarChart.tsx — vertical SVG bar chart component used by WakaTime tiles
- [x] TWM-89-5: Create src/tiles/wakatime/SummaryTile.tsx — total coded time + daily breakdown
- [x] TWM-89-6: Create src/tiles/wakatime/LanguagesTile.tsx — horizontal BarChart of hours per language
- [x] TWM-89-7: Create src/tiles/wakatime/ProjectsTile.tsx — table: project name, hours today/week
- [x] TWM-89-8: Create src/tiles/wakatime/index.tsx factory barrel
- [x] TWM-89-9: Add TileTypes 'wakatime-summary' | 'wakatime-languages' | 'wakatime-projects' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-89-10: Create src/data/clockify.ts — ClockifyEntry + ClockifyProject interfaces + fetchClockifyEntries() (X-Api-Key header)
- [x] TWM-89-11: Add GET /api/clockify/time-entries server route + GET /api/clockify/projects
- [x] TWM-89-12: Add GET /api/clockify/active (30s poll — active timer)
- [x] TWM-89-13: Create src/tiles/clockify/TimeEntriesTile.tsx — table: project, description, duration, date
- [x] TWM-89-14: Create src/tiles/clockify/ProjectsTile.tsx — project list with total duration summary
- [x] TWM-89-15: Create src/tiles/clockify/index.tsx factory barrel
- [x] TWM-89-16: Add TileTypes 'clockify-time-entries' | 'clockify-projects' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-89-17: Add WakaTime + Clockify TileDefinitions to tileRegistry.ts (category: 'productivity')
- [x] TWM-89-18: Add WAKATIME_API_KEY + CLOCKIFY_API_KEY + CLOCKIFY_WORKSPACE_ID to .env.example
- [x] TWM-89-19: Add wakatime + clockify entries to renderTile.tsx

## TWM-90: Linear integration
- [x] TWM-90-1: Create src/data/linear.ts — LinearIssue + LinearCycle + LinearTeam interfaces + GraphQL fetch helpers (Authorization: {key}, no Bearer prefix)
- [x] TWM-90-2: Add GET /api/linear/issues server route — pre-baked GraphQL query for team issues (status, priority, assignee)
- [x] TWM-90-3: Add GET /api/linear/cycles server route — active and past cycles with completion %
- [x] TWM-90-4: Add GET /api/linear/teams server route — team list with member count, open issue count
- [x] TWM-90-5: Register 'linear-issues' + 'linear-cycles' SSE pollers (60s)
- [x] TWM-90-6: Create src/tiles/linear/IssuesTile.tsx — table: ID, title, priority badge, status badge, assignee
- [x] TWM-90-7: Create src/tiles/linear/CyclesTile.tsx — active cycle progress bar + completed/remaining counts
- [x] TWM-90-8: Create src/tiles/linear/TeamsTile.tsx — team cards: name, member count, backlog vs in-progress
- [x] TWM-90-9: Create src/tiles/linear/index.tsx factory barrel
- [x] TWM-90-10: Add TileTypes 'linear-issues' | 'linear-cycles' | 'linear-teams' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-90-11: Add Linear TileDefinitions to tileRegistry.ts (category: 'productivity')
- [x] TWM-90-12: Add LINEAR_API_KEY + LINEAR_TEAM_ID to .env.example
- [x] TWM-90-13: Add linear entries to renderTile.tsx

## TWM-91: Jira integration
- [x] TWM-91-1: Create src/data/jira.ts — JiraIssue + JiraSprint + JiraProject interfaces + fetch helpers (Basic base64(email:token))
- [x] TWM-91-2: Add GET /api/jira/issues server route (JQL filter proxy, inject browse URL)
- [x] TWM-91-3: Add GET /api/jira/sprint server route (Agile v1 /rest/agile/1.0/board/:id/sprint)
- [x] TWM-91-4: Add GET /api/jira/projects server route
- [x] TWM-91-5: Register 'jira-issues' + 'jira-sprint' SSE pollers (60s)
- [x] TWM-91-6: Create src/tiles/jira/IssuesTile.tsx — table: key (linked), summary, type icon, status badge, assignee
- [x] TWM-91-7: Create src/tiles/jira/SprintTile.tsx — sprint name, dates, burndown bar (done/todo/in-progress)
- [x] TWM-91-8: Create src/tiles/jira/ProjectsTile.tsx — project cards with open issue count
- [x] TWM-91-9: Create src/tiles/jira/index.tsx factory barrel
- [x] TWM-91-10: Add TileTypes 'jira-issues' | 'jira-sprint' | 'jira-projects' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-91-11: Add Jira TileDefinitions to tileRegistry.ts (category: 'productivity')
- [x] TWM-91-12: Add JIRA_BASE_URL + JIRA_EMAIL + JIRA_API_TOKEN + JIRA_BOARD_ID to .env.example
- [x] TWM-91-13: Add jira entries to renderTile.tsx

## TWM-92: Slack integration
- [x] TWM-92-1: Create src/data/slack.ts — SlackMessage + SlackWorkspaceStats interfaces + fetchSlackMessages() (xoxb- token)
- [x] TWM-92-2: Add GET /api/slack/messages server route — conversations.list → channels.history for top N channels
- [x] TWM-92-3: Add GET /api/slack/workspace-stats server route — member count, channel count, bot count
- [x] TWM-92-4: Register 'slack-messages' SSE poller (30s)
- [x] TWM-92-5: Create src/tiles/slack/MessagesTile.tsx — feed of recent messages with channel, sender, timestamp
- [x] TWM-92-6: Create src/tiles/slack/WorkspaceStatsTile.tsx — KPI cards: members, channels, active users
- [x] TWM-92-7: Create src/tiles/slack/index.tsx factory barrel
- [x] TWM-92-8: Add TileTypes 'slack-messages' | 'slack-workspace-stats' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-92-9: Add Slack TileDefinitions to tileRegistry.ts (category: 'comms')
- [x] TWM-92-10: Add SLACK_BOT_TOKEN + SLACK_CHANNEL_IDS to .env.example
- [x] TWM-92-11: Add slack entries to renderTile.tsx

## TWM-93: Discord integration
- [x] TWM-93-1: Create src/data/discord.ts — DiscordGuildStats + DiscordChannel interfaces + fetchDiscordStats() (Bot token)
- [x] TWM-93-2: Add GET /api/discord/server-stats server route (guild info + approximate member count + presence count)
- [x] TWM-93-3: Add GET /api/discord/channels server route (text channels list + message count last 24h if available)
- [x] TWM-93-4: Register 'discord-server-stats' SSE poller (60s)
- [x] TWM-93-5: Create src/tiles/discord/ServerStatsTile.tsx — KPI: members, online now, channels, guild icon
- [x] TWM-93-6: Create src/tiles/discord/ChannelsTile.tsx — channel list with type icon
- [x] TWM-93-7: Create src/tiles/discord/index.tsx factory barrel
- [x] TWM-93-8: Add TileTypes 'discord-server-stats' | 'discord-channels' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-93-9: Add Discord TileDefinitions to tileRegistry.ts (category: 'comms')
- [x] TWM-93-10: Add DISCORD_BOT_TOKEN + DISCORD_GUILD_ID to .env.example
- [x] TWM-93-11: Add discord entries to renderTile.tsx

## TWM-94: Mailchimp integration
- [x] TWM-94-1: Create src/data/mailchimp.ts — MailchimpCampaign + MailchimpAudience interfaces + fetchMailchimpCampaigns() (Basic anystring:apikey, prefix from key suffix)
- [x] TWM-94-2: Add GET /api/mailchimp/campaigns server route — recent campaigns with stats (open/click rates)
- [x] TWM-94-3: Add GET /api/mailchimp/audience server route — list summary (total, cleaned, unsubscribed)
- [x] TWM-94-4: Register 'mailchimp-campaigns' SSE poller (5m)
- [x] TWM-94-5: Create src/tiles/mailchimp/CampaignsTile.tsx — table: name, status badge, sent count, open rate, click rate
- [x] TWM-94-6: Create src/tiles/mailchimp/AudienceTile.tsx — KPI cards: total contacts, growth, unsubscribe rate
- [x] TWM-94-7: Create src/tiles/mailchimp/index.tsx factory barrel
- [x] TWM-94-8: Add TileTypes 'mailchimp-campaigns' | 'mailchimp-audience' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-94-9: Add Mailchimp TileDefinitions to tileRegistry.ts (category: 'comms')
- [x] TWM-94-10: Add MAILCHIMP_API_KEY to .env.example
- [x] TWM-94-11: Add mailchimp entries to renderTile.tsx

## TWM-95: Google Analytics 4 integration
- [x] TWM-95-1: Create src/data/ga4.ts — GA4SessionTrend + GA4TopPage + GA4TrafficSource interfaces
- [x] TWM-95-2: Implement server-side JWT construction via WebCrypto (crypto.subtle.importKey + sign RS256) — no npm package needed, Bun has native crypto.subtle
- [x] TWM-95-3: Add token exchange: JWT → OAuth2 access token via googleapis token endpoint (cache token in-memory with TTL)
- [x] TWM-95-4: Add GET /api/ga4/sessions-trend server route — Analytics Data API runReport (7-day sessions by date)
- [x] TWM-95-5: Add GET /api/ga4/top-pages server route — top 10 pages by screenPageViews
- [x] TWM-95-6: Add GET /api/ga4/traffic-sources server route — sessions by sessionSource
- [x] TWM-95-7: Register 'ga4-sessions-trend' SSE poller (5m)
- [x] TWM-95-8: Create src/tiles/ga4/SessionsTrendTile.tsx — Sparkline of daily sessions over 7d
- [x] TWM-95-9: Create src/tiles/ga4/TopPagesTile.tsx — ranked table: page path, views, avg session duration
- [x] TWM-95-10: Create src/tiles/ga4/TrafficSourcesTile.tsx — donut/bar breakdown: organic, paid, referral, direct
- [x] TWM-95-11: Create src/tiles/ga4/index.tsx factory barrel
- [x] TWM-95-12: Add TileTypes 'ga4-sessions-trend' | 'ga4-top-pages' | 'ga4-traffic-sources' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-95-13: Add GA4 TileDefinitions to tileRegistry.ts (category: 'analytics')
- [x] TWM-95-14: Add GA4_PROPERTY_ID + GA4_SERVICE_ACCOUNT_JSON to .env.example
- [x] TWM-95-15: Add ga4 entries to renderTile.tsx

## TWM-96: Instatus + HackerNews integration
- [x] TWM-96-1: Create src/data/instatus.ts — InstatusPage + InstatusIncident + InstatusComponent interfaces
- [x] TWM-96-2: Add GET /api/instatus/overview server route — dual-mode: authenticated API or public summary.json, both normalized to same shape
- [x] TWM-96-3: Add GET /api/instatus/incidents server route
- [x] TWM-96-4: Register 'instatus-overview' SSE poller (60s)
- [x] TWM-96-5: Create src/tiles/instatus/OverviewTile.tsx — status page components with operational/degraded/down badge
- [x] TWM-96-6: Create src/tiles/instatus/IncidentsTile.tsx — active + recent resolved incidents table
- [x] TWM-96-7: Create src/tiles/instatus/index.tsx factory barrel
- [x] TWM-96-8: Add TileTypes 'instatus-overview' | 'instatus-incidents' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-96-9: Create src/data/hackernews.ts — HNStory interface + fetchTopStories() (no auth, public API)
- [x] TWM-96-10: Add GET /api/hn/top-stories server route — top 500 IDs → parallel item fetches for top 30
- [x] TWM-96-11: Add GET /api/hn/mentions server route — keyword filter across top stories (HN_KEYWORDS env var)
- [x] TWM-96-12: Register 'hn-top-stories' SSE poller (5m)
- [x] TWM-96-13: Create src/tiles/hackernews/TopStoriesTile.tsx — numbered story list with score, comments count, time-ago
- [x] TWM-96-14: Create src/tiles/hackernews/MentionsTile.tsx — keyword-matched stories highlighted
- [x] TWM-96-15: Create src/tiles/hackernews/index.tsx factory barrel
- [x] TWM-96-16: Add TileTypes 'instatus-overview' | 'instatus-incidents' | 'hn-top-stories' | 'hn-mentions' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-96-17: Add Instatus + HackerNews TileDefinitions to tileRegistry.ts (category: 'analytics')
- [x] TWM-96-18: Add INSTATUS_SUBDOMAIN + optional INSTATUS_API_KEY + INSTATUS_PAGE_ID + HN_KEYWORDS to .env.example
- [x] TWM-96-19: Add instatus + hackernews entries to renderTile.tsx

## TWM-97: Alpha Vantage + CoinGecko integration
- [x] TWM-97-1: Add getCached<T>/setCached<T> TTL-based cache helper to api/server.ts (shared by all finance routes)
- [x] TWM-97-2: Create src/data/alphavantage.ts — AVQuote + AVSparkline interfaces
- [x] TWM-97-3: Add GET /api/alphavantage/quotes server route — sequential fetches with 12s delay, detect rate-limit in body "Note"/"Information" → return cached, 60m poll
- [x] TWM-97-4: Add GET /api/alphavantage/sparklines server route — TIME_SERIES_DAILY for each symbol
- [x] TWM-97-5: Register 'alphavantage-quotes' SSE poller (60m)
- [x] TWM-97-6: Create src/tiles/alphavantage/QuotesTile.tsx — table: symbol, price, change%, volume; red/green coloring
- [x] TWM-97-7: Create src/tiles/alphavantage/SparklinesTile.tsx — mini Sparkline per symbol in a grid
- [x] TWM-97-8: Create src/tiles/alphavantage/index.tsx factory barrel
- [x] TWM-97-9: Add TileTypes 'alphavantage-quotes' | 'alphavantage-sparklines' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-97-10: Create src/data/coingecko.ts — CoinPrice + CoinGlobal interfaces + fetchCoinPrices() (no auth)
- [x] TWM-97-11: Add GET /api/coingecko/prices server route — sequential 1s delay, 429 detection + cache fallback
- [x] TWM-97-12: Add GET /api/coingecko/global server route — global market data (market cap, btc dominance)
- [x] TWM-97-13: Register 'coingecko-prices' SSE poller (2m)
- [x] TWM-97-14: Create src/tiles/coingecko/PricesTile.tsx — table: coin name, price, 24h change%, market cap
- [x] TWM-97-15: Create src/tiles/coingecko/GlobalTile.tsx — KPI: total market cap, 24h volume, BTC dominance
- [x] TWM-97-16: Create src/tiles/coingecko/index.tsx factory barrel
- [x] TWM-97-17: Add TileTypes 'coingecko-prices' | 'coingecko-global' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-97-18: Add Alpha Vantage + CoinGecko TileDefinitions to tileRegistry.ts (category: 'finance')
- [x] TWM-97-19: Add ALPHA_VANTAGE_KEY + AV_SYMBOLS + COINGECKO_COINS to .env.example
- [x] TWM-97-20: Add alphavantage + coingecko entries to renderTile.tsx

## TWM-98: Finnhub + Plaid integration
- [x] TWM-98-1: Create src/data/finnhub.ts — FinnhubQuote + FinnhubNews interfaces + fetchFinnhubQuotes() (X-Finnhub-Token header)
- [x] TWM-98-2: Add GET /api/finnhub/quotes server route — parallel Promise.all (60/min free), 30s poll
- [x] TWM-98-3: Add GET /api/finnhub/news server route — company news for symbols
- [x] TWM-98-4: Register 'finnhub-quotes' SSE poller (30s)
- [x] TWM-98-5: Create src/tiles/finnhub/QuotesTile.tsx — table: symbol, c (current), dp (% change), d (change abs)
- [x] TWM-98-6: Create src/tiles/finnhub/NewsTile.tsx — news feed: headline, source, time-ago, sentiment badge
- [x] TWM-98-7: Create src/tiles/finnhub/index.tsx factory barrel
- [x] TWM-98-8: Add TileTypes 'finnhub-quotes' | 'finnhub-news' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-98-9: Run: bun install plaid
- [x] TWM-98-10: Create src/data/plaid.ts — PlaidBalance + PlaidTransaction interfaces
- [x] TWM-98-11: Add GET /api/plaid/balances server route (PlaidApi SDK, handle ITEM_LOGIN_REQUIRED → 401)
- [x] TWM-98-12: Add GET /api/plaid/transactions server route — last 30 days
- [x] TWM-98-13: Register 'plaid-balances' SSE poller (60s)
- [x] TWM-98-14: Create src/tiles/plaid/BalancesTile.tsx — account cards: name, type, current/available balance
- [x] TWM-98-15: Create src/tiles/plaid/TransactionsTile.tsx — table: date, merchant, amount, category badge
- [x] TWM-98-16: Create src/tiles/plaid/index.tsx factory barrel
- [x] TWM-98-17: Add TileTypes 'finnhub-quotes' | 'finnhub-news' | 'plaid-balances' | 'plaid-transactions' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-98-18: Add Finnhub + Plaid TileDefinitions to tileRegistry.ts (category: 'finance')
- [x] TWM-98-19: Add FINNHUB_TOKEN + FH_SYMBOLS + PLAID_CLIENT_ID + PLAID_SECRET + PLAID_ACCESS_TOKEN + PLAID_ENV to .env.example
- [x] TWM-98-20: Add finnhub + plaid entries to renderTile.tsx

## TWM-99: HIBP + VirusTotal + Shodan integration
- [x] TWM-99-1: Create src/data/hibp.ts — HibpBreach + HibpBreachStatus interfaces + fetchHibpBreaches() (hibp-api-key header, 1.6s between calls)
- [x] TWM-99-2: Add GET /api/hibp/breach-status server route — per-email breach lookup, 6h poll
- [x] TWM-99-3: Add GET /api/hibp/recent-breaches server route — public breach list
- [x] TWM-99-4: Register 'hibp-breach-status' SSE poller (6h)
- [x] TWM-99-5: Create src/tiles/hibp/BreachStatusTile.tsx — email list with breach count badge (red if >0)
- [x] TWM-99-6: Create src/tiles/hibp/RecentBreachesTile.tsx — recent breach cards: name, date, pwn count
- [x] TWM-99-7: Create src/tiles/hibp/index.tsx factory barrel
- [x] TWM-99-8: Add TileTypes 'hibp-breach-status' | 'hibp-recent-breaches' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-99-9: Create src/data/virustotal.ts — VtDomainReport + VtUrlScan interfaces (x-apikey header, 15s between domain reqs)
- [x] TWM-99-10: Add GET /api/virustotal/domain-threats server route — batch domain analysis, 5m poll
- [x] TWM-99-11: Add POST /api/virustotal/url-scan server route — submit URL scan + poll report
- [x] TWM-99-12: Create src/tiles/virustotal/DomainThreatsTile.tsx — domain cards: malicious/suspicious/harmless counts, vendor badges
- [x] TWM-99-13: Create src/tiles/virustotal/UrlScanTile.tsx — scan submission form + result display
- [x] TWM-99-14: Create src/tiles/virustotal/index.tsx factory barrel
- [x] TWM-99-15: Add TileTypes 'virustotal-domain-threats' | 'virustotal-url-scan' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-99-16: Create src/data/shodan.ts — ShodanExposedService + ShodanVulnSummary interfaces (api-key query param, 30m poll)
- [x] TWM-99-17: Add GET /api/shodan/exposed-services server route — aggregate CVEs server-side, credit-aware
- [x] TWM-99-18: Add GET /api/shodan/vuln-summary server route — top CVEs with severity counts
- [x] TWM-99-19: Create src/tiles/shodan/ExposedServicesTile.tsx — table: host, port, protocol, product, CVE badge
- [x] TWM-99-20: Create src/tiles/shodan/VulnSummaryTile.tsx — CVE donut: critical/high/medium/low
- [x] TWM-99-21: Create src/tiles/shodan/index.tsx factory barrel
- [x] TWM-99-22: Add TileTypes 'shodan-exposed-services' | 'shodan-vuln-summary' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-99-23: Add HIBP + VT + Shodan TileDefinitions to tileRegistry.ts (category: 'security')
- [x] TWM-99-24: Add HIBP_API_KEY + HIBP_EMAILS + VIRUSTOTAL_API_KEY + VT_DOMAINS + SHODAN_API_KEY + SHODAN_QUERY to .env.example
- [x] TWM-99-25: Add hibp + virustotal + shodan entries to renderTile.tsx

## TWM-100: WooCommerce + Shopify integration
- [x] TWM-100-1: Create src/data/woocommerce.ts — WooOrder + WooSalesSummary + WooTopSeller interfaces (Basic auth consumer key:secret)
- [x] TWM-100-2: Add GET /api/woocommerce/orders server route
- [x] TWM-100-3: Add GET /api/woocommerce/sales-summary server route — aggregate total sales, orders count, avg order value
- [x] TWM-100-4: Add GET /api/woocommerce/top-sellers server route — product sales ranking
- [x] TWM-100-5: Register 'woocommerce-orders' SSE poller (60s)
- [x] TWM-100-6: Create src/tiles/woocommerce/OrdersTile.tsx — table: order #, customer, status badge, total, date
- [x] TWM-100-7: Create src/tiles/woocommerce/SalesSummaryTile.tsx — KPI: revenue, order count, avg value
- [x] TWM-100-8: Create src/tiles/woocommerce/TopSellersTile.tsx — ranked product list with units sold
- [x] TWM-100-9: Create src/tiles/woocommerce/index.tsx factory barrel
- [x] TWM-100-10: Add TileTypes 'woocommerce-orders' | 'woocommerce-sales-summary' | 'woocommerce-top-sellers' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-100-11: Create src/data/shopify.ts — ShopifyOrder + ShopifyProduct interfaces (X-Shopify-Access-Token header)
- [x] TWM-100-12: Add GET /api/shopify/orders server route
- [x] TWM-100-13: Add GET /api/shopify/products server route
- [x] TWM-100-14: Register 'shopify-orders' SSE poller (60s)
- [x] TWM-100-15: Create src/tiles/shopify/OrdersTile.tsx — table: order name, email, financial/fulfillment status badge, total, date
- [x] TWM-100-16: Create src/tiles/shopify/ProductsTile.tsx — product cards: title, vendor, price, inventory count
- [x] TWM-100-17: Create src/tiles/shopify/index.tsx factory barrel
- [x] TWM-100-18: Add TileTypes 'shopify-orders' | 'shopify-products' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-100-19: Add WooCommerce + Shopify TileDefinitions to tileRegistry.ts (category: 'payments')
- [x] TWM-100-20: Add WC_BASE_URL + WC_CONSUMER_KEY + WC_CONSUMER_SECRET + SHOPIFY_SHOP + SHOPIFY_ACCESS_TOKEN to .env.example
- [x] TWM-100-21: Add woocommerce + shopify entries to renderTile.tsx

## TWM-101: Reddit + Product Hunt integration
- [x] TWM-101-1: Create src/data/reddit.ts — RedditPost interface + fetchRedditHot() (optional OAuth or public JSON fallback)
- [x] TWM-101-2: Add GET /api/reddit/hot-posts server route — fetch hot posts for REDDIT_SUBREDDITS
- [x] TWM-101-3: Add GET /api/reddit/keyword-monitor server route — filter posts matching REDDIT_KEYWORDS
- [x] TWM-101-4: Register 'reddit-hot-posts' SSE poller (5m)
- [x] TWM-101-5: Create src/tiles/reddit/HotPostsTile.tsx — post feed: subreddit, title, score, comments, flair badge
- [x] TWM-101-6: Create src/tiles/reddit/KeywordMonitorTile.tsx — keyword-matched posts with match highlight
- [x] TWM-101-7: Create src/tiles/reddit/index.tsx factory barrel
- [x] TWM-101-8: Add TileTypes 'reddit-hot-posts' | 'reddit-keyword-monitor' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-101-9: Create src/data/producthunt.ts — PHProduct interface + fetchTopLaunches() (GraphQL POST, Authorization: Bearer)
- [x] TWM-101-10: Add GET /api/producthunt/top-launches server route — top 10 posts by votes
- [x] TWM-101-11: Register 'producthunt-top-launches' SSE poller (5m)
- [x] TWM-101-12: Create src/tiles/producthunt/TopLaunchesTile.tsx — ranked cards: name, tagline, votes, thumbnail, link
- [x] TWM-101-13: Create src/tiles/producthunt/index.tsx factory barrel
- [x] TWM-101-14: Add TileTypes 'reddit-hot-posts' | 'reddit-keyword-monitor' | 'producthunt-top-launches' to TileConfig.ts + TILE_DEFAULTS
- [x] TWM-101-15: Add Reddit + Product Hunt TileDefinitions to tileRegistry.ts (category: 'social')
- [x] TWM-101-16: Add REDDIT_SUBREDDITS + REDDIT_KEYWORDS + PRODUCTHUNT_API_TOKEN to .env.example
- [x] TWM-101-17: Add reddit + producthunt entries to renderTile.tsx

## TWM-102: Final integration pass
- [x] TWM-102-1: Run bun run typecheck — fix all type errors
- [x] TWM-102-2: Run bun run lint — fix all lint warnings
- [x] TWM-102-3: Run bun run test — all tests passing
- [x] TWM-102-4: Run bun run build — confirm bundle compiles clean
- [x] TWM-102-5: Verify AddTileModal shows all new providers in correct categories
- [x] TWM-102-6: Verify renderTile.tsx handles every new TileType

## TWM-103: Close existing tile gaps (9 TileTypes registered but unimplemented)
- [x] TWM-103-1: alphavantage-sparklines — server: `dataAvSparklines()` using TIME_SERIES_DAILY compact, SSE `alphavantage-sparklines` 60m poll; component `SparklinesTile.tsx` mini chart + price + 1d change per symbol
- [x] TWM-103-2: coingecko-prices — component `CoinPricesTile.tsx` consuming existing `coingecko-markets` SSE channel; compact coin ticker strip
- [x] TWM-103-3: coingecko-global — server: `dataCoingeckoGlobal()` GET /global, SSE `coingecko-global` 10m poll; component `CoinGlobalTile.tsx` showing total market cap + BTC dominance + active coins
- [x] TWM-103-4: finnhub-news — server: `dataFinnhubNews()` GET /news?category=general, SSE `finnhub-news` 5m poll; component `FinnhubNewsTile.tsx` scrollable list with source + headline + category tabs
- [x] TWM-103-5: plaid-balances — component `PlaidBalancesTile.tsx` consuming existing `plaid-accounts` SSE channel; visual bar per account (current vs available)
- [x] TWM-103-6: plaid-transactions — server: `dataPlaidTransactions()` POST /transactions/get last 30d/50 items, SSE `plaid-transactions` 5m poll; component `PlaidTransactionsTile.tsx` date + merchant + amount + category
- [x] TWM-103-7: woocommerce-sales-summary — verify or create server `dataWooSalesSummary()` GET /reports/sales, SSE `woocommerce-sales-summary` 10m; component `WooSalesSummaryTile.tsx` KPI card (revenue, orders, avg order)
- [x] TWM-103-8: woocommerce-top-sellers — verify or create server `dataWooTopSellers()` GET /reports/top_sellers, SSE `woocommerce-top-sellers` 30m; component `WooTopSellersTile.tsx` ranked product list
- [x] TWM-103-9: shopify-products — verify or create server `dataShopifyProducts()` GET /admin/api/2024-07/products.json, SSE `shopify-products` 10m; component `ShopifyProductsTile.tsx` product card grid
- [x] TWM-103-10: Wire all 9 into renderTile.tsx + tileRegistry.ts
- [x] TWM-103-11: bun run typecheck + bun run test — all passing

## TWM-104: Alpha Vantage extended tiles (10 new tile types) ✅ COMPLETE
- [x] TWM-104-1: `alphavantage-market-status` — GET MARKET_STATUS, SSE 5m; `MarketStatusTile.tsx` open/closed + session per exchange
- [x] TWM-104-2: `alphavantage-market-movers` — GET TOP_GAINERS_LOSERS, SSE 15m; `MarketMoversTile.tsx` gainers/losers/most-active tabs
- [x] TWM-104-3: `alphavantage-news-sentiment` — GET NEWS_SENTIMENT, SSE 15m; `NewsSentimentTile.tsx` headline + bullish/bearish score per ticker
- [x] TWM-104-4: `alphavantage-earnings` — GET EARNINGS, SSE 1h; `EarningsTile.tsx` annual + quarterly EPS history chart
- [x] TWM-104-5: `alphavantage-earnings-calendar` — GET EARNINGS_CALENDAR, SSE 1h; `EarningsCalendarTile.tsx` upcoming earnings by date
- [x] TWM-104-6: `alphavantage-fundamentals` — GET OVERVIEW, SSE 1h; `FundamentalsTile.tsx` P/E, EPS, market cap, 52w range table
- [x] TWM-104-7: `alphavantage-forex-rates` — GET FX_DAILY compact, SSE 30m; `ForexRatesTile.tsx` sparkline per pair with bid/ask
- [x] TWM-104-8: `alphavantage-commodities` — GET WTI/BRENT/NATURAL_GAS/COPPER/WHEAT, SSE 1h; `CommoditiesTile.tsx` price + change per commodity
- [x] TWM-104-9: `alphavantage-economic-indicators` — GET REAL_GDP/INFLATION/UNEMPLOYMENT/CPI, SSE 24h; `EconomicIndicatorsTile.tsx` KPI row
- [x] TWM-104-10: `alphavantage-insider-transactions` — GET ANALYTICS_FIXED_WINDOW insider, SSE 1h; `InsiderTransactionsTile.tsx` buy/sell signal per ticker
- [x] TWM-104-11: Add all 10 TileTypes to TileConfig.ts + TILE_DEFAULTS + TILE_POLL_MS
- [x] TWM-104-12: Register all 10 in renderTile.tsx + tileRegistry.ts
- [x] TWM-104-13: bun run typecheck + bun run test — all passing (327/327)

## TWM-105: CoinGecko extended (6) + Finnhub extended (12) = 18 new tile types ✅ COMPLETE
- [x] TWM-105-1: `coingecko-trending` — GET /search/trending, SSE 15m; `TrendingCoinsTile.tsx` top-7 trending coins with rank + change
- [x] TWM-105-2: `coingecko-price-chart` — GET /coins/{id}/market_chart per-instance id, SSE 10m; `PriceChartTile.tsx` 7d sparkline + change%
- [x] TWM-105-3: `coingecko-defi-overview` — GET /global/decentralized_finance_defi, SSE 10m; `DefiOverviewTile.tsx` total DeFi TVL + dominance
- [x] TWM-105-4: `coingecko-categories` — GET /coins/categories, SSE 30m; `CoinCategoriesTile.tsx` sorted by 24h change
- [x] TWM-105-5: `coingecko-exchanges` — GET /exchanges (top 10 by trust score), SSE 30m; `CryptoExchangesTile.tsx` volume table
- [x] TWM-105-6: `coingecko-coin-detail` — GET /coins/{id} per-instance, SSE 5m; `CoinDetailTile.tsx` image + description + market stats
- [x] TWM-105-7: `finnhub-company-news` — GET /company-news per-instance symbol, SSE 5m; `CompanyNewsTile.tsx`
- [x] TWM-105-8: `finnhub-market-news` — GET /news?category=forex|crypto|merger, SSE 5m; `MarketNewsTile.tsx` category tabs
- [x] TWM-105-9: `finnhub-earnings-calendar` — GET /calendar/earnings, SSE 1h; `FinnhubEarningsCalendarTile.tsx` upcoming earnings
- [x] TWM-105-10: `finnhub-earnings-surprises` — GET /stock/earnings per-instance, SSE 1h; `EarningsSurprisesTile.tsx` actual vs estimate
- [x] TWM-105-11: `finnhub-analyst-consensus` — GET /stock/recommendation per-instance, SSE 1h; `AnalystConsensusTile.tsx` consensus bar
- [x] TWM-105-12: `finnhub-fundamentals` — GET /stock/metric per-instance, SSE 1h; `FinnhubFundamentalsTile.tsx` key ratios table
- [x] TWM-105-13: `finnhub-market-status` — GET /stock/market-status per exchange, SSE 5m; `FinnhubMarketStatusTile.tsx` open/closed indicator
- [x] TWM-105-14: `finnhub-insider-transactions` — GET /stock/insider-transactions per-instance, SSE 1h; `InsiderTxTile.tsx` buy/sell rows
- [x] TWM-105-15: `finnhub-insider-sentiment` — GET /stock/insider-sentiment per-instance, SSE 1h; `InsiderSentimentTile.tsx` MSPR gauge
- [x] TWM-105-16: `finnhub-ipo-calendar` — GET /calendar/ipo, SSE 1h; `IpoCalendarTile.tsx` upcoming IPOs table
- [x] TWM-105-17: `finnhub-sec-filings` — GET /stock/filings per-instance, SSE 1h; `SecFilingsTile.tsx` form type + date + link
- [x] TWM-105-18: `finnhub-company-profile` — GET /stock/profile2 per-instance, SSE 6h; `CompanyProfileTile.tsx` logo + name + sector
- [x] TWM-105-19: Add all 18 TileTypes to TileConfig.ts + TILE_DEFAULTS + TILE_POLL_MS
- [x] TWM-105-20: Register all 18 in tileRegistry.ts (factory pattern, no renderTile changes needed)
- [x] TWM-105-21: bun run typecheck + bun run test — all passing (327/327)

## TWM-106: Plaid extended tiles (6 new tile types) ✅
- [x] TWM-106-1: `plaid-investment-portfolio` — GET /investments/holdings, SSE 10m; `InvestmentPortfolioTile.tsx` security name + quantity + value + gain/loss
- [x] TWM-106-2: `plaid-investment-transactions` — GET /investments/transactions/get last 30d, SSE 10m; `InvestmentTransactionsTile.tsx` buy/sell/div rows
- [x] TWM-106-3: `plaid-liabilities-overview` — GET /liabilities/get, SSE 30m; `LiabilitiesOverviewTile.tsx` total owed + per-account breakdown
- [x] TWM-106-4: `plaid-credit-card-details` — derived from liabilities credit card data, SSE 30m; `CreditCardDetailsTile.tsx` utilisation ring + last statement + min payment due
- [x] TWM-106-5: `plaid-mortgage-tracker` — derived from liabilities mortgage data, SSE 1h; `MortgageTrackerTile.tsx` outstanding balance + payoff date + interest rate
- [x] TWM-106-6: `plaid-statements` — GET /statements/list, SSE 1h; `PlaidStatementsTile.tsx` downloadable PDF links per account
- [x] TWM-106-7: Add all 6 TileTypes to TileConfig.ts + TILE_DEFAULTS + TILE_POLL_MS
- [x] TWM-106-8: Register all 6 in plaid/index.tsx + tileRegistry.ts
- [x] TWM-106-9: bun run typecheck + bun run test — all passing (327/327)


## TWM-107: Fix GitHub tile for GITHUB_USER + fine-grained token ✅
- [x] TWM-10&1: `dataGithubRuns()` — add GITHUB_USER fallback: fetch user repos then fan-out to per-repo action runs; parallelize with Promise.all; cap at 100 repos / 50 total runs
- [x] TWM-10&2: REST handler `/api/github/runs` — same org/user branching; remove hard-error on missing GITHUB_ORG
- [x] TWM-10&3: Poller guard — change condition from `GITHUB_TOKEN && GITHUB_ORG` to `GITHUB_TOKEN && (GITHUB_ORG || GITHUB_USER)`
- [x] TWM-10&4: bun run typecheck + bun run test — all passing

## TWM-108: RSS feed URL config modal on tile-add ✅
- [x] TWM-10&1: AddTileModal — add `rss-feed` to the `setConfiguring()` branch in `selectTile()`
- [x] TWM-10&2: AddTileModal — add rssUrl/rssMaxItems signals and RSS config form sub-screen (Feed URL required, Max Items optional default 20)
- [x] TWM-10&3: AddTileModal — URL validation (http/https, disable submit if invalid); RSS-specific add handler builds `makeTile('rss-feed', { rss: { url, maxItems } })`
- [x] TWM-10&4: bun run typecheck + bun run test — all passing

## TWM-109: Audit and fix tile defaults ✅
- [x] TWM-10&1: TileConfig.ts — add missing TILE_POLL_MS entries (~20 tiles falling back to 60s hardcoded): reddit, npm, jsdelivr, linear, jira, slack, discord, mailchimp, ga4, instatus, hibp, virustotal, shodan
- [x] TWM-10&2: TileConfig.ts — fix undersized TILE_DEFAULTS dimensions: stripe-orders, stripe-customers, discord-channels, jsdelivr-versions, woocommerce-top-sellers, wakatime-summary, ga4-sessions-trend
- [x] TWM-10&3: TileConfig.ts — fix generic/ambiguous titles: github-actions -> Workflow Runs, stripe-orders -> Stripe Orders, stripe-customers -> Stripe Customers, instatus-overview -> Instatus Overview
- [x] TWM-10&4: bun run typecheck + bun run test — all passing

## TWM-110: Per-tile gear icon for post-creation configuration ✅
- [x] TWM-110-1: Create src/tiles/TileConfigModal.tsx — title field, refresh interval (seconds), type-specific sections (rss: url+maxItems, rest: url+headers+displayMode, ws: url+maxMessages); Save/Cancel
- [x] TWM-110-2: TileGrid.tsx — add onConfigureTile prop; render gear button in titlebar with stopPropagation; add .tile__gear CSS
- [x] TWM-110-3: DashboardPanel.tsx — add configuringTileId signal; pass onConfigureTile to TileGrid; render TileConfigModal; handleSaveConfig updates layout + saveTileLayout
- [x] TWM-110-4: bun run typecheck + bun run test — all passing

## TWM-111: Add "Last updated" timestamp to each tile ✅
- [x] TWM-111-1: TileConfig.ts — added `showLastUpdated?: boolean` to TileConfig interface (defaults true)
- [x] TWM-111-2: TileGrid.tsx — renders "Updated X ago" footer per tile; reads `sseRevision` from useSseChannel for immediate reactivity; hidden via `display:none` until first SSE message; respects `showLastUpdated` flag
- [x] TWM-111-3: useSseChannel.ts — added `sseReceivedAt: Map<string, number>` (epoch stamps per channel) + exported `sseRevision` SolidJS signal (increments on every message)
- [x] TWM-111-4: base.css — added `.tile__footer` styles (right-aligned, dimmed, border-top)
- [x] TWM-111-5: TileConfigModal.tsx — added "Show last updated footer" checkbox; persisted to `showLastUpdated` on save
- [x] TWM-111-6: 327/327 tests pass, typecheck clean

## TWM-112: Add "Refresh now" button to each tile for manual data refresh ✅
- [x] TWM-112-1: TileConfig.ts — add `isRefreshing` boolean to TileConfig
- [x] TWM-112-2: renderTile.tsx — add refresh button in tile header; on click, set `isRefreshing` to true and trigger data refresh (re-fetch from server or re-open WebSocket); disable button while `isRefreshing` is true
- [x] TWM-112-3: Server data functions — add support for on-demand refresh via query param or WebSocket message; ensure `lastUpdated` is updated on manual refresh
- [x] TWM-112-4: Triggers API refresh as well.
- [x] TWM-112-5: bun run typecheck + bun run test — all passing

## TWM-113: Fix tile refresh not adjusting api refresh intervals. It should treat .env as initial if nothing else is set from user. ✅
- [x] TWM-113-1: TileConfig.ts / TileGrid.tsx — fixed priority: `tile.refreshInterval ?? TILE_POLL_MS[type] ?? 60_000` (user config wins over env default) in both TileGrid and TileConfigModal
- [x] TWM-113-2: TileRefreshTimer.tsx — added `onRefresh?: () => void` prop; attached to `animationiteration` event on the countdown arc so the ring completing one cycle actually triggers `POST /api/refresh/:channel`
- [x] TWM-113-3: TileGrid.tsx — passes `onRefresh={() => onRefreshTile(tile.id)}` to TileRefreshTimer so every tile auto-refreshes on its configured schedule
- [x] TWM-113-4: TileConfigModal.tsx — fixed same priority inversion so the modal shows the user's saved interval, not the env default
- [x] TWM-113-5: 327/327 tests pass, typecheck clean

## TWM-114: Add "Display mode" option to toggle between compact/detailed views for applicable tiles ✅
- [x] TWM-114-1: TileConfig.ts — add `displayMode
` enum ('compact' | 'detailed') to TileConfig; set default per tile type in TILE_DEFAULTS
- [x] TWM-114-2: renderTile.tsx — pass `displayMode` to tile components; within each tile component, conditionally render compact or detailed view based on `displayMode`
- [x] TWM-114-3: TileConfigModal.tsx — add select input for `displayMode` with options 'Compact' and 'Detailed'; on save, update `displayMode` in TileConfig
- [x] TWM-114-4: bun run typecheck + bun run test — all passing

## TWM-115: Copying a tile by ALT+Drag tile
- [x] TWM-115-1: TileGrid.tsx — add `onTileCopy` prop; detect `e.altKey` in `onDragPointerDown` to enter copy-mode; on pointer-up in copy-mode call `onTileCopy(sourceId, dropX, dropY)` instead of moving the tile
- [x] TWM-115-2: DashboardPanel.tsx — implement `handleCopyTile(sourceId, x, y)` which clones the source tile config with a new ID positioned at (x, y); append to layout and call `saveTileLayout`
- [x] TWM-115-3: bun run typecheck + bun run test — all passing

## TWM-116: Tiles lacking .env variables should warn in the Tile and explain configuration.
- [x] TWM-116-1: TileConfig.ts — add optional `missingEnvVars?: string[]` field to `TileConfig`; server SSE poll handlers set this field (per channel) when required env vars are absent
- [x] TWM-116-2: BaseTile.tsx — read `useTileConfig()?.missingEnvVars` inside BaseTile; if non-empty, render a warning banner listing the missing vars with setup instructions instead of (or above) the normal loading/content/error states
- [x] TWM-116-3: bun run typecheck + bun run test — all passing

## TWM-117: Add "Test connection" button in TileConfigModal for REST/WS tiles to validate API credentials and connectivity before saving ✅
- [x] TWM-117-1: TileConfigModal.tsx — for REST/WS tiles, add a "Test connection" button; on click, send a test request to the server (e.g. GET /api/test-connection with tile type and config); display success or error message based on response
- [x] TWM-117-2: Server — implement /api/test-connection route which validates the provided config by making a test API call; return success or detailed error message
- [x] TWM-117-3: bun run typecheck + bun run test — all passing

## TWM-118: Editing .env file in UI
- [x] TWM-118-1: Create EnvConfigModal.tsx — list of env vars with current values, input fields to edit, Save/Cancel buttons
- [x] TWM-118-2: DashboardPanel.tsx — add "Edit environment variables" button that opens EnvConfigModal; handle saving updates to .env file and reloading server
- [x] TWM-118-3: Server — implement API route to read/write .env file securely
- [x] TWM-118-4: bun run typecheck + bun run test — all passing

## TWM-119: Turning off refresh by setting polling to Zero (0)
- [x] TWM-119-1: TileConfigModal.tsx — allow refresh interval input to accept 0 (meaning "manual only"); change `min="5"` to `min="0"` and update the save logic so `refreshInterval: 0` is stored (not coerced to 5000)
- [x] TWM-119-2: TileGrid.tsx — when `tile.refreshInterval === 0`, skip rendering `<TileRefreshTimer>` entirely so the ring never fires; for self-polling tiles (RSS/REST/WS in their `createEffect` interval), skip `setInterval` when `refreshInterval === 0`
- [x] TWM-119-3: Server (api/server.ts) — expose `POST /api/poll/pause/:channel` and `POST /api/poll/resume/:channel`; DashboardPanel calls pause when a tile's `refreshInterval` is set to 0 and resume when it's set back to a non-zero value; server skips the scheduled poll loop for paused channels
- [x] TWM-119-4: bun run typecheck + bun run test — all passing

## TWM-120: Refactor tiles into a base class where each tile is an extension rather than individuals inhereting commons properties.
- [x] TWM-120-1: Create BaseTile.tsx — common layout, titlebar with refresh and config buttons, footer with last updated; accepts props for title, displayMode, showLastUpdated, isRefreshing, onRefresh, onConfigure
- [x] TWM-120-2: Refactor existing tiles to extend BaseTile and use its layout and functionality
- [x] TWM-120-3: bun run typecheck + bun run test — all passing
- [x] TWM-120-4: Verify all tiles still render correctly and retain functionality after refactor. Verify that all necessary tiles were converted to basetile.

## TWM-121: Fix github poll rating preventing error.
- The error   [poll] fetching    github-runs
  [poll] ✗ error     github-runs                       125ms  {
        "message": "API rate limit exceeded for user ID 168627. If you reach out to GitHub Support for help, please include the request ID ECBB:211721:92377:BF859:69A1DE33 and timestamp 2026-02-27 18:11:29 UTC. For more on scraping GitHub and how it may affect your rights, please review our Terms of Service (https:\/\/docs.github.com\/en\/site-policy\/github-terms\/github-terms-of-service)",
        "documentation_url": "https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api#rate-limiting",
        "status": "403"
- [x] TWM-121-1: Implement exponential backoff retry logic in the server data fetching function for github-runs when a 403 rate limit error is encountered; log retries and final failure if max retries exceeded
- [x] TWM-121-2: Consider implementing caching of GitHub API responses to reduce the number of API calls and avoid hitting rate limits
- [x] TWM-121-3: bun run typecheck + bun run test — all passing}

## TWM-122: Add user authentication and per-user dashboards
- [x] TWM-122-1: Implement user authentication (e.g. JWT-based auth with login/signup routes); secure API routes to require authentication
- [x] TWM-122-122: Update dashboard layout and tile configurations to be stored per user in a database; ensure users only see and can configure their own dashboards
- [x] TWM-122-3: Update server data fetching to be aware of user context if necessary (e.g. for user-specific API credentials)
- [x] TWM-122-4: bun run typecheck + bun run test — all passing

### Review
- Optional JWT auth behind `AUTH_ENABLED=true` env var (fully backward-compatible when disabled)
- SQLite `auth.db` with `users` (PBKDF2/sha512 passwords) and `tile_layouts` (per-user per-workspace JSON) tables
- Manual HMAC-SHA256 JWT implementation via `node:crypto` — zero external auth libs
- `window.fetch` monkey-patched in `AuthContext.onMount` to auto-add `Authorization: Bearer` to all `/api/` calls
- SSE token passed as `?token=` query param (EventSource can't set headers)
- `LoginModal` with login/register toggle; `AuthGate` blocks the app until authenticated when auth is enabled
- Per-user layout load/save via `GET|POST /api/layout/:workspace`; DashboardPanel loads from server on mount, saves on every change
- 327/327 tests, typecheck clean, lint clean

## TWM-123: Add support for custom user-defined tiles with arbitrary API endpoints
- [ ] TWM-123-1: Update AddTileModal to allow creating a "Custom API" tile where users can specify the API endpoint, HTTP method, headers, and how to display the response data (e.g. as a table, list, or key-value pairs)
- [ ] TWM-123-2: Implement server route to proxy requests to the specified API endpoint with the provided configuration; handle authentication if needed
- [ ] TWM-123-3: Create a new tile component that can render the response data based on the user's display configuration
- [ ] TWM-123-4: bun run typecheck + bun run test — all passing

## TWM-124: Implement expectation in API for renew, instead of having it renew on every cycle - if its exepcted to update it should, otherwise it will return cache and not poll external source.
- [ ] TWM-124-1: Update server data fetching functions to check for an "expectUpdate" flag in the request; if true, fetch fresh data from the external API; if false, return cached data without making an external API call
- [ ] TWM-124-2: Update TileRefreshTimer to send "expectUpdate=true" when triggering a refresh, and regular polling to send "expectUpdate=false"
- [ ]TWM-124-3: bun run typecheck + bun run test — all passing  

## TWM-125: Fix help shortcut and add keyboard shortcuts modal
- The `?` key is listed in the hints bar as "Help" but currently just opens the command palette (`openPalette`). It should open a dedicated HelpModal listing all keyboard shortcuts and notable interactions.
- [ ] TWM-125-1: Create `src/ui/HelpModal.tsx` — full-screen modal overlay triggered by `?`; lists all keybindings from `DEFAULT_CONFIG.keybindings` with labels and descriptions in a two-column table; includes an "Interactions" section covering mouse/drag behaviours: ALT+drag to copy a tile, drag titlebar to move, drag resize handle to resize, right-click tile for context menu; has a close button and closes on Escape or click-outside
- [ ] TWM-125-2: App.tsx — change the `kb.help` registration from `openPalette` to a new `openHelp` signal/setter; render `<HelpModal open={helpOpen()} onClose={() => setHelpOpen(false)} />` in the App JSX
- [ ] TWM-125-3: `src/ui/HintsContext.tsx` — update the `?` hint label from `'Help'` to `'Help / Shortcuts'` so the status bar hint is accurate
- [ ] TWM-125-4: bun run typecheck + bun run test — all passing

## TWM-126: Fix Reddit tiles — "Unknown tile type" error for reddit-hot-posts and reddit-keyword-monitor
- **Root cause:** `tileRegistry.ts` exposes `reddit-hot-posts` and `reddit-keyword-monitor` in the Add Tile picker, but `src/tiles/reddit/index.tsx` only registers a factory for `'reddit-posts'`. Adding either UI-facing type renders "Unknown tile type: reddit-hot-posts". Additionally `TILE_SSE_CHANNEL` has no mapping for these two types, so they would attempt to subscribe to non-existent SSE channels instead of the shared `reddit-posts` channel.
- [ ] TWM-126-1: `src/tiles/TileConfig.ts` — add `TILE_SSE_CHANNEL` overrides: `'reddit-hot-posts': 'reddit-posts'` and `'reddit-keyword-monitor': 'reddit-posts'` so both types consume the existing SSE feed; remove the redundant `'reddit-posts'` TileType (it is an internal channel name, not a user-facing tile type) — or keep it as a hidden alias
- [ ] TWM-126-2: `src/tiles/reddit/` — create `HotPostsTile.tsx` (subscribes to `reddit-posts`, renders hot posts table sorted by score with upvote/comment counts and subreddit column, links open in new tab) and `KeywordMonitorTile.tsx` (same feed, filters/highlights rows that match `REDDIT_KEYWORDS` env var, shows keyword badge)
- [ ] TWM-126-3: `src/tiles/reddit/index.tsx` — add factories for `'reddit-hot-posts'` and `'reddit-keyword-monitor'` mapping to the two new tile components
- [ ] TWM-126-4: `api/server.ts` — update `CHANNEL_ENV_MAP` so `reddit-hot-posts` and `reddit-keyword-monitor` both resolve to `['REDDIT_SUBREDDITS or REDDIT_KEYWORDS']` (currently only `reddit-posts` is mapped, leaving the UI types uncovered by the env-warning banner)
- [ ] TWM-126-5: bun run typecheck + bun run test — all passing

## TWM-127: Graph visualisation for JSON/WS tiles
- **Goal:** Allow REST and WebSocket tiles to render incoming numeric data as a live line/bar chart instead of (or alongside) the raw JSON log or table view. Users configure which field to plot via the tile config modal.
- [ ] TWM-127-1: Add `chartField?: string` and `chartType?: 'line' | 'bar'` to `RestTileConfig` and `WsTileConfig` in `src/tiles/TileConfig.ts`
- [ ] TWM-127-2: Create `src/ui/MiniChart.tsx` — a lightweight SVG-based chart component (no external lib); accepts `data: number[]`, `type: 'line' | 'bar'`, `label?: string`; line chart draws a polyline with a fill gradient; bar chart draws fixed-width rects; auto-scales Y axis to min/max of data window; renders within a fixed 200 px height container
- [ ] TWM-127-3: `WsTile.tsx` — when `chartField` is set, extract that field from each incoming message using the existing `getField()` helper and append to a numeric ring buffer (max 100 points); render `<MiniChart>` above (or instead of) the message list/table; keep existing table/log view togglable via a small "Table / Chart" switch button
- [ ] TWM-127-4: `RestTile.tsx` — when `chartField` is set and the response is an array, map each element through `getField()` to build the data series; re-render chart on each SSE refresh; same "Table / Chart" toggle
- [ ] TWM-127-5: `TileConfigModal.tsx` — add "Chart field" text input (dot-path, e.g. `p` for Binance price) and "Chart type" radio (Line / Bar) to both WS and REST config sections; only shown when tile supports charting
- [ ] TWM-127-6: `src/styles/base.css` — add `.mini-chart`, `.mini-chart__svg`, `.mini-chart__line`, `.mini-chart__fill`, `.mini-chart__bar`, `.mini-chart__toggle` styles; chart toggle button uses existing `.btn--sm` style
- [ ] TWM-127-7: bun run typecheck + bun run test — all passing

## TWM-128: GraphQL tile
- **Goal:** A first-class GraphQL tile where the endpoint URL, operation, variables, and headers are all configurable in the tile config modal. The response is auto-detected as a table (if the selected field is an array of objects), JSON tree, or plain text — same display pipeline as `RestTile`.
- [ ] TWM-128-1: `src/tiles/TileConfig.ts` — add `GraphqlTileConfig` interface (`url: string`, `query: string`, `variables?: string` (JSON string), `dataPath?: string` (dot-path into response to extract, e.g. `data.users`), `headers?: Record<string, string>`, `refreshInterval?: number`, `displayMode?: 'table' | 'json' | 'text'`); add `'graphql'` to `TileType` union; add `TILE_DEFAULTS['graphql']`; add `graphql?: GraphqlTileConfig` to `TileConfig`
- [ ] TWM-128-2: Create `src/tiles/sources/GraphqlTile.tsx` — posts `{ query, variables }` as JSON to the configured endpoint with configurable headers; extracts the response sub-tree via `dataPath` using the same dot-path traversal as `getField()`; auto-detects + renders as table/JSON/text with the same logic as `RestTile`; uses `usePagination` + `<PaginationBar>` for table mode; shows loading skeleton + error state via `<BaseTile>`; re-fetches on `tileRefresh()` and on `refreshInterval`
- [ ] TWM-128-3: `src/tiles/sources/index.tsx` (or equivalent barrel) — register `'graphql'` factory pointing to `<GraphqlTile>`
- [ ] TWM-128-4: `TileConfigModal.tsx` — add GraphQL-specific config section (shown when `isGraphql()`): endpoint URL input, multi-line `<textarea>` for the GraphQL query with monospace styling, Variables textarea (JSON, optional), Data path input (e.g. `data.orders`), Headers textarea (JSON, optional), Display mode select (Table / JSON / Text), Refresh interval, "Test connection" button that POSTs the query and reports HTTP status or first-field preview
- [ ] TWM-128-5: `src/tiles/tileRegistry.ts` — add `TileDefinition` for `'graphql'` (label: `'GraphQL'`, provider: `'Generic'`, icon: `'◈'`, category: `'generic'`, tags: `['graphql', 'api', 'query']`, status: `'available'`)
- [ ] TWM-128-6: `api/server.ts` — add `POST /api/test-connection` support for `type: 'graphql'` (proxy the introspection or provided query with 10 s timeout, same pattern as REST test); add `CHANNEL_ENV_MAP` entry for `'graphql'` (no required env vars)
- [ ] TWM-128-7: `src/styles/base.css` — add `.graphql-tile__query` for the query textarea in the modal (monospace, min-height 120 px, resize: vertical)
- [ ] TWM-128-8: bun run typecheck + bun run test — all passing

## TWM-129: Reload .env / restart API server from UI
- **Goal:** After saving `.env` via the env modal, the user can trigger a live env reload or full server restart without leaving the browser. Two tiers: (1) hot-reload — re-read `.env` into `process.env` in-process (instant, no downtime), (2) full restart — spawn a new server process and exit the current one (needed when native add-ons or cached module state depend on env vars set at startup).
- [ ] TWM-129-1: `api/server.ts` — add `POST /api/server/reload-env`: reads `.env` from disk and merges keys into `process.env` (existing keys overwritten, new keys added); returns `{ ok: true, reloaded: string[] }` listing the keys that changed; no restart required
- [ ] TWM-129-2: `api/server.ts` — add `POST /api/server/restart`: responds `{ ok: true }` immediately, then calls `process.exit(0)` after a 200 ms delay (assumes the process is managed by a supervisor like `bun --watch` or PM2 that will respawn); log `[server] restarting on user request` to stdout before exit
- [ ] TWM-129-3: `src/tiles/EnvConfigModal.tsx` — after a successful save, show two action buttons below the "✔ Saved to .env" confirmation: **"Reload env"** (calls `POST /api/server/reload-env`, shows reloaded key count) and **"Restart server"** (calls `POST /api/server/restart`, shows a "Restarting…" spinner then polls `GET /health` every second until the server responds, then shows "Server back online"); buttons only visible after a successful save
- [ ] TWM-129-4: `src/styles/base.css` — add `.env-config-modal__post-save` flex row for the two post-save action buttons; reuse `.btn--sm` + `.btn--neutral` / `.btn--danger` styles
- [ ] TWM-129-5: bun run typecheck + bun run test — all passing

## TWM-130: SAML SSO authentication provider
- **Goal:** Add SAML 2.0 as an optional auth provider so organisations can use their existing identity provider (Okta, Azure AD, Google Workspace, etc.) to log in instead of local username/password. Controlled by a new `AUTH_PROVIDER` env var (`local` = default, `saml` = SAML SSO). Local auth continues to work unchanged.
- [ ] TWM-130-1: `api/server.ts` — add `AUTH_PROVIDER` env var (`'local' | 'saml'`, default `'local'`); add SAML config constants (`SAML_ENTRY_POINT`, `SAML_ISSUER`, `SAML_CERT`, `SAML_CALLBACK_URL` from env); implement SP-initiated SSO flow: `GET /api/auth/saml/login` redirects to the IdP with a signed AuthnRequest; `POST /api/auth/saml/callback` receives + validates the SAML response (use `node:crypto` for XML signature verification — no external SAML lib unless unavoidable), extracts `NameID` as username, upserts the user in `auth.db`, and issues a JWT that is passed back to the frontend via a redirect to `/?token=<jwt>`; `GET /api/auth/saml/metadata` returns the SP metadata XML
- [ ] TWM-130-2: `GET /api/auth/config` — extend response to include `provider: 'local' | 'saml'` and `samlLoginUrl: string | null` so the frontend knows which flow to initiate
- [ ] TWM-130-3: `src/ui/LoginModal.tsx` — when `auth.provider() === 'saml'`, replace the username/password form with a single "Sign in with SSO" button that navigates to `/api/auth/saml/login`; local mode is unchanged
- [ ] TWM-130-4: `src/ui/AuthContext.tsx` — on mount, check `window.location.search` for `?token=`; if present, call `auth.login(token)`, strip the param from the URL via `history.replaceState`, then fetch `/api/auth/me` to populate user info
- [ ] TWM-130-5: `.env.example` — document `AUTH_PROVIDER`, `SAML_ENTRY_POINT`, `SAML_ISSUER`, `SAML_CERT` (PEM base64), `SAML_CALLBACK_URL` with examples for Okta and Azure AD
- [ ] TWM-130-6: bun run typecheck + bun run test — all passing

## TWM-131: Configurable API server host/port and proxy backend URLs via .env
- **Goal:** The `bun run api` server should be fully configurable from `.env` so it can be deployed and run independently of the Vite frontend — on a different host, port, or machine. The upstream provider URLs it proxies to should also be overridable so the same binary can target staging, production, or local mocks without code changes.
- [ ] TWM-131-1: `api/server.ts` — read `API_HOST` (default `0.0.0.0`) and `API_PORT` (default `3001`) from `process.env` and use them in the `Bun.serve({ hostname, port })` call; log the bound address on startup so it's visible in the terminal
- [ ] TWM-131-2: `vite.config.ts` — read `VITE_API_URL` (already in `.env.example`) for the dev-server proxy target; ensure it falls back to `http://localhost:3001` so local dev still works out of the box without any `.env` changes
- [ ] TWM-131-3: `api/server.ts` — read per-provider base URL overrides from `process.env`: `STRIPE_API_URL`, `GITHUB_API_URL`, `CLOUDFLARE_API_URL`, `PAYPAL_API_URL`; default to the current hardcoded origins; use the env value as the base for all outgoing `fetch` calls in the matching provider block
- [ ] TWM-131-4: `api/server.ts` — add a generic `BACKEND_BASE_URL` fallback for REST tile proxying (`/api/proxy/*`) so custom REST tiles can target an internal service configured in `.env`
- [ ] TWM-131-5: `.env.example` — document `API_HOST`, `API_PORT`, `VITE_API_URL`, `STRIPE_API_URL`, `GITHUB_API_URL`, `CLOUDFLARE_API_URL`, `PAYPAL_API_URL`, `BACKEND_BASE_URL` with comments covering common scenarios: remote API server, GitHub Enterprise, Stripe CLI, local mock
- [ ] TWM-131-6: `src/tiles/EnvConfigModal.tsx` — add a read-only "Server" info section showing the currently active `API_PORT`/`API_HOST` and each provider base URL, so operators can confirm what the running server is pointed at without SSH
- [ ] TWM-131-7: bun run typecheck + bun run test — all passing

## TWM-132: Docker Compose deployment with Ngrok + Traefik reverse proxy
- **Goal:** Package the dashboard frontend and API server as separate Docker containers orchestrated by Docker Compose. Add a Traefik reverse proxy for internal routing and an Ngrok sidecar to expose the whole stack to the internet with a stable public URL — suitable for demos, webhooks, and remote access without a public static IP.
- [ ] TWM-132-1: `docker/Dockerfile.api` — multi-stage Bun image: `FROM oven/bun:1 AS builder` installs dependencies; production stage copies `api/` + built assets, runs `bun api/server.ts`; `API_HOST=0.0.0.0` baked as default ENV; exposes port 3001
- [ ] TWM-132-2: `docker/Dockerfile.dashboard` — multi-stage Node/Bun image: builder stage runs `bun run build` (Vite); production stage serves `dist/` via a lightweight static file server (e.g. `bunx serve dist -l 8080`); exposes port 8080
- [ ] TWM-132-3: `docker-compose.yml` — defines four services: `dashboard` (Dockerfile.dashboard, port 8080), `api` (Dockerfile.api, port 3001), `traefik` (official `traefik:v3` image, listens on 80/443, Docker provider enabled, dashboard on port 8090), `ngrok` (`ngrok/ngrok` image, tunnels to `traefik:80`); all services on a shared `twm` bridge network; `api` and `dashboard` have Traefik labels for routing (`Host` rules + `PathPrefix` stripping); env vars passed through to `api` from a `.env` file
- [ ] TWM-132-4: `docker-compose.yml` — Traefik routing rules: `Host(\`dashboard.localhost\`)` → `dashboard:8080`; `Host(\`dashboard.localhost\`) && PathPrefix(\`/api\`)` → `api:3001` (strip `/api` prefix); in Ngrok-exposed mode all rules match the public Ngrok hostname via `HostRegexp` middleware
- [ ] TWM-132-5: `docker-compose.yml` — Ngrok service config: reads `NGROK_AUTHTOKEN` from env; `command: http traefik:80 --log-level=info`; healthcheck polls `http://ngrok:4040/api/tunnels`; a small init container (or entrypoint script) fetches the assigned public URL from the Ngrok API and prints it to stdout so the operator sees the URL on `docker compose up`
- [ ] TWM-132-6: `docker/traefik.yml` — static Traefik config: `entryPoints.web.address: ":80"`, `providers.docker.exposedByDefault: false`, `api.dashboard: true`, `api.insecure: true` (dashboard on 8090); log level info
- [ ] TWM-132-7: `.env.example` — add `NGROK_AUTHTOKEN`, `NGROK_DOMAIN` (optional static domain for paid Ngrok plans), `TRAEFIK_DASHBOARD_PORT=8090`; document how to get an Ngrok auth token and set a reserved domain
- [ ] TWM-132-8: `README.md` (or `docs/docker.md`) — quickstart section: prerequisites (Docker + Compose v2), `cp .env.example .env` → fill in tokens, `docker compose up --build`, open printed Ngrok URL; note on webhook registration (use the Ngrok URL as the Stripe/GitHub webhook base)
- [ ] TWM-132-9: bun run typecheck + bun run test — all passing (unit tests unaffected; verify build smoke test still passes against the production Vite output)