import type { Remote } from 'comlink';
import type WorkerRedis from '../workers/redis.js';

import { delay, random } from './dateTime.js';

export function pollingCurse(redis: Remote<WorkerRedis>, callback: () => void | Promise<void>) {
  redis.getConfig('POLLING_CURSE').then((polling) => {
    redis.getConfig('DELAY_CURSE_DEALS').then((delayCycle) => {
      redis.getConfig('DELAY_CURSE_ARAGE_DEALS').then((delayARageCycle) => {
        const start = Date.now();
        const delayCycleDelta = random((delayCycle as number) - (delayARageCycle as number), (delayCycle as number) + (delayARageCycle as number));
        if (polling)
          Promise.resolve(callback()).finally(() => {
            const delta = delayCycleDelta - (Date.now() - start);
            if (delta > 0) delay(delayCycleDelta).finally(() => pollingCurse.call(null, redis, callback));
            else pollingCurse.call(null, redis, callback);
          });
        else delay(delayCycleDelta).finally(() => pollingCurse.call(null, redis, callback));
      });
    });
  });
}
