import type { Series, UserSeriesSettings, UserProgress, Volume } from '../../generated/prisma/client';

export type MetadataFormat = 'mokuro' | 'comicinfo';

export const normalizeMetadataFormat = (value?: string): MetadataFormat => {
  if (value === 'comicinfo') return 'comicinfo';
  return 'mokuro';
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const extractVolumeNumber = (value: string) => {
  const match = value.match(/(\d+(\.\d+)?)/);
  return match ? match[1] : '';
};

export const buildComicInfoXml = (
  series: Series,
  volume?: Volume
) => {
  const seriesTitle = series.title || series.folderName;
  const volumeTitle = volume?.title || volume?.folderName || seriesTitle;
  const number = volume ? extractVolumeNumber(volume.folderName) : '';
  const summary = series.description || '';

  return `<?xml version="1.0" encoding="utf-8"?>\n<ComicInfo>\n` +
    `  <Series>${escapeXml(seriesTitle)}</Series>\n` +
    `  <Title>${escapeXml(volumeTitle)}</Title>\n` +
    (number ? `  <Number>${escapeXml(number)}</Number>\n` : '') +
    (summary ? `  <Summary>${escapeXml(summary)}</Summary>\n` : '') +
    `</ComicInfo>\n`;
};

export interface MokuroSeriesMetadata {
  version: string;
  series: {
    title: string | null;
    description: string | null;
    originalFolderName: string;
    bookmarked: boolean;
  };
  volumes: {
    [fileName: string]: {
      displayTitle: string | null;
      progress?: {
        page: number;
        isCompleted: boolean;
        timeRead: number;
        charsRead: number;
      };
    }
  };
}

export const generateSeriesMetadata = (
  series: Series & { userSettings: UserSeriesSettings[] },
  volumes: (Volume & { progress: UserProgress[] })[],
  userId: string
): MokuroSeriesMetadata => {
  const volumeMap: MokuroSeriesMetadata['volumes'] = {};

  for (const vol of volumes) {
    const fileName = `${vol.folderName}`;
    const userProgress = vol.progress.find((progress) => progress.userId === userId);

    volumeMap[fileName] = {
      displayTitle: vol.title,
      progress: userProgress ? {
        page: userProgress.page,
        isCompleted: userProgress.completed,
        timeRead: userProgress.timeRead,
        charsRead: userProgress.charsRead
      } : undefined
    };
  }

  const isBookmarked = series.userSettings?.[0]?.bookmarked ?? false;

  return {
    version: '0.2.0',
    series: {
      title: series.title,
      description: series.description,
      bookmarked: isBookmarked,
      originalFolderName: series.folderName
    },
    volumes: volumeMap
  };
};
