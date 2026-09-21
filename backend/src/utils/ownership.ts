/**
 * Ownership Utilities
 *
 * Centralized ownership checking patterns for multi-user library access.
 * Users can access their own content plus admin-owned (shared) content.
 */

/**
 * Creates a Prisma where clause for user or admin ownership
 *
 * @param userId - The ID of the user requesting access
 * @returns Prisma OR clause for ownership checking
 *
 * @example
 * ```typescript
 * const series = await prisma.series.findMany({
 *   where: userOrAdminOwnership(userId)
 * });
 * ```
 */
export const userOrAdminOwnership = (userId: string) => ({
  OR: [
    { ownerId: userId },
    { ownerId: 'admin' }
  ]
});

/**
 * Creates a nested Prisma where clause for checking series ownership through volume
 *
 * @param userId - The ID of the user requesting access
 * @returns Prisma nested where clause
 *
 * @example
 * ```typescript
 * const volume = await prisma.volume.findFirst({
 *   where: {
 *     id: volumeId,
 *     series: volumeOwnershipCheck(userId)
 *   }
 * });
 * ```
 */
export const volumeOwnershipCheck = (userId: string) => ({
  OR: [
    { ownerId: userId },
    { ownerId: 'admin' }
  ]
});

/**
 * Checks if a user is the owner of content (not admin)
 *
 * @param ownerId - The owner ID of the content
 * @param userId - The current user's ID
 * @returns true if user is the actual owner (not accessing via admin share)
 */
export const isContentOwner = (ownerId: string, userId: string): boolean => {
  return ownerId === userId;
};

/**
 * Checks if content is official (admin-owned)
 *
 * @param ownerId - The owner ID of the content
 * @returns true if content is owned by admin
 */
export const isOfficialContent = (ownerId: string): boolean => {
  return ownerId === 'admin';
};
