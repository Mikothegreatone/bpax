/**
 * BPAX Type Definitions
 *
 * These types are derived from the BPAX JSON Schema.
 * See: spec/bpax-0.1-alpha.schema.json
 */

// ============================================================================
// Core Document
// ============================================================================

export interface BPAXDocument {
  bpax_version: '0.1-alpha';
  id: string;
  name: string;
  description?: string;
  version?: string;
  created_at?: string;
  updated_at?: string;
  author?: Author;
  metadata?: Metadata;
  roles?: Role[];
  tools?: Tool[];
  context?: Context;
  steps: Step[];
  cost?: Cost;
  security?: Security;
  governance?: Governance;
  guardrails?: Guardrail[];
  error_handling?: ErrorHandling;
  observability?: Observability;
}

export interface Author {
  name?: string;
  email?: string;
  organization?: string;
}

// ============================================================================
// Metadata
// ============================================================================

export interface Metadata {
  domain?: 'sales' | 'operations' | 'finance' | 'hr' | 'security' | 'engineering' | 'support' | 'legal' | 'custom';
  trigger?: Trigger;
  criticality?: 'low' | 'medium' | 'high' | 'critical';
  estimated_duration_minutes?: number;
  tags?: string[];
  _extensions?: Record<string, unknown>;
}

export interface Trigger {
  type: 'manual' | 'scheduled' | 'event' | 'api' | 'webhook' | 'a2a_task';
  config?: TriggerConfig;
}

export interface TriggerConfig {
  schedule?: string;
  event_type?: string;
  api_endpoint?: string;
  webhook_path?: string;
  a2a_agent_card_uri?: string;
  a2a_accepted_input_modes?: string[];
  [key: string]: unknown;
}

// ============================================================================
// Roles
// ============================================================================

export type RoleType = 'human' | 'agent' | 'system' | 'external_agent';

export interface Role {
  id: string;
  type: RoleType;
  name: string;
  description?: string;
  responsibilities?: string[];
  agent_config?: AgentConfig;
  human_config?: HumanConfig;
  system_config?: SystemConfig;
  external_agent_config?: ExternalAgentConfig;
}

