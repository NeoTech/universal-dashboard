import { createSignal, onMount, onCleanup, Index, Show } from 'solid-js';
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
import { HintsProvider, useHints, HINTS_DEFAULT, HINTS_PALETTE } from './ui/HintsContext';
import { DashboardPanel } from './panels/DashboardPanel';
import { AuthProvider, useAuth } from './ui/AuthContext';
import { LoginModal } from './ui/LoginModal';

interface Props {
  config: TwmConfig;
}

const STATUS_BAR_H = 25; // 24px height + 1px border-top
const IS_MAC =
  typeof navigator !== 'undefined' &&
  /mac/i.test(navigator.platform);

function AppInner(props: Props): JSX.Element {
  // ── Managers ───────────────────────────────────────────────────────────────
  new ThemeManager().setTheme(props.config.theme);
  const wm = new WorkspaceManager();

  // ── State ──────────────────────────────────────────────────────────────────
  const restoredTree = wm.activeTree() ?? makeLeaf();
  const [tree, setTree] = createSignal<Tree>(restoredTree);
  const [focusedId] = createSignal<string>(
    leaves(restoredTree)[0] ?? (makeLeaf() as { id: string }).id,
  );
  const [isPaletteOpen, setPaletteOpen] = createSignal(false);
  /** Maps panelId → content type; all panels default to 'dashboard' */
  const [panelTypes] = createSignal<Record<string, string>>({});
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

  // ── Commands ───────────────────────────────────────────────────────────────
  const commands: Command[] = [
    {
      id: 'new-dashboard',
      label: 'New Dashboard',
      run: () => {
        if (!dm.canAdd) return;
        dm.add();
        setDashIds(dm.ids);
        setActiveDashIdx(dm.activeIndex);
      },
    },
    {
      id: 'close-dashboard',
      label: 'Close Dashboard',
      run: () => {
        if (!dm.canRemove) return;
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
  registry.register(kb.openPalette,    'palette',       openPalette);
  registry.register(kb.help,           'help',          openPalette);
  registry.register(kb.nextDashboard,  'next-dashboard', nextDash);
  registry.register(kb.prevDashboard,  'prev-dashboard', prevDash);
  registry.register(kb.undo,           'undo',          commands.find(c => c.id === 'undo')!.run);
  registry.register(kb.redo,           'redo',          commands.find(c => c.id === 'redo')!.run);

  onMount(() => {
    setHints(HINTS_DEFAULT);
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
  function renderPanel(_id: string): JSX.Element {
    const type = panelTypes()[_id] ?? 'dashboard';
    if (type !== 'dashboard') {
      return <div class="panel-placeholder" data-type={type} />;
    }
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
    </div>
  );
}

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

/** Shows LoginModal when the server requires auth and no valid token is present. */
function AuthGate(props: { children: JSX.Element }): JSX.Element {
  const auth = useAuth();
  return (
    <>
      <Show when={auth.authEnabled() && !auth.isAuthenticated()}>
        <LoginModal />
      </Show>
      <Show when={!auth.authEnabled() || auth.isAuthenticated()}>
        {props.children}
      </Show>
    </>
  );
}
