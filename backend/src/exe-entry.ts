import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
// 1. Determine Paths
const executableDir = process.cwd();
const dataDir = path.join(executableDir, 'data');
const migrationsDir = path.join(executableDir, 'prisma', 'migrations');
const dbPath = path.join(dataDir, 'library.db');

// 2. Configure Environment Variables
process.env.MOKURO_DATA_DIR = executableDir;
process.env.NODE_ENV = 'production';
process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, '/')}`;

// Default port
const PORT = process.env.PORT || '3001';
if (!process.env.PORT) process.env.PORT = PORT;

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

  const Database = require('better-sqlite3');
  const db = new Database(dbPath);

  try {
    // A. Create table
    db.exec(`
      CREATE TABLE IF NOT EXISTS _app_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // B. Check history
    const applied = new Set(
      db.prepare('SELECT name FROM _app_migrations').all().map((row: any) => row.name)
    );

    // C. Read folder
    if (!fs.existsSync(migrationsDir)) {
      console.warn('⚠️  No migrations folder found. Skipping.');
      return;
    }

    const migrationFolders = fs.readdirSync(migrationsDir)
      .filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory())
      .filter(f => f !== 'migration_lock.toml')
      .sort();

    // D. Apply
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
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run migrations
runMigrations();

console.log('🚀 Starting Server...');
console.log('-------------------------------------------');

// 4. Start the Server
require('./server');

// 5. Launch Browser (Windows specific)
// We wait 1.5 seconds to ensure Fastify is listening before opening the tab
setTimeout(() => {
  console.log(`🌐 Launching browser at http://localhost:${PORT}`);
  exec(`start http://localhost:${PORT}`);
}, 1500);
