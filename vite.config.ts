import { defineConfig, type Plugin } from 'vite';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

function staticMirror(): Plugin {
  return {
    name: 'portfolio-static-mirror',
    async transformIndexHtml(html) {
      const out = await build({
        entryPoints: [path.join(ROOT, 'src/data/content.ts')],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'neutral',
        logLevel: 'silent',
      });
      const code = out.outputFiles[0]!.text;
      const mod = (await import(
        `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
      )) as typeof import('./src/data/content');

      const { META, CONTACT, WORK, PROJECTS, ABOUT, SKILLS, EDUCATION } = mod;
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
        url: META.url,
        email: `mailto:${CONTACT.email}`,
        sameAs: [CONTACT.github, CONTACT.linkedin].filter(Boolean),
        knowsAbout: [...SKILLS.languages, ...SKILLS.frameworks],
      };

      return html
        .replace('<!--MIRROR-->', mirror)
        .replace(
          '<!--HEAD-->',
          `<title>${esc(META.siteTitle)}</title>
    <meta name="description" content="${esc(META.siteDescription)}" />
    <link rel="canonical" href="${esc(META.url)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(META.siteTitle)}" />
    <meta property="og:description" content="${esc(META.siteDescription)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
        );
    },
  };
}

export default defineConfig({
  plugins: [staticMirror()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0, // keep pixel art as real files so caching works
  },
  server: { host: true },
});
