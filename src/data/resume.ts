/**
 * The resume, verbatim, for the /minimal page only.
 *
 * Deliberately separate from content.ts. That file is the game's script: its
 * prose is written to fit a 58-character dialogue box, is validated against
 * the bitmap font, and drives the map objects. Resume bullets are none of
 * those things, and pushing them through the game would wreck its pacing.
 *
 * NOTHING under src/scenes or src/ui may import this. It is read at build time
 * by vite.config.ts and rendered to static HTML; the game never sees it.
 *
 * META and CONTACT are reused from content.ts so the email, links and name
 * cannot disagree between the two surfaces.
 */

export interface ResumeRole {
  company: string;
  title: string;
  dates: string;
  location?: string;
  bullets: string[];
}

export interface ResumeProject {
  name: string;
  blurb: string;
  dates: string;
  tech: string[];
  bullets: string[];
  repo?: string;
  demo?: string;
}

export interface ResumeDegree {
  school: string;
  degree: string;
  dates: string;
  location?: string;
}

/**
 * A Font Awesome Free icon, as "<style>/<name>" - e.g. "brands/python".
 * Resolved at build time against node_modules/@fortawesome/fontawesome-free,
 * which fails the build if the name does not exist.
 */
export type IconRef = string;

export interface SkillGroup {
  label: string;
  /** Hue for this group's chips, 0-360. Only used by the /minimal page. */
  hue: number;
  /** Icon for any item without its own entry in SKILL_ICONS below. */
  icon: IconRef;
  items: string[];
}

/**
 * Per-skill icon overrides. Anything absent falls back to its group's icon,
 * so this only lists the ones with a recognisable brand mark.
 */
export const SKILL_ICONS: Record<string, IconRef> = {
  Python: 'brands/python',
  Java: 'brands/java',
  JavaScript: 'brands/js',
  TypeScript: 'brands/js',
  SQL: 'solid/database',
  React: 'brands/react',
  'Next.js': 'brands/react',
  'Node.js': 'brands/node-js',
  Docker: 'brands/docker',
  Kubernetes: 'solid/dharmachakra',
  Git: 'brands/git-alt',
  Linux: 'brands/linux',
  'Microsoft Azure': 'brands/microsoft',
  'Azure Blob Storage': 'brands/microsoft',
  'SQL Server': 'brands/microsoft',
  '.NET': 'brands/microsoft',
  'CI/CD': 'solid/code-branch',
  'Agile/Scrum': 'solid/users',
};

export const HEADLINE = {
  greeting: "Hello! I'm Arjun.",
  role: 'Software Engineer & AI Developer',
  location: 'New York, NY',
  /** Short credibility pills, shown under the role. */
  badges: ['AI Engineer @ NYU', 'M.S. CS @ NYU', 'Ex-Microsoft'],
  blurb:
    'I spent three years at Microsoft keeping Azure backup and restore dependable for ' +
    'enterprise workloads, and now build retrieval-augmented AI systems at NYU while ' +
    'finishing my Masters. I like infrastructure that is fast, fun to operate, and ' +
    'occasionally shaped like a Game Boy game.',
};

/** Icons for the contact pills in the intro. */
export const LINK_ICONS: Record<string, IconRef> = {
  Email: 'solid/envelope',
  GitHub: 'brands/github',
  LinkedIn: 'brands/linkedin',
  'Resume': 'solid/file-pdf',
};

export const EXPERIENCE: ResumeRole[] = [
  {
    company: 'New York University, AI Centre of Excellence',
    title: 'AI Fullstack Developer',
    dates: 'Jun 2026 - Present',
    location: 'New York, NY',
    bullets: [
      'Deployed retrieval-augmented generation (RAG) systems for the Pilot GenAI initiative using LangChain and pgvector, lifting retrieval precision by 12% across enterprise knowledge bases.',
      'Integrated fine-tuned LLMs (GPT-4o, Claude 3.5, Llama 3) into core SaaS applications through FastAPI and Node.js services, sustaining sub-300ms initial response latency for teams across multiple university departments.',
      'Implemented semantic caching in Redis for recurrent prompt queries, trimming API token spend and improving response latency by 60%.',
    ],
  },
  {
    company: 'Microsoft',
    title: 'Software Engineer',
    dates: 'Jul 2022 - Jul 2025',
    location: 'Hyderabad, India',
    bullets: [
      'Shipped backup and restore orchestration features for Azure BCDR services, protecting SQL and SAP workloads on Azure VMs across large-scale production environments.',
      'Devised a secondary job-validation pipeline that eliminated false restore failures, raising restore SLA compliance to 99.8% and preventing inconsistent state propagation across distributed backup services.',
      'Engineered an automated machine learning remediation agent that resolved 800+ security vulnerabilities across 120+ repositories, reducing manual triage effort by 95% and strengthening compliance readiness.',
      'Led high-availability backup support for SAP ASE, giving enterprise customers 24/7 resilient recovery, and migrated 80+ deprecated BCDR pipelines onto modernized infrastructure aligned with secure SDLC standards.',
      'Directed recovery during a ransomware incident affecting 80+ customer VMs, designing retention-bypass workflows and sequencing restores to achieve full workload recovery within strict operational timelines.',
    ],
  },
  {
    company: 'Microsoft',
    title: 'Software Engineer Intern',
    dates: 'Jun 2021 - Sep 2021, Jan 2022 - Jun 2022',
    location: 'Hyderabad, India',
    bullets: [
      'Delivered Partial Restore for Azure Backup, shortening incremental restore duration by 40%, and parallelized Full Sync execution to lower microservice load and operational cost by 25%.',
    ],
  },
];

