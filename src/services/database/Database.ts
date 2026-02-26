// =============================================================================
// Stock Advisors - Database Connection Manager
// =============================================================================
// Singleton wrapper around @tauri-apps/plugin-sql for SQLite access.
// Falls back to an in-memory Map-based implementation when running in the
// browser (dev mode without the Tauri runtime).
// =============================================================================

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Minimal interface matching the subset of @tauri-apps/plugin-sql we use.
 * Both the real Tauri driver and the in-memory fallback implement this.
 */
export interface DatabaseDriver {
  execute(query: string, bindValues?: unknown[]): Promise<{ rowsAffected: number; lastInsertId: number }>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

// -----------------------------------------------------------------------------
// In-Memory Fallback (browser / dev mode)
// -----------------------------------------------------------------------------

/**
 * Lightweight in-memory SQL-like store for development without Tauri.
 * Supports INSERT, SELECT, UPDATE, and DELETE on simple table structures.
 * Not a full SQL engine -- just enough to keep the app functional in the browser.
 */
class InMemoryDatabase implements DatabaseDriver {
  private tables: Map<string, Array<Record<string, unknown>>> = new Map();
  private autoIncrements: Map<string, number> = new Map();

  async execute(
    query: string,
    bindValues: unknown[] = []
  ): Promise<{ rowsAffected: number; lastInsertId: number }> {
    const trimmed = query.trim();

    // CREATE TABLE -- just ensure the table key exists
    if (/^CREATE\s+TABLE/i.test(trimmed)) {
      const match = trimmed.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/i)
        ?? trimmed.match(/CREATE\s+TABLE\s+(\w+)/i);
      if (match) {
        const table = match[1];
        if (!this.tables.has(table)) {
          this.tables.set(table, []);
          this.autoIncrements.set(table, 1);
        }
      }
      return { rowsAffected: 0, lastInsertId: 0 };
    }

    // CREATE INDEX -- no-op
    if (/^CREATE\s+INDEX/i.test(trimmed)) {
      return { rowsAffected: 0, lastInsertId: 0 };
    }

    // INSERT
    if (/^INSERT\s+INTO/i.test(trimmed)) {
      return this.handleInsert(trimmed, bindValues);
    }

    // UPDATE
    if (/^UPDATE\s+/i.test(trimmed)) {
      return this.handleUpdate(trimmed, bindValues);
    }

    // DELETE
    if (/^DELETE\s+FROM/i.test(trimmed)) {
      return this.handleDelete(trimmed, bindValues);
    }

    return { rowsAffected: 0, lastInsertId: 0 };
  }

  async select<T>(query: string, bindValues: unknown[] = []): Promise<T[]> {
    const trimmed = query.trim();
    const tableMatch = trimmed.match(/FROM\s+(\w+)/i);
    if (!tableMatch) return [];

    const table = tableMatch[1];
    const rows = this.tables.get(table) ?? [];

    // Apply simple WHERE filtering
    let filtered = this.applyWhere(trimmed, rows, bindValues);

    // ORDER BY
    const orderMatch = trimmed.match(/ORDER\s+BY\s+(\w+)\s*(ASC|DESC)?/i);
    if (orderMatch) {
      const col = orderMatch[1];
      const desc = orderMatch[2]?.toUpperCase() === 'DESC';
      filtered.sort((a, b) => {
        const va = a[col] as string | number;
        const vb = b[col] as string | number;
        if (va < vb) return desc ? 1 : -1;
        if (va > vb) return desc ? -1 : 1;
        return 0;
      });
    }

    // LIMIT
    const limitMatch = trimmed.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      filtered = filtered.slice(0, parseInt(limitMatch[1], 10));
    }

