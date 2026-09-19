import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const migration = readFileSync(path.resolve('prisma/migrations/20260904000000_freeze_ocr_review_head/migration.sql'), 'utf8');
let db: DatabaseSync;

/** Build a disposable legacy-schema fixture; never read the runtime database. */
function legacyDatabase() {
  db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE Patch (id TEXT PRIMARY KEY, parentId TEXT REFERENCES Patch(id), volumeId TEXT);
    CREATE TABLE OcrBranch (
      id TEXT PRIMARY KEY, userId TEXT, volumeId TEXT,
      headPatchId TEXT REFERENCES Patch(id), rootPatchId TEXT REFERENCES Patch(id),
      snapshotPatchId TEXT REFERENCES Patch(id), version INTEGER,
      isPendingReview BOOLEAN, updatedAt DATETIME, submissionNote TEXT, rejectionReason TEXT
    );
    CREATE TABLE RebaseSession (id TEXT PRIMARY KEY, branchId TEXT REFERENCES OcrBranch(id));
    INSERT INTO Patch VALUES ('g', NULL, 'v'), ('u1', 'g', 'v'), ('u2', 'u1', 'v'), ('other', 'g', 'v');
    INSERT INTO OcrBranch VALUES ('pending', 'user', 'v', 'u2', 'u1', 'g', 7, 1, 1234, 'note', NULL);
    INSERT INTO OcrBranch VALUES ('idle', 'other-user', 'v', 'u2', 'u1', 'g', 8, 0, 1235, NULL, 'old rejection');
    INSERT INTO OcrBranch VALUES ('clean', 'clean-user', 'v', 'g', NULL, 'g', 0, 1, 1236, NULL, NULL);
    INSERT INTO OcrBranch VALUES ('undone', 'undone-user', 'v', 'g', 'u1', 'g', 3, 1, 1237, NULL, NULL);
    INSERT INTO OcrBranch VALUES ('disconnected', 'disconnected-user', 'v', 'u2', 'other', 'g', 4, 1, 1238, NULL, NULL);
    INSERT INTO RebaseSession VALUES ('session', 'pending');
  `);
  return db;
}

afterEach(() => db?.close());

describe('frozen-review migration', () => {
  it('applies after the complete existing migration history on an empty database', () => {
    db = new DatabaseSync(':memory:');
    const directory = path.resolve('prisma/migrations');
    for (const entry of readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      db.exec(readFileSync(path.join(directory, entry.name, 'migration.sql'), 'utf8'));
    }
    const columns = db.prepare('PRAGMA table_info(OcrBranch)').all().map(row => row.name);
    expect(columns).toContain('reviewHeadPatchId');
    expect(columns).toContain('reviewRequestedAt');
    expect(columns).not.toContain('isPendingReview');
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('freezes a valid pending head without rewriting history or branch state', () => {
    const database = legacyDatabase();
    const patches = database.prepare('SELECT * FROM Patch').all();
    database.exec(migration);
    expect(database.prepare('SELECT * FROM Patch').all()).toEqual(patches);
    expect(database.prepare('SELECT * FROM OcrBranch WHERE id = ?').get('pending')).toMatchObject({
      headPatchId: 'u2', rootPatchId: 'u1', snapshotPatchId: 'g', version: 7,
      reviewHeadPatchId: 'u2', reviewRequestedAt: 1234, submissionNote: 'note'
    });
    expect(database.prepare('SELECT * FROM RebaseSession').all()).toHaveLength(1);
    expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(database.prepare('PRAGMA table_info(OcrBranch)').all().map(row => row.name)).not.toContain('isPendingReview');
  });

  it('does not invent reviews for idle branches and explains invalid pending ranges', () => {
    const database = legacyDatabase();
    database.exec(migration);
    expect(database.prepare('SELECT * FROM OcrBranch WHERE id = ?').get('idle')).toMatchObject({
      reviewHeadPatchId: null, reviewRequestedAt: null, rejectionReason: 'old rejection'
    });
    for (const id of ['clean', 'undone', 'disconnected']) {
      expect(database.prepare('SELECT * FROM OcrBranch WHERE id = ?').get(id)).toMatchObject({
        reviewHeadPatchId: null, reviewRequestedAt: null,
        rejectionReason: expect.stringContaining('Review cancelled during upgrade')
      });
    }
  });

  it('keeps review identity and request time fixed when the live branch changes', () => {
    const database = legacyDatabase();
    database.exec(migration);
    database.exec(`INSERT INTO Patch VALUES ('u3', 'u2', 'v');
      UPDATE OcrBranch SET headPatchId = 'u3', updatedAt = 9999, version = 8 WHERE id = 'pending';`);
    expect(database.prepare('SELECT * FROM OcrBranch WHERE id = ?').get('pending')).toMatchObject({
      headPatchId: 'u3', reviewHeadPatchId: 'u2', reviewRequestedAt: 1234
    });
  });

  it('enforces the review-head foreign key', () => {
    const database = legacyDatabase();
    database.exec(migration);
    expect(() => database.exec(`UPDATE OcrBranch SET reviewHeadPatchId = 'missing' WHERE id = 'pending'`)).toThrow();
  });
});