export const RESUME_PROJECTS: ResumeProject[] = [
  {
    name: 'Contextly',
    blurb: 'Local RAG Application',
    dates: 'Apr 2026',
    tech: ['Next.js', 'TypeScript', 'FastAPI', 'PostgreSQL', 'pgvector', 'Celery'],
    bullets: [
      'A document-grounded question answering application that parses PDF and text files and returns answers with citations pointing to exact source passages, with the full RAG pipeline running locally.',
      'Application is backed by Redis and MinIO S3-compatible object storage, with nomic-embed-text embeddings and an ms-marco-MiniLM-L-6-v2 cross-encoder reranker.',
    ],
    repo: 'https://github.com/antailbaxt3r/contextly',
  },
  {
    name: 'Erica AI',
    blurb: 'GraphRAG Course Tutor',
    dates: 'Sep 2025',
    tech: ['Python', 'Neo4j', 'MongoDB', 'Ollama', 'GraphRAG'],
    bullets: [
      'A Graph-based RAG course tutor with a multi-stage pipeline for ingestion, knowledge graph construction, and scaffolded answer generation spanning 1300+ RAG concepts.',
      'Runs with a hybrid storage layer combining MongoDB for multi-source ingestion with Neo4j knowledge graphs modeling prerequisite relationships, with local GPU inference for privacy-preserving answers with structured citations.',
    ],
    repo: 'https://github.com/antailbaxt3r/EricaAI',
  },
  // {
  //   name: 'Portfolio Town',
  //   blurb: 'This site, as a GBA game',
  //   dates: '2026',
  //   tech: ['Phaser 4', 'TypeScript', 'Vite'],
  //   bullets: [
  //     'Built an explorable pixel-art town where each building is a section of the portfolio, with grid movement, click-to-walk pathfinding and scene transitions.',
  //     'Generated every sprite, tilemap, font and music track from code at build time - no third-party art ships with the site.',
  //   ],
  //   repo: 'https://github.com/antailbaxt3r/GBA-Web-Portfolio',
  //   demo: '/',
  // },
  {
    name: 'LinkedIn Post Generator',
    blurb: 'AI writing assistant',
    dates: 'Dec 2025',
    tech: ['React', 'Express', 'Drizzle', 'PostgreSQL', 'Gemini'],
    bullets: [
      'An auto-post generator that drafts posts with Gemini or OpenAI, suggests source articles for inspiration, and tracks how each published post performed.',
      'Allows user management, and post scheduling, with a React frontend and an Express backend using Drizzle ORM for PostgreSQL.',
    ],
    repo: 'https://github.com/antailbaxt3r/linkedin-post-generator',
  },
];

export const RESUME_SKILLS: SkillGroup[] = [
  { label: 'Languages', icon: 'solid/code', hue: 220, items: ['Python', 'C#', 'TypeScript', 'JavaScript', 'SQL'] },
  {
    label: 'AI / Machine Learning', icon: 'solid/brain',
    hue: 275,
    items: [
      'GraphRAG', 'LangChain', 'PyTorch', 'Ollama',
      'Scikit-learn', 'NumPy', 'Pandas', 'OpenCV',
    ],
  },
  {
    label: 'Backend / Distributed', icon: 'solid/server',
    hue: 165,
    items: [
      '.NET', 'Node.js', 'FastAPI', 'REST API Design', 'Microservices',
      'High Availability', 'Celery',
    ],
  },
  // { label: 'Frontend', icon: 'solid/window-maximize', hue: 25, items: ['React', 'Next.js', 'Tailwind CSS'] },
  {
    label: 'Databases / Storage', icon: 'solid/database',
    hue: 340,
    items: [
      'PostgreSQL', 'pgvector', 'SQL Server', 'SAP HANA', 'SAP ASE', 'MongoDB',
      'Neo4j', 'Redis', 'Azure Blob Storage', 'MinIO',
    ],
  },
  // {
  //   label: 'Developer Tools', icon: 'solid/screwdriver-wrench',
  //   hue: 195,
  //   items: ['Microsoft Azure', 'Docker', 'Kubernetes', 'Git', 'CI/CD', 'Linux', 'Agile/Scrum'],
  // },
];

export const RESUME_EDUCATION: ResumeDegree[] = [
  {
    school: 'New York University',
    degree: 'Master of Science in Computer Science',
    dates: 'Sep 2025 - May 2027',
    location: 'New York, NY',
  },
  {
    school: 'BITS Pilani, K. K. Birla Goa Campus',
    degree: 'Bachelor of Engineering in Computer Science',
    dates: 'Aug 2018 - Jun 2022',
    location: 'Goa, India',
  },
];
