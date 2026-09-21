export interface UserProgress {
  page: number;
  completed: boolean;
  timeRead: number;
  charsRead: number;
  lastReadAt?: string;
}

export interface Volume {
  id: string;
  title: string | null;
  folderName: string;
  pageCount: number;
  progress: UserProgress[];
}

export interface Series {
  id: string;
  title: string | null;
  folderName: string;
  volumes: Volume[];
}

export interface ReadingStats {
  recentSpeed: number;
  charactersRead: number;
  volumesCompleted: number;
  totalTime: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  unlocked: boolean;
}

export interface SpeedBySeries {
  seriesName: string;
  volumes: number;
  avgSpeed: number;
  improvement: number;
}

export interface CompletedVolume {
  seriesName: string;
  volumeTitle: string;
  speed: number;
  vsAvg: number;
  duration: number;
  characters: number;
  dateFinished: string;
}

export type TimeFilter = 'week' | 'month' | '3months' | '6months' | 'year';
