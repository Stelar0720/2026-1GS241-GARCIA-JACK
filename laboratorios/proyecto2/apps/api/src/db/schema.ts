// Database wrapper para sql.js (sin Native Dependencies)
let db: any = null;
let SQL: any = null;

// Inicializar sql.js
async function initSQL() {
  if (SQL) return SQL;
  const initSqlJs = (await import('sql.js')).default;
  SQL = await initSqlJs();
  return SQL;
}

// Schema de Rankings
export const rankings = {
  name: 'rankings',
  columns: [
    { name: 'id', type: 'INTEGER', primaryKey: true, autoIncrement: true },
    { name: 'username', type: 'TEXT', notNull: true },
    { name: 'moves', type: 'INTEGER', notNull: true },
    { name: 'difficulty', type: 'TEXT', notNull: true },
    { name: 'game_mode', type: 'TEXT', notNull: true },
    { name: 'result', type: 'TEXT' },
    { name: 'checkers_variant', type: 'TEXT' },
    { name: 'created_at', type: 'INTEGER', notNull: true },
    { name: 'device_hash', type: 'TEXT' },
    { name: 'clerk_id', type: 'TEXT' }
  ]
};

// Schema de Game Sessions
export const gameSessions = {
  name: 'game_sessions',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'board', type: 'TEXT', notNull: true },
    { name: 'current_player', type: 'TEXT', notNull: true },
    { name: 'move_count', type: 'INTEGER', notNull: true, default: 0 },
    { name: 'status', type: 'TEXT', notNull: true },
    { name: 'difficulty', type: 'TEXT' },
    { name: 'game_mode', type: 'TEXT', notNull: true },
    { name: 'checkers_variant', type: 'TEXT' },
    { name: 'winner', type: 'TEXT' },
    { name: 'created_at', type: 'INTEGER', notNull: true }
  ]
};

// Schema de Heartbeats
export const heartbeats = {
  name: 'heartbeats',
  columns: [
    { name: 'id', type: 'INTEGER', primaryKey: true, autoIncrement: true },
    { name: 'service_name', type: 'TEXT', notNull: true },
    { name: 'status', type: 'TEXT', notNull: true },
    { name: 'timestamp', type: 'INTEGER', notNull: true },
    { name: 'metadata', type: 'TEXT' }
  ]
};

// Crear tablas
function createTables() {
  if (!db) throw new Error('Database not initialized');

  db.run(`
    CREATE TABLE IF NOT EXISTS rankings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      moves INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      game_mode TEXT NOT NULL,
      result TEXT,
      checkers_variant TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      device_hash TEXT,
      clerk_id TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS game_sessions (
      id TEXT PRIMARY KEY,
      board TEXT NOT NULL,
      current_player TEXT NOT NULL,
      move_count INTEGER DEFAULT 0,
      status TEXT NOT NULL,
      difficulty TEXT,
      game_mode TEXT NOT NULL,
      checkers_variant TEXT,
      winner TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS heartbeats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_name TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      metadata TEXT
    )
  `);

  // Índices
  db.run('CREATE INDEX IF NOT EXISTS idx_rankings_moves ON rankings(moves)');
  db.run('CREATE INDEX IF NOT EXISTS idx_rankings_username ON rankings(username)');
  db.run('CREATE INDEX IF NOT EXISTS idx_rankings_difficulty ON rankings(difficulty)');
  db.run('CREATE INDEX IF NOT EXISTS idx_rankings_clerk ON rankings(clerk_id)');
  migrateColumn('rankings', 'result', 'TEXT');
  migrateColumn('rankings', 'checkers_variant', 'TEXT');
  migrateColumn('game_sessions', 'checkers_variant', 'TEXT');
  db.run('CREATE INDEX IF NOT EXISTS idx_rankings_result ON rankings(result)');
  db.run('CREATE INDEX IF NOT EXISTS idx_rankings_variant ON rankings(checkers_variant)');
}

function migrateColumn(tableName: string, columnName: string, definition: string) {
  const info = db.exec(`PRAGMA table_info(${tableName})`)[0]?.values || [];
  const exists = info.some((row: any[]) => row[1] === columnName);
  if (!exists) {
    db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

// Guardar base de datos a archivo
function saveDatabase() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    require('fs').writeFileSync(process.env.DB_PATH || './data/sqlite.db', buffer);
  } catch (e) {
    // Ignorar errores de escritura en desarrollo
  }
}

// Inicializar base de datos
export async function initializeDatabase() {
  const SqlJs = await initSQL();
  
  // Intentar cargar base de datos existente
  try {
    const fs = require('fs');
    if (fs.existsSync(process.env.DB_PATH || './data/sqlite.db')) {
      const buffer = fs.readFileSync(process.env.DB_PATH || './data/sqlite.db');
      db = new SqlJs.Database(buffer);
    } else {
      db = new SqlJs.Database();
    }
  } catch {
    db = new SqlJs.Database();
  }

  createTables();
  return db;
}

// Ejecutar query
export function runQuery(sql: string, params: any[] = []) {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  saveDatabase();
}

// Seleccionar datos
export function selectQuery(sql: string, params: any[] = []) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Insertar y retornar
export function insertAndReturn(sql: string, params: any[] = []) {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0]?.values[0]?.[0];
  saveDatabase();
  return { id: lastId, ...Object.fromEntries(params.map((v, i) => [`p${i}`, v])) };
}

export { db };
