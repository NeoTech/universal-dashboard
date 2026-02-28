import { onMount } from 'solid-js';

interface Props {
  panelId: string;
  contentType: string;
  fixtureBaseUrl: string;
}

/**
 * Content loader for a panel.
 * Uses HTMX attributes so the browser fetches the HTML fragment automatically
 * once HTMX is active on the page (htmx.process is called in main.ts).
 */
export function PanelContent(props: Props) {
  let loaderRef: HTMLDivElement | undefined;

  onMount(() => {
    // If htmx is available on the window (browser context), process the element
    if (typeof window !== 'undefined' && 'htmx' in window) {
      (window as { htmx: { process: (el: Element) => void } }).htmx.process(loaderRef!);
    }
  });

  return (
    <div class="panel-content-wrapper" data-panel-id={props.panelId}>
      <div
        ref={loaderRef}
        class="panel-content-loader"
        hx-get={`${props.fixtureBaseUrl}/fragment/${props.contentType}`}
        hx-trigger="load"
        hx-swap="innerHTML"
      >
        <span class="panel-loading">Loading {props.contentType}…</span>
      </div>
    </div>
  );
}
