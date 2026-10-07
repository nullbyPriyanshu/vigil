import { getFirstHandoff, getShift } from './onCall';

const iso = (date: Date | undefined) => date?.toISOString();

describe('getFirstHandoff', () => {
  it('is the handoff time on the start date, in the schedule timezone', () => {
    const first = getFirstHandoff(
      '2026-01-05',
      '10:00',
      'Asia/Kolkata',
      'DAILY',
      null,
    );
    expect(iso(first)).toBe('2026-01-05T04:30:00.000Z');
  });

  it('keeps the start date when it already falls on the weekly handoff day', () => {
    const first = getFirstHandoff(
      '2026-01-05',
      '10:00',
      'Asia/Kolkata',
      'WEEKLY',
      1,
    );
    expect(iso(first)).toBe('2026-01-05T04:30:00.000Z');
  });

  it('moves forward to the next handoff day for a weekly rotation', () => {
    const first = getFirstHandoff(
      '2026-01-06',
      '10:00',
      'Asia/Kolkata',
      'WEEKLY',
      1,
    );
    expect(iso(first)).toBe('2026-01-12T04:30:00.000Z');
  });

  it('treats 0 as Sunday', () => {
    const first = getFirstHandoff('2026-01-05', '09:00', 'UTC', 'WEEKLY', 0);
    expect(iso(first)).toBe('2026-01-11T09:00:00.000Z');
  });
});

describe('getShift', () => {
  const weekly = {
    timezone: 'Asia/Kolkata',
    rotationType: 'WEEKLY' as const,
    startDate: new Date('2026-01-05T04:30:00.000Z'),
  };

  it('returns null before the rotation starts', () => {
    expect(getShift(weekly, new Date('2026-01-05T04:29:59.000Z'))).toBeNull();
  });

  it('starts shift 0 exactly at the first handoff', () => {
    const shift = getShift(weekly, new Date('2026-01-05T04:30:00.000Z'));
    expect(shift?.number).toBe(0);
    expect(iso(shift?.start)).toBe('2026-01-05T04:30:00.000Z');
    expect(iso(shift?.end)).toBe('2026-01-12T04:30:00.000Z');
  });

  it('is still shift 0 one second before the next handoff, and shift 1 at it', () => {
    expect(getShift(weekly, new Date('2026-01-12T04:29:59.000Z'))?.number).toBe(
      0,
    );
    expect(getShift(weekly, new Date('2026-01-12T04:30:00.000Z'))?.number).toBe(
      1,
    );
  });

  it('counts many weeks ahead', () => {
    const shift = getShift(weekly, new Date('2026-03-18T12:00:00.000Z'));
    expect(shift?.number).toBe(10);
    expect(iso(shift?.start)).toBe('2026-03-16T04:30:00.000Z');
  });

  it('rotates daily', () => {
    const daily = {
      timezone: 'UTC',
      rotationType: 'DAILY' as const,
      startDate: new Date('2026-01-05T09:00:00.000Z'),
    };
    const shift = getShift(daily, new Date('2026-01-08T08:59:00.000Z'));
    expect(shift?.number).toBe(2);
    expect(iso(shift?.start)).toBe('2026-01-07T09:00:00.000Z');
    expect(iso(shift?.end)).toBe('2026-01-08T09:00:00.000Z');
  });

  describe('daylight saving time (America/New_York)', () => {
    const newYork = {
      timezone: 'America/New_York',
      rotationType: 'DAILY' as const,
      startDate: new Date('2026-03-06T14:00:00.000Z'),
    };

    it('keeps the handoff at 09:00 local when clocks go forward (8 Mar 2026)', () => {
      const before = getShift(newYork, new Date('2026-03-07T15:00:00.000Z'));
      expect(iso(before?.start)).toBe('2026-03-07T14:00:00.000Z');
      expect(iso(before?.end)).toBe('2026-03-08T13:00:00.000Z');

      const after = getShift(newYork, new Date('2026-03-08T13:00:00.000Z'));
      expect(after?.number).toBe(2);
      expect(iso(after?.end)).toBe('2026-03-09T13:00:00.000Z');
    });

    it('does not hand off an hour early on the short day', () => {
      const shift = getShift(newYork, new Date('2026-03-08T12:59:59.000Z'));
      expect(shift?.number).toBe(1);
    });

    it('keeps the handoff at 09:00 local when clocks go back (1 Nov 2026)', () => {
      const shift = getShift(newYork, new Date('2026-11-01T14:00:00.000Z'));
      expect(iso(shift?.start)).toBe('2026-11-01T14:00:00.000Z');
      expect(iso(shift?.end)).toBe('2026-11-02T14:00:00.000Z');

      const justBefore = getShift(
        newYork,
        new Date('2026-11-01T13:59:59.000Z'),
      );
      expect(iso(justBefore?.start)).toBe('2026-10-31T13:00:00.000Z');
    });

    it('keeps a weekly handoff at the same local time across the change', () => {
      const weeklyNewYork = {
        timezone: 'America/New_York',
        rotationType: 'WEEKLY' as const,
        startDate: new Date('2026-03-02T14:00:00.000Z'),
      };
      const shift = getShift(
        weeklyNewYork,
        new Date('2026-03-10T00:00:00.000Z'),
      );
      expect(shift?.number).toBe(1);
      expect(iso(shift?.start)).toBe('2026-03-09T13:00:00.000Z');
      expect(iso(shift?.end)).toBe('2026-03-16T13:00:00.000Z');
    });
  });
});
