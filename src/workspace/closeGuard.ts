export class CloseGuard {
  private _dirty = false;

  get isDirty(): boolean {
    return this._dirty;
  }

  markDirty(): void {
    this._dirty = true;
  }

  markClean(): void {
    this._dirty = false;
  }

  handleBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (this._dirty) {
      event.returnValue = 'You have unsaved layout changes.';
    }
  };

  install(): () => void {
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    return () => this.uninstall();
  }

  uninstall(): void {
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }
}
