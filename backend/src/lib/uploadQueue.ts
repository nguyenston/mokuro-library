import { randomUUID } from 'crypto';

export type UploadJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type UploadJob = {
  id: string;
  status: UploadJobStatus;
  message?: string;
  volumeId?: string;
  createdAt: Date;
  updatedAt: Date;
};

const jobs = new Map<string, UploadJob>();
const queue: Array<() => Promise<void>> = [];
let isProcessing = false;

export const enqueueUploadJob = (
  task: () => Promise<{ volumeId?: string; message?: string }>
) => {
  const id = randomUUID();
  const job: UploadJob = {
    id,
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  jobs.set(id, job);

  queue.push(async () => {
    job.status = 'processing';
    job.updatedAt = new Date();
    try {
      const result = await task();
      job.status = 'completed';
      job.volumeId = result.volumeId;
      job.message = result.message;
    } catch (error) {
      job.status = 'failed';
      job.message = error instanceof Error ? error.message : 'Upload failed.';
    } finally {
      job.updatedAt = new Date();
    }
  });

  void processQueue();
  return job;
};

export const getUploadJob = (id: string) => jobs.get(id);

const processQueue = async () => {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const task = queue.shift();
    if (task) {
      await task();
    }
  }

  isProcessing = false;
};
