import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { HintsProvider, useHints, HINTS_DEFAULT } from '../../ui/HintsContext';
import type { JSX } from 'solid-js';

function TestConsumer(): JSX.Element {
  const { hints, setHints } = useHints();
  return (
    <div>
      <button class="set-btn" onClick={() => setHints([{ keys: 'Ctrl+X', label: 'Cut' }])}>
        set
      </button>
      <ul class="hints-list">
        {hints().map((h) => <li>{h.keys} {h.label}</li>)}
      </ul>
    </div>
  );
}

describe('HintsContext', () => {
  it('starts with empty hints list', () => {
    const { container } = render(() => (
      <HintsProvider>
        <TestConsumer />
      </HintsProvider>
    ));
    expect(container.querySelectorAll('.hints-list li').length).toBe(0);
  });

  it('setHints populates the list', () => {
    const { container } = render(() => (
      <HintsProvider>
        <TestConsumer />
      </HintsProvider>
    ));
    fireEvent.click(container.querySelector('.set-btn')!);
    expect(container.querySelector('.hints-list li')?.textContent).toContain('Ctrl+X');
  });

  it('HINTS_DEFAULT contains expected shortcuts', () => {
    const keys = HINTS_DEFAULT.map((h) => h.keys);
    expect(keys).toContain('Ctrl+P');
  });
});
