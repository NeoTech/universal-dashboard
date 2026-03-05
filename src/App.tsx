import { createSignal, createEffect, onMount, onCleanup, Index, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { TwmConfig } from './config/config';
import { ThemeManager } from './config/ThemeManager';
import { KeybindingRegistry } from './keyboard/keybindings';
import { HistoryManager } from './workspace/HistoryManager';
import { makeLeaf, setRatio, leaves } from './layout/tree';
import type { Tree } from './layout/tree';
import { computeRects, computeHandles } from './layout/tree';
import { WorkspaceManager } from './workspace/WorkspaceManager';
import { DashboardManager } from './workspace/DashboardManager';
import { PanelTree } from './renderer/PanelTree';
import { StatusBar } from './panels/StatusBar';
import { CommandPalette } from './ui/CommandPalette';
import type { Command } from './ui/CommandPalette';
import { HelpModal } from './ui/HelpModal';
import { HintsProvider, useHints, HINTS_DEFAULT, HINTS_PALETTE } from './ui/HintsContext';
import { DashboardPanel } from './panels/DashboardPanel';
import { useSseChannel } from './ui/useSseChannel';
import { AuthProvider, useAuth } from './ui/AuthContext';
import { LoginModal } from './ui/LoginModal';
import { clearTileLayout, deleteLayoutFromServer, loadWorkspacesFromServer } from './tiles/tilePersistence';
import { API_BASE_URL } from './data/api';

/**
 * Props accepted by the top-level {@link App} component.
 */
interface Props {
  /** Resolved application configuration (keybindings, theme, workspace name). */
  config: TwmConfig;
}

const STATUS_BAR_H = 25; // 24px height + 1px border-top
const IS_MAC =
  typeof navigator !== 'undefined' &&
  /mac/i.test(navigator.platform);

/**
 * Inner application shell rendered after authentication has resolved.
 *
 * Instantiates all top-level managers (WorkspaceManager, DashboardManager,
 * KeybindingRegistry) and wires together the signal graph:
 * DashboardManager state → dashIds / activeDashIdx signals → rendered
 * DashboardPanel slots. Also registers all global keyboard shortcuts and
 * listens for SSE `tile-op` events that remove dashboards via MCP.
 *
 * @param props - Application configuration including keybindings and theme.
 */
function AppInner(props: Props): JSX.Element {
  // ── Managers ───────────────────────────────────────────────────────────────
  new ThemeManager().setTheme(props.config.theme);
  const wm = new WorkspaceManager();
  const auth = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const restoredTree = wm.activeTree() ?? makeLeaf();
  const [tree, setTree] = createSignal<Tree>(restoredTree);
  const [focusedId] = createSignal<string>(
    leaves(restoredTree)[0] ?? (makeLeaf() as { id: string }).id,
  );
  const [isPaletteOpen, setPaletteOpen] = createSignal(false);
  const [isHelpOpen,    setHelpOpen]    = createSignal(false);
  /** Reactive viewport — tracks actual window dimensions */
  const [viewport, setViewport] = createSignal({
    x: 0, y: 0,
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight - STATUS_BAR_H : 695,
  });

  /** Persist the tree to localStorage and update the signal. */
  const commitTree = (next: Tree) => { setTree(next); wm.setTree(next); };
  const history = new HistoryManager<Tree>(tree());
  const { setHints } = useHints();

  // ── Dashboard manager ──────────────────────────────────────────────────────
  const dm = new DashboardManager();
  const [dashIds, setDashIds] = createSignal<string[]>(dm.ids);
  const [activeDashIdx, setActiveDashIdx] = createSignal(dm.activeIndex);

  /** Navigate to a dashboard by index and sync reactive state. */
  const gotoIdx = (i: number) => { dm.goto(i); setActiveDashIdx(dm.activeIndex); };
  const nextDash = () => { dm.next(); setActiveDashIdx(dm.activeIndex); };
  const prevDash = () => { dm.prev(); setActiveDashIdx(dm.activeIndex); };

  // ── SSE: handle MCP remove-dashboard ops ────────────────────────────────
  type DashOp = { op: string; workspace?: string } | null;
  const { data: dashOp } = useSseChannel<DashOp>('tile-op', null);
  createEffect(() => {
    const op = dashOp();
    if (!op || op.op !== 'remove-dashboard' || !op.workspace) return;
    const ws = op.workspace;
    const idx = dm.ids.indexOf(ws);
    if (idx === -1) return; // not in our list
    clearTileLayout(ws);
    dm.remove(idx);
    setDashIds(dm.ids);
    setActiveDashIdx(dm.activeIndex);
  });

  // ── Commands ───────────────────────────────────────────────────────────────
  const commands: Command[] = [
    {
      id: 'new-dashboard',
      label: 'New Dashboard',
      run: () => {
        if (!dm.canAdd) return;
        dm.add();
        // Do NOT pre-seed localStorage here. DashboardPanel.onMount will read
        // null from localStorage and null from the server, then persist the
        // default state for a brand-new dashboard.
        setDashIds(dm.ids);
        setActiveDashIdx(dm.activeIndex);
      },
    },
    {
      id: 'close-dashboard',
      label: 'Close Dashboard',
      run: async () => {
        if (!dm.canRemove) return;
        const removedId = dm.activeDashboardId;
        // 1. Clear localStorage immediately (sync)
        clearTileLayout(removedId);

        // 2. Delete from server with one retry
        let deleted = await deleteLayoutFromServer(removedId, API_BASE_URL);
        if (!deleted) deleted = await deleteLayoutFromServer(removedId, API_BASE_URL);
        if (!deleted) {
          // Queue for cleanup on next load
          try {
            const raw = localStorage.getItem('twm:pending-deletes');
            const pending: string[] = raw ? JSON.parse(raw) : [];
            if (!pending.includes(removedId)) pending.push(removedId);
            localStorage.setItem('twm:pending-deletes', JSON.stringify(pending));
          } catch { /* noop */ }
        }

        // 3. Update local registry and signals
        dm.remove();
        setDashIds(dm.ids);
        setActiveDashIdx(dm.activeIndex);
      },
    },
    { id: 'goto-1', label: 'Go to Dashboard 1', run: () => gotoIdx(0) },
    { id: 'goto-2', label: 'Go to Dashboard 2', run: () => gotoIdx(1) },
    { id: 'goto-3', label: 'Go to Dashboard 3', run: () => gotoIdx(2) },
    { id: 'goto-4', label: 'Go to Dashboard 4', run: () => gotoIdx(3) },
    {
      id: 'undo',
      label: 'Undo',
      run: () => { const t = history.undo(); if (t) commitTree(t); },
    },
    {
      id: 'redo',
      label: 'Redo',
      run: () => { const t = history.redo(); if (t) commitTree(t); },
    },
  ];

  // ── Keybindings ────────────────────────────────────────────────────────────
  const registry = new KeybindingRegistry();
  const kb = props.config.keybindings;

  const openPalette = () => { setPaletteOpen(true); setHints(HINTS_PALETTE); };
  const openHelp    = () => setHelpOpen(true);
  registry.register(kb.openPalette,    'palette',       openPalette);
  registry.register(kb.help,           'help',          openHelp);
  registry.register(kb.nextDashboard,  'next-dashboard', nextDash);
  registry.register(kb.prevDashboard,  'prev-dashboard', prevDash);
  registry.register(kb.undo,           'undo',          commands.find(c => c.id === 'undo')!.run);
  registry.register(kb.redo,           'redo',          commands.find(c => c.id === 'redo')!.run);

  onMount(() => {
    setHints(HINTS_DEFAULT);

    // ── Reconcile dashboard list with server ──────────────────────────────
    // Process any deletes that failed on a previous session
    if (auth.isAuthenticated()) {
      // Read deleted IDs BEFORE clearing the key so we can filter them from
      // loadWorkspacesFromServer even if the server hasn't processed the
      // DELETE yet (avoids resurrection of closed dashboards on reload).
      const deletedIds = new Set<string>();
      try {
        const raw = localStorage.getItem('twm:pending-deletes');
        if (raw) {
          const pending: string[] = JSON.parse(raw);
          localStorage.removeItem('twm:pending-deletes');
          for (const ws of pending) {
            deletedIds.add(ws);
            void deleteLayoutFromServer(ws, API_BASE_URL);
          }
        }
      } catch { /* noop */ }

      // Discover server-only dashboards (e.g. created by MCP while offline).
      // Exclude any workspace that was just deleted above — the fire-and-forget
      // DELETE may not have reached the server yet when this query runs.
      void loadWorkspacesFromServer(API_BASE_URL).then((serverWs) => {
        if (!serverWs.length) return;
        const localIds = new Set(dm.ids);
        const newIds = serverWs.filter((ws) => !localIds.has(ws) && !deletedIds.has(ws));
        if (newIds.length === 0) return;
        // Add server-only dashboards to the local registry
        for (const ws of newIds) dm.addExisting(ws);
        setDashIds(dm.ids);
      });
    }

    const handler = (e: KeyboardEvent) => {
      // Don't fire modifier-free shortcuts (like '?') when typing in an input
      const target = e.target as HTMLElement;
      const inInput = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target.isContentEditable;
      if (inInput && !e.ctrlKey && !e.metaKey && !e.altKey) return;
      registry.dispatch(e, IS_MAC);
    };
    document.addEventListener('keydown', handler);
    onCleanup(() => document.removeEventListener('keydown', handler));
    // Keep viewport in sync with window resizes
    const onResize = () => setViewport({
      x: 0, y: 0,
      w: window.innerWidth,
      h: window.innerHeight - STATUS_BAR_H,
    });
    window.addEventListener('resize', onResize);
    onCleanup(() => window.removeEventListener('resize', onResize));
    // Correct initial size (may differ from SSR guess above)
    onResize();
  });

  // ── Derived layout ─────────────────────────────────────────────────────────
  const rects = () => Object.fromEntries(computeRects(tree(), viewport()));
  const handles = () => computeHandles(tree(), viewport());

  // ── Panel renderer ─────────────────────────────────────────────────────────
  // The BSP tree is kept as a single leaf; all dashboards are rendered here
  // and only the active one is visible. We ignore the BSP leaf id.
  /**
   * Render all dashboard slots inside the BSP leaf.
   *
   * All DashboardPanel instances are mounted simultaneously; only the active
   * one is visible (`display: flex`). This preserves each panel's reactive
   * state and SSE subscriptions across dashboard switches.
   *
   * @param _id - BSP leaf ID (unused — the layout is always a single leaf).
   */
  function renderPanel(_id: string): JSX.Element {
    return (
      <Index each={dashIds()}>
        {(dashId, i) => (
          <div
            class="dashboard-slot"
            style={{
              display: i === activeDashIdx() ? 'flex' : 'none',
              height: '100%',
              'flex-direction': 'column',
            }}
          >
            <DashboardPanel panelId={dashId()} workspaceName={dashId()} />
          </div>
        )}
      </Index>
    );
  }

  return (
    <div class="twm-app" style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
      {/* Panel tree fills available space */}
      <div style={{ flex: '1', position: 'relative', overflow: 'hidden' }}>
        <PanelTree
          rects={rects}
          handles={handles}
          renderPanel={renderPanel}
          onRatioChange={(splitId, ratio) => {
            const next = setRatio(tree(), splitId, ratio);
            commitTree(next);
          }}
        />
      </div>

      {/* Status bar at the bottom */}
      <StatusBar
        focusedPanelId={focusedId()}
        workspaceName={props.config.defaultWorkspace}
        dashCount={dashIds().length}
        activeDashIdx={activeDashIdx()}
      />

      {/* Command palette overlay */}
      <CommandPalette
        commands={commands}
        isOpen={isPaletteOpen}
        onClose={() => {
          setPaletteOpen(false);
          setHints(HINTS_DEFAULT);
        }}
      />

      {/* Help / keyboard shortcuts modal */}
      <HelpModal
        open={isHelpOpen}
        onClose={() => setHelpOpen(false)}
        keybindings={props.config.keybindings}
      />
    </div>
  );
}

/**
 * Root application component.
 *
 * Wraps {@link AppInner} with context providers required by every subtree:
 * - `AuthProvider` — exposes SAML/JWT auth state via {@link useAuth}
 * - `HintsProvider` — exposes contextual keyboard hint state via {@link useHints}
 * - `AuthGate` — blocks rendering until auth status is known and the user is
 *   authenticated (or auth is disabled).
 *
 * @param props - Application configuration forwarded to {@link AppInner}.
 */
export function App(props: Props): JSX.Element {
  return (
    <AuthProvider>
      <HintsProvider>
        <AuthGate>
          <AppInner config={props.config} />
        </AuthGate>
      </HintsProvider>
    </AuthProvider>
  );
}

/** Shows LoginModal when the server requires auth and no valid token is present.
 *  Blocks rendering children entirely until /api/auth/config has resolved so
 *  tiles do not fire requests before we know whether auth is required. */
function AuthGate(props: { children: JSX.Element }): JSX.Element {
  const auth = useAuth();
  return (
    <>
      <Show when={auth.authReady() && auth.authEnabled() && !auth.isAuthenticated()}>
        <LoginModal />
      </Show>
      <Show when={auth.authReady() && (!auth.authEnabled() || auth.isAuthenticated())}>
        {props.children}
      </Show>
    </>
  );
}
