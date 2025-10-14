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

function extractKatexCss() {
  // Read KaTeX CSS and write it to dist
  const katexCssPath = path.join(__dirname, 'node_modules', 'katex', 'dist', 'katex.min.css');
  const outCssPath = path.join(__dirname, 'dist', 'katex.css');

  if (fs.existsSync(katexCssPath)) {
    fs.copyFileSync(katexCssPath, outCssPath);
    console.log('  Extracted KaTeX CSS');
  } else {
    console.warn('  Warning: KaTeX CSS not found');
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
      // External packages are bundled since we're targeting browser
      loader: {
        '.css': 'text',  // Import CSS as text string
      },
    });

    console.log('✓ Build completed successfully');

    // Extract KaTeX CSS
    extractKatexCss();

    // Copy dist to Python package
    copyDistToPython();
    console.log('✓ Copied to Python package');
  } catch (error) {
    console.error('✗ Build failed:', error);
    process.exit(1);
  }
}

build();
