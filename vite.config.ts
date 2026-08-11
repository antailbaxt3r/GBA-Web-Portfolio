import { defineConfig, type Plugin } from 'vite';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';

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

/** Compile and evaluate a TypeScript data module so this config can read it. */
async function evalModule<T>(rel: string): Promise<T> {
  const out = await build({
    entryPoints: [path.join(ROOT, rel)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    logLevel: 'silent',
  });
  const code = out.outputFiles[0]!.text;
  return (await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  )) as T;
}

/** src/data/content.ts - the game's script. Also feeds the embedded mirror. */
let contentPromise: Promise<typeof import('./src/data/content')> | null = null;
function loadContent() {
  contentPromise ??= evalModule<typeof import('./src/data/content')>('src/data/content.ts');
  return contentPromise;
}

/** src/data/resume.ts - the resume. Feeds /minimal only; the game never sees it. */
let resumePromise: Promise<typeof import('./src/data/resume')> | null = null;
function loadResume() {
  resumePromise ??= evalModule<typeof import('./src/data/resume')>('src/data/resume.ts');
  return resumePromise;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type Content = typeof import('./src/data/content');
type Resume = typeof import('./src/data/resume');

/**
 * The portfolio as plain semantic HTML.
 *
 * One renderer feeds two surfaces: the crawlable mirror embedded in the game
 * page, and the standalone /minimal page recruiters are sent to. Writing the
 * markup twice would guarantee the two drift.
 */
function renderSections(mod: Content): string {
  const { META, CONTACT, WORK, PROJECTS, ABOUT, SKILLS, EDUCATION } = mod;

  const skill = (label: string, items: string[]) =>
    `<div class="skill"><dt>${esc(label)}</dt><dd>${items.map(esc).join(', ')}</dd></div>`;

  return `
<header class="intro">
  <h1>Hello! I'm Arjun.</h1>
  <p class="lede">${esc(META.role)} based in ${esc(META.location)}.</p>
  <p>${esc(META.tagline)}</p>
  <ul class="links">
    <li><a href="mailto:${esc(CONTACT.email)}">${esc(CONTACT.email)}</a></li>
    <li><a href="${esc(CONTACT.github)}" rel="noopener">GitHub</a></li>
    <li><a href="${esc(CONTACT.linkedin)}" rel="noopener">LinkedIn</a></li>
    <li><a href="${esc(CONTACT.resumeUrl)}">Resume (PDF)</a></li>
  </ul>
</header>

<section id="skills" aria-labelledby="skills-h">
  <h2 id="skills-h">Skills</h2>
  <dl>
    ${skill('Languages', SKILLS.languages)}
    ${skill('Frameworks', SKILLS.frameworks)}
    ${skill('Tools', SKILLS.tools)}
  </dl>
</section>

<section id="work" aria-labelledby="work-h">
  <h2 id="work-h">Work experience</h2>
  ${WORK.map(
    (r) => `<article>
    <h3>${esc(r.title)}</h3>
    <p class="meta">${esc(r.company)}${r.location ? ` &middot; ${esc(r.location)}` : ''} &middot; <time>${esc(
      r.start
    )}</time>&ndash;<time>${esc(r.end)}</time></p>
    <ul>${r.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
    <p class="tech">${r.tech.map(esc).join(' &middot; ')}</p>
  </article>`
  ).join('')}
</section>

<section id="projects" aria-labelledby="projects-h">
  <h2 id="projects-h">Projects</h2>
  ${PROJECTS.map(
    (p) => `<article>
    <h3>${esc(p.name)} <span class="year">${esc(p.year)}</span></h3>
    <p>${esc(p.pitch)} ${esc(p.description)}</p>
    <p class="tech">${p.tech.map(esc).join(' &middot; ')}</p>
    <p class="links">${[
      p.repo ? `<a href="${esc(p.repo)}" rel="noopener">Repository</a>` : '',
      p.demo ? `<a href="${esc(p.demo)}" rel="noopener">Live demo</a>` : '',
    ]
      .filter(Boolean)
      .join(' &middot; ')}</p>
  </article>`
  ).join('')}
</section>

<section id="education" aria-labelledby="education-h">
  <h2 id="education-h">Education</h2>
  ${EDUCATION.map(
    (d) => `<article>
    <h3>${esc(d.degree)}</h3>
    <p class="meta">${esc(d.school)} &middot; ${esc(d.years)}${
      d.location ? ` &middot; ${esc(d.location)}` : ''
    }</p>
  </article>`
  ).join('')}
</section>

<section id="about" aria-labelledby="about-h">
  <h2 id="about-h">About</h2>
  <p>${ABOUT.intro.map(esc).join(' ')}</p>
  <p>${ABOUT.interests.map(esc).join(' ')}</p>
</section>`;
}

// ---------------------------------------------------------------------------
// Font Awesome Free, inlined.
//
// The page's CSP is `default-src 'self'` with no CDN allowance, and pulling in
// the full webfont for a dozen glyphs would cost more than the rest of the
// page combined. Instead the individual SVGs are read out of the package at
// build time and emitted once each as <symbol>s, referenced by <use>.
//
// Icons are Font Awesome Free 7, CC BY 4.0. See CREDITS.md.
// ---------------------------------------------------------------------------
const FA_DIR = path.join(ROOT, 'node_modules/@fortawesome/fontawesome-free/svgs');
const iconCache = new Map<string, { viewBox: string; body: string }>();

/** @param ref "<style>/<name>", e.g. "brands/python". Throws if it is not there. */
function loadIcon(ref: string): { viewBox: string; body: string } {
  const hit = iconCache.get(ref);
  if (hit) return hit;
  const file = path.join(FA_DIR, `${ref}.svg`);
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    // Fail the build rather than ship an invisible icon.
    throw new Error(`Unknown Font Awesome icon "${ref}" - no such file ${file}`);
  }
  const parsed = {
    viewBox: /viewBox="([^"]+)"/.exec(raw)?.[1] ?? '0 0 512 512',
    body: raw
      .replace(/^[\s\S]*?<svg[^>]*>/, '')
      .replace(/<\/svg>\s*$/, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim(),
  };
  iconCache.set(ref, parsed);
  return parsed;
}

