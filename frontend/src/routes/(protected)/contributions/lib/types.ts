import type { Volume } from '$lib/types';

export type VolumeContribution = Volume & {
  hasAhead: number;
  hasBehind: number;
  userPatchCount: number;
  behindByCount: number;
};

export type SeriesContribution = {
  id: string;
  title: string;
  coverPath: string | null;
  volumes: VolumeContribution[];
  totalAhead: number;
  totalBehind: number;
  volumesAhead: number;
  volumesBehind: number;
};

export type FilterType = 'all' | 'behind' | 'ahead';

export type ActivityEntry = {
  id: string;
  volumeId: string;
  volumeTitle: string;
  seriesTitle: string;
  seriesId: string;
  timestamp: string;
  patchCount: number;
  editType: 'text' | 'box' | 'font' | 'structure';
};

export type ActivityGraphDay = {
  date: string;
  count: number;
  dayName: string;
};

export type ConflictType =
  | 'content_conflict'
  | 'dead_zone'
  | 'double_delete'
  | 'reorder_length_change'
  | 'competing_reorder'
  | 'structure_change';

export type RebaseResolution = 'keep_admin' | 'keep_mine' | 'skip' | 'resurrect';

export type RebaseConflict = {
  type: ConflictType;
  path: string;
  userValue: string | null;
  adminValue: string | null;
  context: {
    pageNumber?: number;
    blockIndex?: number;
    lineIndex?: number;
  };
};

export type StatusInfo = {
  color: string;
  textColor: string;
  icon: string;
};
