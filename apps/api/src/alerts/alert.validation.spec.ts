import { BadRequestException } from '@nestjs/common';
import { parseAlert } from './alert.validation';

describe('parseAlert', () => {
  it('accepts just a title and fills in the defaults', () => {
    expect(parseAlert({ title: '  Pool exhausted  ' })).toEqual({
      title: 'Pool exhausted',
      dedupKey: null,
      severity: 'HIGH',
      status: 'TRIGGERED',
      description: null,
      details: null,
    });
  });

  it('reads every field, ignoring the case of severity and status', () => {
    expect(
      parseAlert({
        title: 'Pool exhausted',
        dedup_key: 'db-pool',
        severity: 'Critical',
        status: 'RESOLVED',
        description: '45 of 45 in use',
        details: { host: 'db-1' },
      }),
    ).toEqual({
      title: 'Pool exhausted',
      dedupKey: 'db-pool',
      severity: 'CRITICAL',
      status: 'RESOLVED',
      description: '45 of 45 in use',
      details: { host: 'db-1' },
    });
  });

  it.each<[unknown, string]>([
    [null, 'The request body must be a JSON object'],
    [[], 'The request body must be a JSON object'],
    [{}, 'title is required'],
    [{ title: '   ' }, 'title is required'],
    [{ title: 42 }, 'title must be a string'],
    [{ title: 'x'.repeat(256) }, 'title must be at most 255 characters'],
    [
      { title: 'A', severity: 'urgent' },
      'severity must be critical, high or low',
    ],
    [{ title: 'A', status: 'open' }, 'status must be triggered or resolved'],
    [{ title: 'A', details: 'text' }, 'details must be a JSON object'],
    [{ title: 'A', dedup_key: 7 }, 'dedup_key must be a string'],
  ])('rejects %j', (body, message) => {
    expect(() => parseAlert(body)).toThrow(new BadRequestException(message));
  });
});
