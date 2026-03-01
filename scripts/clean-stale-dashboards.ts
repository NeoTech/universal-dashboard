import { Database } from 'bun:sqlite';
import { join } from 'node:path';

const db = new Database(join(import.meta.dir, '..', 'auth.db'));

const all = db.prepare('SELECT workspace FROM tile_layouts').all() as { workspace: string }[];
console.log('Before:', all.map(r => r.workspace));

// Keep only dashboard-1 (the one the client knows about)
db.prepare(`DELETE FROM tile_layouts WHERE workspace IN ('dashboard-1772328583590','default','dashboard-1772313995709')`).run();

const after = db.prepare('SELECT workspace FROM tile_layouts').all() as { workspace: string }[];
console.log('After:', after.map(r => r.workspace));
db.close();
