import { randomUUID } from 'crypto';
import { RequestHandler } from 'express';
import { requestStore } from '../logger';

export const requestId: RequestHandler = (req, _res, next) => {
  const id = (req.headers['x-request-id'] as string) ?? randomUUID();
  req.headers['x-request-id'] = id;
  requestStore.run({ requestId: id }, next);
};
