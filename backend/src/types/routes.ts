/**
 * Common Route Parameter Types
 *
 * Centralized type definitions for route parameters used across multiple routes.
 * This reduces duplication and ensures consistency in API endpoint definitions.
 */

/**
 * Generic ID parameter (used in many routes)
 */
export interface IdParams {
  id: string;
}

/**
 * Volume-specific route parameters
 */
export interface VolumeParams {
  /** The volume ID */
  id: string;
}

/**
 * Series-specific route parameters
 */
export interface SeriesParams {
  /** The series ID */
  id: string;
}

/**
 * Upload job status parameters
 */
export interface UploadStatusParams {
  /** The upload job ID */
  jobId: string;
}

/**
 * Progress update parameters
 */
export interface ProgressParams {
  /** The volume ID for progress tracking */
  volumeId: string;
}

/**
 * File serving parameters
 */
export interface FileParams {
  /** The volume ID */
  volumeId: string;
  /** The image filename */
  imageName: string;
}

/**
 * Mokuro JSON file parameters
 */
export interface MokuroFileParams {
  /** The volume ID */
  volumeId: string;
}

/**
 * Rebase session parameters
 */
export interface RebaseParams {
  /** The rebase session ID */
  sessionId: string;
}

/**
 * Contribution parameters
 */
export interface ContributionParams {
  /** The submission ID */
  submissionId: string;
}
