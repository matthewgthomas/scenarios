import { canonicalStage } from '$lib/domain/project';

const pages = {
  0: 'define',
  9: 'models',
  1: 'drivers',
  2: 'assessment',
  3: 'uncertainties',
  4: 'hypotheses',
  5: 'chains',
  6: 'writing',
  8: 'export'
} as const;

export type WalkthroughId = 'home' | (typeof pages)[keyof typeof pages];
export type WalkthroughStep = { target?: string; title: string; description: string };
export type WalkthroughPreferences = { automatic: boolean; seen: WalkthroughId[] };
export const WALKTHROUGH_PREFERENCE = 'walkthroughs';

export function walkthroughId(stage: number | null): WalkthroughId {
  return stage === null ? 'home' : (pages[canonicalStage(stage) as keyof typeof pages] ?? 'home');
}

const step = (target: string, title: string, description: string): WalkthroughStep => ({
  target,
  title,
  description
});

export const walkthroughs: Record<WalkthroughId, WalkthroughStep[]> = {
  home: [
    step(
      'home-create',
      'Explore possible futures',
      'Start with an open question, a place and a time horizon. Work manually or add optional AI help. Every scenario is a possibility to explore, rather than a prediction.'
    ),
    step(
      'home-example',
      'Follow one example from the beginning',
      'Explore an example traces a question through a driver, its scores, alternative outcomes, a combination and a narrative. Use Exit example beside the guide’s primary action to return to your exercises.'
    ),
    step(
      'walkthrough-launcher',
      'Get help when you need it',
      'Each workspace has contextual guidance. Page walkthrough replays detailed instructions on request; further tours will not open automatically. Your work saves on this device; download project backups regularly.'
    )
  ],
  define: [
    step(
      'analysis-name',
      'Give your analysis a name',
      'Choose a short name so you can find this analysis again. You can change it later.'
    ),
    step(
      'analysis-question',
      'Ask an open question',
      'This field is required. Describe what might change and what it could mean for people. For example: “How might access to housing change, and who could be affected?”'
    ),
    step(
      'analysis-horizon',
      'Set the time and place',
      'This field is required. Say where you are looking and how far ahead, such as “United Kingdom, 2026–2029”.'
    ),
    step(
      'analysis-drivers',
      'Add any starting ideas',
      'A driver is a force that could shape the future, such as housing costs or government policy. You can add one per line here, or leave this optional section for later.'
    ),
    step(
      'stage-complete',
      'Continue manually or set up AI help',
      'Once your question and time horizon are filled in, choose “Continue manually” to go straight to exploring drivers without connecting OpenRouter, choosing models or setting a budget. Choose “Continue to models and budget” for optional AI help. Your details save automatically as you work.'
    )
  ],
  models: [
    step(
      'model-manual',
      'AI setup is optional',
      'Choose “Continue manually” to skip AI setup and design scenarios yourself. You can add drivers of change, enter impact/uncertainty scores, develop hypotheses, build scenario combinations, write scenarios and export your work without needing to use AI. You can add AI help later using the “Models and budget” button in the top bar.'
    ),
    step(
      'model-connection-step',
      'Connect your OpenRouter account',
      'If you want AI help, start with “Connect OpenRouter”. Paste your API key and check the connection. The key lets this app send requests through your account; checking it does not generate a paid response. You will need to enter it again if you reload the page.'
    ),
    step(
      'model-models-step',
      'Choose who helps with your analysis',
      'Next, choose one or more AI models. A model is an AI system that suggests ideas. You can keep the starting selection; different models may offer different perspectives. You review their suggestions and decide what to keep.'
    ),
    step(
      'model-budget-step',
      'Decide how much to allow',
      'Finally, set a spending allowance for this analysis. Setting it does not buy credits or charge your account. The app checks estimated costs, but this is not a guaranteed cap on charges from OpenRouter.'
    ),
    step(
      'model-current-step',
      'Work through these steps for AI help',
      'For AI help, complete the step shown here, then use Continue at the bottom. You will review the models and estimated cost before each AI request. “Continue manually” stays available at every setup step.'
    ),
    step(
      'stage-complete',
      'Finish setup and explore drivers',
      'For AI setup, Continue becomes available when the current step is ready: a checked connection, available models, then a valid positive budget. On the last step, choose “Explore drivers of change”. To skip AI setup, choose “Continue manually” above at any time.'
    )
  ],
  drivers: [
    step(
      'stage-heading',
      'Find forces that could shape the future',
      'A driver of change is something that could change the answer to your question, such as food prices, public policy or access to services. Start with a useful range of ideas.'
    ),
    step(
      'stage-actions',
      'Add your ideas or ask AI',
      'Use “Add driver” to write your own, or “Generate drivers” for suggestions. AI help is optional. You will confirm any AI request before it runs.'
    ),
    step(
      'driver-list',
      'Refine the list',
      'Read each driver and edit unclear names or descriptions. Use “Suggest merges” for help finding overlaps, or “Organise drivers” to merge, split or remove ideas yourself. Review merge suggestions before accepting them.'
    ),
    step(
      'stage-complete',
      'Approve the drivers you want to keep',
      'You need at least one driver. Approve retained drivers individually, or choose “Approve all & assess drivers” after refining the list. Then continue to scoring.'
    )
  ],
  assessment: [
    step(
      'stage-heading',
      'Score the drivers of change',
      'Give each driver two scores from 1 to 5: how much it could affect people, and how uncertain its future is. Higher scores mean greater humanitarian impact or greater uncertainty.'
    ),
    step(
      'stage-actions',
      'Use AI scores if they help',
      '“Generate scores” asks AI for scores and explanations. This is optional: you can enter your own scores instead. AI scores are suggestions; you must accept or adjust them.'
    ),
    step(
      'assessment-workspace',
      'Inspect scores and disagreements',
      'Open a driver from the matrix, list or table to inspect it and enter your judgement. The median is the middle of the available AI scores. Look at different views and explanations before accepting it.'
    ),
    step(
      'stage-guide',
      'Fill gaps and approve your scores',
      'Every driver needs impact and uncertainty scores as well as your approval. Use the named links here to find gaps; you can accept remaining AI medians explicitly or adjust scores one driver at a time.'
    ),
    step(
      'stage-complete',
      'Continue when every score is approved',
      'The bottom action takes you to missing scores or offers to accept available scores. Once every driver has approved impact and uncertainty scores, continue to “Select critical uncertainties”.'
    )
  ],
  uncertainties: [
    step(
      'stage-heading',
      'Choose what your scenarios will explore',
      'A critical uncertainty is a driver whose different possible outcomes could make a meaningful difference to your question. Look for drivers that matter and could develop in different ways.'
    ),
    step(
      'assessment-workspace',
      'Compare impact and uncertainty',
      'Use the matrix or table to compare the drivers you scored. Open a driver if you want to inspect its scores and reasoning before choosing.'
    ),
    step(
      'uncertainty-choices',
      'Select the drivers you want to explore',
      'Use the checkboxes to include drivers in your scenarios. Choose at least one. Aim for four to six; choose a set you can meaningfully compare.'
    ),
    step(
      'stage-guide',
      'Check your selection',
      'Your selected uncertainties appear here. You can change the selection before confirming it.'
    ),
    step(
      'stage-complete',
      'Confirm and develop hypotheses',
      'Once at least one uncertainty is selected, choose “Confirm selection & develop hypotheses”. Next you will describe possible outcomes for each one.'
    )
  ],
  hypotheses: [
    step(
      'stage-heading',
      'Describe possible future outcomes',
      'A hypothesis is one way an uncertainty could turn out. For housing costs, alternatives might include costs rising, staying steady or falling. Give each uncertainty useful, distinct possibilities.'
    ),
    step(
      'hypothesis-index',
      'Work through each uncertainty',
      'Choose an uncertainty from this list. Its count and status show whether it still needs hypotheses or approval.'
    ),
    step(
      'stage-actions',
      'Add or generate alternatives',
      'Use “Add hypothesis” to write your own, or generate ideas for all uncertainties, the current one or those missing hypotheses. Edit alternatives and use the organisation or merge tools to refine them.'
    ),
    step(
      'hypothesis-coverage',
      'Fill every gap and review what stays',
      'Each uncertainty needs at least one approved hypothesis. This section shows where any gaps remain. Approve alternatives one uncertainty at a time, or approve the whole retained set when ready.'
    ),
    step(
      'stage-complete',
      'Approve and build combinations',
      'When every uncertainty has a hypothesis, this button lets you approve the retained set and continue. Next you will combine these outcomes into contrasting futures.'
    )
  ],
  chains: [
    step(
      'stage-heading',
      'Build different possible futures',
      'A hypothesis chain combines a possible outcome for each uncertainty into one future. The outcomes should make sense together and give you something useful to compare with other chains.'
    ),
    step(
      'stage-actions',
      'Create candidates',
      'Use “Add combination” to build a candidate yourself, choosing a hypothesis for each uncertainty. Optional AI help can generate three candidates per selected model or explore a disruptive wildcard. You review and confirm any AI request first.'
    ),
    step(
      'chain-comparison',
      'Compare and refine',
      'Compare the outcomes in each chain, edit its explanation and adjust the choices. You can leave an outcome explicitly unresolved. If a wildcard adds new drivers of change, you will need to review and accept or remove them.'
    ),
    step(
      'chain-chooser',
      'Choose the chains you want to write',
      'Open the full candidate list to see all active chains. Include any selection of one or more chains. You can remove unwanted chains and restore them later.'
    ),
    step(
      'stage-complete',
      'Review and approve your selection',
      'Use the bottom action to review your selection and approve it in the chooser. At least one hypothesis chain is required, and any issues must be resolved. Once approved, continue to “Write & review scenarios”.'
    )
  ],
  writing: [
    step(
      'stage-heading',
      'Turn each hypothesis chain into a story',
      'Write what this future looks like, how it could come about and what it could mean for people. Keep any unresolved outcomes clear rather than treating them as settled facts.'
    ),
    step(
      'writing-scenarios',
      'Open a scenario to write or review',
      'Click/tap a scenario to open the editor, where you can write a draft. Your text saves as you type, and the hypothesis chain remains available as a reference.'
    ),
    step(
      'stage-actions',
      'Use AI help only when you want it',
      '“Write scenario” opens the editor; “Generate draft” offers an AI starting point. With several scenarios, choose which story to work on. AI drafts are just proposals for you to apply, edit or dismiss.'
    ),
    step(
      'stage-guide',
      'Review every story',
      'Read each draft alongside its hypothesis chain. The checklist inside the editor is optional. The guidance here links to missing drafts or chains that need renewed approval.'
    ),
    step(
      'stage-complete',
      'Save your final set and export',
      'Every selected scenario needs a non-empty draft, and the hypothesis chain selection must be approved. Then choose “Save final set & export”. This saves final snapshots; you can still return and edit later.'
    )
  ],
  export: [
    step(
      'stage-guide',
      'Check what you are sharing',
      'This summary tells you whether stories are missing, need review or have final snapshots. Follow its links if you want to finish or review work first.'
    ),
    step(
      'export-options',
      'Choose how much to include',
      'Share the narratives on their own, include hypothesis chains and assumptions, or include the full analytical record for a deeper review.'
    ),
    step(
      'export-download',
      'Copy or download your work',
      'Choose Copy, Markdown, Word or PDF for the contents you selected. Export can include working drafts; use the status above to decide when your set is ready to share.'
    ),
    step(
      'export-analysis',
      'Use structured analysis elsewhere',
      '“Analytical JSON” contains structured records for other tools. It serves a different purpose from a project backup, which you can reopen in this app.'
    ),
    step(
      'export-backup',
      'Keep a resumable project backup',
      '“Download project backup” preserves the analysis, including decisions, drafts and history, so you can import it later or on another device. It never includes your API key.'
    )
  ]
};

