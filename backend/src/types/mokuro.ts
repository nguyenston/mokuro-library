// A "Quad" representing the 4 corners of a text line (x,y)
export type Quad = [
  [number, number],
  [number, number],
  [number, number],
  [number, number]
];

// A "Rect" representing the bounding box of a block (min_x, min_y, max_x, max_y)
export type Rect = [number, number, number, number];

export interface MokuroBlock {
  box: Rect;
  vertical: boolean;
  font_size?: number;

  // NATIVE FORMAT: Split Arrays
  lines: string[];
  lines_coords: Quad[];
}

export interface MokuroPage {
  blocks: MokuroBlock[];
  img_path: string;
  // Add dimensions or other page metadata if needed
  img_width: number;
  img_height: number;
}

export interface MokuroData {
  // The UUID of the patch this snapshot represents. 
  // Used for optimistic locking and staleness checks.
  patch_id?: string;

  title?: string;
  title_uuid?: string;
  volume?: string;
  pages: MokuroPage[];
}
