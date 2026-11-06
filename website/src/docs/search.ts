import generated from './components.generated.json';
import { notes } from './componentNotes';
import { markdownFor } from './content';
import { plainText } from './markdown';
import { pages, type DocPage } from './nav';

export interface SearchHit {
  page: DocPage;
  snippet: string;
}

interface Entry {
  page: DocPage;
  body: string;
  haystack: string;
}

let index: Entry[] | null = null;

// Built on first use: titles, descriptions, Markdown text and, for component pages, component names.
const build = (): Entry[] =>
  pages.map((page) => {
    const components = page.slug.startsWith('components/')
      ? (generated as { name: string }[])
          .filter((doc) => `components/${notes[doc.name]?.category}` === page.slug)
          .map((doc) => doc.name)
          .join(' ')
      : '';
    const body = [
      page.description,
      page.markdown ? plainText(markdownFor(page.slug) ?? '') : '',
      components
    ]
      .join(' ')
      .trim();
    return { page, body, haystack: `${page.title} ${body}`.toLowerCase() };
  });

const snippetOf = (body: string, term: string): string => {
  const at = body.toLowerCase().indexOf(term);
  if (at < 0) return body.slice(0, 110);
  const start = Math.max(0, at - 40);
  const text = body.slice(start, at + 90).trim();
  return `${start > 0 ? '…' : ''}${text}${at + 90 < body.length ? '…' : ''}`;
};

export const searchDocs = (query: string): SearchHit[] => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  index ??= build();
  return index
    .filter((entry) => terms.every((term) => entry.haystack.includes(term)))
    .map((entry) => ({
      entry,
      score: terms.reduce(
        (sum, term) => sum + (entry.page.title.toLowerCase().includes(term) ? 10 : 0),
        0
      )
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ entry }) => ({ page: entry.page, snippet: snippetOf(entry.body, terms[0]!) }));
};
