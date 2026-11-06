import { categories } from './componentNotes';

export interface DocPage {
  /** Path under /docs, for example `getting-started/introduction`. */
  slug: string;
  title: string;
  description: string;
  /** Markdown file under content/. Absent for generated component pages. */
  markdown?: boolean;
}

export interface DocSection {
  id: string;
  title: string;
  pages: DocPage[];
}

const md = (section: string, name: string, title: string, description: string): DocPage => ({
  slug: `${section}/${name}`,
  title,
  description,
  markdown: true
});

export const sections: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    pages: [
      md('getting-started', 'introduction', 'Introduction', 'What AndroMiner is and is not.'),
      md('getting-started', 'installation', 'Installation', 'Choose an APK, verify it and run it.'),
      md(
        'getting-started',
        'development-setup',
        'Development setup',
        'Tools and commands to build from source.'
      ),
      md(
        'getting-started',
        'project-structure',
        'Project structure',
        'Where everything lives in the repository.'
      )
    ]
  },
  {
    id: 'architecture',
    title: 'Architecture',
    pages: [
      md(
        'architecture',
        'application-architecture',
        'Application architecture',
        'Frontend layers and the native boundary.'
      ),
      md(
        'architecture',
        'mining-engine',
        'Mining engine',
        'XMRig, XMRigCC and XLArig and how one is chosen.'
      ),
      md(
        'architecture',
        'native-android',
        'Native Android',
        'Plugins, the foreground service and the runtime classes.'
      ),
      md('architecture', 'data-storage', 'Data storage', 'What is stored on the phone and where.')
    ]
  },
  {
    id: 'components',
    title: 'Components',
    pages: [
      md(
        'components',
        'overview',
        'Overview',
        'How component documentation is produced and organised.'
      ),
      ...categories.map((category) => ({
        slug: `components/${category.id}`,
        title: category.title,
        description: category.intro.replace(/`/g, '')
      }))
    ]
  },
  {
    id: 'features',
    title: 'Features',
    pages: [
      md('features', 'mining', 'Mining', 'Session lifecycle, limits and crash handling.'),
      md(
        'features',
        'pool-configuration',
        'Pool configuration',
        'Coin, wallet, pool and the connection test.'
      ),
      md('features', 'cpu-profiles', 'CPU profiles', 'Presets for threads, affinity and priority.'),
      md(
        'features',
        'device-protection',
        'Device protection',
        'Normal, Caution, Throttled and Critical.'
      ),
      md('features', 'statistics', 'Statistics', 'What anonymous statistics send and show.')
    ]
  },
  {
    id: 'contributing',
    title: 'Contributing',
    pages: [
      md(
        'contributing',
        'contribution-guide',
        'Contribution guide',
        'Ground rules, workflow and bug reports.'
      ),
      md(
        'contributing',
        'coding-guidelines',
        'Coding guidelines',
        'Formatting, frontend and native conventions.'
      ),
      md('contributing', 'pull-requests', 'Pull requests', 'Checks to run and what to include.'),
      md('contributing', 'testing', 'Testing', 'Unit, smoke, site and Android tests.')
    ]
  }
];

export const pages: DocPage[] = sections.flatMap((section) => section.pages);

export const sectionOf = (slug: string): DocSection | undefined =>
  sections.find((section) => section.pages.some((page) => page.slug === slug));
