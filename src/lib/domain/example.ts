import { newProject, now, MODEL_SETUP_STAGE, type Project } from './project';

const driverData = [
  [
    'Household energy',
    'The cost, reliability and distribution of household energy, including access to affordable heating.',
    ['Economic', 'Environmental'],
    5,
    4,
    ['Prices remain volatile', 'Lower costs, unequal gains', 'Stable regulated bills']
  ],
  [
    'Income support',
    'The reach and adequacy of benefits, crisis grants and other support for households.',
    ['Political'],
    5,
    5,
    ['Local emergency funds', 'Automated, tightly targeted', 'Broader national support']
  ],
  [
    'Work & incomes',
    'The security of employment, real wages and access to work as the economy changes.',
    ['Economic', 'Social'],
    4,
    4,
    ['Portfolio incomes expand', 'Automation reshapes work', 'Public service jobs grow']
  ],
  [
    'Housing access',
    'Affordable, secure accommodation and the pressures on renters and people without a stable home.',
    ['Social', 'Political'],
    5,
    4,
    ['Rents keep rising', 'Access becomes fragmented', 'Social housing grows slowly']
  ],
  [
    'Community capacity',
    'The ability of local organisations and informal networks to respond to unmet needs.',
    ['Social'],
    4,
    4,
    ['Mutual aid expands', 'Digital-first assistance', 'Formal local partnerships']
  ],
  [
    'Food supply resilience',
    'The exposure of food prices and availability to global supply disruptions.',
    ['Environmental', 'Economic'],
    4,
    3,
    ['Supply chains diversify', 'Import dependence persists']
  ],
  [
    'Access to advice',
    'Whether people can find timely, understandable help with debt, benefits and housing.',
    ['Technological', 'Legal'],
    3,
    3,
    ['Local advice networks', 'Online triage expands']
  ],
  [
    'Health service capacity',
    'The ability of health services to absorb the effects of material hardship.',
    ['Social', 'Political'],
    5,
    2,
    ['Preventive care expands', 'Waiting lists persist']
  ]
] as const;

// Browsing positions and save bookkeeping do not turn a preview into an exercise.
export function hasExerciseEdits(before: Project, after: Project): boolean {
  const content = ({ stage, modelSetupStep, revision, updatedAt, events, ...rest }: Project) =>
    rest;
  return JSON.stringify(content(before)) !== JSON.stringify(content(after));
}

