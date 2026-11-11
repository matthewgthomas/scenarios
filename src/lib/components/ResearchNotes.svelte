<script lang="ts">
  import type { Driver, Change } from '$lib/domain/project';
  let { driver, change }: { driver: Driver; change: Change } = $props();
  type Evidence = NonNullable<Driver['evidence']>;
  function save<K extends keyof Evidence>(field: K, value: Evidence[K]) {
    change((p) => {
      const d = p.drivers.find((d) => d.id === driver.id)!;
      d.evidence ??= { sources: [], notes: '', rationale: '', perspectives: '' };
      d.evidence[field] = value;
    });
  }
</script>

<details class="research-notes">
  <summary>Research and analyst judgement</summary>
  <p class="small muted">
    Optional notes save automatically and travel into your analytical export and project backup.
  </p>
  <label
    >Source links <small class="muted">One per line</small><textarea
      rows="2"
      value={driver.evidence?.sources.join('\n') ?? ''}
      onchange={(e) =>
        save(
          'sources',
          e.currentTarget.value
            .split('\n')
            .map((v) => v.trim())
            .filter(Boolean)
        )}
      placeholder="https://…"></textarea></label
  >
  <label
    >Research and consultation notes<textarea
      rows="3"
      value={driver.evidence?.notes ?? ''}
      oninput={(e) => save('notes', e.currentTarget.value)}
      placeholder="What did the desk review or consultations find? Record dates, limitations and conflicting findings."
    ></textarea></label
  >
  <label
    >Why these scores?<textarea
      rows="3"
      value={driver.evidence?.rationale ?? ''}
      oninput={(e) => save('rationale', e.currentTarget.value)}
      placeholder="Explain your judgement, including why you agree with or override a model assessment."
    ></textarea></label
  >
  <label
    >Whose experience does this assessment represent?<textarea
      rows="3"
      value={driver.evidence?.perspectives ?? ''}
      oninput={(e) => save('perspectives', e.currentTarget.value)}
      placeholder="Who was consulted? Whose experience is missing? How might impacts differ for marginalised groups, and where do people disagree?"
    ></textarea></label
  >
</details>

<style>
  .research-notes {
    margin-top: 24px;
    border-top: 1px solid var(--cg-border);
    padding-top: 16px;
  }
  summary {
    font-weight: 700;
    cursor: pointer;
  }
  label {
    display: block;
    margin-top: 16px;
  }
  p {
    max-width: 65ch;
  }
</style>
