import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * The app is designed to be hosted from a repository sub-path on GitHub Pages
 * (for example https://<user>.github.io/Devops/). The base path can be overridden
 * at build time with BASE_PATH so the same code can be hosted at a domain root:
 *
 *   BASE_PATH=/ npm run build
 */
const basePath = process.env.BASE_PATH ?? '/Devops/'

export default defineConfig(({ mode }) => ({
  // Dev server always runs from "/" so local development needs no sub-path juggling.
  base: mode === 'production' ? basePath : '/',
  plugins: [
    react(),
    VitePWA({
      // "prompt" gives us an explicit "New version available - Update" banner instead
      // of silently swapping content while somebody is mid-lesson.
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        id: basePath,
        name: 'DevOps Learning Hub',
        short_name: 'DevOps Hub',
        description:
          'Independent study app for DevOps certifications. Course one: Certified Kubernetes Application Developer (CKAD).',
        lang: 'en',
        dir: 'ltr',
        start_url: basePath,
        scope: basePath,
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#0b1220',
        theme_color: '#0b1220',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Old revisions are deleted on activation so a new deployment can never leave
        // somebody stranded on stale cached content.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: `${basePath}index.html`,
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
    // The content chunk is deliberately large: this is an offline-first study
    // app, so the service worker precaches all 50 lessons on first visit and
    // every later navigation is served from cache. The framework and app-shell
    // chunks stay small, so first paint does not wait on the content.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        /**
         * Split by change frequency so a content-only deployment does not
         * invalidate the framework chunk in every learner's cache (and vice
         * versa). The course content is by far the largest part of this app,
         * and it changes far more often than React does.
         */
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('highlight.js')) return 'vendor-highlight'
            if (
              id.includes('react-router') ||
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('scheduler')
            ) {
              return 'vendor-react'
            }
            return 'vendor'
          }
          if (id.includes('/src/content/')) return 'content-ckad'
          return undefined
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    alias: {
      // The generated service-worker registration module only exists during a
      // real build, so tests use a stub. The logic worth testing lives in
      // src/lib/sw-update.ts and is exercised directly.
      'virtual:pwa-register/react': new URL('./src/test/pwa-register-stub.ts', import.meta.url)
        .pathname,
    },
  },
}))
