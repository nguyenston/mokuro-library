import type { RebaseConflict, VolumeContribution } from './types';

export type RebaseModalState = {
  isOpen: boolean;
  volumeId: string | null;
  volumeTitle: string | null;
  seriesTitle: string | null;
  conflicts: RebaseConflict[];
  currentConflictIndex: number;
};

export type ResetModalState = {
  isOpen: boolean;
  volumeId: string | null;
  volumeTitle: string | null;
};

const sampleConflicts: RebaseConflict[] = [
  {
    type: 'content_conflict',
    path: '/pages/5/blocks/2/lines/0/text',
    userValue: '彼は学生です',
    adminValue: '彼女は学生です',
    context: {
      pageNumber: 5,
      blockIndex: 2,
      lineIndex: 0
    }
  },
  {
    type: 'dead_zone',
    path: '/pages/12/blocks/3',
    userValue: 'Deleted block that user edited',
    adminValue: null,
    context: {
      pageNumber: 12,
      blockIndex: 3
    }
  }
];

export function createRebaseModalState(): RebaseModalState {
  return {
    isOpen: false,
    volumeId: null,
    volumeTitle: null,
    seriesTitle: null,
    conflicts: [],
    currentConflictIndex: 0
  };
}

export function openRebaseModal(volume: VolumeContribution, seriesTitle: string): RebaseModalState {
  return {
    isOpen: true,
    volumeId: volume.id,
    volumeTitle: volume.title,
    seriesTitle,
    conflicts: sampleConflicts,
    currentConflictIndex: 0
  };
}

export function createResetModalState(): ResetModalState {
  return {
    isOpen: false,
    volumeId: null,
    volumeTitle: null
  };
}

export function openResetModal(volume: VolumeContribution): ResetModalState {
  return {
    isOpen: true,
    volumeId: volume.id,
    volumeTitle: volume.title
  };
}