    return filtered as T[];
  }

  async close(): Promise<void> {
    this.tables.clear();
    this.autoIncrements.clear();
  }

  // -- Private helpers --------------------------------------------------------

  private handleInsert(
    query: string,
    bindValues: unknown[]
  ): { rowsAffected: number; lastInsertId: number } {
    const tableMatch = query.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)/i);
    if (!tableMatch) return { rowsAffected: 0, lastInsertId: 0 };

    const table = tableMatch[1];
    const columns = tableMatch[2].split(',').map((c) => c.trim());

    if (!this.tables.has(table)) {
      this.tables.set(table, []);
      this.autoIncrements.set(table, 1);
    }

    const id = this.autoIncrements.get(table) ?? 1;
    this.autoIncrements.set(table, id + 1);

    const row: Record<string, unknown> = { id };
    columns.forEach((col, i) => {
      row[col] = i < bindValues.length ? bindValues[i] : null;
    });

    // Apply defaults for common columns
    if (!row.created_at) {
      row.created_at = new Date().toISOString();
    }
    if (row.status === undefined && columns.indexOf('status') === -1) {
      // only set default if column wasn't explicitly provided
    }

    this.tables.get(table)!.push(row);
    return { rowsAffected: 1, lastInsertId: id };
  }

  private handleUpdate(
    query: string,
    bindValues: unknown[]
  ): { rowsAffected: number; lastInsertId: number } {
    const tableMatch = query.match(/UPDATE\s+(\w+)\s+SET/i);
    if (!tableMatch) return { rowsAffected: 0, lastInsertId: 0 };

    const table = tableMatch[1];
    const rows = this.tables.get(table) ?? [];

    // Extract SET clause columns
    const setMatch = query.match(/SET\s+(.+?)(?:\s+WHERE|$)/i);
    if (!setMatch) return { rowsAffected: 0, lastInsertId: 0 };

    const setCols = setMatch[1].split(',').map((s) => {
      const eqMatch = s.trim().match(/(\w+)\s*=\s*\?/);
      return eqMatch ? eqMatch[1] : null;
    }).filter(Boolean) as string[];

    // The bind values: first N for SET, remaining for WHERE
    const setValues = bindValues.slice(0, setCols.length);
    const whereValues = bindValues.slice(setCols.length);

    // Apply WHERE to find matching rows
    const filtered = this.applyWhere(query, rows, whereValues, setCols.length);

    let affected = 0;
    for (const row of filtered) {
      setCols.forEach((col, i) => {
        row[col] = setValues[i];
      });
      affected++;
    }

    return { rowsAffected: affected, lastInsertId: 0 };
  }

  private handleDelete(
    query: string,
    bindValues: unknown[]
  ): { rowsAffected: number; lastInsertId: number } {
    const tableMatch = query.match(/DELETE\s+FROM\s+(\w+)/i);
    if (!tableMatch) return { rowsAffected: 0, lastInsertId: 0 };

    const table = tableMatch[1];
    const rows = this.tables.get(table) ?? [];
    const toRemove = this.applyWhere(query, rows, bindValues);
    const removeSet = new Set(toRemove);

    const remaining = rows.filter((r) => !removeSet.has(r));
    this.tables.set(table, remaining);

    return { rowsAffected: toRemove.length, lastInsertId: 0 };
  }

  private applyWhere(
    query: string,
    rows: Array<Record<string, unknown>>,
    bindValues: unknown[],
    bindOffset: number = 0
  ): Array<Record<string, unknown>> {
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s+GROUP|$)/i);
    if (!whereMatch) return [...rows];

    const whereClause = whereMatch[1];
    // Extract column = ? conditions (simple AND-only)
    const conditions: Array<{ column: string; op: string }> = [];
    const condRegex = /(\w+)\s*(=|!=|>=|<=|>|<|LIKE)\s*\?/gi;
    let condMatch: RegExpExecArray | null;
    while ((condMatch = condRegex.exec(whereClause)) !== null) {
      conditions.push({ column: condMatch[1], op: condMatch[2].toUpperCase() });
    }

    return rows.filter((row) => {
      return conditions.every((cond, i) => {
        const val = bindValues[bindOffset + i];
        const rowVal = row[cond.column];
        switch (cond.op) {
          case '=': return rowVal === val;
          case '!=': return rowVal !== val;
          case '>': return (rowVal as number) > (val as number);
          case '<': return (rowVal as number) < (val as number);
          case '>=': return (rowVal as number) >= (val as number);
          case '<=': return (rowVal as number) <= (val as number);
          case 'LIKE': {
            const pattern = String(val).replace(/%/g, '.*');
            return new RegExp(`^${pattern}$`, 'i').test(String(rowVal));
          }
          default: return rowVal === val;
        }
      });
    });
  }
}

