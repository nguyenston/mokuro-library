import { describe, expect, it } from 'vitest';
import { runWithConcurrency } from '../routes/export';
import { buildComicInfoXml, normalizeMetadataFormat } from '../utils/export/metadata';
import type { Series, Volume } from '../generated/prisma/client';

const buildSeries = (): Series =>
  ({
    id: 'series-1',
    title: 'My Series',
    japaneseTitle: null,
    romajiTitle: null,
    synonyms: null,
    description: 'A description',
    folderName: 'MySeries',
    coverPath: null,
    sortTitle: 'My Series',
    createdAt: new Date(),
    updatedAt: new Date(),
    ownerId: 'user-1'
  }) as Series;

const buildVolume = (seriesId: string): Volume =>
  ({
    id: 'volume-1',
    title: 'Vol 12',
    folderName: 'Vol_12',
    pageCount: 10,
    sortTitle: 'Vol_12',
    createdAt: new Date(),
    updatedAt: new Date(),
    filePath: 'uploads/user/series/vol',
    mokuroPath: 'uploads/user/series/vol.mokuro',
    coverImageName: null,
    seriesId,
    submissionId: null
  }) as Volume;

describe('export helpers', () => {
  it('normalizes metadata format', () => {
    expect(normalizeMetadataFormat('comicinfo')).toBe('comicinfo');
    expect(normalizeMetadataFormat('something-else')).toBe('mokuro');
    expect(normalizeMetadataFormat()).toBe('mokuro');
  });

  it('builds ComicInfo XML with series and volume data', () => {
    const series = buildSeries();
    const volume = buildVolume(series.id);

    const xml = buildComicInfoXml(series, volume);
    expect(xml).toContain('<Series>My Series</Series>');
    expect(xml).toContain('<Title>Vol 12</Title>');
    expect(xml).toContain('<Number>12</Number>');
    expect(xml).toContain('<Summary>A description</Summary>');
  });

  it('runs tasks with concurrency limits and preserves order', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const results = await runWithConcurrency([1, 2, 3, 4], 2, async (value) => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 10));
      concurrent -= 1;
      return value * 2;
    });

    expect(results).toEqual([2, 4, 6, 8]);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
