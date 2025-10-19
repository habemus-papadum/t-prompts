import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function copyIifeToPython() {
  const distDir = path.join(__dirname, 'dist');
  const pythonWidgetsDir = path.join(__dirname, '..', 'src', 't_prompts', 'widgets');

  // Ensure Python widgets directory exists
  if (!fs.existsSync(pythonWidgetsDir)) {
    fs.mkdirSync(pythonWidgetsDir, { recursive: true });
  }

  // Copy only the IIFE bundle to Python package
  const iifeBundle = 'index.js';
  const srcPath = path.join(distDir, iifeBundle);
  const destPath = path.join(pythonWidgetsDir, iifeBundle);

  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`  Copied ${iifeBundle} to Python package`);
  } else {
    throw new Error(`IIFE bundle not found at ${srcPath}`);
  }
}

async function buildPython() {
  const outdir = path.join(__dirname, 'dist');
  const srcdir = path.join(__dirname, 'src');

  // Ensure output directory exists
  if (!fs.existsSync(outdir)) {
    fs.mkdirSync(outdir, { recursive: true });
  }

  try {
    console.log('Building IIFE bundle for Python integration...\n');

    // Step 1: Bundle KaTeX CSS (resolves @import and bundles fonts)
    console.log('Building KaTeX bundle...');
    await esbuild.build({
      entryPoints: [path.join(srcdir, 'katex-bundle.css')],
      bundle: true,
      minify: true,
      outfile: path.join(outdir, 'katex-bundle.css'),
      loader: {
        '.woff': 'dataurl',
        '.woff2': 'dataurl',
        '.ttf': 'dataurl',
        '.eot': 'dataurl',
      },
    });
    console.log('✓ KaTeX bundle built');

    // Step 2: Concatenate widget styles + bundled KaTeX
    const widgetStyles = fs.readFileSync(path.join(srcdir, 'styles.css'), 'utf8');
    const katexBundle = fs.readFileSync(path.join(outdir, 'katex-bundle.css'), 'utf8');
    const finalStyles = widgetStyles + '\n\n' + katexBundle;
    fs.writeFileSync(path.join(outdir, 'styles.css'), finalStyles);
    const stylesHash = crypto.createHash('sha256').update(finalStyles).digest('hex').substring(0, 8);
    console.log('✓ Concatenated styles.css');
    console.log(`  Generated styles hash: ${stylesHash}`);

    // Step 4: Build IIFE JavaScript bundle from index-iife.ts
    console.log('Building IIFE JavaScript bundle...');
    await esbuild.build({
      entryPoints: ['src/index-iife.ts'],
      bundle: true,
      minify: true,
      sourcemap: true,
      sourcesContent: false,  // Exclude source content from source map
      target: ['es2020'],
      format: 'iife',
      globalName: 'TPromptsWidgets',
      outfile: path.join(outdir, 'index.js'),
      platform: 'browser',
      metafile: true,
      logLevel: 'info',
      define: {
        __TP_WIDGET_STYLES__: JSON.stringify(finalStyles),
        __TP_WIDGET_STYLES_HASH__: JSON.stringify(stylesHash),
      },
    });
    console.log('✓ IIFE JavaScript bundle built');

    // Step 5: Copy IIFE bundle to Python package
    copyIifeToPython();
    console.log('✓ Copied to Python package');

    console.log('\n✅ Python build completed successfully');
  } catch (error) {
    console.error('✗ Build failed:', error);
    process.exit(1);
  }
}

buildPython();