export interface AgentConfig {
  model_preference?: string[];
  autonomy_level: 'full' | 'supervised' | 'human_in_loop';
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface HumanConfig {
  notification_channel?: 'email' | 'slack' | 'teams' | 'sms' | 'web_ui';
  escalation_contact?: string;
}

export interface SystemConfig {
  interface?: 'api' | 'database' | 'file' | 'queue';
  connection_ref?: string;
}

export interface ExternalAgentConfig {
  agent_card_uri: string;
  required_skills?: string[];
  auth_scheme?: 'none' | 'api_key' | 'oauth2' | 'mtls';
  auth_secret_ref?: string;
}

// ============================================================================
// Tools
// ============================================================================

export type ToolType = 'api' | 'search' | 'database' | 'communication' | 'file' | 'mcp_tool' | 'custom';

export interface Tool {
  id: string;
  name: string;
  description?: string;
  type: ToolType;
  mcp_server?: McpServerReference;
  provider?: string;
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  auth?: ToolAuth;
  assigned_to?: string[];
  requires_approval?: boolean | ApprovalConfig;
  annotations?: ToolAnnotations;
  rate_limit?: RateLimit;
}

export interface McpServerReference {
  server_name: string;
  tool_name: string;
  server_uri?: string;
}

export interface ToolAuth {
  method: 'none' | 'api_key' | 'oauth2' | 'basic' | 'bearer' | 'mtls' | 'custom';
  secret_ref?: string;
  oauth_config?: {
    token_url?: string;
    scopes?: string[];
  };
}

export interface ToolAnnotations {
  read_only?: boolean;
  destructive?: boolean;
  idempotent?: boolean;
  open_world?: boolean;
}

export interface ApprovalConfig {
  role: string;
  type?: 'explicit' | 'implicit_timeout';
  timeout_minutes?: number;
}

export interface RateLimit {
  requests_per_minute?: number;
  requests_per_hour?: number;
  on_limit?: 'queue' | 'fail' | 'warn';
}

// ============================================================================
// Context
// ============================================================================

export interface Context {
  inputs?: ContextInput[];
  memory?: MemoryConfig;
  knowledge_bases?: KnowledgeBase[];
}

export interface ContextInput {
  id: string;
  name: string;
  type: 'string' | 'integer' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  schema?: Record<string, unknown>;
  example?: unknown;
  default?: unknown;
  sensitive?: boolean;
}

export interface MemoryConfig {
  type?: 'persistent' | 'session' | 'none';
  store?: 'redis' | 'postgres' | 'dynamodb' | 'in_memory' | 'custom';
  keys?: string[];
  ttl_hours?: number;
}

export interface KnowledgeBase {
  id: string;
  name?: string;
  type: 'rag' | 'vector_db' | 'structured_db' | 'api' | 'mcp_resource';
  source: string;
  mcp_server?: McpServerReference;
  relevance_threshold?: number;
  max_results?: number;
}

// ============================================================================
// Steps
// ============================================================================

export type StepType = 'agent_task' | 'human_task' | 'gateway' | 'terminal';

export type Step = AgentTaskStep | HumanTaskStep | GatewayStep | TerminalStep;

export interface StepBase {
  id: string;
  name: string;
  description?: string;
}

export interface AgentTaskStep extends StepBase {
  type: 'agent_task';
  assigned_to: string;
  instructions: string;
  tools_available?: string[];
  inputs?: string[];
  knowledge_bases?: string[];
  output?: StepOutput;
  confidence?: ConfidenceConfig;
  requires_approval?: boolean | ApprovalConfig;
  timeout_minutes?: number;
  retry?: RetryConfig;
  on_success?: string;
  on_failure?: string;
  on_timeout?: string;
  cost_config?: StepCostConfig;
}

export interface HumanTaskStep extends StepBase {
  type: 'human_task';
  assigned_to: string;
  inputs?: string[];
  interface?: HumanInterface;
  output?: StepOutput;
  timeout_minutes?: number;
  on_success?: string;
  on_rejection?: string;
  on_timeout?: string;
}

export interface GatewayStep extends StepBase {
  type: 'gateway';
  gateway_type?: 'exclusive' | 'parallel' | 'inclusive';
  conditions: GatewayCondition[];
  default_step?: string;
}

export interface TerminalStep extends StepBase {
  type: 'terminal';
  terminal_type?: 'success' | 'failure' | 'cancelled';
  final_output?: StepOutput;
}

export interface StepOutput {
  id: string;
  schema?: Record<string, unknown>;
  required?: boolean;
}

export interface ConfidenceConfig {
  threshold?: number;
  on_low_confidence?: 'escalate_to_human' | 'retry' | 'fail' | 'proceed_with_warning';
  escalation_role?: string;
}

export interface HumanInterface {
  type: 'slack' | 'email' | 'web_ui' | 'teams' | 'api' | 'custom';
  channel?: string;
  message_template?: string;
  form_schema?: Record<string, unknown>;
}

export interface GatewayCondition {
  condition: string;
  next_step: string;
}

export interface RetryConfig {
  max_attempts?: number;
  backoff?: 'none' | 'linear' | 'exponential';
  initial_delay_seconds?: number;
  max_delay_seconds?: number;
  on_exhausted?: string;
}

export interface StepCostConfig {
  budget_usd?: number;
  track_tokens?: boolean;
  on_overrun?: 'warn' | 'block' | 'escalate';
}

// ============================================================================
// Cost
// ============================================================================

export interface Cost {
  budget?: {
    per_step?: {
      default_max_usd?: number;
      overrides?: Record<string, number>;
      on_overrun?: 'warn' | 'block' | 'escalate';
    };
    per_run?: {
      max_usd?: number;
      warn_at_percent?: number;
      on_overrun?: 'warn' | 'block' | 'escalate';
      escalation_role?: string;
    };
    per_month?: {
      max_usd?: number;
      on_overrun?: 'warn' | 'block' | 'escalate';
      reset_day?: number;
    };
  };
  attribution?: {
    team?: string;
    project?: string;
    cost_center?: string;
    environment?: 'production' | 'staging' | 'development' | 'test';
    tags?: string[];
  };
  estimation?: {
    enabled?: boolean;
    run_before_execution?: boolean;
    abort_if_exceeds_usd?: number;
  };
  reporting?: {
    destination?: 'datadog' | 'custom_webhook' | 's3' | 'none';
    webhook_url?: string;
    include_token_breakdown?: boolean;
  };
}

// ============================================================================
// Security
// ============================================================================

export interface Security {
  data_classification?: {
    level?: 'public' | 'internal' | 'confidential' | 'restricted';
    contains_pii?: boolean;
    contains_phi?: boolean;
    contains_financial?: boolean;
    data_residency?: string[];
    retention_days?: number;
  };
  access_control?: {
    execute?: AccessRule;
    view_logs?: AccessRule;
    modify?: AccessRule;
    delete?: AccessRule;
  };
  secrets?: {
    provider?: 'aws_secrets_manager' | 'hashicorp_vault' | 'azure_keyvault' | 'gcp_secret_manager' | 'env';
    namespace?: string;
    rotation_days?: number;
    references?: Record<string, string>;
  };
  network?: {
    allowed_egress_domains?: string[];
    require_tls?: boolean;
    proxy?: string;
  };
  input_validation?: {
    sanitize_inputs?: boolean;
    max_input_length_chars?: number;
    blocked_patterns?: string[];
    on_violation?: 'reject' | 'sanitize' | 'flag';
  };
  output_filtering?: {
    redact_in_logs?: string[];
    redact_pattern?: string;
  };
}

export interface AccessRule {
  roles?: string[];
  require_mfa?: boolean;
  require_approval?: boolean;
  approvers?: string[];
}

// ============================================================================
// Governance
// ============================================================================

export interface Governance {
  lifecycle?: {
    status?: 'draft' | 'review' | 'approved' | 'active' | 'deprecated' | 'archived';
    approval_required_to_deploy?: boolean;
    approvers?: string[];
    approved_by?: string;
    approved_at?: string;
    review_cycle_days?: number;
    next_review_date?: string;
  };
  compliance?: {
    frameworks?: Array<'SOC2' | 'GDPR' | 'HIPAA' | 'ISO27001' | 'PCI_DSS' | 'CCPA' | 'EU_AI_ACT'>;
    data_processing_basis?: 'legitimate_interest' | 'consent' | 'contract' | 'legal_obligation';
    cross_border_transfer?: boolean;
    human_oversight_required?: boolean;
    human_oversight_justification?: string;
  };
  change_management?: {
    require_pr_review?: boolean;
    min_reviewers?: number;
    auto_rollback_on_error_rate_percent?: number;
    canary_deployment?: {
      enabled?: boolean;
      percent_traffic?: number;
      evaluation_period_minutes?: number;
    };
  };
  audit?: {
    immutable_log?: boolean;
    log_destination?: string;
    log_retention_years?: number;
    include_agent_reasoning?: boolean;
    include_inputs?: boolean;
    include_outputs?: boolean;
    include_tool_calls?: boolean;
    sign_log_entries?: boolean;
  };
  sla?: {
    max_duration_minutes?: number;
    on_breach?: 'notify' | 'escalate' | 'abort';
    escalation_contact?: string;
    p99_target_minutes?: number;
  };
}

// ============================================================================
// Guardrails
// ============================================================================

export interface Guardrail {
  id: string;
  description: string;
  applies_to?: 'all_agents' | 'all_steps' | string[];
  enforcement: 'hard_block' | 'soft_warn';
  type?: 'pii_filter' | 'content_filter' | 'rate_limit' | 'cost_cap' | 'output_validation' | 'custom';
  config?: Record<string, unknown>;
  on_violation?: {
    notify_roles?: string[];
    log_level?: 'debug' | 'info' | 'warn' | 'error' | 'critical';
    abort_process?: boolean;
    custom_handler?: string;
  };
}

// ============================================================================
// Error Handling
// ============================================================================

export interface ErrorHandling {
  default_on_unhandled?: 'escalate_to_human' | 'fail' | 'retry' | 'ignore';
  default_escalation_role?: string;
  handlers?: ErrorHandler[];
}

export interface ErrorHandler {
  id: string;
  name?: string;
  type: 'error_handler' | 'escalation' | 'compensation';
  handles_errors?: string[];
  actions?: ErrorAction[];
}

export interface ErrorAction {
  action: 'log' | 'notify' | 'retry' | 'escalate' | 'abort' | 'compensate' | 'goto_step';
  config?: Record<string, unknown>;
}

// ============================================================================
// Observability
// ============================================================================

export interface Observability {
  logging?: {
    level?: 'step' | 'decision' | 'tool_call' | 'full';
    destination?: 'stdout' | 'datadog' | 'loki' | 'cloudwatch' | 'custom';
    custom_endpoint?: string;
    include_inputs?: boolean;
    include_outputs?: boolean;
    include_reasoning?: boolean;
  };
  metrics?: {
    enabled?: boolean;
    provider?: 'prometheus' | 'datadog' | 'cloudwatch' | 'otlp' | 'custom';
    collect?: Array<
      | 'step_duration'
      | 'agent_confidence_score'
      | 'human_intervention_rate'
      | 'llm_cost_per_run'
      | 'llm_tokens_per_step'
      | 'process_success_rate'
      | 'error_rate'
      | 'retry_rate'
    >;
  };
  tracing?: {
    enabled?: boolean;
    provider?: 'langsmith' | 'langfuse' | 'opentelemetry' | 'datadog_apm' | 'custom';
    sample_rate?: number;
    propagate_context?: boolean;
  };
}