const symbolId = (ref: string) => `i-${ref.replace(/[^a-z0-9]+/gi, '-')}`;

/** An icon reference. Decorative, so hidden from assistive tech. */
const icon = (ref: string) =>
  `<svg class="ic" aria-hidden="true" focusable="false"><use href="#${symbolId(ref)}"></use></svg>`;

/** The one-time <symbol> definitions for every icon the page uses. */
function iconSprite(refs: string[]): string {
  const seen = [...new Set(refs)];
  const symbols = seen
    .map((ref) => {
      const { viewBox, body } = loadIcon(ref);
      return `<symbol id="${symbolId(ref)}" viewBox="${viewBox}">${body}</symbol>`;
    })
    .join('');
  return `<svg class="sprite" aria-hidden="true" focusable="false">${symbols}</svg>`;
}

/**
 * Bold the numbers a recruiter is scanning for - "12%", "800+", "sub-300ms",
 * "24/7" - and nothing else. Deliberately narrow: a looser pattern also hits
 * "GPT-4o", "Claude 3.5" and "ms-marco-MiniLM-L-6-v2", which are names, not
 * results. Runs after escaping, and neither digits nor % are affected by it.
 */
/**
 * Every link out of this page opens in a new tab, so a reader part-way through
 * the resume never loses their place. `noopener noreferrer` is not optional
 * with target=_blank: without it the opened page gets a handle on this one
 * through window.opener.
 */
const NEW_TAB = 'target="_blank" rel="noopener noreferrer"';

const METRIC = /(\bsub-\d+ms\b|\b24\/7\b|\b\d[\d.,]*\s?[%+](?!\w))/g;
const withMetrics = (s: string) => esc(s).replace(METRIC, '<b class="m">$1</b>');

/**
 * Styles for /minimal.
 *
 * Light, quiet, and fast, but not lifeless: colour-coded skill chips, role
 * cards with highlighted metrics, and a pixel avatar lifted straight from the
 * game's own favicon so the two versions of the site feel related.
 *
 * The Experience/Projects tabs are pure CSS - a pair of radio inputs and
 * sibling selectors. The CSP is `script-src 'self'` with no inline scripts,
 * and more to the point a resume has no business needing JavaScript to show
 * its own text. Radios also come with working arrow-key navigation for free,
 * and `@media print` reveals both panels so nothing is lost when this is saved
 * as a PDF.
 *
 * Motion is small, one-shot, and entirely disabled under prefers-reduced-motion.
 */
