import { CreateAlertDto } from './dto/createAlert.dto';

type SentryBody = {
  action?: string;
  data?: {
    issue?: { id?: string; title?: string; level?: string; culprit?: string };
  };
};

type GrafanaBody = {
  status?: string;
  title?: string;
  message?: string;
  groupKey?: string;
  commonLabels?: { severity?: string };
};

type UptimeRobotBody = {
  monitorID?: string | number;
  monitorFriendlyName?: string;
  alertType?: string | number;
  alertDetails?: string;
};

export function fromSentry(body: SentryBody): CreateAlertDto | null {
  const issue = body.data?.issue;
  if (!issue || !issue.id || !issue.title) {
    return null;
  }

  let severity: 'critical' | 'high' | 'low' = 'low';
  if (issue.level === 'fatal') severity = 'critical';
  if (issue.level === 'error') severity = 'high';

  return {
    title: String(issue.title),
    dedup_key: `sentry-${issue.id}`,
    severity,
    status: body.action === 'resolved' ? 'resolved' : 'triggered',
    description: issue.culprit ? String(issue.culprit) : undefined,
  };
}

export function fromGrafana(body: GrafanaBody): CreateAlertDto | null {
  if (!body.status || !body.title || !body.groupKey) {
    return null;
  }

  let severity: 'critical' | 'high' | 'low' = 'high';
  if (body.commonLabels?.severity === 'critical') severity = 'critical';
  if (body.commonLabels?.severity === 'low') severity = 'low';

  return {
    title: String(body.title),
    dedup_key: `grafana-${body.groupKey}`,
    severity,
    status: body.status === 'resolved' ? 'resolved' : 'triggered',
    description: body.message ? String(body.message) : undefined,
  };
}

export function fromUptimeRobot(body: UptimeRobotBody): CreateAlertDto | null {
  if (!body.monitorID || !body.alertType) {
    return null;
  }

  const name = body.monitorFriendlyName ?? 'Monitor';

  return {
    title: `${name} is down`,
    dedup_key: `uptimerobot-${body.monitorID}`,
    severity: 'critical',
    status: String(body.alertType) === '2' ? 'resolved' : 'triggered',
    description: body.alertDetails ? String(body.alertDetails) : undefined,
  };
}
