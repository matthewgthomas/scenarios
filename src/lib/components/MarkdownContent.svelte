<script lang="ts">
  import DOMPurify from 'dompurify';
  import { Marked } from 'marked';

  let { source }: { source: string } = $props();
  let html = $state('');
  const markdown = new Marked({
    renderer: {
      // Documentation uses Markdown; ignore embedded HTML and images before DOM parsing.
      html() {
        return '';
      },
      image() {
        return '';
      },
      heading({ depth, tokens }) {
        // The dialog already has an h2; keep document headings below it.
        const level = Math.min(depth + 2, 6);
        return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>`;
      }
    }
  });

  $effect(() => {
    // Effects run only in the browser, where DOMPurify can use the DOM.
    const content = DOMPurify.sanitize(markdown.parse(source, { async: false }), {
      USE_PROFILES: { html: true },
      RETURN_DOM_FRAGMENT: true,
      FORBID_TAGS: ['img', 'style', 'input', 'form'],
      FORBID_ATTR: ['style']
    });
    for (const link of content.querySelectorAll('a[href]')) {
      try {
        const url = new URL(
          link.getAttribute('href')!,
          'https://github.com/matthewgthomas/scenarios/blob/main/ROADMAP.md'
        );
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
          link.removeAttribute('href');
          continue;
        }
        link.setAttribute('href', url.href);
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      } catch {
        link.removeAttribute('href');
      }
    }
    const container = document.createElement('div');
    container.append(content);
    html = container.innerHTML;
  });
</script>

<div class="markdown-content">{@html html}</div>

<style>
  .markdown-content {
    overflow-wrap: anywhere;
  }
  .markdown-content :global(h3) {
    font-size: 1.2rem;
    margin: 0 0 16px;
  }
  .markdown-content :global(h4) {
    font-size: 1.1rem;
    margin: 28px 0 12px;
  }
  .markdown-content :global(h5),
  .markdown-content :global(h6) {
    font-size: 1rem;
    margin: 24px 0 10px;
  }
  .markdown-content :global(ul),
  .markdown-content :global(ol) {
    padding-left: 22px;
  }
  .markdown-content :global(li) {
    margin: 8px 0;
  }
  .markdown-content :global(pre) {
    white-space: pre-wrap;
  }
  .markdown-content :global(table) {
    display: block;
    overflow-x: auto;
  }
</style>