const MINIMAL_CSS = `
:root {
  color-scheme: light;
  --ink: #14171f;
  --muted: #59606e;
  --faint: #8b93a3;
  --rule: #e6e8ee;
  --accent: #2f5bd0;
  --accent-soft: #eef2fd;
  --bg: #ffffff;
  --card: #fbfcfe;
}
* { box-sizing: border-box; }
body {
  margin: 0 auto;
  padding: 2.5rem 1.25rem 3rem;
  max-width: 46rem;
  background: var(--bg);
  color: var(--ink);
  font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-text-size-adjust: 100%;
}
a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 2px; }
a:hover { color: var(--ink); }
.sr-only {
  position: absolute; width: 1px; height: 1px;
  margin: -1px; padding: 0; overflow: hidden;
  clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap;
}
.sprite { display: none; }
.ic { width: 1em; height: 1em; fill: currentColor; vertical-align: -.125em; flex: none; }

/* --- motion, used sparingly --- */
@keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes bob  { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
.rise { animation: rise .45s cubic-bezier(.2,.7,.3,1) both; }
.d1 { animation-delay: .05s; } .d2 { animation-delay: .12s; }
.d3 { animation-delay: .19s; } .d4 { animation-delay: .26s; }

/* --- header --- */
.head { display: flex; align-items: center; gap: 1rem; }
.avatar {
  image-rendering: pixelated;
  width: 64px; height: 64px; flex: none;
  border-radius: 10px; border: 1px solid var(--rule); background: var(--card);
  animation: bob 3.2s ease-in-out infinite;
}
h1 { font-size: 2.05rem; line-height: 1.15; margin: 0 0 .3rem; letter-spacing: -.025em; }
.role-line { font-size: 1.02rem; margin: 0; font-weight: 500; }
.role-line .where { color: var(--muted); font-weight: 400; }
.badges { list-style: none; display: flex; flex-wrap: wrap; gap: .4rem; padding: 0; margin: 1rem 0 0; }
.badges li {
  font-size: .8rem; font-weight: 500; padding: .25rem .6rem;
  border-radius: 999px; background: var(--accent-soft); color: var(--accent);
}
.blurb { color: var(--muted); margin: 1rem 0 0; max-width: 36rem; }
ul.links { list-style: none; padding: 0; margin: 1.25rem 0 0; display: flex; flex-wrap: wrap; gap: .5rem; }
ul.links a {
  display: inline-flex; align-items: center; gap: .45rem;
  padding: .4rem .8rem;
  border: 1px solid var(--rule); border-radius: 999px;
  font-size: .875rem; text-decoration: none; color: var(--ink);
  transition: border-color .15s, color .15s, transform .15s;
}
ul.links a .ic { color: var(--faint); transition: color .15s; }
ul.links a:hover { border-color: var(--accent); color: var(--accent); transform: translateY(-1px); }
ul.links a:hover .ic { color: var(--accent); }

/* --- sections --- */
h2 {
  font-size: .75rem; text-transform: uppercase; letter-spacing: .11em;
  color: var(--faint); margin: 2.75rem 0 1.1rem;
  padding-bottom: .5rem; border-bottom: 1px solid var(--rule);
}
h3 { font-size: 1rem; margin: 0 0 .1rem; }
p { margin: .35rem 0; }

/* --- skills: one hue per group, an icon per chip --- */
.skill-group { margin-bottom: 1.05rem; }
.skill-group .label {
  font-size: .8rem; font-weight: 600; margin: 0 0 .45rem;
  color: hsl(var(--h) 45% 38%);
}
.chips { list-style: none; display: flex; flex-wrap: wrap; gap: .35rem; padding: 0; margin: 0; }
.chips li {
  display: inline-flex; align-items: center; gap: .4rem;
  padding: .24rem .62rem; border-radius: 7px;
  background: hsl(var(--h) 88% 97%);
  border: 1px solid hsl(var(--h) 60% 90%);
  color: hsl(var(--h) 40% 34%);
  font-size: .8rem; white-space: nowrap;
  transition: transform .12s, border-color .12s;
}
.chips li:hover { transform: translateY(-2px); border-color: hsl(var(--h) 55% 72%); }
.chips .ic { opacity: .75; font-size: .95em; }

/* --- tabs: two radios and sibling selectors, no script --- */
.tabs { margin-top: 2.75rem; }
.tablist { display: flex; gap: .25rem; border-bottom: 1px solid var(--rule); margin-bottom: 1.4rem; }
.tablist label {
  position: relative; cursor: pointer; user-select: none;
  padding: .55rem .9rem; font-size: .9rem; font-weight: 600;
  color: var(--faint); transition: color .15s;
}
.tablist label:hover { color: var(--muted); }
.tablist label .n { font-weight: 400; opacity: .7; margin-left: .3rem; }
.tablist label::after {
  content: ""; position: absolute; left: .6rem; right: .6rem; bottom: -1px; height: 2px;
  background: var(--accent); border-radius: 2px;
  transform: scaleX(0); transform-origin: center;
  transition: transform .22s cubic-bezier(.2,.7,.3,1);
}
.panel { display: none; }
#v-exp:checked ~ .tablist label[for="v-exp"],
#v-proj:checked ~ .tablist label[for="v-proj"] { color: var(--ink); }
#v-exp:checked ~ .tablist label[for="v-exp"]::after,
#v-proj:checked ~ .tablist label[for="v-proj"]::after { transform: scaleX(1); }
#v-exp:checked ~ .p-exp,
#v-proj:checked ~ .p-proj { display: block; animation: rise .3s cubic-bezier(.2,.7,.3,1) both; }
#v-exp:focus-visible ~ .tablist label[for="v-exp"],
#v-proj:focus-visible ~ .tablist label[for="v-proj"] {
  outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 5px;
}

/* --- experience: one card per role --- */
.role {
  position: relative; margin-bottom: .8rem;
  padding: 1.05rem 1.15rem 1.1rem 1.35rem;
  border: 1px solid var(--rule); border-radius: 10px; background: var(--card);
  transition: border-color .15s, transform .15s;
}
.role::before {
  content: ""; position: absolute; left: 0; top: 14px; bottom: 14px;
  width: 3px; border-radius: 0 3px 3px 0; background: var(--accent); opacity: .85;
}
.role:hover { border-color: #ccd6ee; transform: translateY(-2px); }
.role-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: .5rem; }
.role-head h3 { margin: 0; }
.when {
  margin-left: auto; white-space: nowrap;
  font-size: .78rem; font-weight: 500;
  color: var(--accent); background: var(--accent-soft);
  padding: .18rem .6rem; border-radius: 999px;
}
.role .at { display: flex; align-items: center; gap: .45rem; margin: .3rem 0 0; font-size: .9rem; font-weight: 500; }
.role .at .ic { color: var(--faint); }
.role .spot { display: flex; align-items: center; gap: .45rem; margin: .2rem 0 0; font-size: .85rem; color: var(--muted); }
.role .spot .ic { color: var(--faint); }
.role ul { list-style: none; margin: .8rem 0 0; padding: 0; }
.role li { position: relative; padding-left: 1.1rem; margin: .4rem 0; }
.role li::before {
  content: ""; position: absolute; left: .15rem; top: .62em;
  width: 5px; height: 5px; border-radius: 1px;
  background: var(--accent); opacity: .55; transform: rotate(45deg);
}
b.m { color: var(--accent); font-weight: 700; }

/* --- projects --- */
.card {
  position: relative;
  border: 1px solid var(--rule); border-radius: 10px;
  padding: 1.05rem 1.15rem; margin-bottom: .8rem; background: var(--card);
  transition: border-color .15s, transform .15s;
}
.card:hover { border-color: #ccd6ee; transform: translateY(-2px); }
.card.is-link { cursor: pointer; }
/* Keyboard focus lands on the stretched link, so the ring goes on the card. */
.card:focus-within { border-color: var(--accent); outline: 2px solid var(--accent); outline-offset: 2px; }
.card-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: .5rem; }
.card-head h3 { margin: 0; }
.card-head .dates { margin-left: auto; color: var(--faint); font-size: .85rem; }
.card .sub { color: var(--muted); font-size: .9rem; margin: .1rem 0 0; }
.card ul { margin: .6rem 0 0; padding-left: 1.05rem; }
.card li { margin: .3rem 0; }
.card li::marker { color: var(--faint); }
.card .chips { margin-top: .7rem; --h: 220; }
/* An open-in-new-tab affordance in the card's bottom-right corner, revealed on
   hover. The row keeps its height whether or not the icon is showing, so
   nothing shifts underneath the pointer.
   Hover alone would strand two groups: keyboard users get it via :focus-within
   and :focus-visible, and devices with no hover at all get it permanently. */
.card-links { display: flex; justify-content: flex-end; gap: .35rem; margin: .85rem 0 0; min-height: 30px; }
.card-open {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 8px;
  color: var(--faint); text-decoration: none;
  opacity: 0;
  transition: opacity .15s, color .15s, background .15s;
}
/* The lift is on the icon, NOT on the anchor. A transform makes an element the
   containing block for its own absolutely positioned ::after, which would size
   the stretch overlay below to the 30px icon instead of the whole card. */
.card-open .ic { transform: translateY(2px); transition: transform .15s; }
.card:hover .card-open, .card:focus-within .card-open { opacity: 1; }
.card:hover .card-open .ic, .card:focus-within .card-open .ic { transform: none; }
/* The whole card is the click target: this overlay fills it, sitting above the
   card's own content but below the icons themselves. The cost is that text
   inside the card can no longer be selected by dragging - the overlay swallows
   the gesture. */
.card-open.stretch::after { content: ""; position: absolute; inset: 0; z-index: 1; }
.card-open.above { position: relative; z-index: 2; }
.card-open:hover { color: var(--accent); background: var(--accent-soft); }
.card-open:focus-visible {
  opacity: 1;
  outline: 2px solid var(--accent); outline-offset: 2px;
}
.card-open:focus-visible .ic { transform: none; }
@media (hover: none) { .card-open { opacity: 1; } .card-open .ic { transform: none; } }

/* --- education --- */
.edu { margin-bottom: 1rem; }
.edu h3 { margin: 0; }
.edu .meta { color: var(--muted); font-size: .875rem; margin: .1rem 0 0; }

/* --- the one way back to the game, at the foot of the page --- */
footer { margin-top: 3.5rem; padding-top: 1.5rem; border-top: 1px solid var(--rule); text-align: center; }
.switch a {
  display: inline-flex; align-items: center; gap: .55rem;
  padding: .7rem 1.15rem;
  background: var(--accent-soft); color: var(--accent);
  border: 1px solid #d7e0f8; border-radius: 10px;
  text-decoration: none; font-size: .95rem; font-weight: 600;
  transition: border-color .15s, background .15s, transform .15s;
}
.switch a:hover { border-color: var(--accent); background: #e6edfc; transform: translateY(-2px); }
.switch .pix { image-rendering: pixelated; }
footer .note { color: var(--faint); font-size: .85rem; margin: .9rem 0 0; }

@media (max-width: 34rem) {
  body { padding-top: 1.5rem; }
  h1 { font-size: 1.7rem; }
  .head { gap: .8rem; }
  .avatar { width: 48px; height: 48px; }
  .card-head .dates, .when { margin-left: 0; width: 100%; }
  .when { width: auto; }
  .tablist label { padding: .55rem .6rem; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::after { animation: none !important; transition: none !important; }
}
@media print {
  footer, .tablist, .card-links { display: none; }
  .panel { display: block !important; }
  body { max-width: none; padding: 0; font-size: 11pt; }
  .avatar { display: none; }
  h2 { margin-top: 1.4rem; }
  .card, .role { break-inside: avoid; background: none; }
  a { color: inherit; text-decoration: none; }
}
`;