export function walkthroughSteps(page: WalkthroughId, blocked?: string | null): WalkthroughStep[] {
  const steps = walkthroughs[page];
  if (!blocked) return steps;
  return [
    {
      title: 'Complete an earlier step first',
      description: `${blocked} Close this tour and use the “Go to” button to return there. Here is what you will do on this page once it is available.`
    },
    ...steps.map(({ title, description }) => ({ title, description }))
  ];
}

export function readWalkthroughPreferences(value?: string): WalkthroughPreferences {
  const defaults: WalkthroughPreferences = { automatic: true, seen: [] };
  if (!value) return defaults;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return defaults;
    const { automatic, seen } = parsed as Record<string, unknown>;
    return {
      automatic: typeof automatic === 'boolean' ? automatic : true,
      seen: Array.isArray(seen)
        ? [
            ...new Set(
              seen.filter(
                (page): page is WalkthroughId =>
                  typeof page === 'string' && Object.hasOwn(walkthroughs, page)
              )
            )
          ]
        : []
    };
  } catch {
    return defaults;
  }
}

export function shouldShowWalkthrough(
  preferences: WalkthroughPreferences,
  page: WalkthroughId,
  ready: boolean,
  blocked: boolean,
  dialogOpen: boolean
): boolean {
  return (
    page === 'home' &&
    ready &&
    !blocked &&
    !dialogOpen &&
    preferences.automatic &&
    !preferences.seen.includes(page)
  );
}
