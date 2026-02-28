import { Show } from 'solid-js';
import type { JSX } from 'solid-js';

interface Props {
  isOpen: boolean;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog(props: Props): JSX.Element {
  return (
    <Show when={props.isOpen}>
      <div class="modal-overlay" onClick={props.onCancel}>
        <div class="modal confirm-dialog" role="alertdialog" aria-label="Confirm action" onClick={(e) => e.stopPropagation()}>
          <div class="modal__header">
            <h2 class="modal__title">Confirm</h2>
          </div>
          <div class="modal__body">
            <p class="confirm-dialog__message">{props.message}</p>
          </div>
          <div class="modal__actions">
            <button class="btn" onClick={props.onCancel}>Cancel</button>
            <button
              class={`btn ${props.danger ? 'btn--danger' : 'btn--primary'}`}
              onClick={props.onConfirm}
            >
              {props.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
