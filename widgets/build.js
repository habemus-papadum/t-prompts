const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

function copyDistToPython() {
  const distDir = path.join(__dirname, 'dist');
  const pythonWidgetsDir = path.join(__dirname, '..', 'src', 't_prompts', 'widgets');

  // Ensure Python widgets directory exists
  if (!fs.existsSync(pythonWidgetsDir)) {
    fs.mkdirSync(pythonWidgetsDir, { recursive: true });
  }

  // Copy all files from dist/ to Python package
  const files = fs.readdirSync(distDir);
  for (const file of files) {
    const srcPath = path.join(distDir, file);
    const destPath = path.join(pythonWidgetsDir, file);
    fs.copyFileSync(srcPath, destPath);
    console.log(`  Copied ${file} to Python package`);
  }
}

async function build() {
  const outdir = path.join(__dirname, 'dist');

  // Ensure output directory exists
  if (!fs.existsSync(outdir)) {
    fs.mkdirSync(outdir, { recursive: true });
  }

  try {
    await esbuild.build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      minify: true,
      sourcemap: true,
      target: ['es2020'],
      format: 'iife',
      globalName: 'TPromptsWidgets',
      outfile: path.join(outdir, 'index.js'),
      platform: 'browser',
      // Ensure deterministic output
      metafile: true,
      logLevel: 'info',
    });

    console.log('✓ Build completed successfully');

    // Copy dist to Python package
    copyDistToPython();
    console.log('✓ Copied to Python package');
  } catch (error) {
    console.error('✗ Build failed:', error);
    process.exit(1);
  }
}

build();
