import fs from 'fs';
import path from 'path';
import util from 'util';
import { pipeline } from 'stream';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const pump = util.promisify(pipeline);

interface SeriesCoverParams {
  id: string;
}

export async function handleSeriesCoverUpload(
  fastify: FastifyInstance,
  request: FastifyRequest<{ Params: SeriesCoverParams }>,
  reply: FastifyReply
) {
  const { id: seriesId } = request.params;
  const userId = request.user.id;

  const data = await request.file();
  if (!data) {
    return reply.status(400).send({ message: 'No file uploaded.' });
  }

  try {
    const series = await fastify.prisma.series.findFirst({
      where: { id: seriesId, ownerId: userId }
    });

    if (!series) {
      await data.toBuffer();
      return reply.status(404).send({ message: 'Series not found.' });
    }

    const seriesDirRelative = path.join('uploads', userId, series.folderName);
    const seriesDirAbsolute = path.join(fastify.projectRoot, seriesDirRelative);

    await fs.promises.mkdir(seriesDirAbsolute, { recursive: true });

    const ext = path.extname(data.filename).toLowerCase() || '.jpg';
    const newFileName = `${series.folderName}${ext}`;
    const filePathAbsolute = path.join(seriesDirAbsolute, newFileName);
    const filePathRelative = path.join(seriesDirRelative, newFileName);

    await pump(data.file, fs.createWriteStream(filePathAbsolute));

    await fastify.prisma.series.update({
      where: { id: seriesId },
      data: { coverPath: filePathRelative.replace(/\\/g, '/') }
    });

    return reply.status(200).send({ message: 'Cover updated successfully.' });
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ message: 'Failed to upload cover.' });
  }
}
