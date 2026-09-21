import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../core/app';

describe('buildServer projectRoot resolution', () => {
  let originalCwd: string;
  let originalDataDir: string | undefined;
  let tempRoot: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    originalDataDir = process.env.MOKURO_DATA_DIR;
    delete process.env.MOKURO_DATA_DIR;

    tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mokuro-root-'));
    await fs.promises.mkdir(path.join(tempRoot, 'uploads'), { recursive: true });
    await fs.promises.mkdir(path.join(tempRoot, 'backend'), { recursive: true });
    process.chdir(path.join(tempRoot, 'backend'));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (originalDataDir) {
      process.env.MOKURO_DATA_DIR = originalDataDir;
    } else {
      delete process.env.MOKURO_DATA_DIR;
    }
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  });

  it('uses parent directory when cwd lacks uploads', async () => {
    const app = buildServer({ logger: false });

    expect(path.resolve(app.projectRoot)).toBe(path.resolve(tempRoot));

    await app.close();
  });
});
