import { fromGrafana, fromSentry, fromUptimeRobot } from './sources';

describe('alert sources', () => {
  it('translates a Sentry issue webhook', () => {
    expect(
      fromSentry({
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
    const alert = fromSentry({
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
      groupKey: 'g1',
      commonLabels: { severity: 'critical' },
    };
    expect(fromGrafana(body)).toEqual({
      title: '[FIRING:1] High CPU',
      dedup_key: 'grafana-g1',
      severity: 'critical',
      status: 'triggered',
      description: 'CPU above 90% for 5m',
    });
    expect(fromGrafana({ ...body, status: 'resolved' })).toMatchObject({
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
    expect(fromUptimeRobot(body)).toEqual({
      title: 'Website is down',
      dedup_key: 'uptimerobot-77',
      severity: 'critical',
      status: 'triggered',
      description: 'Connection timeout',
    });
    expect(fromUptimeRobot({ ...body, alertType: '2' })).toMatchObject({
      status: 'resolved',
    });
  });

  it("returns null for a body that is not that tool's webhook", () => {
    expect(fromSentry({})).toBeNull();
    expect(fromGrafana({ title: 'no status' })).toBeNull();
    expect(fromUptimeRobot({ monitorID: 1 })).toBeNull();
  });
});
