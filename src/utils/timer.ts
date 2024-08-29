import type { Remote } from 'comlink';
import type WorkerRedis from '../workers/redis.js';

import { delay } from './dateTime.js';

export function pollingCurse(redis: Remote<WorkerRedis>, callback: () => void | Promise<void>) {
  redis.getConfig('POLLING_CURSE').then((polling) => {
    redis.getConfig('DELAY_CURSE_DEALS').then((delayCycle) => {
      const start = Date.now();
      if (polling)
        Promise.resolve(callback()).finally(() => {
          const delta = (delayCycle as number) - (Date.now() - start);
          if (delta > 0) delay(delayCycle as number).finally(() => pollingCurse.call(null, redis, callback));
          else pollingCurse.call(null, redis, callback);
        });
      else delay(delayCycle as number).finally(() => pollingCurse.call(null, redis, callback));
    });
  });
}
