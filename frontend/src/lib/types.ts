// --- Type definitions Reader GET ---
export interface MokuroBlock {
  box: [number, number, number, number];
  lines_coords: [[number, number], [number, number], [number, number], [number, number]][];
  lines: string[];
  vertical?: boolean;
  font_size?: number;
  domElement?: HTMLDivElement;
}
export interface MokuroPage {
  img_width: number;
  img_height: number;
  blocks: MokuroBlock[];
  img_path: string;
}
export interface MokuroData {
  title: string;
  title_uuid: string;
  volume: string;
  pages: MokuroPage[];
}

export interface VolumeReaderResponse {
  id: string;
  title: string;
  seriesId: string;
  pageCount: number;
  coverImageName: string | null;
  mokuroData: MokuroData;
}

// --- Upload Pipeline Types ---

export interface UploadJob {
  id: string;
  name: string;
  files: File[];
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
  progress: number;
  resultMsg?: string;
  seriesFolderName: string;
  volumeFolderName: string;
  metadata: {
    seriesTitle?: string | null;
    seriesDescription?: string | null;
    seriesBookmarked?: boolean;
    volumeTitle?: string | null;
    volumeProgress?: { page: number; completed: boolean } | null;
  };
}

export interface DirNode {
  name: string;
  fullPath: string;
  files: File[];
  children: Map<string, DirNode>;
}

export interface SeriesMetadata {
  series: {
    title: string | null;
    description?: string | null;
    bookmarked?: boolean;
  };
  volumes: Record<
    string,
    {
      displayTitle: string | null;
      progress?: { page: number; completed: boolean } | null;
    }
  >;
}
