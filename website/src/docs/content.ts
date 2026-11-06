const sources = import.meta.glob('./content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

export const markdownFor = (slug: string): string | undefined => sources[`./content/${slug}.md`];
