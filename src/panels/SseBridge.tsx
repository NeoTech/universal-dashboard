import { onMount, onCleanup } from 'solid-js';
import type { JSX } from 'solid-js';

interface Props {
  eventsUrl: string;
  onReload?: () => void;
  children: JSX.Element;
}

/**
 * Connects to an SSE endpoint and calls `onReload` whenever a `reload` event
 * arrives. Wraps panel content as a transparent container.
 *
 * The `EventSource` is opened on mount and closed on cleanup (unmount).
 */
export function SseBridge(props: Props) {
  onMount(() => {
    if (typeof window === 'undefined' || !('EventSource' in window)) return;

    const es = new window.EventSource(props.eventsUrl);

    const handleReload = () => {
      props.onReload?.();
    };

    es.addEventListener('reload', handleReload);

    onCleanup(() => {
      es.removeEventListener('reload', handleReload);
      es.close();
    });
  });

  return <>{props.children}</>;
}
