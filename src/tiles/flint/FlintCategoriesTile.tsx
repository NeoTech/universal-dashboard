import { createSignal, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { FlintCategory } from '../../data/flint';
import { useFlintResource, sendCommand } from './flintRealtimeStore';
import { useStripeAction } from '../../ui/useStripeAction';
import { BaseWsTile as BaseTile } from '../BaseWsTile';

export function FlintCategoriesTile(_props: Record<string, never>): JSX.Element {
  const { data: categories, loading, error } = useFlintResource<FlintCategory[]>('flint-categories', []);

  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editName, setEditName]   = createSignal('');
  const [showAdd, setShowAdd]     = createSignal(false);
  const [newName, setNewName]     = createSignal('');
  const [newParent, setNewParent] = createSignal('');
  const [newSort, setNewSort]     = createSignal('0');

  const roots   = () => categories().filter(c => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  const childOf = (parentId: string) =>
    categories().filter(c => c.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  const renameAction = useStripeAction(
    async (id: string, name: string) => {
      const result = await sendCommand('update-category', id, { name });
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
    },
    { onSuccess: () => setEditingId(null) },
  );

  const createAction = useStripeAction(
    async (name: string, parentId: string, sortOrder: number) => {
      const result = await sendCommand('create-category', undefined, { name, parentId: parentId || undefined, sortOrder });
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
    },
    { onSuccess: () => { setShowAdd(false); setNewName(''); setNewParent(''); setNewSort('0'); } },
  );

  function startEdit(cat: FlintCategory): void {
    setEditingId(cat.id);
    setEditName(cat.name);
  }

  function saveEdit(): void {
    const id = editingId();
    if (id) void renameAction.execute(id, editName());
  }

  function renderCategory(cat: FlintCategory, depth = 0): JSX.Element {
    const children = childOf(cat.id);
    return (
      <div class="flint-category-tree__node" style={{ 'padding-left': `${depth * 16}px` }}>
        <div class="flint-category-tree__row">
          <Show
            when={editingId() === cat.id}
            fallback={
              <span class="flint-category-tree__name" onDblClick={() => startEdit(cat)}>
                {cat.name}
                <Show when={cat.productCount !== undefined}>
                  <span class="cell-muted"> ({cat.productCount})</span>
                </Show>
              </span>
            }
          >
            <input
              class="flint-auth-form__input"
              style="width:160px;padding:2px 6px;"
              value={editName()}
              onInput={(e) => setEditName(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
              onBlur={saveEdit}
              autofocus
            />
          </Show>
          <button class="btn btn--xs btn--neutral" onClick={() => startEdit(cat)} title="Rename">✎</button>
        </div>
        <Show when={children.length > 0}>
          <For each={children}>
            {(child) => renderCategory(child, depth + 1)}
          </For>
        </Show>
      </div>
    );
  }

  return (
    <div class="stripe-tile flint-categories-tile">
      <BaseTile loading={loading()} error={error()}>
        <div class="flint-category-tree">
          <Show when={categories().length === 0}>
            <p class="cell-empty">No categories yet</p>
          </Show>
          <For each={roots()}>
            {(cat) => renderCategory(cat)}
          </For>
        </div>
      </BaseTile>

      {/* Add category form */}
      <div style="padding:8px;border-top:1px solid var(--twm-color-border)">
        <Show
          when={showAdd()}
          fallback={
            <button class="btn btn--sm btn--neutral" onClick={() => setShowAdd(true)}>+ Add Category</button>
          }
        >
          <div class="flint-inline-form">
            <Show when={createAction.error()}>
              <p class="drawer-error">{createAction.error()}</p>
            </Show>
            <label class="flint-auth-form__label">Name<input class="flint-auth-form__input" value={newName()} onInput={(e) => setNewName(e.currentTarget.value)} /></label>
            <label class="flint-auth-form__label">
              Parent
              <select class="flint-auth-form__input" value={newParent()} onChange={(e) => setNewParent(e.currentTarget.value)}>
                <option value="">No parent (root)</option>
                <For each={categories()}>
                  {(c) => <option value={c.id}>{c.name}</option>}
                </For>
              </select>
            </label>
            <label class="flint-auth-form__label">Sort Order<input class="flint-auth-form__input" type="number" value={newSort()} onInput={(e) => setNewSort(e.currentTarget.value)} /></label>
            <div class="drawer-actions">
              <button class="btn btn--primary" disabled={createAction.loading() || !newName()} onClick={() => void createAction.execute(newName(), newParent(), parseInt(newSort() || '0'))}>
                {createAction.loading() ? 'Creating…' : 'Create'}
              </button>
              <button class="btn btn--neutral" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
