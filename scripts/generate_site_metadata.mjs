import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const dist = join(import.meta.dirname, '..', 'dist')
const rawSiteUrl = process.env.SITE_URL?.trim()

if (!rawSiteUrl) {
  // A fork without a configured domain must not advertise the upstream site.
  await rm(join(dist, 'sitemap.xml'), { force: true })
  console.log('SITE_URL unset: no canonical URL or sitemap was generated.')
  process.exit(0)
}

let siteUrl
try {
  siteUrl = new URL(rawSiteUrl)
} catch {
  throw new Error('SITE_URL must be an absolute http(s) URL, for example https://example.com/')
}

if (!['http:', 'https:'].includes(siteUrl.protocol) || !siteUrl.hostname || siteUrl.username || siteUrl.password || siteUrl.search || siteUrl.hash) {
  throw new Error('SITE_URL must be an absolute http(s) URL without credentials, query, or fragment')
}
if (!siteUrl.pathname.endsWith('/')) siteUrl.pathname += '/'

const pageUrl = siteUrl.href
const sitemapUrl = new URL('sitemap.xml', pageUrl).href
const escapeMarkup = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char])

const indexPath = join(dist, 'index.html')
const index = await readFile(indexPath, 'utf8')
if (!index.includes('</head>')) throw new Error('Built index.html has no closing head tag')
const tags = `<link rel="canonical" href="${escapeMarkup(pageUrl)}"/><meta property="og:url" content="${escapeMarkup(pageUrl)}"/>`
await writeFile(indexPath, index.replace('</head>', `${tags}</head>`))

await writeFile(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${escapeMarkup(pageUrl)}</loc></url>\n</urlset>\n`)
const rootDeployment = siteUrl.pathname === '/'
await writeFile(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n${rootDeployment ? `\nSitemap: ${sitemapUrl}\n` : ''}`)
console.log(`Generated canonical URL and sitemap for ${pageUrl}`)
if (!rootDeployment) console.log('Subdirectory deployment: submit sitemap.xml directly; robots.txt is only read from the domain root.')
