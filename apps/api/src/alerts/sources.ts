// Turns the webhook body of another tool into the body POST /alerts
// expects ({ title, dedup_key, severity, status, description }). After that
// it goes through exactly the same checks and steps as any other alert.
//
// Each function returns null when the body doesn't look like that tool's
// webhook at all.

type Body = Record<string, unknown>;
type AlertBody = {
  title: string;
  dedup_key: string;
  severity: 'critical' | 'high' | 'low';
  status: 'triggered' | 'resolved';
  description?: string;
};

const asObject = (value: unknown): Body | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Body)
    : null;

// Text or a number as text; anything else is treated as missing.
const asText = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (typeof value === 'number') return String(value);
  return undefined;
};

// Sentry sends { action, data: { issue } } or { action, data: { event } }.
// One Sentry issue = one incident.
function fromSentry(body: Body): AlertBody | null {
  const data = asObject(body.data);
  const item = asObject(data?.issue) ?? asObject(data?.event);
  if (!item) return null;

  const title = asText(item.title) ?? asText(item.message);
  const id = asText(item.issue_id) ?? asText(item.id);
  if (!title || !id) return null;

  const level = asText(item.level);
  return {
    title,
    dedup_key: `sentry-${id}`,
    severity:
      level === 'fatal' ? 'critical' : level === 'error' ? 'high' : 'low',
    status: body.action === 'resolved' ? 'resolved' : 'triggered',
    description: asText(item.culprit) ?? asText(item.web_url),
  };
}

// Grafana sends one message per alert group:
// { status: "firing" | "resolved", title, message, groupKey, commonLabels }.
function fromGrafana(body: Body): AlertBody | null {
  const labels = asObject(body.commonLabels) ?? {};
  const title = asText(body.title) ?? asText(labels.alertname);
  const groupKey = asText(body.groupKey) ?? asText(labels.alertname);
  if (!title || !groupKey || !asText(body.status)) return null;

  const severity = asText(labels.severity)?.toLowerCase();
  return {
    title,
    dedup_key: `grafana-${groupKey}`,
    severity:
      severity === 'critical'
        ? 'critical'
        : severity === 'low'
          ? 'low'
          : 'high',
    status: body.status === 'resolved' ? 'resolved' : 'triggered',
    description: asText(body.message),
  };
}

// UptimeRobot sends { monitorID, monitorFriendlyName, monitorURL,
// alertType, alertDetails }. alertType 1 = down, 2 = back up.
function fromUptimeRobot(body: Body): AlertBody | null {
  const monitorId = asText(body.monitorID);
  const alertType = asText(body.alertType);
  if (!monitorId || !alertType) return null;

  const name =
    asText(body.monitorFriendlyName) ?? asText(body.monitorURL) ?? 'Monitor';
  return {
    title: `${name} is down`,
    dedup_key: `uptimerobot-${monitorId}`,
    severity: 'critical',
    status: alertType === '2' ? 'resolved' : 'triggered',
    description: asText(body.alertDetails) ?? asText(body.monitorURL),
  };
}

export const SOURCES: Record<string, (body: Body) => AlertBody | null> = {
  sentry: fromSentry,
  grafana: fromGrafana,
  uptimerobot: fromUptimeRobot,
};
