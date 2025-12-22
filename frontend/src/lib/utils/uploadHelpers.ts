import type { UploadJob, SeriesMetadata, DirNode } from '$lib/types';

// We'll define these types here if they aren't in your global types yet, 
// or you can move them to $lib/types.ts
export type { UploadJob };

export async function createJobsFromFiles(fileList: FileList): Promise<UploadJob[]> {
  const rootChildren = new Map<string, DirNode>();

  // Step A: Build the Directory Tree
  for (const file of fileList) {
    // FILTER 1: Ignore junk files
    if (!/\.(jpg|jpeg|png|webp|mokuro|json)$/i.test(file.name)) {
      continue;
    }

    // FILTER 2: Ignore Hidden Files & System Folders
    const pathParts = file.webkitRelativePath.split('/');
    const isJunk = pathParts.some(
      (part) =>
        part.startsWith('.') ||
        ['__MACOSX', 'node_modules', '$RECYCLE.BIN', 'System Volume Information', 'Thumbs.db', '_ocr'].includes(part)
    );

    if (isJunk) continue;

    // Clustering key
    const folderParts = file.webkitRelativePath.split('/').slice(0, -1);
    if (file.name.toLowerCase().endsWith('.mokuro')) {
      folderParts.push(file.name.replace(/\.mokuro$/i, ''));
    }
    if (folderParts.length > 3) continue;

    let currentMap = rootChildren;
    let currentPath = '';
    let node: DirNode | undefined;

    for (const part of folderParts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!currentMap.has(part)) {
        currentMap.set(part, {
          name: part,
          fullPath: currentPath,
          files: [],
          children: new Map()
        });
      }

      node = currentMap.get(part)!;
      currentMap = node.children;
    }

    if (node) node.files.push(file);
  }

  // Step B: Traverse Tree
  const newJobs: UploadJob[] = [];
  await traverse(rootChildren, null, undefined, newJobs);

  return newJobs;
}

async function traverse(
  map: Map<string, DirNode>,
  parentName: string | null,
  parentMetadata: SeriesMetadata | undefined,
  jobs: UploadJob[]
) {
  const sortedKeys = Array.from(map.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  for (const key of sortedKeys) {
    const node = map.get(key)!;
    let currentMetadata = parentMetadata;

    // Metadata JSON check
    const jsonFile = node.files.find((f) => f.name === `${node.name}.json`);
    if (jsonFile) {
      try {
        const text = await jsonFile.text();
        currentMetadata = JSON.parse(text) as SeriesMetadata;
      } catch (e) {
        console.warn(`Failed to parse metadata for ${node.fullPath}`, e);
      }
    }

    // Merge Parent Covers
    if (node.files.length > 0 && node.children.size > 0) {
      const validCovers = node.files.filter((f) => {
        const fName = f.name.substring(0, f.name.lastIndexOf('.'));
        return fName === node.name && /\.(jpg|jpeg|png|webp)$/i.test(f.name);
      });
      if (validCovers.length > 0) {
        const firstChildKey = Array.from(node.children.keys()).sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        )[0];
        if (firstChildKey) {
          const child = node.children.get(firstChildKey)!;
          child.files.push(...validCovers);
          node.files = node.files.filter((f) => !validCovers.includes(f));
        }
      }
    }

    // CREATE JOB
    if (node.files.length > 0) {
      const payloadFiles = node.files.filter((f) => !f.name.toLowerCase().endsWith('.json'));

      if (payloadFiles.length > 0) {
        const seriesFolder = parentName ?? node.name;
        const volumeFolder = node.name;
        const displayName = seriesFolder === volumeFolder ? seriesFolder : `${seriesFolder}/${volumeFolder}`;

        const seriesTitle = currentMetadata?.series?.title ?? null;
        const seriesDescription = currentMetadata?.series?.description ?? null;
        const seriesBookmarked = currentMetadata?.series?.bookmarked ?? false;

        const volMeta = currentMetadata?.volumes?.[node.name];
        const volumeTitle = volMeta?.displayTitle ?? null;
        const volumeProgress = volMeta?.progress ?? null;

        jobs.push({
          id: `vol-${node.fullPath}`,
          name: displayName,
          files: payloadFiles,
          status: 'pending',
          progress: 0,
          seriesFolderName: seriesFolder,
          volumeFolderName: volumeFolder,
          metadata: {
            seriesTitle,
            seriesDescription,
            seriesBookmarked,
            volumeTitle,
            volumeProgress
          }
        });
      }
    }

    await traverse(node.children, node.name, currentMetadata, jobs);
  }
}
