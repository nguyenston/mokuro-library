import type { FastifyInstance } from 'fastify';
import type { LibraryQuery, PaginationData, SeriesWithOptionalSettings } from '../../types/library';
import { Prisma } from '../../generated/prisma/client';
import { transformSeriesForLibraryQuery } from './seriesTransform';
import { SeriesInclude } from '../../generated/prisma/models';

type DefaultTransformResult = ReturnType<typeof transformSeriesForLibraryQuery>;
export async function queryLibrary<T = DefaultTransformResult>(
  fastify: FastifyInstance,
  userId: string,
  query: LibraryQuery,
  options?: {
    transform?: (series: SeriesWithOptionalSettings, userId: string) => T,
    include?: SeriesInclude,
  }
): Promise<{
  meta: PaginationData,
  data: T[]
}> {
  const transform = options?.transform ?? transformSeriesForLibraryQuery as (series: SeriesWithOptionalSettings, userId: string) => T;
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.max(1, Math.min(100, query.limit ?? 20));
  const q = query.q?.trim() ?? '';
  const sort = query.sort ?? 'title';
  const order = query.order ?? 'asc';
  const status = query.status ?? 'all';
  const bookmarked = query.bookmarked === 'true';
  const filter_missing = query.filter_missing ?? 'none';
  const is_organized = query.is_organized;
  const owner = query.owner ?? 'all';

  // Build owner filter
  let ownerFilter: Prisma.SeriesWhereInput;
  if (owner === 'admin') {
    ownerFilter = { ownerId: 'admin' };
  } else if (owner === 'user') {
    ownerFilter = { ownerId: userId };
  } else {
    ownerFilter = { OR: [{ ownerId: userId }, { ownerId: 'admin' }] };
  }

  const seriesWhere: Prisma.SeriesWhereInput = {
    AND: [ownerFilter]
  };
  const andConditions = (seriesWhere.AND as Prisma.SeriesWhereInput[]);

  if (q) {
    andConditions.push({
      OR: [
        { sortTitle: { contains: q } },
        { japaneseTitle: { contains: q } },
        { romajiTitle: { contains: q } },
        { synonyms: { contains: q } }
      ]
    });
  }

  if (filter_missing !== 'none') {
    if (filter_missing === 'cover') andConditions.push({ coverPath: null });
    else if (filter_missing === 'description') {
      andConditions.push({ OR: [{ description: null }, { description: '' }] });
    } else if (filter_missing === 'title') {
      andConditions.push({ OR: [{ japaneseTitle: null }, { romajiTitle: null }] });
    } else if (filter_missing === 'any') {
      andConditions.push({ OR: [{ coverPath: null }, { description: null }, { japaneseTitle: null }] });
    }
  }

  const addUserFilter = (filter: Prisma.UserSeriesSettingsWhereInput) => {
    andConditions.push({ userSettings: { some: { userId: userId, ...filter } } });
  };

  if (bookmarked) addUserFilter({ bookmarked: true });
  if (is_organized === 'true') addUserFilter({ organized: true });
  else if (is_organized === 'false') {
    andConditions.push({
      OR: [
        { userSettings: { none: { userId } } },
        { userSettings: { some: { userId, organized: false } } }
      ]
    });
  }

  if (status === 'reading') addUserFilter({ status: 1 });
  else if (status === 'read') addUserFilter({ status: 2 });
  else if (status === 'unread') {
    andConditions.push({
      OR: [
        { userSettings: { none: { userId } } },
        { userSettings: { some: { userId, status: 0 } } }
      ]
    });
  }

  if (sort === 'recent') {
    const [total, settings] = await fastify.prisma.$transaction([
      fastify.prisma.userSeriesSettings.count({
        where: { userId, series: seriesWhere }
      }),
      fastify.prisma.userSeriesSettings.findMany({
        where: { userId, series: seriesWhere },
        orderBy: { lastReadAt: order },
        take: limit,
        skip: (page - 1) * limit,
        include: {
          series: {
            include: options?.include ?? {}
          }
        }
      })
    ]);

    const data = settings.map((setting: any) => {
      const { series, ...cleanSettings } = setting;
      return transform({ ...series, userSettings: cleanSettings }, userId)
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
  }

  let orderBy: Prisma.SeriesOrderByWithRelationInput;
  if (sort === 'created') orderBy = { createdAt: order };
  else if (sort === 'updated') orderBy = { updatedAt: order };
  else orderBy = { sortTitle: order };

  const [total, seriesList] = await fastify.prisma.$transaction([
    fastify.prisma.series.count({ where: seriesWhere }),
    fastify.prisma.series.findMany({
      where: seriesWhere,
      orderBy,
      take: limit,
      skip: (page - 1) * limit,
      include: {
        ...(options?.include ?? {}),
        userSettings: { where: { userId } }
      }
    })
  ]);

  const data = seriesList.map((series: any) => transform(series, userId));

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
  };
}
