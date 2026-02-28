import { For } from 'solid-js';
import type { JSX } from 'solid-js';

export interface Tab {
  id: string;
  label: string;
  contentType: string;
}

interface Props {
  tabs: Tab[];
  activeTabId: string;
  onTabSelect: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
}

/**
 * Horizontal tab bar shown at the top of a panel.
 * Supports multiple content views; active tab is highlighted.
 */
export function TabBar(props: Props): JSX.Element {
  return (
    <div class="tab-bar" role="tablist">
      <For each={props.tabs}>
        {(tab) => (
          <div
            class="tab-bar__tab"
            role="tab"
            data-tab-id={tab.id}
            aria-selected={tab.id === props.activeTabId ? 'true' : 'false'}
            onClick={() => props.onTabSelect(tab.id)}
          >
            <span class="tab-bar__label">{tab.label}</span>
            {props.onTabClose && (
              <button
                class="tab-bar__close"
                type="button"
                aria-label={`Close ${tab.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  props.onTabClose!(tab.id);
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}
      </For>
    </div>
  );
}
