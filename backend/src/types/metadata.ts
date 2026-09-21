export interface SeriesUpdateBody {
  title?: string | null;
  description?: string | null;
  bookmarked?: boolean;
  organized?: boolean;
  japaneseTitle?: string | null;
  romajiTitle?: string | null;
  synonyms?: string | null;
  tempCoverPath?: string;
}

export interface ScrapedManga {
  englishName?: string;
  japaneseName?: string;
  romajiName?: string;
  synonyms?: string[];
  description?: string;
  coverUrl?: string;
}

export interface ScrapeResponse {
  current: {
    title: string | null;
    japaneseTitle: string | null;
    romajiTitle: string | null;
    synonyms: string | null;
    description: string | null;
    hasCover: boolean;
    coverPath: string | null;
  };
  scraped: {
    title?: string;
    japaneseTitle?: string;
    romajiTitle?: string;
    synonyms?: string; // JSON stringified array
    description?: string;
    hasCover: boolean;
    tempCoverPath?: string;
  };
}
