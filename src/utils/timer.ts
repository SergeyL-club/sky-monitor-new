import type { Remote } from 'comlink';
import type WorkerRedis from '../workers/redis.js';

import { delay } from './dateTime.js';

export function pollingDeals(redis: Remote<WorkerRedis>, callback: () => void | Promise<void>) {
  redis.getConfig('POLLING_DEALS').then((polling) => {
    redis.getConfig('DELAY_POLLING_DEALS').then((delayCycle) => {
      const start = Date.now();
      if (polling)
        Promise.resolve(callback()).finally(() => {
          const delta = (delayCycle as number) - (Date.now() - start);
          if (delta > 0) delay(delayCycle as number).finally(() => pollingDeals.call(null, redis, callback));
          else pollingDeals.call(null, redis, callback);
        });
      else delay(delayCycle as number).finally(() => pollingDeals.call(null, redis, callback));
    });
  });
}

export function pollingPhone(redis: Remote<WorkerRedis>, callback: () => void | Promise<void>) {
  redis.getConfig('TIMER_PHONE').then((polling) => {
    redis.getConfig('DELAY_TIMER_PHONE').then((delayCycle) => {
      const start = Date.now();
      if (polling)
        Promise.resolve(callback()).finally(() => {
          const delta = (delayCycle as number) - (Date.now() - start);
          if (delta > 0) delay(delayCycle as number).finally(() => pollingPhone.call(null, redis, callback));
          else pollingPhone.call(null, redis, callback);
        });
      else delay(delayCycle as number).finally(() => pollingPhone.call(null, redis, callback));
    });
  });
}
