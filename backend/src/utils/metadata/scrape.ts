import type { FastifyInstance } from 'fastify';
import { LRUCache } from 'lru-cache';

export interface ScrapedManga {
  englishName?: string;
  japaneseName?: string;
  romajiName?: string;
  synonyms?: string[];
  description?: string;
  coverUrl?: string;
}

interface AniListResponse {
  data: {
    Media: {
      title: {
        english: string | null;
        native: string | null;
        romaji: string | null;
      };
      synonyms: string[];
      description: string | null;
      coverImage: {
        extraLarge: string | null;
        large: string | null;
        medium: string | null;
      };
    } | null;
  };
}

interface KitsuResponse {
  data: Array<{
    attributes: {
      canonicalTitle: string;
      titles: {
        en?: string;
        en_jp?: string;
        ja_jp?: string;
      };
      abbreviatedTitles: string[];
      synopsis: string | null;
      posterImage: {
        large: string | null;
        medium: string | null;
        small: string | null;
      };
    };
  }>;
}

interface MALResponse {
  data: Array<{
    title: string;
    title_english: string | null;
    title_japanese: string | null;
    title_synonyms: string[];
    synopsis: string | null;
    images: {
      jpg: {
        image_url: string;
        large_image_url: string | null;
      };
    };
  }>;
}

const scrapeCache = new LRUCache<string, ScrapedManga>({
  max: 1000,
  ttl: 1000 * 60 * 60 * 24 // 24 hours
});

const normalizeTitle = (value?: string | null) =>
  value ? value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() : '';

const levenshteinDistance = (a: string, b: string) => {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const dp = new Array(b.length + 1).fill(0);
  for (let j = 0; j <= b.length; j += 1) dp[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }

  return dp[b.length];
};

const scoreCandidate = (query: string, candidate: ScrapedManga) => {
  const normalizedQuery = normalizeTitle(query);
  if (!normalizedQuery) return 0;

  const titles = [
    candidate.englishName,
    candidate.romajiName,
    candidate.japaneseName,
    ...(candidate.synonyms || [])
  ]
    .map(normalizeTitle)
    .filter(Boolean);

  let bestScore = 0;
  for (const title of titles) {
    const distance = levenshteinDistance(normalizedQuery, title);
    const maxLen = Math.max(normalizedQuery.length, title.length);
    const score = maxLen > 0 ? 1 - distance / maxLen : 0;
    if (score > bestScore) bestScore = score;
  }

  return bestScore;
};

