const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  try {
    // Find all series with 0 volumes
    const allSeries = await prisma.series.findMany({
      include: {
        _count: { select: { volumes: true } }
      }
    });

    const emptySeries = allSeries.filter(s => s._count.volumes === 0);

    console.log('Total series:', allSeries.length);
    console.log('Empty series (0 volumes):', emptySeries.length);

    if (emptySeries.length > 0) {
      console.log('\nEmpty series details:');
      emptySeries.forEach(s => {
        console.log(`  - ID: ${s.id}`);
        console.log(`    Owner: ${s.ownerId}`);
        console.log(`    Title: ${s.title || '(no title)'}`);
        console.log(`    Folder: ${s.folderName}`);
        console.log(`    Created: ${s.createdAt}`);
        console.log('');
      });

      console.log('Deleting empty series...');

      for (const series of emptySeries) {
        // Delete user settings first
        await prisma.userSeriesSettings.deleteMany({
          where: { seriesId: series.id }
        });

        // Delete the series
        await prisma.series.delete({
          where: { id: series.id }
        });

        console.log(`  Deleted: ${series.folderName} (${series.ownerId})`);
      }

      console.log('\nCleanup complete!');
    } else {
      console.log('\nNo empty series found. Database is clean!');
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
