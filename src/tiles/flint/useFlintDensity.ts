import { createSignal, onCleanup } from 'solid-js';

export type FlintDensity = 'compact' | 'standard' | 'expanded';

/**
 * Reactive density signal driven by container width.
 * - compact:  < 400px
 * - standard: 400-700px
 * - expanded: > 700px
 */
export function useFlintDensity(): { density: () => FlintDensity; ref: (el: HTMLElement) => void } {
  const [density, setDensity] = createSignal<FlintDensity>('standard');
  let observer: ResizeObserver | undefined;

  function ref(el: HTMLElement): void {
    observer?.disconnect();
    observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 500;
      setDensity(w < 400 ? 'compact' : w > 700 ? 'expanded' : 'standard');
    });
    observer.observe(el);
  }

  onCleanup(() => observer?.disconnect());

  return { density, ref };
}
