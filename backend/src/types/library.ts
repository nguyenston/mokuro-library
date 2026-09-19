import { MokuroData } from './mokuro';
import { UserProgress } from '../generated/prisma/client';
import { Prisma, UserSeriesSettings } from '../generated/prisma/client';

export interface LibraryQuery {
  page?: number;
  limit?: number;
  q?: string;
  sort?: 'title' | 'created' | 'updated' | 'recent';
  order?: 'asc' | 'desc';
  status?: 'all' | 'read' | 'unread' | 'reading';
  bookmarked?: string;
  filter_missing?: 'cover' | 'description' | 'title' | 'any' | 'none';
  is_organized?: 'true' | 'false';
  owner?: 'admin' | 'user' | 'all';
}

export type SeriesWithOptionalSettings = Prisma.SeriesGetPayload<null> & {
  userSettings?: UserSeriesSettings[];

  // We might still have volumes if this is used by getSeries (single view),
  // so we allow it but don't require it for the transform.
  volumes?: any[];
};

export type PaginationData = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LibraryEntry {
  id: string;
  title: string | null;
  japaneseTitle: string | null;
  romajiTitle: string | null;
  synonyms: string | null;
  description: string | null;
  folderName: string;
  coverPath: string | null;
  sortTitle: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  // Flattened User Settings
  bookmarked: boolean;
  status: number;
  organized: boolean;
  lastReadAt: Date;
  isOfficial: boolean;
  canEdit: boolean;
  // Progress Stats (Cached)
  totalPageCount: number;
  totalVolumeCount: number;
  readPageCount: number;
  completedVolumeCount: number;
}

export interface LibraryResponse {
  data: LibraryEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SeriesResponse extends LibraryEntry {
  volumes: VolumeResponse[];
}

export interface VolumeResponse {
  id: string;
  title: string;
  folderName: string;
  seriesId: string;
  pageCount: number;
  coverImageName: string | null;
  progress: UserProgress[]; // UserProgress details
  mokuroData: MokuroData;
  versionInfo: {
    branchId: string;
    headPatchId: string;
    branchVersion: number;
    hasAhead: number;
    hasBehind: number;
    reviewHeadPatchId: string | null;
    reviewRequestedAt: Date | null;
    rejectionReason: string | null;
  };
}
