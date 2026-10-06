import { BadRequestException } from '@nestjs/common';

export const TARGET_TYPES = ['USER', 'TEAM', 'SCHEDULE'] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

export type StepInput = {
  position: number;
  delayMinutes: number;
  targetType: TargetType;
  targetId: string;
};

export const MAX_STEPS = 20;
export const MIN_DELAY_MINUTES = 1;
export const MAX_DELAY_MINUTES = 1440; // 24 hours

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Checks the shape of the `steps` a client sent and returns them sorted by
// position. Every problem is reported as "Step N: what's wrong", so the
// person filling in the form knows exactly which row to fix.
//
// This only looks at the steps themselves. Whether each target really
// exists in the organization is checked afterwards, against the database.
export function parseSteps(input: unknown): StepInput[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestException('A policy needs at least one step');
  }
  if (input.length > MAX_STEPS) {
    throw new BadRequestException(
      `A policy can have at most ${MAX_STEPS} steps`,
    );
  }

  const steps = input.map((raw: unknown, index): StepInput => {
    // Until we know the step's own position, name it by where it sits in
    // the list.
    const fail = (problem: string): never => {
      throw new BadRequestException(`Step ${index + 1}: ${problem}`);
    };

    if (typeof raw !== 'object' || raw === null) {
      return fail('must be an object');
    }
    const step = raw as Record<string, unknown>;

    if (!Number.isInteger(step.position) || (step.position as number) < 1) {
      return fail('position must be a whole number starting at 1');
    }
    if (
      !Number.isInteger(step.delayMinutes) ||
      (step.delayMinutes as number) < MIN_DELAY_MINUTES ||
      (step.delayMinutes as number) > MAX_DELAY_MINUTES
    ) {
      return fail(
        `delayMinutes must be a whole number from ${MIN_DELAY_MINUTES} to ${MAX_DELAY_MINUTES}`,
      );
    }
    if (!TARGET_TYPES.includes(step.targetType as TargetType)) {
      return fail(`targetType must be one of ${TARGET_TYPES.join(', ')}`);
    }
    if (typeof step.targetId !== 'string' || !UUID.test(step.targetId)) {
      return fail('targetId must be a valid id');
    }

    return {
      position: step.position as number,
      delayMinutes: step.delayMinutes as number,
      targetType: step.targetType as TargetType,
      targetId: step.targetId,
    };
  });

  // Positions must be exactly 1, 2, 3 ... n: no gaps and no repeats.
  steps.sort((a, b) => a.position - b.position);
  steps.forEach((step, index) => {
    if (step.position !== index + 1) {
      throw new BadRequestException(
        `Step positions must run from 1 to ${steps.length} with no gaps or repeats (found ${steps.map((s) => s.position).join(', ')})`,
      );
    }
  });

  return steps;
}
