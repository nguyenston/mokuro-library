// backend/scripts/build-exe.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild'); // Uses the API directly to avoid Windows quoting issues

const ROOT_DIR = path.resolve(__dirname, '../..');
const BACKEND_DIR = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const RELEASE_DIR = path.join(BACKEND_DIR, 'release');

console.log('🚀 Starting Windows Portable Build (Node 22 SEA)...');

try {
  // 1. Clean & Init Release Dir
  if (fs.existsSync(RELEASE_DIR)) fs.rmSync(RELEASE_DIR, { recursive: true, force: true });

  const DIST_DIR = path.join(BACKEND_DIR, 'dist');
  if (fs.existsSync(DIST_DIR)) fs.rmSync(DIST_DIR, { recursive: true, force: true });

  fs.mkdirSync(RELEASE_DIR);
  fs.mkdirSync(DIST_DIR);
  fs.mkdirSync(path.join(RELEASE_DIR, 'data'));
  fs.mkdirSync(path.join(RELEASE_DIR, 'prisma'));

  // 2. Build Frontend
  console.log('📦 Building Frontend...');
  execSync('npm run build', { cwd: FRONTEND_DIR, stdio: 'inherit' });

  // Matches expectation in server.ts
  const releaseFrontendDir = path.join(RELEASE_DIR, 'frontend', 'build');

  // Create the nested directory structure
  fs.mkdirSync(releaseFrontendDir, { recursive: true });

  // Copy files
  fs.cpSync(path.join(FRONTEND_DIR, 'build'), releaseFrontendDir, { recursive: true });

  // 3. Copy Migrations
  // We ship the SQL files so the exe can run them on startup
  console.log('📂 Copying migration files...');
  fs.cpSync(
    path.join(BACKEND_DIR, 'prisma', 'migrations'),
    path.join(RELEASE_DIR, 'prisma', 'migrations'),
    { recursive: true }
  );

  // 4. Bundle Backend with esbuild
  console.log('⚡ Bundling Backend with esbuild...');
  esbuild.buildSync({
    entryPoints: [path.join(BACKEND_DIR, 'src', 'exe-entry.ts')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    outfile: path.join(BACKEND_DIR, 'dist', 'bundle.js'),
    external: ['better-sqlite3', '@prisma/client'],
    banner: {
      js: 'require = require("node:module").createRequire(process.execPath);',
    },
  });

  // 5. Generate SEA Config
  console.log('📝 Generating SEA Config...');
  const seaConfig = {
    main: "dist/bundle.js",
    output: "dist/sea-prep.blob",
    disableExperimentalSEAWarning: true
  };
  fs.writeFileSync(path.join(BACKEND_DIR, 'sea-config.json'), JSON.stringify(seaConfig));

  // 6. Generate Blob
  console.log('blob Generating Blob...');
  execSync('node --experimental-sea-config sea-config.json', { cwd: BACKEND_DIR, stdio: 'inherit' });

  // 7. Copy Node Executable
  console.log('📀 Copying Node.js Executable...');
  const nodeExePath = process.execPath;
  const destExePath = path.join(RELEASE_DIR, 'mokuro-library.exe');
  fs.copyFileSync(nodeExePath, destExePath);

  // 8. Inject Blob into Executable
  console.log('💉 Injecting Application...');
  const sentinel = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";
  execSync(`npx postject "${destExePath}" NODE_SEA_BLOB dist/sea-prep.blob --sentinel-fuse ${sentinel} --overwrite`, { cwd: BACKEND_DIR, stdio: 'inherit' });

  // 9. Copy Native Dependencies
  console.log('🐘 Copying Native Assets...');
  fs.copyFileSync(path.join(BACKEND_DIR, 'prisma', 'schema.prisma'), path.join(RELEASE_DIR, 'prisma', 'schema.prisma'));

  const prismaDir = path.join(BACKEND_DIR, 'src', 'generated', 'prisma');
  fs.copyFileSync(path.join(prismaDir, 'query_engine-windows.dll.node'), path.join(RELEASE_DIR, 'query_engine-windows.dll.node'));

  console.log('📦 Copying native modules...');
  const destNodeModules = path.join(RELEASE_DIR, 'node_modules');
  fs.mkdirSync(destNodeModules);

  fs.cpSync(path.join(BACKEND_DIR, 'node_modules', 'better-sqlite3'), path.join(destNodeModules, 'better-sqlite3'), { recursive: true });
  fs.cpSync(path.join(BACKEND_DIR, 'node_modules', '.prisma'), path.join(destNodeModules, '.prisma'), { recursive: true });
  fs.cpSync(path.join(BACKEND_DIR, 'node_modules', '@prisma'), path.join(destNodeModules, '@prisma'), { recursive: true });

  console.log('------------------------------------------------');
  console.log('✅ Build Complete!');
  console.log(`📁 Artifacts located in: ${RELEASE_DIR}`);
  console.log('------------------------------------------------');

} catch (error) {
  console.error('❌ Build Failed:', error);
  process.exit(1);
}