export function exampleProject(): Project {
  const p = newProject();
  p.title = 'UK financial hardship';
  p.question =
    'How might financial hardship in the United Kingdom evolve over the next three years, and what could that mean for people struggling to meet essential costs?';
  p.horizon = 'United Kingdom, 2026–2029';
  p.stage = 5;
  p.example = true;
  p.completed = [0, MODEL_SETUP_STAGE, 1, 2, 3, 4];
  p.modelSetupStep = 'budget';
  p.drivers = driverData.map((d, i) => ({
    id: `example_driver_${i}`,
    title: d[0],
    summary: d[1],
    tags: [...d[2]],
    origin: 'example',
    origins: [{ modelId: 'authored/example', text: d[1], runId: 'example' }],
    revision: 1,
    approved: true,
    selected: i < 5,
    archived: false,
    ratings: [0, 1, 2].map((j) => ({
      modelId: `authored/perspective-${j + 1}`,
      runId: 'example',
      driverRevision: 1,
      impact: i === 1 ? [5, 4, 2][j] : d[3],
      uncertainty: Math.min(5, Math.max(1, d[4] + j - 1)),
      rationale: [
        `Illustrative judgement: ${d[0].toLowerCase()} directly shapes households’ ability to meet essential needs. Policy and distributional effects could lead to different trajectories.`,
        `Illustrative judgement: existing institutions create some continuity, but access and regional variation leave several credible futures.`,
        `Illustrative judgement: the outcome depends on how support reaches people facing overlapping barriers, not just on aggregate improvements.`
      ][j]
    })),
    decision: {
      impact: i === 1 ? 4 : d[3],
      uncertainty: d[4],
      type: 'bulk_accepted_median',
      at: now(),
      revision: 1
    }
  }));
  p.hypotheses = driverData.flatMap((d, i) =>
    d[5].map((title, j) => ({
      id: `example_hyp_${i}_${j}`,
      driverId: `example_driver_${i}`,
      title,
      description: [
        `${title}. Local institutions and household adaptation play a larger role, with uneven capacity between places and groups.`,
        `${title}. Technology and market change alter access; benefits reach some households while others face new barriers.`,
        `${title}. Public coordination expands, but implementation takes time and capacity remains uneven.`
      ][j],
      origins: [{ modelId: 'authored/example', runId: 'example', text: title }],
      revision: 1,
      approved: true,
      archived: false
    }))
  );
  const titles = ['Local lifelines', 'The digital divide', 'Public renewal'];
  const reasoning = [
    'Local emergency funds and mutual aid reinforce one another as public support becomes more uneven. Portfolio incomes offer flexibility, but volatile energy bills and rising rents keep households close to crisis. This chain assumes that community organisations can sustain their capacity without replacing adequate national provision.',
    'Targeted support could ease pressure for people the system reaches. Digital barriers could leave others without help, even as energy costs fall. Automation changes incomes and access to services at the same time, creating reinforcing advantages for digitally connected households and compounding exclusion for others.',
    'Broader income support and public service jobs reinforce household stability. More predictable energy bills create room to plan, while local partnerships connect services. The main tension is timing: housing supply responds slowly, so higher disposable income does not immediately produce more secure accommodation.'
  ];
  p.chains = titles.map((title, j) => ({
    id: `example_chain_${j}`,
    title,
    colour: j + 1,
    kind: 'main',
    selected: true,
    revision: 1,
    approvedRevision: null,
    review: false,
    items: Object.fromEntries(
      p.drivers.filter((d) => d.selected).map((d, i) => [d.id, `example_hyp_${i}_${j}`])
    ),
    notes: [
      {
        modelId: 'authored/example',
        runId: 'example',
        revision: 1,
        at: now(),
        reasoning: reasoning[j],
        tensions: ['Local delivery capacity may not keep pace with demand.'],
        assumptions: ['No single intervention removes all barriers to essential services.']
      }
    ],
    origins: [{ modelId: 'authored/example', runId: 'example', text: reasoning[j] }],
    wildcardDriverIds: [],
    distinctiveness: [
      'Adaptation through local relationships',
      'Uneven gains from technological change',
      'Coordinated public investment'
    ][j]
  }));
  p.narratives = p.chains.map((c, j) => {
    const text = [
      'By 2029, financial hardship in the United Kingdom is shaped as much by where a household lives as by how much it earns. A patchwork of local emergency funds helps people navigate immediate crises. Community groups connect food provision, debt advice and small grants, while informal networks share resources. These relationships become an essential part of everyday resilience.\n\nEnergy prices continue to fluctuate. Households with little financial headroom cannot reliably plan for the next bill. Rising rents absorb income gains and force some families to move away from the very networks they rely on. People taking on several kinds of paid work gain flexibility, but fluctuating hours make it difficult to qualify for support or commit to caring responsibilities.\n\nThis future emerges through a series of incremental adaptations rather than a single decisive reform. National measures remain limited, and local institutions respond with the resources they can assemble. Some places establish effective partnerships; others depend on a small number of overstretched volunteers. A community’s ability to help reflects its own resources, creating a risk that places with the greatest need have the least capacity.\n\nFor people already facing barriers to services, personal contact provides a route to help that a purely digital system might miss. Yet relying on networks also leaves gaps. New arrivals, isolated older people and people with insecure housing may have fewer connections. The humanitarian challenge is both immediate and cumulative: meeting essential needs while avoiding a gradual transfer of responsibility onto communities that are themselves under pressure.',
      'By 2029, lower average energy costs coexist with persistent financial hardship. Automated income support reaches eligible households quickly, and digital assistance services handle routine requests. For people with stable connections, clear records and predictable circumstances, the system feels faster and more responsive. For others, the distance between formal eligibility and practical access grows.\n\nAutomation reshapes work as well as public services. Some workers move into more productive roles with higher earnings; others cycle between short contracts and periods without work. Tightly targeted benefits respond to recorded income, but records lag behind changing circumstances. An apparent improvement in average household finances hides sharply different experiences.\n\nHousing access becomes increasingly fragmented. People with reliable earnings and a strong digital footprint can compare options and meet screening requirements. Those with irregular income, limited documentation or a recent crisis find fewer routes to secure accommodation. Assistance increasingly starts online, linking housing, employment and benefits systems in ways that help some people but make errors harder to untangle.\n\nThe causal thread is not technology alone. Choices about targeting, accountability and access determine who benefits from lower operating costs. Human advice remains available in some places, but funding shifts towards digital delivery. A small administrative error can compound across connected services.\n\nHumanitarian organisations encounter people whose needs are poorly represented in the data used to allocate support. They spend more time helping households establish eligibility and correct records. The central uncertainty is whether institutions recognise these gaps early enough to preserve accessible alternatives, or whether exclusion becomes an accepted feature of an otherwise efficient system.',
      'By 2029, a broader national support settlement begins to change the experience of financial hardship in the United Kingdom. More predictable energy bills reduce one source of immediate insecurity. Public service recruitment creates jobs and strengthens local provision. Formal partnerships between councils, health services and community organisations make support easier to navigate.\n\nThe pathway is gradual. Policy changes first stabilise household finances, then strengthen the institutions that provide advice and assistance. Wider eligibility reduces some of the administrative effort involved in proving need. Frontline organisations can spend more time helping people through transitions and less time assembling emergency support for recurring shortfalls.\n\nProgress remains uneven. Social housing expands slowly because planning, construction and staffing cannot respond as quickly as financial support. Private rents continue to exert pressure in high-demand areas. Some households experience greater stability in their income without gaining a secure home. People with complex circumstances still face gaps between services.\n\nPublic service jobs support local economies and rebuild relationships between institutions and communities. However, recruitment competes with other employers, and newly funded services need time to become effective. Local partnerships work best where they build on existing trust; formal agreements alone do not guarantee that people can find help.\n\nFor humanitarian organisations, the work shifts towards connecting people to a wider public offer and identifying those who remain excluded. Broader national provision creates a stronger floor, but it does not remove the need for flexible support. This scenario assumes a sustained political commitment through implementation and enough institutional capacity to turn funding into accessible services.'
    ][j];
    return {
      id: `example_narrative_${j}`,
      chainId: c.id,
      drafts: [
        {
          id: `example_draft_${j}`,
          modelId: 'authored/example',
          runId: 'example',
          text,
          at: now(),
          chainRevision: 1
        }
      ],
      chosenId: `example_draft_${j}`,
      working: text,
      chainRevision: 1,
      original: { text, at: now(), chainRevision: 1, source: 'example' as const },
      final: null,
      finalAt: null,
      review: false,
      history: [],
      redo: [],
      checklist: [],
      annotationsDetached: false
    };
  });
  return p;
}
