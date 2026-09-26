/** Exercise scrape authorization before any external provider request. */
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import metadataRoutes from '../routes/metadata';
import { scrapeFromProvider } from '../utils/metadata/scrape';

vi.mock('../utils/metadata/scrape', () => ({ scrapeFromProvider: vi.fn() }));

describe('scrape authorization', () => {
  it.each([
    ['user', 'admin', 403],
    ['user', 'other', 404],
    ['user', null, 404],
    ['user', 'user', 200],
    ['admin', 'admin', 200]
  ])('actor %s / owner %s returns %s', async (actor, owner, status) => {
    const app = Fastify();
    const findFirst = vi.fn().mockImplementation(async ({ where }) => {
      const visible = owner && where.OR.some((clause: { ownerId: string }) => clause.ownerId === owner);
      return visible ? { id: 'series', ownerId: owner, title: 'Series' } : null;
    });
    app.decorate('prisma', { series: { findFirst } });
    app.decorate('authenticate', async (request: { user: unknown }) => { request.user = { id: actor }; });
    vi.mocked(scrapeFromProvider).mockReset().mockResolvedValue({
      englishName: 'Series', japaneseName: 'Series', romajiName: 'Series', description: 'Description'
    });
    try {
      await app.register(metadataRoutes, { prefix: '/api/metadata' });
      const response = await app.inject({ method: 'POST', url: '/api/metadata/series/scrape',
        payload: { seriesId: 'series', seriesName: 'Series', provider: 'anilist' } });
      expect(response.statusCode).toBe(status);
      expect(scrapeFromProvider).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
      expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'series', OR: [{ ownerId: actor }, { ownerId: 'admin' }] }
      }));
    } finally { await app.close(); }
  });
});
