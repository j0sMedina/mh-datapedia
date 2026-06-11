import { AsyncLocalStorage } from 'async_hooks';
import winston from 'winston';

export const requestStore = new AsyncLocalStorage<{ requestId: string }>();

const requestIdFormat = winston.format((info) => {
  const store = requestStore.getStore();
  if (store) info['requestId'] = store.requestId;
  return info;
});

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    requestIdFormat(),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple()),
  ),
  transports: [new winston.transports.Console()],
});
