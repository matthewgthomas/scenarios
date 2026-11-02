<script lang="ts">
  import { Download, Copy, FileText, Braces, Check, ArrowUpRight, Archive } from '@lucide/svelte';
  import {
    markdown,
    exportDocx,
    exportPDF,
    download,
    projectJSON,
    analyticalJSON,
    filename
  } from '$lib/export/files';
  import { type Project } from '$lib/domain/project';
  let { p }: { p: Project } = $props();
  let annotations = $state(false);
  let full = $state(false);
  let status = $state('');
  let busy = $state(false);
  const selected = $derived(p.chains.filter((c) => c.selected));
  async function output(format: 'copy' | 'md' | 'docx' | 'pdf') {
    busy = true;
    status = '';
    try {
      if (format === 'copy') {
        await navigator.clipboard.writeText(markdown(p, annotations, full));
        status = 'Copied to clipboard.';
      } else if (format === 'md') {
        download(
          markdown(p, annotations, full),
          `${filename(p)}${full ? '-full-record' : ''}.md`,
          'text/markdown;charset=utf-8'
        );
        status = 'Markdown downloaded.';
      } else if (format === 'docx') {
        await exportDocx(p, annotations, full);
        status = 'Word document downloaded.';
      } else {
        await exportPDF(p, annotations, full);
        status = 'PDF downloaded.';
      }
    } catch {
      status = 'Export failed. Try another format or download a project backup.';
    } finally {
      busy = false;
    }
  }
</script>

<div class="stage-heading">
  <div>
    <h1>Take these futures into other conversations.</h1>
    <p>
      Use your scenarios and supporting materials for further analysis and decisions:
      Bring the scenarios to a workshop; explore humanitarian consequences; identify early-warning
      indicators; or test strategies against the different futures.
    </p>
  </div>
</div>
<div class="export-scenarios">
  {#each selected as c}<article class="export-scenario scenario-{c.colour}">
      <Check size={20} />
      <div>
        <h2>{c.title}</h2>
        <p>
          {c.kind === 'wildcard' ? 'Wildcard · ' : ''}{p.narratives.find((n) => n.chainId === c.id)
            ?.final !== null && p.narratives.find((n) => n.chainId === c.id)?.final !== undefined
            ? 'Final snapshot recorded'
            : 'Working material'}{c.review ? ' · Review suggested' : ''}
        </p>
      </div>
    </article>{/each}
</div>
<section class="export-main">
  <FileText size={27} />
  <h2>Narratives & analytical report</h2>
  <p>
    Download narratives only or include the drivers, scores, hypotheses, hypothesis chains and
    operation record.
  </p>
  <div class="export-options">
    <label class="check-label"
      ><input type="checkbox" bind:checked={full} /> Include full analytical record</label
    ><label class="check-label"
      ><input type="checkbox" bind:checked={annotations} /> Include chain hypotheses and assumptions</label
    >
  </div>
  <div class="export-buttons">
    <button class="primary" disabled={busy} onclick={() => output('copy')}
      ><Copy size={16} /> Copy text</button
    ><button class="secondary" disabled={busy} onclick={() => output('md')}
      ><Download size={16} /> Markdown</button
    ><button class="secondary" disabled={busy} onclick={() => output('docx')}
      ><Download size={16} /> Word (.docx)</button
    ><button class="secondary" disabled={busy} onclick={() => output('pdf')}
      ><Download size={16} /> PDF</button
    >
  </div>
  <p class="small muted">
    Quick Mode has no historical source citations. Included annotations describe hypotheses and
    assumptions, not verified evidence.
  </p>
  <p role="status">{status}</p>
</section>
<div class="backup-options">
  <section>
    <Archive size={24} />
    <h2>A portable project</h2>
    <p>
      Resume this exercise in another browser, with edits, approvals, model contributions and
      snapshots.
    </p>
    <button
      class="secondary"
      onclick={() => download(projectJSON(p), `${filename(p)}.scenario.json`, 'application/json')}
      ><Download size={16} /> Download project backup</button
    ><small>Backups never include your API key.</small>
  </section>
  <section>
    <Braces size={24} />
    <h2>Machine-readable analysis</h2>
    <p>
      Stable IDs, provenance and structured analytical objects for downstream tools and further
      work.
    </p>
    <button
      class="secondary"
      onclick={() =>
        download(analyticalJSON(p), `${filename(p)}.analysis.json`, 'application/json')}
      ><Download size={16} /> Analytical JSON</button
    >
  </section>
</div>
