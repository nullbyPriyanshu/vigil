import { BadRequestException } from '@nestjs/common';
import { AlertStatus, Severity } from 'src/generated/prisma/enums';

// An alert after checking, in the shape the rest of the code uses.
export type AlertInput = {
  title: string;
  dedupKey: string | null;
  severity: Severity;
  status: AlertStatus;
  description: string | null;
  details: Record<string, unknown> | null;
};

const SEVERITIES = ['critical', 'high', 'low'];
const STATUSES = ['triggered', 'resolved'];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Checks the body of POST /alerts and returns a clean AlertInput, or throws
// a 400 that says exactly what's wrong. Only `title` is required.
export function parseAlert(body: unknown): AlertInput {
  if (!isPlainObject(body)) {
    throw new BadRequestException('The request body must be a JSON object');
  }

  // Reads an optional text field, trimmed. Empty counts as not sent.
  const text = (field: string, maxLength: number): string | null => {
    const value = body[field];
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') {
      throw new BadRequestException(`${field} must be a string`);
    }
    const trimmed = value.trim();
    if (trimmed.length > maxLength) {
      throw new BadRequestException(
        `${field} must be at most ${maxLength} characters`,
      );
    }
    return trimmed === '' ? null : trimmed;
  };

  const title = text('title', 255);
  if (!title) {
    throw new BadRequestException('title is required');
  }

  // Missing severity means "high": worth a look, not a full emergency.
  const severity = (text('severity', 20) ?? 'high').toLowerCase();
  if (!SEVERITIES.includes(severity)) {
    throw new BadRequestException('severity must be critical, high or low');
  }

  const status = (text('status', 20) ?? 'triggered').toLowerCase();
  if (!STATUSES.includes(status)) {
    throw new BadRequestException('status must be triggered or resolved');
  }

  const details = body.details;
  if (details !== undefined && details !== null && !isPlainObject(details)) {
    throw new BadRequestException('details must be a JSON object');
  }

  return {
    title,
    dedupKey: text('dedup_key', 255),
    severity: severity.toUpperCase() as Severity,
    status: status.toUpperCase() as AlertStatus,
    description: text('description', 5000),
    details: details ?? null,
  };
}
