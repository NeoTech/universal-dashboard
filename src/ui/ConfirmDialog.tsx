import { Show } from 'solid-js';
import type { JSX } from 'solid-js';

/** Props for {@link ConfirmDialog}. */
interface Props {
  /** Whether the dialog is currently visible. */
  isOpen: boolean;
  /** Body text explaining the action that requires confirmation. */
  message: string;
  /** Label for the confirm button. Default: `'Confirm'`. */
  confirmLabel?: string;
  /** When `true`, renders the confirm button with the danger/destructive style. */
  danger?: boolean;
  /** Called when the user clicks the confirm button. */
  onConfirm: () => void;
  /** Called when the user cancels or clicks the backdrop. */
  onCancel: () => void;
}

/**
 * Modal dialog for confirming destructive or irreversible actions.
 *
 * Clicking the backdrop calls `onCancel`. The confirm button can be styled
 * as a danger action via the `danger` prop.
 *
 * @param props - See {@link Props}.
 * @returns A modal overlay with Cancel and Confirm buttons, or nothing when closed.
 */
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
