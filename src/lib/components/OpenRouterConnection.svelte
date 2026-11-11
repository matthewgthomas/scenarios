<script lang="ts">
  import { Check, CheckCircle2, CircleAlert, ExternalLink, LockKeyhole } from '@lucide/svelte';
  let {
    connectionKey = $bindable(''),
    connected,
    testing,
    status,
    failed = false,
    onkeychange,
    ontest,
    onforget
  }: {
    connectionKey: string;
    connected: boolean;
    testing: boolean;
    status: string;
    failed?: boolean;
    onkeychange: () => void;
    ontest: () => void;
    onforget: () => void;
  } = $props();
  const uid = $props.id();
</script>

<div class="connection-intro learning-copy">
  <h3>Connect your OpenRouter account</h3>
  <p>
    OpenRouter is a service that lets this app use AI models from different companies through one
    account. A model is the AI that reads your question and writes a response, like the ones behind
    ChatGPT or Claude.
  </p>
  <p>
    Here, you ask for AI help from inside your analysis. The app sends the relevant information to
    OpenRouter and your chosen model providers, then brings their suggestions back for you to
    review. You decide when to ask and what to keep.
  </p>
</div>

<details class="openrouter-guide">
  <summary>
    <span
      >New to OpenRouter? Start here.<small>Create an account, make a key and add credits</small
      ></span
    >
  </summary>
  <div class="learning-copy">
    <p>
      You only need to do this once. The links open in a new tab so you can keep this page open.
    </p>
    <ol>
      <li>
        <h4>Create an OpenRouter account</h4>
        <p>
          Visit <a href="https://openrouter.ai/" target="_blank" rel="noreferrer">OpenRouter</a>,
          choose the option to sign up and follow the instructions. Your ChatGPT, Claude or other
          chatbot subscription does not pay for requests made through OpenRouter. This is a separate
          account with its own balance.
        </p>
      </li>
      <li>
        <h4>Create a key for this app</h4>
        <p>
          While signed in, open <a
            href="https://openrouter.ai/settings/keys"
            target="_blank"
            rel="noreferrer">your API keys</a
          >
          and create a new key. Give it a name you’ll recognise, such as “Scenario Designer”. An API key
          is a private code that lets an app use your OpenRouter account. You don’t need to write any
          code yourself.
        </p>
        <p>
          Set a spending limit for this key on OpenRouter. Copy the key when it is shown, then paste
          it into the box below. Treat it like a password: anyone with it could use your credits.
          Read <a
            href="https://openrouter.ai/docs/api/reference/authentication"
            target="_blank"
            rel="noreferrer">OpenRouter’s guide to keys and limits</a
          >.
        </p>
      </li>
      <li>
        <h4>Add credits for paid models</h4>
        <p>
          Open <a href="https://openrouter.ai/settings/credits" target="_blank" rel="noreferrer"
            >your credits page</a
          >
          and follow the payment instructions. Credits are money you add in advance, in US dollars. Each
          paid AI request uses some of that balance. Check the current fees before paying; adding credits
          here does not happen automatically when you set this app’s budget.
        </p>
        <p>
          You don't have to pay to use this app; OpenRouter also offers free AI models that you can
          choose in the next step. They have usage limits and may be temporarily unavailable. For
          billing details, see <a
            href="https://openrouter.ai/docs/faq"
            target="_blank"
            rel="noreferrer">OpenRouter’s frequently asked questions</a
          >.
        </p>
      </li>
      <li>
        <h4>Come back and check your key</h4>
        <p>
          Paste your key below and choose “Check connection”. This checks access to your account; it
          does not ask a model to generate anything nor does it cost any money. You’ll choose models
          and a budget next.
        </p>
      </li>
    </ol>
    <a href="https://openrouter.ai/docs/quickstart" target="_blank" rel="noreferrer"
      >OpenRouter’s getting-started guide <ExternalLink size={13} /></a
    >
  </div>
</details>

<label for={`${uid}-key`}>Your OpenRouter API key</label>
<input
  id={`${uid}-key`}
  class="connection-key"
  type="password"
  bind:value={connectionKey}
  autocomplete="off"
  spellcheck="false"
  autocapitalize="off"
  placeholder="Paste the key you copied from OpenRouter"
  aria-describedby={`${uid}-key-help`}
  oninput={onkeychange}
/>
<p id={`${uid}-key-help`} class="small muted connection-key-help">
  <LockKeyhole size={15} aria-hidden="true" /> Your key stays in memory for this page session. It is never
  saved in your project or included in downloads. After a reload, enter it again to use AI.
</p>
<div class="toolbar-group spaced">
  <button class="secondary" disabled={!connectionKey.trim() || testing} onclick={ontest}>
    {#if connected}<Check size={16} />{/if}
    {testing ? 'Checking connection…' : connected ? 'Check again' : 'Check connection'}
  </button>
  {#if connectionKey}<button class="text-button" onclick={onforget}>Forget key</button>{/if}
</div>
{#if status}
  {#if connected}
    <div role="status" aria-atomic="true" class="connection-status connection-confirmed">
      <CheckCircle2 size={24} aria-hidden="true" />
      <div>
        <strong>Connected</strong>
        <p>{status.replace(/^Connected\.\s*/, '')}</p>
      </div>
    </div>
  {:else if failed}
    <div role="alert" aria-atomic="true" class="connection-status connection-failed">
      <CircleAlert size={24} aria-hidden="true" />
      <div>
        <strong
          >{status.startsWith('This key was not accepted.')
            ? 'Key not accepted'
            : 'Connection check failed'}</strong
        >
        <p>{status}</p>
      </div>
    </div>
  {:else}<p role="status" class="connection-status">{status}</p>{/if}
{/if}
<p class="small external-links">
  <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer"
    >Manage keys <ExternalLink size={12} /></a
  >
  <a href="https://openrouter.ai/settings/credits" target="_blank" rel="noreferrer"
    >Add credits <ExternalLink size={12} /></a
  >
</p>

<style>
  .connection-confirmed,
  .connection-failed {
    --connection-status-color: var(--cg-status-approved-text);
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px 18px;
    border: 1px solid var(--connection-status-color);
    border-left-width: 4px;
    border-radius: var(--cg-radius-control);
    background: var(--cg-status-approved-bg);
    color: var(--connection-status-color);
    animation: connection-confirmed 800ms ease-out;
  }
  .connection-failed {
    --connection-status-color: var(--cg-status-error-text);
    background: var(--cg-status-error-bg);
  }
  .connection-confirmed :global(svg),
  .connection-failed :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
  }
  .connection-confirmed strong,
  .connection-failed strong {
    font-size: 1rem;
  }
  .connection-confirmed p,
  .connection-failed p {
    margin: 4px 0 0;
  }
  @keyframes connection-confirmed {
    from {
      box-shadow: 0 0 0 5px color-mix(in srgb, var(--connection-status-color) 25%, transparent);
    }
    to {
      box-shadow: 0 0 0 0 transparent;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .connection-confirmed,
    .connection-failed {
      animation: none;
    }
  }
</style>
