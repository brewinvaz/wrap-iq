import { api, ApiError } from '../api-client';
import {
  APIKey,
  APIKeyScope,
  APIKeyUsageStats,
  APIKeyCreateRequest,
  BillingPlan,
  BillingSubscription,
  BillingPaymentMethod,
  BillingUsageMetrics,
} from '../types';

// ---------- snake_case → camelCase mappers ----------

interface ApiKeyRaw {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  revoked_at: string | null;
  usage_count: number;
  full_key?: string;
}

function mapApiKey(raw: ApiKeyRaw): APIKey {
  return {
    id: raw.id,
    name: raw.name,
    keyPrefix: raw.key_prefix,
    scopes: raw.scopes,
    rateLimitPerMinute: raw.rate_limit_per_minute,
    rateLimitPerDay: raw.rate_limit_per_day,
    isActive: raw.is_active,
    lastUsedAt: raw.last_used_at,
    expiresAt: raw.expires_at,
    createdBy: raw.created_by,
    createdAt: raw.created_at,
    revokedAt: raw.revoked_at,
    usageCount: raw.usage_count,
  };
}

function mapUsageStats(raw: {
  total_requests: number;
  requests_today: number;
  avg_response_time: number;
  top_endpoints: { endpoint: string; count: number }[];
}): APIKeyUsageStats {
  return {
    totalRequests: raw.total_requests,
    requestsToday: raw.requests_today,
    avgResponseTime: raw.avg_response_time,
    topEndpoints: raw.top_endpoints,
  };
}

interface SubscriptionRaw {
  id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  trial_end?: string | null;
  plan?: { id: string; name: string; price_cents: number; features: Record<string, unknown>; is_default: boolean } | null;
}

