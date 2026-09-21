import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import pino from 'pino';
import { buildServer } from '../../core/app';
import { createPrismaClient, ExtendedPrismaClient } from '../../lib/prisma/prisma';
import { ensureAdminUser } from '../../utils/bootstrap';

const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
const TEST_PNG = Buffer.from(TEST_PNG_BASE64, 'base64');

type CookieMap = Record<string, string>;

export type TestContext = {
  app: FastifyInstance;
  prisma: ExtendedPrismaClient;
  projectRoot: string;
  cleanup: () => Promise<void>;
};

const createSilentLogger = (): FastifyBaseLogger =>
  pino({ level: 'silent' }) as unknown as FastifyBaseLogger;

const parseCookies = (setCookieHeader?: string | string[]): CookieMap => {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader].filter((value): value is string => typeof value === 'string');
  const result: CookieMap = {};
  for (const cookie of cookies) {
    const [pair] = cookie.split(';');
    const [name, value] = pair.split('=');
    if (name && value) result[name] = value;
  }
  return result;
};

const normalizePath = (value: string) => value.replace(/\\/g, '/');

export async function createTestContext(): Promise<TestContext> {
  const projectRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mokuro-test-'));
  const dbFile = path.join(projectRoot, 'test.db');
  const databaseUrl = `file:${normalizePath(dbFile)}`;
  const repoRoot = path.resolve(process.cwd(), '..');
  const seedDb = path.join(repoRoot, 'data', 'library.db');

  if (fs.existsSync(seedDb)) {
    await fs.promises.copyFile(seedDb, dbFile);
  }
  execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
    cwd: process.cwd(),
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  const prisma = createPrismaClient(databaseUrl);
  await ensureAdminUser(prisma, createSilentLogger());

  const app = buildServer({ prisma, logger: false, projectRoot });
  await app.ready();

  const cleanup = async () => {
    await app.close();
    await prisma.$disconnect();
    await fs.promises.rm(projectRoot, { recursive: true, force: true });
  };

  return { app, prisma, projectRoot, cleanup };
}

export async function registerAndLogin(
  app: FastifyInstance,
  username = `tester-${randomUUID().slice(0, 8)}`,
  password = 'Test123!'
) {
  const deviceFingerprint = 'test-device-fingerprint-12345';

  const register = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { username, password },
  });
  if (register.statusCode !== 201) {
    throw new Error(`Registration failed: ${register.statusCode} ${register.body}`);
  }

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username,
      password,
      deviceFingerprint,
      rememberMe: false
    },
  });
  if (login.statusCode !== 200) {
    throw new Error(`Login failed: ${login.statusCode} ${login.body}`);
  }

  const cookies = parseCookies(login.headers['set-cookie']);
  const cookieHeader = `sessionId=${cookies.sessionId}; csrfToken=${cookies.csrfToken}`;

  return {
    user: login.json(),
    cookies,
    cookieHeader,
    csrfToken: cookies.csrfToken,
    deviceFingerprint,
  };
}

export async function seedLibrary(
  prisma: ExtendedPrismaClient,
  projectRoot: string,
  userId: string
) {
  const seriesFolder = `Series_${randomUUID().slice(0, 8)}`;
  const volumeFolder = `Vol_${randomUUID().slice(0, 8)}`;
  const coverFileName = `${seriesFolder}.jpg`;
  const imageName = 'page_000.png';

  const series = await prisma.series.create({
    data: {
      ownerId: userId,
      folderName: seriesFolder,
      sortTitle: seriesFolder,
      title: `${seriesFolder} Title`,
      description: 'Test description',
      coverPath: normalizePath(path.join('uploads', userId, seriesFolder, coverFileName)),
    },
  });

  const volumePath = normalizePath(path.join('uploads', userId, seriesFolder, volumeFolder));
  const mokuroPath = normalizePath(path.join('uploads', userId, seriesFolder, `${volumeFolder}.mokuro`));

  const coverAbsolute = path.join(projectRoot, series.coverPath ?? '');
  const volumeAbsolute = path.join(projectRoot, volumePath);
  const imageAbsolute = path.join(volumeAbsolute, imageName);
  const mokuroAbsolute = path.join(projectRoot, mokuroPath);

  await fs.promises.mkdir(path.dirname(coverAbsolute), { recursive: true });
  await fs.promises.mkdir(volumeAbsolute, { recursive: true });

  await fs.promises.writeFile(coverAbsolute, TEST_PNG);
  await fs.promises.writeFile(imageAbsolute, TEST_PNG);

  const mokuroData = {
    title: series.title ?? series.folderName,
    pages: [
      {
        blocks: [],
        img_path: imageName,
        img_width: 1,
        img_height: 1,
      },
    ],
  };
  await fs.promises.writeFile(mokuroAbsolute, JSON.stringify(mokuroData));

  const volume = await prisma.volume.create({
    data: {
      seriesId: series.id,
      title: `${volumeFolder} Title`,
      folderName: volumeFolder,
      sortTitle: volumeFolder,
      pageCount: 1,
      filePath: volumePath,
      mokuroPath,
      coverImageName: imageName,
    },
  });

  return { series, volume, imageName };
}