const pickBestCandidate = (query: string, candidates: ScrapedManga[]) => {
  let best = candidates[0] || {};
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = scoreCandidate(query, candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
};

function fixMojibake(text: string | undefined | null): string | undefined {
  if (!text) return text ?? undefined;

  const mojibakePatterns: [RegExp, string][] = [
    [/\u251c\u00e2\u252c\u00ae/g, '\u251c\u00ae'],
    [/\u251c\u00e2\u252c\u00bf/g, '\u251c\u00bf'],
    [/\u251c\u00e2\u252c\u00bd/g, '\u251c\u00bd'],
    [/\u251c\u00e2\u252c\u00f3/g, '\u251c\u00f3'],
    [/\u251c\u00e2\u0020/g, '\u251c\u00e1'],
    [/\u251c\u00e2\u252c\u00f1/g, '\u251c\u00f1'],
    [/\u251c\u00e2\u252c\u00ba/g, '\u251c\u00ba'],
    [/\u251c\u00e2\u252c\u2524/g, '\u251c\u2524'],
    [/\u251c\u00e2\u252c\u2563/g, '\u251c\u2563'],
    [/\u251c\u00e2\u252c\u2557/g, '\u251c\u2557'],
    [/\u251c\u00e2\u252c\u255d/g, '\u251c\u255d'],
    [/\u251c\u00e2\u252c\u00ab/g, '\u251c\u00ab'],
    [/\u251c\u00e2\u252c\u00bb/g, '\u251c\u00bb'],
    [/\u251c\u00e0\u0093/g, '\u253c\u00f4'],
    [/\u251c\u00e2\u0089/g, '\u251c\u00eb']
  ];

  let fixed = text;
  for (const [pattern, replacement] of mojibakePatterns) {
    fixed = fixed.replace(pattern, replacement);
  }

  return fixed;
}

export async function scrapeFromProvider(
  fastify: FastifyInstance,
  provider: 'anilist' | 'mal' | 'kitsu',
  seriesName: string
): Promise<ScrapedManga> {
  const cacheKey = `${provider}:${seriesName.trim().toLowerCase()}`;
  const cached = scrapeCache.get(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    switch (provider) {
      case 'anilist': {
        const query = `
          query ($search: String, $perPage: Int) {
            Page(perPage: $perPage) {
              media(search: $search, type: MANGA) {
                title { english native romaji }
                synonyms
                description
                coverImage { extraLarge large medium }
              }
            }
          }
        `;
        const resp = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables: { search: seriesName, perPage: 5 } }),
          signal: controller.signal
        });

        if (!resp.ok) {
          fastify.log.error(`AniList API returned ${resp.status}: ${resp.statusText}`);
          return {};
        }

        const result = await resp.json() as {
          data?: { Page?: { media?: Array<{
            title?: { english?: string | null; native?: string | null; romaji?: string | null };
            synonyms?: string[];
            description?: string | null;
            coverImage?: { extraLarge?: string | null; large?: string | null; medium?: string | null };
          }> } };
        };
        const mediaList = result.data?.Page?.media || [];
        if (!mediaList.length) return {};

        const candidates = mediaList.map((media) => ({
          englishName: fixMojibake(media.title?.english),
          romajiName: fixMojibake(media.title?.romaji),
          japaneseName: fixMojibake(media.title?.native),
          synonyms: (media.synonyms || []).map((s: string) => fixMojibake(s) || s).filter(Boolean),
          description: fixMojibake(media.description),
          coverUrl: media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || undefined
        }));

        const best = pickBestCandidate(seriesName, candidates);
        scrapeCache.set(cacheKey, best);
        return best;
      }

      case 'mal': {
        const resp = await fetch(
          `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(seriesName)}&limit=5`,
          { signal: controller.signal }
        );

        if (!resp.ok) {
          fastify.log.error(`MAL API returned ${resp.status}: ${resp.statusText}`);
          return {};
        }

        const { data } = await resp.json() as MALResponse;
        const candidates = (data || []).map((manga) => ({
          englishName: fixMojibake(manga.title_english),
          romajiName: fixMojibake(manga.title),
          japaneseName: fixMojibake(manga.title_japanese),
          synonyms: (manga.title_synonyms || []).map((s: string) => fixMojibake(s) || s).filter(Boolean),
          description: fixMojibake(manga.synopsis),
          coverUrl: manga.images?.jpg?.large_image_url || manga.images?.jpg?.image_url || undefined
        }));

        if (!candidates.length) return {};
        const best = pickBestCandidate(seriesName, candidates);
        scrapeCache.set(cacheKey, best);
        return best;
      }

      case 'kitsu': {
        const resp = await fetch(
          `https://kitsu.io/api/edge/manga?filter[text]=${encodeURIComponent(seriesName)}&page[limit]=5`,
          { signal: controller.signal }
        );

        if (!resp.ok) {
          fastify.log.error(`Kitsu API returned ${resp.status}: ${resp.statusText}`);
          return {};
        }

        const { data } = await resp.json() as KitsuResponse;
        const candidates = (data || []).map((entry) => {
          const manga = entry.attributes;
          return {
            englishName: fixMojibake(manga.titles?.en || manga.titles?.en_jp),
            romajiName: fixMojibake(manga.canonicalTitle),
            japaneseName: fixMojibake(manga.titles?.ja_jp),
            synonyms: (manga.abbreviatedTitles || []).map((s: string) => fixMojibake(s) || s).filter(Boolean),
            description: fixMojibake(manga.synopsis),
            coverUrl: manga.posterImage?.large || manga.posterImage?.medium || manga.posterImage?.small || undefined
          };
        });

        if (!candidates.length) return {};
        const best = pickBestCandidate(seriesName, candidates);
        scrapeCache.set(cacheKey, best);
        return best;
      }
    }
  } catch (err) {
    fastify.log.error(`Failed to scrape from ${provider}: ${err}`);
    return {};
  } finally {
    clearTimeout(timeoutId);
  }
}
