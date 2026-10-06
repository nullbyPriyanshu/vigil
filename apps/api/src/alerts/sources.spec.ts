import { SOURCES } from './sources';

describe('SOURCES', () => {
  it('translates a Sentry issue webhook', () => {
    expect(
      SOURCES.sentry({
        action: 'created',
        data: {
          issue: {
            id: '991',
            title: 'TypeError: x is undefined',
            level: 'error',
            culprit: 'checkout.ts',
          },
        },
      }),
    ).toEqual({
      title: 'TypeError: x is undefined',
      dedup_key: 'sentry-991',
      severity: 'high',
      status: 'triggered',
      description: 'checkout.ts',
    });
  });

  it('treats a Sentry "resolved" action as a resolve', () => {
    const alert = SOURCES.sentry({
      action: 'resolved',
      data: { issue: { id: '991', title: 'TypeError', level: 'fatal' } },
    });
    expect(alert).toMatchObject({ status: 'resolved', severity: 'critical' });
  });

  it('translates a Grafana alert group, firing and resolved', () => {
    const body = {
      status: 'firing',
      title: '[FIRING:1] High CPU',
      message: 'CPU above 90% for 5m',
      groupKey: '{}:{alertname="High CPU"}',
      commonLabels: { alertname: 'High CPU', severity: 'critical' },
    };
    expect(SOURCES.grafana(body)).toEqual({
      title: '[FIRING:1] High CPU',
      dedup_key: 'grafana-{}:{alertname="High CPU"}',
      severity: 'critical',
      status: 'triggered',
      description: 'CPU above 90% for 5m',
    });
    expect(SOURCES.grafana({ ...body, status: 'resolved' })).toMatchObject({
      status: 'resolved',
    });
  });

  it('translates UptimeRobot down (1) and up (2)', () => {
    const body = {
      monitorID: 77,
      monitorFriendlyName: 'Website',
      alertType: 1,
      alertDetails: 'Connection timeout',
    };
    expect(SOURCES.uptimerobot(body)).toEqual({
      title: 'Website is down',
      dedup_key: 'uptimerobot-77',
      severity: 'critical',
      status: 'triggered',
      description: 'Connection timeout',
    });
    expect(SOURCES.uptimerobot({ ...body, alertType: '2' })).toMatchObject({
      status: 'resolved',
      dedup_key: 'uptimerobot-77',
    });
  });

  it("returns null for a body that is not that tool's webhook", () => {
    expect(SOURCES.sentry({ hello: 'world' })).toBeNull();
    expect(SOURCES.grafana({ title: 'no status' })).toBeNull();
    expect(SOURCES.uptimerobot({ monitorID: 1 })).toBeNull();
  });
});
