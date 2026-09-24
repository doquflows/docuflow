import type { DocuflowData } from '../types';

export const DOCUFLOW_DATA: DocuflowData = {
  project: {
    name: 'acme-platform',
    path: '~/code/acme-platform',
    domain: 'Code & Architecture',
    health: 94,
    pages: 188,
    sources: 12,
    entities: 412,
    lastIngest: '2 hours ago',
    syncStatus: 'live',
  },

  hero: {
    question: 'How does payment retry work when Stripe returns a soft decline?',
    answer: [
      {
        kind: 'p',
        text: 'Soft Stripe declines (codes like `card_declined.insufficient_funds` or `processing_error`) are routed through the **`PaymentRetryQueue`** rather than failing the order outright.',
      },
      { kind: 'p', text: 'The flow is:' },
      {
        kind: 'ol',
        items: [
          'Webhook handler in `billing/webhooks/stripe.ts` matches the soft-decline error code against `RETRYABLE_DECLINE_CODES`.',
          'A retry job is enqueued with exponential backoff: **5min, 30min, 4h, 24h** (max 4 attempts).',
          'Each retry runs through `RetryablePaymentIntent.attempt()` which re-creates the PaymentIntent with `setup_future_usage=off_session`.',
          'On the final failure, the order transitions to `PAYMENT_FAILED` and a dunning email is dispatched.',
        ],
      },
      {
        kind: 'p',
        text: 'Hard declines (fraud, stolen card) skip the queue and fail immediately. See **Dunning Workflow** for the email cadence after final failure.',
      },
    ],
    citations: [
      { id: 'p1', title: 'PaymentRetryQueue',       cat: 'Modules',   path: 'wiki/modules/payment-retry-queue.md',      score: 0.94, lines: '1-48'  },
      { id: 'p2', title: 'Stripe Webhook Handler',  cat: 'API',       path: 'wiki/api/stripe-webhooks.md',              score: 0.88, lines: '12-67' },
      { id: 'p3', title: 'RETRYABLE_DECLINE_CODES', cat: 'Concepts',  path: 'wiki/concepts/retryable-decline-codes.md', score: 0.81, lines: '1-22'  },
      { id: 'p4', title: 'Dunning Workflow',         cat: 'Workflows', path: 'wiki/workflows/dunning.md',                score: 0.74, lines: '1-95'  },
    ],
    related: [
      'How are failed payments reconciled with the ledger?',
      'What error codes count as "fraud" vs "soft decline"?',
      'How do we test retry logic without hitting Stripe?',
    ],
  },

  activity: [
    { t: '2m',  tool: 'wiki_search',   target: 'payment retry stripe',       kind: 'query',  delta: '4 pages cited'          },
    { t: '14m', tool: 'ingest_source', target: 'docs/billing-spec-v3.md',    kind: 'ingest', delta: '+7 pages, +12 entities'  },
    { t: '1h',  tool: 'lint_wiki',     target: 'full scan',                  kind: 'lint',   delta: '2 stale, 0 orphan'       },
    { t: '2h',  tool: 'read_module',   target: 'src/billing/retry-queue.ts', kind: 'read',   delta: 'cached'                  },
    { t: '3h',  tool: 'update_index',  target: '—',                          kind: 'index',  delta: '188 entries'             },
  ],

  wikiTree: [
    { id: 'arch', label: 'Architecture', kind: 'cat', children: [
      { id: 'arch-overview', label: 'System Overview',  kind: 'page' },
      { id: 'arch-services', label: 'Service Topology', kind: 'page' },
      { id: 'arch-data',     label: 'Data Boundaries',  kind: 'page' },
    ]},
    { id: 'modules', label: 'Modules', kind: 'cat', children: [
      { id: 'mod-billing', label: 'billing/', kind: 'cat', children: [
        { id: 'mod-retry',   label: 'PaymentRetryQueue', kind: 'page', highlight: true },
        { id: 'mod-charge',  label: 'ChargeProcessor',   kind: 'page' },
        { id: 'mod-ledger',  label: 'LedgerWriter',      kind: 'page', stale: true },
        { id: 'mod-dunning', label: 'DunningScheduler',  kind: 'page' },
      ]},
      { id: 'mod-orders', label: 'orders/', kind: 'cat', children: [
        { id: 'mod-cart',     label: 'Cart',         kind: 'page' },
        { id: 'mod-checkout', label: 'CheckoutFlow', kind: 'page' },
        { id: 'mod-fulfill',  label: 'Fulfillment',  kind: 'page' },
      ]},
      { id: 'mod-auth', label: 'auth/', kind: 'cat', children: [
        { id: 'mod-session', label: 'SessionStore', kind: 'page' },
        { id: 'mod-token',   label: 'TokenIssuer',  kind: 'page' },
      ]},
    ]},
    { id: 'concepts', label: 'Concepts', kind: 'cat', children: [
      { id: 'c-retry', label: 'RETRYABLE_DECLINE_CODES', kind: 'page' },
      { id: 'c-idem',  label: 'Idempotency Keys',        kind: 'page' },
      { id: 'c-soft',  label: 'Soft vs Hard Decline',    kind: 'page' },
    ]},
    { id: 'workflows', label: 'Workflows', kind: 'cat', children: [
      { id: 'w-dunning',  label: 'Dunning Workflow', kind: 'page' },
      { id: 'w-checkout', label: 'Checkout',         kind: 'page' },
    ]},
  ],

  graph: {
    nodes: [
      { id: 'retry',   label: 'PaymentRetryQueue', x: 0.50, y: 0.50, size: 28, kind: 'module', hot: true },
      { id: 'charge',  label: 'ChargeProcessor',   x: 0.30, y: 0.32, size: 22, kind: 'module' },
      { id: 'webhook', label: 'StripeWebhook',     x: 0.22, y: 0.62, size: 20, kind: 'api'    },
      { id: 'ledger',  label: 'LedgerWriter',      x: 0.72, y: 0.32, size: 22, kind: 'module' },
      { id: 'dunning', label: 'DunningScheduler',  x: 0.78, y: 0.66, size: 20, kind: 'module' },
      { id: 'codes',   label: 'DeclineCodes',      x: 0.42, y: 0.78, size: 16, kind: 'concept'},
      { id: 'order',   label: 'Order',             x: 0.58, y: 0.78, size: 18, kind: 'entity' },
      { id: 'idem',    label: 'Idempotency',       x: 0.12, y: 0.42, size: 14, kind: 'concept'},
      { id: 'mail',    label: 'MailService',       x: 0.90, y: 0.50, size: 16, kind: 'module' },
      { id: 'cart',    label: 'Cart',              x: 0.45, y: 0.18, size: 16, kind: 'module' },
      { id: 'session', label: 'Session',           x: 0.10, y: 0.22, size: 14, kind: 'module' },
    ],
    edges: [
      ['retry','charge'],  ['retry','ledger'],  ['retry','dunning'], ['retry','codes'],  ['retry','order'],
      ['charge','webhook'],['webhook','codes'],  ['charge','idem'],   ['dunning','mail'],
      ['ledger','order'],  ['cart','charge'],    ['session','webhook'],
    ],
  },

  lintIssues: [
    { kind: 'stale',  sev: 'warn', page: 'LedgerWriter',   age: '47d', msg: 'Source updated 47 days ago, wiki page not refreshed' },
    { kind: 'stale',  sev: 'warn', page: 'TokenIssuer',    age: '38d', msg: 'Source updated 38 days ago, wiki page not refreshed' },
    { kind: 'orphan', sev: 'info', page: 'LegacyAuthFlow', age: '—',   msg: 'No inbound links from any wiki page'                 },
    { kind: 'meta',   sev: 'info', page: 'Cart',           age: '—',   msg: 'Missing frontmatter: `category`, `last_verified`'    },
  ],

  syncEvents: [
    { t: '00:00', kind: 'commit', msg: 'feat(billing): add exponential backoff to retry queue', files: 3 },
    { t: '00:01', kind: 'sync',   msg: 'post-commit hook → docuflow sync --ai',                 files: 0 },
    { t: '00:01', kind: 'tool',   msg: 'read_module billing/retry-queue.ts',                    files: 1 },
    { t: '00:02', kind: 'tool',   msg: 'ingest_source updated PaymentRetryQueue',               files: 1 },
    { t: '00:02', kind: 'tool',   msg: 'update_index → 188 entries',                            files: 1 },
    { t: '00:02', kind: 'done',   msg: 'Wiki up to date · 1.8s',                                files: 0 },
  ],

  domains: [
    { id: 'code',     label: 'Code & Architecture', desc: 'Codebases, services, modules, dependencies', icon: 'code'      },
    { id: 'research', label: 'Research & Analysis', desc: 'Papers, notes, hypotheses, citations',       icon: 'flask'     },
    { id: 'business', label: 'Business & Markets',  desc: 'Companies, deals, signals, briefings',       icon: 'briefcase' },
    { id: 'personal', label: 'Personal Knowledge',  desc: 'Anything else — meeting notes, journals',    icon: 'book'      },
  ],
};
