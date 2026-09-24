import { defineConfig } from 'vite'

// Match asset paths to the deployment URL, including subdirectory hosting.
const siteUrl = process.env.SITE_URL ? new URL(process.env.SITE_URL) : null

export default defineConfig({
  base: siteUrl ? (siteUrl.pathname.endsWith('/') ? siteUrl.pathname : `${siteUrl.pathname}/`) : './',
})