/**
 * The standalone /minimal page: no JavaScript, no game bundle. The game page
 * ships 1.7 MB of Phaser, which is the wrong thing to hand someone who only
 * wants to read a CV.
 *
 * Content comes from src/data/resume.ts, NOT content.ts - the game's script is
 * written to fit a dialogue box and is not what belongs on a resume.
 *
 * The route is also declared in src/data/routes.ts, which is what the game's
 * menus link to.
 */
function renderMinimalPage(mod: Content, resume: Resume, siteUrl: string): string {
  const { META, CONTACT } = mod;
  const {
    HEADLINE, EXPERIENCE, RESUME_PROJECTS, RESUME_SKILLS, RESUME_EDUCATION,
    SKILL_ICONS, LINK_ICONS,
  } = resume;

  // Collected as the page is built, so the sprite carries exactly what is used.
  const used: string[] = ['solid/briefcase', 'solid/location-dot'];
  const use = (ref: string) => {
    used.push(ref);
    return icon(ref);
  };

  const skillIcon = (item: string, fallback: string) => SKILL_ICONS[item] ?? fallback;

  /** Project tech chips carry no icons - only the Skills section does. */
  const plainChips = (items: string[]) =>
    `<ul class="chips">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;

  // Email is the exception: a mailto hands off to the mail client, and
  // target=_blank leaves a stranded blank tab behind when it does.
  const links: { label: string; href: string; sameTab?: true }[] = [
    { label: 'Email', href: `mailto:${CONTACT.email}`, sameTab: true },
    { label: 'GitHub', href: CONTACT.github },
    { label: 'LinkedIn', href: CONTACT.linkedin },
    { label: 'Resume', href: CONTACT.resumeUrl },
  ];

  const experience = EXPERIENCE.map(
    (r) => `<article class="role">
    <div class="role-head">
      <h3>${esc(r.title)}</h3>
      <span class="when">${esc(r.dates)}</span>
    </div>
    <p class="at">${use('solid/briefcase')}${esc(r.company)}</p>
    ${r.location ? `<p class="spot">${use('solid/location-dot')}${esc(r.location)}</p>` : ''}
    <ul>${r.bullets.map((b) => `<li>${withMetrics(b)}</li>`).join('')}</ul>
  </article>`
  ).join('');

  /**
   * Card actions. The first one stretches: its ::after covers the whole card,
   * so a click anywhere on the card follows it. Any second link is lifted
   * above that overlay so it stays separately clickable.
   */
  const cardActions = (p: Resume['RESUME_PROJECTS'][number]) => {
    const parts: string[] = [];
    if (p.repo) {
      parts.push(
        `<a href="${esc(p.repo)}" ${NEW_TAB} title="Open the ${esc(
          p.name
        )} repository in a new tab" aria-label="Open the ${esc(
          p.name
        )} repository in a new tab">${use('solid/arrow-up-right-from-square')}</a>`
      );
    }
    if (p.demo) {
      parts.push(
        `<a href="${esc(p.demo)}" ${NEW_TAB} title="Open ${esc(
          p.name
        )} in a new tab" aria-label="Open ${esc(p.name)} in a new tab">${use(
          'solid/gamepad'
        )}</a>`
      );
    }
    return parts
      .map((a, i) =>
        a.replace('<a ', `<a class="card-open ${i === 0 ? 'stretch' : 'above'}" `)
      )
      .join('');
  };

  const projects = RESUME_PROJECTS.map(
    (p) => `<article class="card${p.repo || p.demo ? ' is-link' : ''}">
    <div class="card-head">
      <h3>${esc(p.name)}</h3>
      <span class="dates">${esc(p.dates)}</span>
    </div>
    <p class="sub">${esc(p.blurb)}</p>
    <ul>${p.bullets.map((b) => `<li>${withMetrics(b)}</li>`).join('')}</ul>
    ${plainChips(p.tech)}
    <p class="card-links">${cardActions(p)}</p>
  </article>`
  ).join('');

  const body = `
<header class="head rise">
  <img class="avatar" src="/favicon-32.png" alt="" width="64" height="64" />
  <div>
    <h1>${esc(HEADLINE.greeting)}</h1>
    <p class="role-line">${esc(HEADLINE.role)} <span class="where">&middot; ${esc(
      HEADLINE.location
    )}</span></p>
  </div>
</header>
<ul class="badges rise d1">${HEADLINE.badges.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
<p class="blurb rise d2">${esc(HEADLINE.blurb)}</p>
<ul class="links rise d2">
  ${links
    .map(
      (l) =>
        `<li><a href="${esc(l.href)}"${l.sameTab ? '' : ` ${NEW_TAB}`}>${use(
          LINK_ICONS[l.label] ?? 'solid/code'
        )}${esc(l.label)}</a></li>`
    )
    .join('')}
</ul>

<section id="skills" class="rise d3" aria-labelledby="skills-h">
  <h2 id="skills-h">Skills</h2>
  ${RESUME_SKILLS.map(
    (g) => `<div class="skill-group" style="--h: ${g.hue}">
    <p class="label">${esc(g.label)}</p>
    <ul class="chips">${g.items
      .map((t) => `<li>${use(skillIcon(t, g.icon))}${esc(t)}</li>`)
      .join('')}</ul>
  </div>`
  ).join('')}
</section>

<section class="tabs rise d4" aria-label="Experience and projects">
  <input class="sr-only" type="radio" name="view" id="v-exp" checked />
  <input class="sr-only" type="radio" name="view" id="v-proj" />
  <div class="tablist">
    <label for="v-exp">Experience<span class="n">${EXPERIENCE.length}</span></label>
    <label for="v-proj">Projects<span class="n">${RESUME_PROJECTS.length}</span></label>
  </div>
  <div class="panel p-exp">${experience}</div>
  <div class="panel p-proj">${projects}</div>
</section>

<section id="education" aria-labelledby="education-h">
  <h2 id="education-h">Education</h2>
  ${RESUME_EDUCATION.map(
    (d) => `<div class="edu">
    <h3>${esc(d.school)}</h3>
    <p class="meta">${esc(d.degree)} &middot; ${esc(d.dates)}${
      d.location ? ` &middot; ${esc(d.location)}` : ''
    }</p>
  </div>`
  ).join('')}
</section>`;

  const footer = `<footer>
  <p class="switch"><a href="/"><img class="pix" src="/favicon-16.png" alt="" width="18" height="18" /> Switch to the game version</a></p>
  <p class="note">Same portfolio, as a Game Boy game you can walk around.</p>
</footer>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(META.name)} - ${esc(HEADLINE.role)}</title>
<meta name="description" content="${esc(HEADLINE.role)} based in ${esc(
    HEADLINE.location
  )}. ${esc(HEADLINE.blurb)}" />
<link rel="canonical" href="${esc(siteUrl)}/minimal/" />
<meta name="robots" content="index,follow" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<style>${MINIMAL_CSS}</style>
</head>
<body>
${iconSprite(used)}
<main>${body}</main>
${footer}
</body>
</html>
`;
}

