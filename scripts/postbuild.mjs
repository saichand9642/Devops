/**
 * GitHub Pages serves static files only, so a deep link such as
 * /Devops/ckad/topics/probes has no file behind it and Pages answers with
 * 404.html. Copying index.html to 404.html lets the client side router take
 * over, which keeps real URLs (instead of hash URLs) working on Pages.
 *
 * .nojekyll stops Pages from running Jekyll, which would otherwise drop files
 * and directories whose names begin with an underscore.
 */
import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const indexHtml = resolve(distDir, 'index.html')

if (!existsSync(indexHtml)) {
  console.error('postbuild: dist/index.html not found - did "vite build" run?')
  process.exit(1)
}

copyFileSync(indexHtml, resolve(distDir, '404.html'))
writeFileSync(resolve(distDir, '.nojekyll'), '')
console.log('postbuild: wrote dist/404.html and dist/.nojekyll')
