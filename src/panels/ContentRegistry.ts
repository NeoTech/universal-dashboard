// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Factory = (...args: any[]) => unknown;

/**
 * Registry that maps content-type strings to factory functions.
 * Panels ask the registry for their content's factory at render time.
 */
export class ContentRegistry {
  private _entries: Map<string, Factory> = new Map();

  /** Register (or overwrite) a factory for the given content type. */
  register(type: string, factory: Factory): void {
    this._entries.set(type, factory);
  }

  /** Remove a content type from the registry. No-op if not registered. */
  unregister(type: string): void {
    this._entries.delete(type);
  }

  /** Returns the factory for the given type. Throws if not registered. */
  get(type: string): Factory {
    const factory = this._entries.get(type);
    if (!factory) throw new Error(`Content type "${type}" is not registered`);
    return factory;
  }

  /** Returns true if the type has a registered factory. */
  has(type: string): boolean {
    return this._entries.has(type);
  }

  /** Returns all registered type names. */
  types(): string[] {
    return Array.from(this._entries.keys());
  }
}
