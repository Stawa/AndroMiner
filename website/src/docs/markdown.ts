import { Marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import powershell from 'highlight.js/lib/languages/powershell';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('powershell', powershell);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const highlight = (code: string, lang: string): string => {
  const known = hljs.getLanguage(lang) ? lang : null;
  return known ? hljs.highlight(code, { language: known }).value : escapeHtml(code);
};

export interface Heading {
  id: string;
  text: string;
  depth: number;
}

export interface Rendered {
  html: string;
  headings: Heading[];
}

/** Renders trusted, repository-owned Markdown. Never pass user input here. */
export const renderMarkdown = (source: string): Rendered => {
  const headings: Heading[] = [];
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const plain = this.parser.parseInline(tokens, this.parser.textRenderer);
        const id = slugify(plain);
        if (depth === 2 || depth === 3) headings.push({ id, text: plain, depth });
        const anchor =
          depth === 1
            ? ''
            : `<a class="anchor" href="#${id}" aria-label="Link to this section">#</a>`;
        return `<h${depth} id="${id}">${text}${anchor}</h${depth}>\n`;
      },
      code({ text, lang }) {
        const language = (lang ?? '').split(/\s/)[0] ?? '';
        const label = language || 'text';
        return `<div class="code-block" data-lang="${escapeHtml(label)}"><button type="button" class="copy-code">Copy</button><pre><code class="hljs language-${escapeHtml(label)}">${highlight(text, language)}</code></pre></div>\n`;
      },
      table({ header, rows }) {
        const cell = (c: { tokens: never[]; align: string | null }, tag: string) =>
          `<${tag}>${this.parser.parseInline(c.tokens)}</${tag}>`;
        const head = `<tr>${header.map((c) => cell(c as never, 'th')).join('')}</tr>`;
        const body = rows
          .map((r) => `<tr>${r.map((c) => cell(c as never, 'td')).join('')}</tr>`)
          .join('');
        return `<div class="table-wrap" tabindex="0" role="region" aria-label="Table, scrollable"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>\n`;
      }
    }
  });
  const html = marked.parse(source, { async: false });
  return { html, headings };
};

export const plainText = (source: string): string =>
  source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*`|>\-[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
