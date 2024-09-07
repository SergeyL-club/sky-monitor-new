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

export function pollingPanik(redis: Remote<WorkerRedis>, callback: () => void | Promise<void>) {
  redis.getConfig('PANIK_DEALS').then((polling) => {
    redis.getConfig('DELAY_PANIK_DEALS_TIMER').then((delayCycle) => {
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

export function pollingNotify(redis: Remote<WorkerRedis>, callback: () => void | Promise<void>) {
  redis.getConfig('POLLING_NOTIFY').then((polling) => {
    redis.getConfig('DELAY_POLLING_NOTIFY').then((delayCycle) => {
      const start = Date.now();
      if (polling)
        Promise.resolve(callback()).finally(() => {
          const delta = (delayCycle as number) - (Date.now() - start);
          if (delta > 0) delay(delayCycle as number).finally(() => pollingNotify.call(null, redis, callback));
          else pollingNotify.call(null, redis, callback);
        });
      else delay(delayCycle as number).finally(() => pollingNotify.call(null, redis, callback));
    });
  });
}

export function pollingEvaluteCycle(callback: () => void | Promise<void>) {
  Promise.resolve(callback()).finally(() => {
    delay(250).finally(() => pollingEvaluteCycle.call(null, callback));
  });
}
