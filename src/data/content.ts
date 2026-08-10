/**
 * EVERY piece of user-facing prose in the site lives in this file.
 *
 * Rules (enforced by tools/validate-content.mjs at build time):
 *  - ASCII only, plus the glyphs listed in src/data/glyphs.json.
 *    No em-dashes, no curly quotes, no accented characters.
 *  - Aim for <= 58 characters per page. Longer strings paginate
 *    automatically, but writing to the constraint reads far better.
 *  - Proper nouns in CAPS. That is the strongest FireRed tonal tell.
 *
 */

export interface Choice {
  label: string;
  action:
    | { type: 'url'; href: string }
    | { type: 'copy'; value: string }
    | { type: 'close' };
}

export interface ContentNode {
  id: string;
  title?: string;
  pages: string[];
  choices?: Choice[];
  /** Shown instead of `pages` the first time this node is read. */
  firstTimeOnly?: string[];
}

export interface WorkRole {
  company: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  bullets: string[];
  tech: string[];
}

export interface Project {
  name: string;
  pitch: string;
  description: string;
  tech: string[];
  year: string;
  repo?: string;
  demo?: string;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const META = {
  name: 'ARJUN BAJPAI',
  role: 'Software Engineer',
  location: 'New York',
  tagline: 'I build software that is fun AND useful.',
  siteTitle: 'Arjun Bajpai - Portfolio',
  siteDescription:
    'The portfolio of Arjun Bajpai, software engineer, built as an explorable pixel-art town.',
  url: 'https://arjunbajpaicodes.netlify.app',
};

export const CONTACT = {
  email: 'arjunbajpaiwork@gmail.com',
  github: 'https://github.com/antailbaxt3r/',
  linkedin: 'https://linkedin.com/in/arjun-bajpai/',
  resumeUrl: '/resume.pdf', 
};

// ---------------------------------------------------------------------------
// Work  (the Battle Hall — one trainer per role)
// ---------------------------------------------------------------------------

export const WORK: WorkRole[] = [
  {
    company: 'New York University IT Department',
    title: 'AI Full-Stack Engineer',
    start: '2026',
    end: 'Present',
    location: 'New York, NY',
    bullets: [
      'Created new features for Pilot GenAI project.',
      'Developed a new API for handling latex outputs of LLM models.',
    ],
    tech: ['LangChain', 'RAG', 'Python', 'Vite+TS'],
  },
  {
    company: 'Microsoft',
    title: 'Software Engineer',
    start: '2022',
    end: '2025',
    location: 'Hyderabad, India',
    bullets: [
      'Shipped backup and restore orchestration features for Azure BCDR services.',
      'Devised a secondary job-validation pipeline to eliminate false restore failures.',
    ],
    tech: ['.NET Framework', 'C#', 'Azure'],
  },
  {
    company: 'Microsoft',
    title: 'Software Engineer Intern',
    start: '2022',
    end: '2021',
    location: 'Hyderabad, India',
    bullets: [
      'Implemented Partial Restore capability for Azure Backup,.',
      'Designed parallelized Full Sync infrastructure to optimize backup stage execution.',
    ],
    tech: ['.NET Framework', 'C#', 'Azure'],
  },
];

export const SKILLS = {
  languages: ['C#', 'Python', 'Java', 'TypeScript', 'JavaScript', 'SQL'],
  frameworks: ['.NET', 'Node.js', 'React', 'Asynchronous Programming', 'API Design'],
  tools: ['PyTorch', 'GraphRAG', 'Numpy', 'Pandas', 'OpenCV', 'Scikit-learn', 'Matplotlib', 'CNN', 'RNN', 'ResNets'],
};

export interface Degree {
  school: string;
  degree: string;
  years: string;
  location?: string;
}

/** One certificate hangs in the Battle Hall for each entry here. */
export const EDUCATION: Degree[] = [
  {
    school: 'New York University', 
    degree: 'M.S. Computer Science',
    years: '2025 - 2027',
    location: 'New York, NY',
  },
  {
    school: 'BITS Pilani',
    degree: 'B.E. Computer Science',
    years: '2018 - 2022',
    location: 'India',
  },
];

// ---------------------------------------------------------------------------
// Projects  (the Research Lab — one PC terminal per project)
// ---------------------------------------------------------------------------

export const PROJECTS: Project[] = [
  {
    name: 'Web Portfolio',
    pitch: 'This website.',
    description: 'A GBA overworld you walk around. All art made from code.',
    tech: ['Phaser 4', 'TypeScript', 'Vite'],
    year: '2026',
    repo: 'https://github.com/antailbaxt3r/GBA-Web-Portfolio',
  },
  {
    name: 'ERICA AI',
    pitch: 'A local AI course tutor.',
    description:
      'Builds a knowledge graph from PDFs, videos and web pages, then answers with cited, scaffolded explanations. Runs fully offline.',
    tech: ['Python', 'Neo4j', 'MongoDB', 'Ollama', 'Docker'],
    year: '2026',
    repo: 'https://github.com/antailbaxt3r/EricaAI',
  },
  {
    name: 'CONTEXTLY',
    pitch: 'Ask your own documents questions.',
    description:
      'A local RAG pipeline: upload a PDF, get answers grounded in the exact passages they came from. No API keys needed.',
    tech: ['Next.js', 'FastAPI', 'pgvector', 'Celery', 'Ollama'],
    year: '2026',
    repo: 'https://github.com/antailbaxt3r/contextly',
  },
  {
    name: 'POST GENERATOR',
    pitch: 'AI writing tool for LINKEDIN.',
    description:
      'Drafts posts with GEMINI or OPENAI, suggests articles for inspiration, and tracks how each post performed.',
    tech: ['React', 'Express', 'Drizzle', 'Postgres', 'Gemini'],
    year: '2025',
    repo: 'https://github.com/antailbaxt3r/linkedin-post-generator',
  },
];

// ---------------------------------------------------------------------------
// About  (the House)
// ---------------------------------------------------------------------------

export const ABOUT = {
  intro: [
    'I am ARJUN. I build software that is fun AND useful.',
    'I like music, games, and bears.',
  ],
  interests: [
    'Lately I have been working on generative AI',
    'and how transformer models can be used',
    'efficiently and effectively.',
  ],
  facts: [
    'I love bears, they are the cutest.',
    'I make my own music and DJ as well.',
  ],
};

// ---------------------------------------------------------------------------
// Dialogue nodes
// ---------------------------------------------------------------------------

const nodes: ContentNode[] = [
  {
    id: 'town.sign',
    title: 'TOWN SIGN',
    pages: [
      'WELCOME TO PORTFOLIO TOWN!',
      'Tap or click anywhere to walk there.',
      'Tap a thing to read it. ARROWS and Z work too.',
      'Four buildings. Four sections. Go look.',
    ],
  },
  {
    id: 'town.professor',
    title: 'GUIDE',
    firstTimeOnly: [
      'Oh! A visitor. ARJUN built this whole town.',
      'Each building holds a part of his portfolio.',
      'Come back when you have seen all four.',
    ],
    pages: ['Still exploring? There are four buildings.'],
  },
  {
    id: 'town.professor.complete',
    title: 'GUIDE',
    pages: [
      'You have seen all four buildings!',
      'That is the whole portfolio. Thank you for actually playing it!',
    ],
    choices: [
      { label: 'RESUME (PDF)', action: { type: 'url', href: CONTACT.resumeUrl } },
      { label: 'EMAIL ARJUN', action: { type: 'url', href: `mailto:${CONTACT.email}` } },
      { label: 'DONE', action: { type: 'close' } },
    ],
  },
  {
    id: 'town.villager.a',
    pages: ['The blue building is the LAB. ARJUN keeps', 'his projects on the machines in there.'],
  },
  {
    id: 'town.villager.b',
    pages: ['Careful in the tall grass.', 'Nothing happens. It just looks nice.'],
  },
  {
    id: 'work.intro',
    title: 'BATTLE HALL',
    pages: ['Each trainer here is a job ARJUN has held.', 'Talk to them in order to hear the story.'],
  },
  {
    id: 'work.skills',
    title: 'TROPHY CASE',
    pages: [
      `LANGUAGES: ${SKILLS.languages.join(', ')}`,
      `FRAMEWORKS: ${SKILLS.frameworks.join(', ')}`,
      `TOOLS: ${SKILLS.tools.join(', ')}`,
    ],
  },
  // One node per degree; see the EDUCATION loop below.
  {
    id: 'projects.intro',
    title: 'RESEARCH LAB',
    pages: [
      'Welcome to the LAB. Every machine here',
      'runs one of the projects ARJUN has built.',
      'Tap a PC to read about it.',
    ],
  },
  {
    id: 'about.photo',
    title: 'PHOTO',
    pages: ABOUT.intro,
  },
  {
    id: 'about.arjun',
    title: 'Hello!',
    pages: ABOUT.intro,
  },
  {
    id: 'about.bookshelf',
    title: 'BOOKSHELF',
    pages: ABOUT.interests,
  },
  {
    id: 'about.bed',
    pages: ['You feel well rested.', 'Nothing was restored. You had full HP.'],
  },
  {
    id: 'about.trainercard',
    title: 'TRAINER CARD',
    pages: [
      `NAME: ${META.name}`,
      `ROLE: ${META.role}`,
      `BASED IN: ${META.location}`,
      `TOP SKILLS: ${SKILLS.languages.slice(0, 3).join(', ')}`,
    ],
    choices: [
      { label: 'RESUME (PDF)', action: { type: 'url', href: CONTACT.resumeUrl } },
      { label: 'BACK', action: { type: 'close' } },
    ],
  },
  {
    id: 'about.plant',
    pages: ['A healthy houseplant. Watered on schedule,', 'unlike most side projects.'],
  },
  {
    id: 'contact.mailbox',
    title: 'MAILBOX',
    pages: [`EMAIL: ${CONTACT.email}`, 'Copy it, or talk to the clerk at the counter.'],
    choices: [
      { label: 'COPY EMAIL', action: { type: 'copy', value: CONTACT.email } },
      { label: 'BACK', action: { type: 'close' } },
    ],
  },
  {
    id: 'contact.clerk',
    title: 'CLERK',
    pages: ['Welcome! Which channel would you like?'],
    choices: [
      { label: 'EMAIL', action: { type: 'url', href: `mailto:${CONTACT.email}` } },
      { label: 'GITHUB', action: { type: 'url', href: CONTACT.github } },
      { label: 'LINKEDIN', action: { type: 'url', href: CONTACT.linkedin } },
      { label: 'RESUME (PDF)', action: { type: 'url', href: CONTACT.resumeUrl } },
      { label: 'CANCEL', action: { type: 'close' } },
    ],
  },
  {
    id: 'contact.shelf',
    pages: ['Shelves of neatly stacked business cards.', 'Take one. They are free.'],
  },
];

// TV cycles a different fact each time you press A on it.
ABOUT.facts.forEach((fact, i) => {
  nodes.push({ id: `about.tv.${i}`, title: 'TV', pages: [fact] });
});

// One certificate on the Battle Hall wall per degree.
EDUCATION.forEach((d, i) => {
  nodes.push({
    id: `work.education.${i}`,
    title: 'CERTIFICATE',
    pages: [d.degree, d.school, `${d.years}${d.location ? `, ${d.location}` : ''}`],
  });
});

// One node per work role, rendered onto the Battle Hall trainers.
WORK.forEach((role, i) => {
  nodes.push({
    id: `work.role.${i}`,
    title: role.company,
    pages: [
      `${role.title}`,
      `${role.location}, ${role.start} - ${role.end}`,
      ...role.bullets,
      `STACK: ${role.tech.join(', ')}`,
    ],
  });
});

// One node per project, rendered onto the Lab's PC terminals.
PROJECTS.forEach((p, i) => {
  const choices: Choice[] = [];
  if (p.repo) choices.push({ label: 'VIEW REPO', action: { type: 'url', href: p.repo } });
  if (p.demo) choices.push({ label: 'LIVE DEMO', action: { type: 'url', href: p.demo } });
  choices.push({ label: 'BACK', action: { type: 'close' } });
  nodes.push({
    id: `projects.item.${i}`,
    title: p.name,
    pages: [p.pitch, p.description, `STACK: ${p.tech.join(', ')}`, `YEAR: ${p.year}`],
    choices,
  });
});

export const CONTENT: Record<string, ContentNode> = Object.fromEntries(
  nodes.map((n) => [n.id, n])
);

/** Trainer card shown on the desk PC in the House. */
export const TRAINER_CARD = {
  name: META.name,
  role: META.role,
  location: META.location,
  since: WORK[WORK.length - 1]?.start ?? '2021',
  sections: 4,
  top: SKILLS.languages.slice(0, 4),
};
