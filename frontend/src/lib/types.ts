/**
 * Type definitions for Mokuro OCR data structures.
 * Mokuro is a manga OCR tool that generates JSON files with text block coordinates.
 */

/**
 * Represents a single text block detected by Mokuro OCR.
 * Contains positioning, text content, and optional UI state.
 */
export interface MokuroBlock {
  /** Bounding box coordinates: [x, y, width, height] in image pixels */
  box: [number, number, number, number];

  /** Quadrilateral coordinates for each text line: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]][] */
  lines_coords: [[number, number], [number, number], [number, number], [number, number]][];

  /** Array of text strings, one per line */
  lines: string[];

  /** Whether text is vertical (true) or horizontal (false) */
  vertical?: boolean;

  /** Font size in image pixels (editable by user) */
  font_size?: number;

  /** Reference to the DOM element (runtime only, not persisted) */
  domElement?: HTMLDivElement;
}

/**
 * Represents a single manga page with OCR data
 */
export interface MokuroPage {
  /** Original image width in pixels */
  img_width: number;

  /** Original image height in pixels */
  img_height: number;

  /** Array of text blocks detected on this page */
  blocks: MokuroBlock[];

  /** Relative path to the image file */
  img_path: string;
}

/**
 * Complete Mokuro OCR data for a volume/chapter
 */
export interface MokuroData {
  /** Series title */
  title: string;

  /** Unique identifier for the volume */
  title_uuid: string;

  /** Volume/chapter identifier */
  volume: string;

  /** Array of pages with OCR data */
  pages: MokuroPage[];
}

/**
 * API response for volume data including metadata and OCR
 */
export interface VolumeResponse {
  /** Volume ID in the database */
  id: string;

  /** Clean display title for the volume */
  title: string;

  /** ID of the parent series */
  seriesId: string;

  /** Total number of pages in this volume */
  pageCount: number;

  /** Filename of the cover image, or null if none */
  coverImageName: string | null;

  /** Complete Mokuro OCR data */
  mokuroData: MokuroData;
}
