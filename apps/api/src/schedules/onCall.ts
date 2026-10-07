import { DateTime } from 'luxon';

type Rotation = {
  timezone: string;
  rotationType: 'DAILY' | 'WEEKLY';
  startDate: Date;
};

export function getFirstHandoff(
  startDate: string,
  handoffTime: string,
  timezone: string,
  rotationType: 'DAILY' | 'WEEKLY',
  handoffDay: number | null,
) {
  let first = DateTime.fromISO(`${startDate}T${handoffTime}`, {
    zone: timezone,
  });

  if (rotationType === 'WEEKLY') {
    while (first.weekday % 7 !== handoffDay) {
      first = first.plus({ days: 1 });
    }
  }

  return first.toJSDate();
}

export function getShift(rotation: Rotation, at: Date) {
  const first = DateTime.fromJSDate(rotation.startDate, {
    zone: rotation.timezone,
  });
  const now = DateTime.fromJSDate(at, { zone: rotation.timezone });

  if (now < first) {
    return null;
  }

  const unit = rotation.rotationType === 'DAILY' ? 'days' : 'weeks';

  let number = Math.floor(now.diff(first, unit).as(unit));
  while (first.plus({ [unit]: number }) > now) {
    number = number - 1;
  }
  while (first.plus({ [unit]: number + 1 }) <= now) {
    number = number + 1;
  }

  return {
    number,
    start: first.plus({ [unit]: number }).toJSDate(),
    end: first.plus({ [unit]: number + 1 }).toJSDate(),
  };
}
