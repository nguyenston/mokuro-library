import path from 'path';
import fs from 'fs';

// 1. Determine Paths
const executableDir = process.cwd();
const dataDir = path.join(executableDir, 'data');
const migrationsDir = path.join(executableDir, 'prisma', 'migrations');
const dbPath = path.join(dataDir, 'library.db');

// 2. Configure Environment Variables
process.env.MOKURO_DATA_DIR = executableDir;
process.env.NODE_ENV = 'production';
process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, '/')}`;

if (!process.env.PORT) process.env.PORT = '3001';

console.log('-------------------------------------------');
console.log(' Mokuro Library - Portable Mode');
console.log('-------------------------------------------');
console.log(`Working Directory: ${executableDir}`);
console.log(`Database Path:     ${dbPath}`);

// 3. Runtime Migration Runner
function runMigrations() {
  console.log('🔄 Checking for database migrations...');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Load better-sqlite3 dynamically
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);

  try {
    // --- DEBUG: Print all existing tables ---
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('📊 Current Tables in DB:', tables.map((t: any) => t.name));
    // ----------------------------------------

    // A. Create the migrations table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS _app_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // B. Get applied migrations
    const applied = new Set(
      db.prepare('SELECT name FROM _app_migrations').all().map((row: any) => row.name)
    );

    // C. Read migration folders
    if (!fs.existsSync(migrationsDir)) {
      console.warn('⚠️  No migrations folder found. Skipping.');
      return;
    }

    const migrationFolders = fs.readdirSync(migrationsDir)
      .filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory())
      .filter(f => f !== 'migration_lock.toml')
      .sort();

    // D. Apply pending migrations transactionally
    let count = 0;
    const insertStmt = db.prepare('INSERT INTO _app_migrations (name) VALUES (?)');

    for (const folder of migrationFolders) {
      if (applied.has(folder)) continue;

      const sqlPath = path.join(migrationsDir, folder, 'migration.sql');
      if (fs.existsSync(sqlPath)) {
        console.log(`   Applying: ${folder}`);
        const sql = fs.readFileSync(sqlPath, 'utf-8');

        db.transaction(() => {
          db.exec(sql);
          insertStmt.run(folder);
        })();

        count++;
      }
    }

    if (count > 0) console.log(`✅ Successfully applied ${count} migrations.`);
    else console.log('✨ Database is up to date.');

  } catch (error) {
    console.error('❌ Migration Failed:', error);
    // process.exit(1); // Optional: Comment out to let server try starting anyway for debugging
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run migrations
runMigrations();

console.log('🚀 Starting Server...');
console.log('-------------------------------------------');

// 4. Start the Server (Must be require() to avoid hoisting)
require('./server');
