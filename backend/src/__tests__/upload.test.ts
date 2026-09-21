import { describe, expect, it } from 'vitest';
import { safeFilename } from '../utils/safeFilename';
import { enqueueUploadJob, getUploadJob } from '../lib/uploadQueue';

const waitForStatus = async (id: string, status: string) => {
  for (let i = 0; i < 30; i += 1) {
    const job = getUploadJob(id);
    if (job?.status === status) return job;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for status ${status}`);
};

describe('upload helpers', () => {
  it('sanitizes unsafe filenames', () => {
    expect(safeFilename('  bad/name  ')).toBe('bad_name');
    expect(safeFilename('..\\evil/../file')).toBe('.._evil_.._file');
  });

  it('processes upload jobs to completion', async () => {
    const job = enqueueUploadJob(async () => ({ volumeId: 'vol-1', message: 'done' }));
    expect(['queued', 'processing']).toContain(job.status);

    const completed = await waitForStatus(job.id, 'completed');
    expect(completed.volumeId).toBe('vol-1');
    expect(completed.message).toBe('done');
  });

  it('marks upload jobs as failed on errors', async () => {
    const job = enqueueUploadJob(async () => {
      throw new Error('boom');
    });

    const failed = await waitForStatus(job.id, 'failed');
    expect(failed.message).toBe('boom');
  });
});