interface PaymentMethodRaw {
  id: string;
  type: string;
  last_four: string;
  brand: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

interface UsageMetricsRaw {
  seats_used: number;
  seats_limit: number;
  storage_used_gb: number;
  storage_limit_gb: number;
  projects_count: number;
}

interface PlanRaw {
  id: string;
  name: string;
  price_cents: number;
  features: Record<string, unknown> | string[];
  is_default: boolean;
}

// ---------- API Key endpoints ----------

export async function fetchApiKeys(): Promise<APIKey[]> {
  const data = await api.get<{ items: ApiKeyRaw[]; total: number }>('/api/api-keys');
  return data.items.map(mapApiKey);
}

export async function fetchScopes(): Promise<APIKeyScope[]> {
  const data = await api.get<{ scopes: APIKeyScope[] }>('/api/api-keys/scopes');
  return data.scopes;
}

export async function createApiKey(
  request: APIKeyCreateRequest,
): Promise<{ key: APIKey; fullKey: string }> {
  const raw = await api.post<ApiKeyRaw & { full_key: string }>('/api/api-keys', {
    name: request.name,
    scopes: request.scopes,
    rate_limit_per_minute: request.rateLimitPerMinute,
    rate_limit_per_day: request.rateLimitPerDay,
    expires_at: request.expiresAt,
  });
  return { key: mapApiKey(raw), fullKey: raw.full_key };
}

export async function revokeApiKey(keyId: string): Promise<void> {
  await api.delete(`/api/api-keys/${keyId}`);
}

export async function rotateApiKey(
  keyId: string,
): Promise<{ key: APIKey; fullKey: string }> {
  const raw = await api.post<ApiKeyRaw & { full_key: string }>(
    `/api/api-keys/${keyId}/rotate`,
  );
  return { key: mapApiKey(raw), fullKey: raw.full_key };
}

export async function fetchApiKeyUsage(keyId: string): Promise<APIKeyUsageStats> {
  const raw = await api.get<{
    total_requests: number;
    requests_today: number;
    avg_response_time: number;
    top_endpoints: { endpoint: string; count: number }[];
  }>(`/api/api-keys/${keyId}/usage`);
  return mapUsageStats(raw);
}

// ---------- Billing / Subscription endpoints ----------

export async function fetchPlans(): Promise<BillingPlan[]> {
  const rawPlans = await api.get<PlanRaw[]>('/api/subscriptions/plans');
  return rawPlans.map((p) => ({
    id: p.id,
    name: p.name,
    priceCents: p.price_cents,
    maxSeats: 0,
    maxStorageGb: 0,
    features: Array.isArray(p.features)
      ? p.features
      : Object.values(p.features).map(String),
    isDefault: p.is_default,
  }));
}

export async function fetchCurrentSubscription(): Promise<BillingSubscription | null> {
  const raw = await api.get<SubscriptionRaw | null>('/api/subscriptions/current');
  if (!raw) return null;
  return {
    id: raw.id,
    planId: raw.plan_id,
    planName: raw.plan?.name ?? '',
    status: raw.status as BillingSubscription['status'],
    currentPeriodStart: raw.current_period_start,
    currentPeriodEnd: raw.current_period_end,
    cancelAtPeriodEnd: raw.cancel_at_period_end,
    trialEnd: raw.trial_end ?? undefined,
  };
}

export async function updateSubscription(planId: string): Promise<BillingSubscription> {
  const raw = await api.post<SubscriptionRaw>('/api/subscriptions', {
    plan_id: planId,
  });
  return {
    id: raw.id,
    planId: raw.plan_id,
    planName: raw.plan?.name ?? '',
    status: raw.status as BillingSubscription['status'],
    currentPeriodStart: raw.current_period_start,
    currentPeriodEnd: raw.current_period_end,
    cancelAtPeriodEnd: raw.cancel_at_period_end,
    trialEnd: raw.trial_end ?? undefined,
  };
}

export async function cancelSubscription(): Promise<BillingSubscription> {
  const raw = await api.post<SubscriptionRaw>('/api/subscriptions/cancel');
  return {
    id: raw.id,
    planId: raw.plan_id,
    planName: raw.plan?.name ?? '',
    status: raw.status as BillingSubscription['status'],
    currentPeriodStart: raw.current_period_start,
    currentPeriodEnd: raw.current_period_end,
    cancelAtPeriodEnd: raw.cancel_at_period_end,
    trialEnd: raw.trial_end ?? undefined,
  };
}

export async function fetchPaymentMethods(): Promise<BillingPaymentMethod[]> {
  const rawMethods = await api.get<PaymentMethodRaw[]>(
    '/api/subscriptions/payment-methods',
  );
  return rawMethods.map((m) => ({
    id: m.id,
    type: m.type as 'card' | 'bank',
    lastFour: m.last_four,
    brand: m.brand,
    expMonth: m.exp_month,
    expYear: m.exp_year,
    isDefault: m.is_default,
  }));
}

export async function setDefaultPaymentMethod(
  pmId: string,
): Promise<BillingPaymentMethod> {
  const raw = await api.put<PaymentMethodRaw>(
    `/api/subscriptions/payment-methods/${pmId}/default`,
  );
  return {
    id: raw.id,
    type: raw.type as 'card' | 'bank',
    lastFour: raw.last_four,
    brand: raw.brand,
    expMonth: raw.exp_month,
    expYear: raw.exp_year,
    isDefault: raw.is_default,
  };
}

export async function removePaymentMethod(pmId: string): Promise<void> {
  await api.delete(`/api/subscriptions/payment-methods/${pmId}`);
}

export async function fetchUsageMetrics(): Promise<BillingUsageMetrics> {
  const raw = await api.get<UsageMetricsRaw>('/api/subscriptions/usage');
  return {
    seatsUsed: raw.seats_used,
    seatsLimit: raw.seats_limit,
    storageUsedGb: raw.storage_used_gb,
    storageLimitGb: raw.storage_limit_gb,
    projectsCount: raw.projects_count,
  };
}

export { ApiError };
