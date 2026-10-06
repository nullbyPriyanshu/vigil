import { BadRequestException } from '@nestjs/common';
import { parseSteps } from './steps.validation';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

const step = (overrides: Record<string, unknown> = {}) => ({
  position: 1,
  delayMinutes: 5,
  targetType: 'USER',
  targetId: ID_A,
  ...overrides,
});

// Runs parseSteps and returns the error message it throws.
const messageFor = (input: unknown) => {
  try {
    parseSteps(input);
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return (error as BadRequestException).message;
  }
  throw new Error('expected parseSteps to throw');
};

describe('parseSteps', () => {
  it('accepts valid steps and returns them in position order', () => {
    const steps = parseSteps([
      step({
        position: 2,
        delayMinutes: 10,
        targetType: 'TEAM',
        targetId: ID_B,
      }),
      step({ position: 1 }),
    ]);

    expect(steps).toEqual([
      { position: 1, delayMinutes: 5, targetType: 'USER', targetId: ID_A },
      { position: 2, delayMinutes: 10, targetType: 'TEAM', targetId: ID_B },
    ]);
  });

  it('drops any extra fields a client sends', () => {
    const [parsed] = parseSteps([step({ id: 'x', hacked: true })]);

    expect(Object.keys(parsed).sort()).toEqual([
      'delayMinutes',
      'position',
      'targetId',
      'targetType',
    ]);
  });

  it.each([[undefined], [null], ['nope'], [[]]])(
    'needs at least one step (%p)',
    (input) => {
      expect(messageFor(input)).toBe('A policy needs at least one step');
    },
  );

  it('limits a policy to 20 steps', () => {
    const many = Array.from({ length: 21 }, (_, i) =>
      step({ position: i + 1 }),
    );

    expect(messageFor(many)).toBe('A policy can have at most 20 steps');
  });

  it.each<[unknown, string]>([
    [0, 'below the minimum'],
    [1441, 'above the maximum'],
    [2.5, 'not a whole number'],
    ['5', 'a string'],
  ])('rejects delayMinutes %p (%s) and names the step', (delayMinutes) => {
    const message = messageFor([step(), step({ position: 2, delayMinutes })]);

    expect(message).toBe(
      'Step 2: delayMinutes must be a whole number from 1 to 1440',
    );
  });

  it('accepts the smallest and largest allowed delay', () => {
    expect(() =>
      parseSteps([
        step({ delayMinutes: 1 }),
        step({ position: 2, delayMinutes: 1440 }),
      ]),
    ).not.toThrow();
  });

  it('rejects an unknown target type', () => {
    expect(messageFor([step({ targetType: 'EVERYONE' })])).toBe(
      'Step 1: targetType must be one of USER, TEAM, SCHEDULE',
    );
  });

  it('rejects a target id that is not an id', () => {
    expect(messageFor([step({ targetId: 'rahul' })])).toBe(
      'Step 1: targetId must be a valid id',
    );
  });

  it('rejects something that is not a step at all', () => {
    expect(messageFor(['step one'])).toBe('Step 1: must be an object');
  });

  it.each([
    [[1, 3], 'a gap'],
    [[1, 1], 'a repeat'],
    [[2, 3], 'not starting at 1'],
  ])('rejects positions %p (%s)', (positions) => {
    const message = messageFor(positions.map((position) => step({ position })));

    expect(message).toContain(
      'Step positions must run from 1 to 2 with no gaps or repeats',
    );
  });
});
