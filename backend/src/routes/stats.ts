import { FastifyPluginAsync } from 'fastify';
import { LibraryQuery } from '../types/library';
import { queryLibrary } from '../utils/library/query';

const statsRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {

  // 1. Apply authentication to all routes in this plugin
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/stats/summary
  fastify.get('/summary', async (request, reply) => {
    const userId = request.user!.id;

    const progress = await fastify.prisma.userProgress.findMany({
      where: { userId },
    });

    let totalTime = 0;
    let totalChars = 0;
    let volumesCompleted = 0;

    for (const p of progress) {
      totalTime += p.timeRead || 0;
      totalChars += p.charsRead || 0;
      if (p.completed) volumesCompleted++;
    }

    const recentSpeed = totalTime > 0 ? Math.round(totalChars / totalTime) : 0;

    return {
      recentSpeed,
      charactersRead: totalChars,
      volumesCompleted,
      totalTime: Math.round(totalTime),
    };
  });

  // GET /api/stats/history
  fastify.get('/history', async (request, reply) => {
    const userId = request.user!.id;
    const { timeRange = '30' } = request.query as { timeRange?: string };
    const days = Math.max(1, Math.min(365, Number.parseInt(timeRange, 10) || 30));

    const rawHistory = await fastify.prisma.$queryRaw<Array<{
      date: string;
      totalChars: bigint | number;
      totalTime: bigint | number;
      speed: bigint | number | null;
    }>>`
            SELECT
                DATE(lastReadAt) as date,
                SUM(charsRead) as totalChars,
                SUM(timeRead) as totalTime,
                CAST(SUM(charsRead) / NULLIF(SUM(timeRead), 0) AS INTEGER) as speed
            FROM UserProgress
            WHERE userId = ${userId}
                AND lastReadAt IS NOT NULL
                AND lastReadAt > datetime('now', '-' || ${days} || ' days')
            GROUP BY DATE(lastReadAt)
            ORDER BY date ASC
        `;

    const history = rawHistory.map(row => ({
      date: row.date,
      totalChars: Number(row.totalChars),
      totalTime: Number(row.totalTime),
      speed: row.speed !== null ? Number(row.speed) : 0
    }));

    return { history };
  });

  // GET /api/stats/series
  // TODO: Optimize by caching stats using extensions
  fastify.get<{ Querystring: LibraryQuery }>('/series', async (request, reply) => {
    const userId = request.user!.id;

    const response = await queryLibrary(fastify, request.user.id, request.query, {
      include: {
        volumes: {
          include: { progress: { where: { userId } } }
        }
      },
      transform: (series) => {
        let totalChars = 0;
        let totalTime = 0;

        for (const volume of series.volumes!) {
          for (const prog of volume.progress) {
            totalChars += prog.charsRead || 0;
            totalTime += prog.timeRead || 0;
          }
        }

        const avgSpeed = totalTime > 0 ? Math.round(totalChars / totalTime) : 0;

        return {
          seriesName: series.sortTitle,
          volumes: series.totalVolumeCount,
          avgSpeed,
        };
      }
    });

    return reply.send(response);
  });

  // GET /api/stats/series/:seriesId
  // fetch stats for a specific series by ID
  fastify.get<{ Params: { id: string } }>('/series/:id', async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params;

    const series = await fastify.prisma.series.findUnique({
      where: { id: id },
      select: {
        title: true,
        folderName: true,
        volumes: {
          select: {
            id: true,
            progress: {
              where: { userId },
              select: {
                charsRead: true,
                timeRead: true,
                completed: true,
              }
            }
          }
        }
      }
    });

    if (!series) {
      return reply.status(404).send({ message: 'Series not found' });
    }

    let totalChars = 0;
    let totalTime = 0;
    let volumesRead = 0;

    for (const volume of series.volumes) {
      for (const prog of volume.progress) {
        totalChars += prog.charsRead || 0;
        totalTime += prog.timeRead || 0;
        if (prog.completed) volumesRead++;
      }
    }

    const avgSpeed = totalTime > 0 ? Math.round(totalChars / totalTime) : 0;

    return {
      seriesName: series.title || series.folderName,
      volumes: volumesRead,
      avgSpeed,
      totalChars,
      totalTime: Math.round(totalTime),
    };
  });

  // GET /api/stats/completedVolumes
  fastify.get('/completedVolumes', async (request, reply) => {
    const userId = request.user!.id;

    const completed = await fastify.prisma.userProgress.findMany({
      where: { userId, completed: true },
      include: { volume: { include: { series: true } } },
      orderBy: {
        lastReadAt: 'desc'
      },
      take: 50,
    });

    const result = completed.map((prog) => {
      const volume = prog.volume;
      // Defensive check in case of orphaned progress records
      if (!volume) return null;

      const speed = prog.timeRead > 0
        ? Math.round((prog.charsRead || 0) / prog.timeRead)
        : 0;

      return {
        seriesName: volume.series.title || volume.series.folderName,
        volumeTitle: volume.title || volume.folderName,
        speed,
        duration: Math.round(prog.timeRead),
        characters: prog.charsRead || 0,
        dateFinished: prog.lastReadAt,
      };
    }).filter(Boolean);

    return { completedVolumes: result };
  });

  // GET /api/stats/export
  fastify.get('/export', async (request, reply) => {
    const userId = request.user!.id;

    const data = await fastify.prisma.userProgress.findMany({
      where: { userId },
      orderBy: {
        lastReadAt: 'desc'
      }
    });

    const volumeIds = data.map((p: any) => p.volumeId);
    const volumes = await fastify.prisma.volume.findMany({
      where: { id: { in: volumeIds } },
      select: {
        id: true,
        title: true,
        folderName: true,
        series: {
          select: {
            title: true,
            folderName: true,
          }
        }
      }
    });

    const volumeMap = new Map(volumes.map((v: any) => [v.id, v]));

    const csvRows = [
      'Date,Series,Volume,Pages Read,Time (min),Chars Read,Speed (chars/min),Completed'
    ];

    for (const row of data) {
      const volume = volumeMap.get(row.volumeId);
      if (!volume) continue;

      const speed = row.timeRead > 0 ? Math.round((row.charsRead || 0) / row.timeRead) : 0;
      csvRows.push([
        row.lastReadAt || 'N/A',
        volume.series.title || volume.series.folderName,
        volume.title || volume.folderName,
        row.page,
        Math.round(row.timeRead),
        row.charsRead || 0,
        speed,
        row.completed ? 'Yes' : 'No'
      ].join(','));
    }

    return reply
      .header('Content-Disposition', 'attachment; filename=reading-stats.csv')
      .type('text/csv')
      .send(csvRows.join('\n'));
  });
};

export default statsRoutes;
