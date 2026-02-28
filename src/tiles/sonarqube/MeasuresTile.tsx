import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import type { SonarMeasure } from '../../data/sonarqube';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

const METRIC_LABELS: Record<string, string> = {
  bugs: 'Bugs',
  vulnerabilities: 'Vulnerabilities',
  code_smells: 'Code Smells',
  coverage: 'Coverage',
  duplicated_lines_density: 'Duplication',
  sqale_index: 'Tech Debt',
  reliability_rating: 'Reliability',
  security_rating: 'Security',
};

export function MeasuresTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ measures: SonarMeasure[] }>('sonarqube-measures', { measures: [] });

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile sonarqube-measures-tile">
      <>
          <Show when={store().measures.length === 0}>
            <p class="cell-empty">No measures</p>
          </Show>
          <For each={store().measures.slice(0, 5)}>
            {(component) => (
              <div class="measures-component">
                <h4 class="measures-component-name">{component.component}</h4>
                <dl class="measures-grid">
                  <For each={component.measures}>
                    {(m) => (
                      <>
                        <dt>{METRIC_LABELS[m.metric] ?? m.metric}</dt>
                        <dd class={m.bestValue ? 'best-value' : ''}>{m.value}</dd>
                      </>
                    )}
                  </For>
                </dl>
              </div>
            )}
          </For>
        </>
    </BaseTile>
  );
}
