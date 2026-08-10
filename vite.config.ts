import { defineConfig, type Plugin } from 'vite';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * Identifier appended to every asset URL, so each deploy is a distinct cache
 * key. Netlify exposes the commit it built; fall back to the build time when
 * running locally. See src/systems/assetUrl.ts for why this exists.
 */
const BUILD_ID =
  process.env.COMMIT_REF?.slice(0, 8) ||
  process.env.DEPLOY_ID ||
  (process.env.NODE_ENV === 'production' ? String(Date.now()) : 'dev');

/**
 * Absolute site URL. Netlify injects `URL` (the primary domain) and
 * `DEPLOY_PRIME_URL` (branch/preview deploys) automatically, so canonical tags,
 * Open Graph URLs and the sitemap are correct on every deploy without anyone
 * editing a constant. SITE_URL overrides both if you need to force one.
 */
function resolveSiteUrl(fallback: string): string {
  const raw =
    process.env.SITE_URL ||
    (process.env.CONTEXT === 'production' ? process.env.URL : process.env.DEPLOY_PRIME_URL) ||
    process.env.URL ||
    fallback;
  return raw.replace(/\/+$/, '');
}

/** Compile and evaluate src/data/content.ts once per build. */
let contentPromise: Promise<typeof import('./src/data/content')> | null = null;
function loadContent() {
  contentPromise ??= (async () => {
    const out = await build({
      entryPoints: [path.join(ROOT, 'src/data/content.ts')],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'neutral',
      logLevel: 'silent',
    });
    const code = out.outputFiles[0]!.text;
    return (await import(
      `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
    )) as typeof import('./src/data/content');
  })();
  return contentPromise;
}

function staticMirror(): Plugin {
  return {
    name: 'portfolio-static-mirror',

    // robots.txt and sitemap.xml are emitted rather than committed so they can
    // never point at a stale domain. Resolved independently of the HTML hook,
    // because plugin hook order between the two is not guaranteed.
    async generateBundle() {
      const { META } = await loadContent();
      const origin = resolveSiteUrl(META.url);
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          `  <url>\n    <loc>${origin}/</loc>\n` +
          `    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>\n` +
          `    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>\n` +
          `</urlset>\n`,
      });
    },

    async transformIndexHtml(html) {
      // In dev the module is re-evaluated on each request so content edits
      // show up without a restart.
      if (process.env.NODE_ENV !== 'production') contentPromise = null;
      const mod = await loadContent();

      const { META, CONTACT, WORK, PROJECTS, ABOUT, SKILLS, EDUCATION } = mod;
      const siteUrl = resolveSiteUrl(META.url);
      const esc = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      const mirror = `
<a href="#game-root" id="back-to-game" class="mirror-back">&larr; Back to the game</a>
<header>
  <h1>${esc(META.name)}</h1>
  <p class="role">${esc(META.role)} &middot; ${esc(META.location)}</p>
  <p class="tagline">${esc(META.tagline)}</p>
</header>

<section id="work" aria-labelledby="work-h">
  <h2 id="work-h">Work</h2>
  ${WORK.map(
    (r) => `<article>
    <h3>${esc(r.title)}, ${esc(r.company)}</h3>
    <p class="dates"><time>${esc(r.start)}</time> &ndash; <time>${esc(r.end)}</time>${
      r.location ? ` &middot; ${esc(r.location)}` : ''
    }</p>
    <ul>${r.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
    <p class="tech">${r.tech.map(esc).join(', ')}</p>
  </article>`
  ).join('')}
  <h3>Skills</h3>
  <ul>
    <li><strong>Languages:</strong> ${SKILLS.languages.map(esc).join(', ')}</li>
    <li><strong>Frameworks:</strong> ${SKILLS.frameworks.map(esc).join(', ')}</li>
    <li><strong>Tools:</strong> ${SKILLS.tools.map(esc).join(', ')}</li>
  </ul>
  <h3>Education</h3>
  ${EDUCATION.map(
    (d) => `<p>${esc(d.degree)}, ${esc(d.school)} <span class="dates">(${esc(d.years)}${
      d.location ? `, ${esc(d.location)}` : ''
    })</span></p>`
  ).join('')}
</section>

<section id="projects" aria-labelledby="projects-h">
  <h2 id="projects-h">Projects</h2>
  ${PROJECTS.map(
    (p) => `<article>
    <h3>${esc(p.name)} <span class="year">${esc(p.year)}</span></h3>
    <p>${esc(p.pitch)} ${esc(p.description)}</p>
    <p class="tech">${p.tech.map(esc).join(', ')}</p>
    <p class="links">${[
      p.repo ? `<a href="${esc(p.repo)}" rel="noopener">Repository</a>` : '',
      p.demo ? `<a href="${esc(p.demo)}" rel="noopener">Live demo</a>` : '',
    ]
      .filter(Boolean)
      .join(' &middot; ')}</p>
  </article>`
  ).join('')}
</section>

<section id="about" aria-labelledby="about-h">
  <h2 id="about-h">About</h2>
  <p>${ABOUT.intro.map(esc).join(' ')}</p>
  <p>${ABOUT.interests.map(esc).join(' ')}</p>
  <ul>${ABOUT.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
</section>

<section id="contact" aria-labelledby="contact-h">
  <h2 id="contact-h">Contact</h2>
  <ul>
    <li><a href="mailto:${esc(CONTACT.email)}">${esc(CONTACT.email)}</a></li>
    <li><a href="${esc(CONTACT.github)}" rel="noopener">GitHub</a></li>
    <li><a href="${esc(CONTACT.linkedin)}" rel="noopener">LinkedIn</a></li>
    <li><a href="${esc(CONTACT.resumeUrl)}">Resume (PDF)</a></li>
  </ul>
</section>

<footer>
  <p>Built with Phaser and TypeScript. All pixel art generated from code.</p>
</footer>`;

      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: META.name,
        jobTitle: META.role,
        description: META.siteDescription,
        url: siteUrl,
        email: `mailto:${CONTACT.email}`,
        sameAs: [CONTACT.github, CONTACT.linkedin].filter(Boolean),
        knowsAbout: [...SKILLS.languages, ...SKILLS.frameworks],
      };

      const ogImage = `${siteUrl}/og-image.png`;
      return html
        .replace('<!--MIRROR-->', mirror)
        .replace(
          '<!--HEAD-->',
          `<title>${esc(META.siteTitle)}</title>
    <meta name="description" content="${esc(META.siteDescription)}" />
    <link rel="canonical" href="${esc(siteUrl)}/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(META.name)}" />
    <meta property="og:url" content="${esc(siteUrl)}/" />
    <meta property="og:title" content="${esc(META.siteTitle)}" />
    <meta property="og:description" content="${esc(META.siteDescription)}" />
    <meta property="og:image" content="${esc(ogImage)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="A pixel-art town with buildings labelled ABOUT and PROJECTS" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(META.siteTitle)}" />
    <meta name="twitter:description" content="${esc(META.siteDescription)}" />
    <meta name="twitter:image" content="${esc(ogImage)}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
        );
    },
  };
}

export default defineConfig({
  plugins: [staticMirror()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0, // keep pixel art as real files so caching works
    // Hashed bundle output goes to /build, NOT /assets. public/assets/ is
    // copied to dist/assets/ verbatim, and mixing content-hashed files with
    // stable-named ones in a single directory makes it impossible to set a
    // correct Cache-Control rule for either.
    assetsDir: 'build',
  },
  server: { host: true },
});