// -----------------------------------------------------------------------------
// Schema (embedded for initialization)
// -----------------------------------------------------------------------------

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  action TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  entry_price REAL NOT NULL,
  entry_date TEXT NOT NULL,
  exit_price REAL,
  exit_date TEXT,
  stop_loss REAL,
  take_profit REAL,
  status TEXT DEFAULT 'open',
  pnl_dollars REAL,
  pnl_percent REAL,
  holding_days INTEGER,
  recommended_by TEXT NOT NULL,
  confidence INTEGER,
  pipeline_id TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_track_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  confidence INTEGER,
  target_price REAL,
  stop_loss REAL,
  recommended_at TEXT NOT NULL,
  outcome TEXT,
  actual_return REAL,
  peak_return REAL,
  worst_drawdown REAL,
  days_to_outcome INTEGER,
  resolved_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analysis_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pipeline_id TEXT,
  agent_id TEXT NOT NULL,
  symbols TEXT NOT NULL,
  input_data TEXT NOT NULL,
  output_data TEXT NOT NULL,
  summary TEXT,
  confidence INTEGER,
  token_usage TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS performance_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_type TEXT NOT NULL,
  agent_id TEXT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  findings TEXT NOT NULL,
  recommendations TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_recommended_by ON trades(recommended_by);
CREATE INDEX IF NOT EXISTS idx_track_agent ON agent_track_records(agent_id);
CREATE INDEX IF NOT EXISTS idx_track_symbol ON agent_track_records(symbol);
CREATE INDEX IF NOT EXISTS idx_snapshots_pipeline ON analysis_snapshots(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_agent ON analysis_snapshots(agent_id);
`;

// -----------------------------------------------------------------------------
// Singleton Database Manager
// -----------------------------------------------------------------------------

let dbInstance: DatabaseDriver | null = null;
let initPromise: Promise<DatabaseDriver> | null = null;

/**
 * Detects whether the Tauri runtime is available.
 */
function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Initialize the database connection. Creates the SQLite file (or opens it
 * if it already exists) and runs the schema DDL. In browser dev mode, creates
 * an in-memory fallback instead.
 *
 * Safe to call multiple times -- returns the same instance after first init.
 */
export async function initializeDatabase(): Promise<DatabaseDriver> {
  if (dbInstance) return dbInstance;

  // Prevent concurrent initialization races
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (isTauriAvailable()) {
        // Tauri runtime available -- use real SQLite
        const { default: TauriDatabase } = await import('@tauri-apps/plugin-sql');
        const db = await TauriDatabase.load('sqlite:stockadvisors.db');

        // Run each statement individually (SQLite via Tauri doesn't support
        // multiple statements in a single execute call)
        const statements = SCHEMA_SQL
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const stmt of statements) {
          await db.execute(stmt);
        }

        dbInstance = db as unknown as DatabaseDriver;
        console.log('[Database] SQLite initialized via Tauri');
      } else {
        // Browser dev mode -- use in-memory fallback
        const memDb = new InMemoryDatabase();

        const statements = SCHEMA_SQL
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const stmt of statements) {
          await memDb.execute(stmt);
        }

        dbInstance = memDb;
        console.log('[Database] In-memory fallback initialized (no Tauri runtime)');
      }

      return dbInstance!;
    } catch (err) {
      initPromise = null;
      console.error('[Database] Initialization failed:', err);
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Returns the database instance. Throws if `initializeDatabase()` hasn't
 * been called yet.
 */
export function getDb(): DatabaseDriver {
  if (!dbInstance) {
    throw new Error(
      '[Database] Not initialized. Call initializeDatabase() before getDb().'
    );
  }
  return dbInstance;
}

/**
 * Execute a write query (INSERT, UPDATE, DELETE) with error handling.
 */
export async function execute(
  query: string,
  params: unknown[] = []
): Promise<{ rowsAffected: number; lastInsertId: number }> {
  const db = getDb();
  try {
    return await db.execute(query, params);
  } catch (err) {
    console.error('[Database] Execute error:', { query, params, err });
    throw err;
  }
}

/**
 * Execute a read query (SELECT) and return typed results.
 */
export async function select<T>(
  query: string,
  params: unknown[] = []
): Promise<T[]> {
  const db = getDb();
  try {
    return await db.select<T>(query, params);
  } catch (err) {
    console.error('[Database] Select error:', { query, params, err });
    throw err;
  }
}

/**
 * Close the database connection and reset the singleton.
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
    initPromise = null;
    console.log('[Database] Connection closed');
  }
}
