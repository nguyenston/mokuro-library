import type { Readable } from 'stream';

// Drains a readable stream completely by resuming it and waiting for the 'end' event.
// This is used to discard file contents we don't want to save.
export function drainStream(stream: Readable): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
    stream.resume(); // Start the flow
  });
}