function staticMirror(): Plugin {
  return {
    name: 'portfolio-static-mirror',

    // /minimal is emitted at build time, so the dev server knows nothing about
    // it and Vite's SPA fallback would hand back the game page instead — which
    // looks like it works, because the crawlable mirror inside it renders the
    // same headings. Serve the real page here so dev matches production.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (url !== '/minimal' && url !== '/minimal/') return next();
        if (url === '/minimal') {
          res.statusCode = 301;
          res.setHeader('Location', '/minimal/');
          return res.end();
        }
        // Pick up edits to either data file without restarting the server.
        contentPromise = null;
        resumePromise = null;
        void Promise.all([loadContent(), loadResume()]).then(([mod, resume]) => {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(renderMinimalPage(mod, resume, resolveSiteUrl(mod.META.url)));
        });
      });
    },

    // robots.txt and sitemap.xml are emitted rather than committed so they can
    // never point at a stale domain. Resolved independently of the HTML hook,
    // because plugin hook order between the two is not guaranteed.
    async generateBundle() {
      const [mod, resume] = await Promise.all([loadContent(), loadResume()]);
      const origin = resolveSiteUrl(mod.META.url);
      const today = new Date().toISOString().slice(0, 10);

      this.emitFile({
        type: 'asset',
        fileName: 'minimal/index.html',
        source: renderMinimalPage(mod, resume, origin),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
      });
      const url = (loc: string, priority: string) =>
        `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n` +
        `    <changefreq>monthly</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          url(`${origin}/`, '1.0') +
          url(`${origin}/minimal/`, '0.8') +
          `</urlset>\n`,
      });
    },

    async transformIndexHtml(html) {
      // In dev the module is re-evaluated on each request so content edits
      // show up without a restart.
      if (process.env.NODE_ENV !== 'production') contentPromise = null;
      const mod = await loadContent();

      const { META, CONTACT, SKILLS } = mod;
      const siteUrl = resolveSiteUrl(META.url);

      // Same markup as /minimal, embedded so the game URL is crawlable and
      // readable without JavaScript. The link to /minimal is what search
      // engines follow to the standalone page.
      const mirror =
        `<a href="#game-root" id="back-to-game" class="mirror-back">&larr; Back to the game</a>\n` +
        `<p class="mirror-switch"><a href="/minimal/">View the plain, minimal version</a></p>` +
        renderSections(mod) +
        `\n<footer>\n  <p>Built with Phaser and TypeScript. All pixel art generated from code.</p>\n</footer>`;

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
