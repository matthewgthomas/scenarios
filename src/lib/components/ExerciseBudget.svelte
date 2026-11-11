<script lang="ts">
  import { spent, reserved, uncertainSpend, type Project, type Change } from '$lib/domain/project';
  let {
    p,
    change,
    required = false,
    valid = $bindable(true)
  }: { p: Project; change: Change; required?: boolean; valid?: boolean } = $props();
  let budgetInput: HTMLInputElement;
  $effect(() => {
    p.budget;
    valid = budgetInput.validity.valid;
  });
</script>

<div class="learning-copy">
  <h3>Decide how much this analysis can use</h3>
  <p>
    OpenRouter charges for the text a model reads and writes, rather than a monthly chat
    subscription. Prices vary by model. Longer questions, longer answers, more thinking and asking
    several models can all increase the cost.
  </p>
  <p>
    Your analysis budget is the total amount you want to allow for AI work in this project, in US
    dollars. The starting amount is $5; change it to an amount you’re comfortable with. It covers
    the whole analysis, across all stages and models. You can adjust it later.
  </p>
</div>
<label class="budget-input">
  Analysis budget in US dollars {required ? '(required)' : '(optional)'}
  <input
    bind:this={budgetInput}
    type="number"
    min="0.01"
    step="0.01"
    {required}
    value={p.budget ?? ''}
    placeholder={required ? 'Enter an amount, such as 5.00' : 'No analysis budget'}
    oninput={(e) => {
      const input = e.currentTarget;
      valid = input.validity.valid;
      const amount = input.valueAsNumber;
      if (input.value === '' || (input.validity.valid && Number.isFinite(amount) && amount > 0))
        change((p) => (p.budget = input.value === '' ? null : amount));
    }}
  />
  <small class="muted"
    >{required
      ? 'Enter at least $0.01 to continue. Setting a budget does not charge you or buy credits.'
      : 'Leave blank to remove the app’s analysis allowance. This does not change your OpenRouter key limit.'}</small
  >
</label>
<div class="budget-explanation learning-copy">
  <h4>Two amounts for two different purposes</h4>
  <dl class="budget-terms">
    <div>
      <dt>Your OpenRouter balance</dt>
      <dd>
        Money you have paid to OpenRouter. Paid requests draw from this balance, including requests
        from other apps using your account.
      </dd>
    </div>
    <div>
      <dt>This analysis’s budget</dt>
      <dd>
        A planning allowance in this app. Setting it does not add money to OpenRouter or set aside
        money in your account.
      </dd>
    </div>
  </dl>
  <h4>You stay in control of each request</h4>
  <p>
    Before AI work starts, you’ll confirm the request. Individual models show an estimated cost;
    Fusion uses the remaining overall exercise budget, with no separate allowance. The app blocks
    new requests when their estimates would take this analysis over budget. Actual charges can
    differ from estimates, so also set a spending limit on
    <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer"
      >your OpenRouter key</a
    >. Choosing settings and moving between stages does not run models.
  </p>
  <p>
    Free models have no model charge, but still have usage limits. A budget does not guarantee how
    many requests you can make or that your account has enough credit. Check charges in <a
      href="https://openrouter.ai/activity"
      target="_blank"
      rel="noreferrer">OpenRouter’s activity page</a
    >.
  </p>
</div>
<dl class="spend-detail">
  <div>
    <dt>Confirmed spending</dt>
    <dd>${spent(p).toFixed(4)}</dd>
  </div>
  <div>
    <dt>Reserved for requests</dt>
    <dd>${reserved(p).toFixed(4)}</dd>
  </div>
  <div>
    <dt>Unknown charges, estimated</dt>
    <dd>${uncertainSpend(p).toFixed(4)}</dd>
  </div>
</dl>
