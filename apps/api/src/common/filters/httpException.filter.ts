import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'http';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<Request>();
    const response = host.switchToHttp().getResponse<Response>();

    const header = request.headers['x-correlation-id'];
    const correlationId = typeof header === 'string' ? header : randomUUID();

    let statusCode = 500;
    let error = 'Internal Server Error';
    let message: string | string[] = 'Something went wrong on our side';
    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else {
        extra = body as Record<string, unknown>;
        message = (extra.message as string | string[]) ?? exception.message;
      }
    } else {
      this.logger.error(`${correlationId} ${request.method} ${request.url}`);
      this.logger.error(exception);
    }

    if (statusCode !== 500) {
      error = STATUS_CODES[statusCode] ?? 'Error';
    }

    response.setHeader('x-correlation-id', correlationId);
    response.status(statusCode).json({
      ...extra,
      statusCode,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
      correlationId,
    });
  }
}
