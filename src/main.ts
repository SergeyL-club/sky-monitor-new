import type { TransferListItem } from 'node:worker_threads';
import type WorkerRedis from './workers/redis.js';
import type WorkerBrowser from './workers/browser.js';
import type WorkerServer from './workers/server.js';
import type { Remote } from 'comlink';
import type { KeyOfConfig } from './workers/redis.js';

import path, { dirname } from 'path';
import { wrap } from 'comlink';
import logger, { loggerBrowser } from './utils/logger.js';
import { Worker } from 'node:worker_threads';
import { pollingCurse } from './utils/timer.js';
import { fileURLToPath } from 'node:url';
import telegramApi from './utils/telegram.js';
import { delay, random } from './utils/dateTime.js';

type Lot = {
  broker_id: string;
  currency: string;
  details: string;
  id: string;
  is_active: boolean;
  is_active_auto_requisites: boolean;
  limit_from: number;
  limit_to: number;
  rate: number;
  requisites: string;
  symbol: string;
  type: string;
};

type Rate = {
  currency: string;
  rate: number;
  symbol: string;
};

type ElementMarket = {
  broker_id: string;
  currency: string;
  id: string;
  limit_from: number;
  limit_to: number;
  rate: number;
  symbol: string;
  type: string;
  user: {
    deals: string[];
    nickname: string;
    rating: number;
    verified: boolean;
  };
};

type Broker = {
  allow_sky_pay_autotrader: boolean;
  autotrader_name: null | string;
  id: string;
  is_card: boolean;
  logo: string;
  name: string;
};

async function updateCurse(redis: Remote<WorkerRedis>, browser: Remote<WorkerBrowser>) {
  const limitLots = (await redis.getConfig('POLLING_CURSE_LIMIT')) as number;
  const evaluteFuncLots = `getLots("[authKey]", ${JSON.stringify({ offset: 0, limit: limitLots, page: 1, currency: 'rub' })})`;
  const lots = (await browser.evalute({ code: evaluteFuncLots })) as Lot[] | null;
  if (!Array.isArray(lots)) return logger.warn(`Не найден список заявок в запросе`);

  const evaluteFuncBrokers = `getBrokers("[authKey]", "rub")`;
  const brokers = (await browser.evalute({ code: evaluteFuncBrokers })) as Broker[] | null;
  if (!Array.isArray(brokers)) return logger.warn(`Не найден список брокеров`);

  const evaluateFuncRates = `getRates("[authKey]")`;
  const rates = (await browser.evalute({ code: evaluateFuncRates })) as Rate[] | null;
  if (!Array.isArray(rates)) return logger.warn(`Не найден список курсов`);

  const market = (symbol: string, broker: string, currency: string, page: number) =>
    `getMarkets("[authKey]", ${JSON.stringify({ lot_type: 'sell', symbol, broker, currency, page, limit: 25, offset: 0 })})`;

  const [verif, ignores, minPerc] = (await redis.getsConfig(['IS_VERIFIED', 'IGNORE_ADS_USER', 'CURSE_DEFAULT_MIN_PERC'])) as [boolean, string[], number];
  const [delayCurse, aRageDelayCurse] = (await redis.getsConfig(['CURSE_DELAY', 'CURSE_ARAGE_DELAY'])) as [number, number];
  for (let indexLot = 0; indexLot < lots.length; indexLot++) {
    const lot = lots[indexLot];
    if (!lot.is_active) continue;
    if (indexLot > 0) await delay(random(delayCurse - aRageDelayCurse, delayCurse + aRageDelayCurse));
    logger.info(`Заявка ${lot.id}, старт обработки`);
    logger.log(`Заявка ${lot.id}, поиск брокеров`);
    const brokerLot = brokers.find((el) => el.id === lot.broker_id);
    if (!brokerLot) {
      logger.warn(`Заявка ${lot.id} не наден брокер`);
      logger.log(`Обработка заявки ${lot.id} завершена`);
      continue;
    }

    logger.log(`Заявка ${lot.id}, получение списка конкурентов`);
    const markets = (await browser.evalute({ code: market(lot.symbol, brokerLot.name, lot.currency, 1) })) as ElementMarket[] | null;
    if (!Array.isArray(markets)) {
      logger.warn(`Заявка ${lot.id} не удалось получить списки заявок`);
      logger.log(`Обработка заявки ${lot.id} завершена`);
      continue;
    }

    // фильтр кандидатов
    logger.log(`Заявка ${lot.id}, фильтрация конкурентов по параметрам`);
    const symbolLot = lot.symbol === 'usdt' ? 'usdt' : 'btc';
    const minCurse = (await redis.getConfig(('CURSE_MIN' + `_${symbolLot.toUpperCase()}`) as KeyOfConfig)) as number;
    const candidates = markets.filter((el) => {
      const isVerif = el.user.verified ?? !verif;
      const isLimit = el.limit_to >= lot.limit_from;
      const isMinCurse = el.rate >= minCurse;
      const isIgnore = !ignores.find((ignore) => ignore === `/u${el.user.nickname}`);
      console.log(el.user.nickname, isVerif, isLimit, isMinCurse, isIgnore);
      return isIgnore && isVerif && isLimit && isMinCurse;
    });

    if (candidates.length === 0) {
      const rate = rates.find((el) => el.symbol === lot.symbol);
      if (!rate) {
        logger.warn(`Заявка ${lot.id} не найден курс для базовой конфигурации`);
        logger.log(`Обработка заявки ${lot.id} завершена`);
        continue;
      }

      const perc = Math.floor((rate.rate / 100) * minPerc);
      const nextRate = rate.rate + perc;
      const oldRate = lot.rate;
      if (oldRate !== nextRate) {
        logger.info(`Заявка ${lot.id} изменение курса (${oldRate}, ${nextRate})`);
        const isSet = await telegramApi.setAdsCurse(redis, lot.id, nextRate, symbolLot);
        if (isSet) {
          logger.info(`Заявка ${lot.id} курс изменен (${nextRate}), сохранение нового курса`);
        } else logger.warn(`Заявка ${lot.id} не удалось задать курс (${oldRate}, ${nextRate})`);
      }
      logger.log(`Обработка заявки ${lot.id} завершена`);
      continue;
    }

    const candidate = candidates[0];
    const fixPerc = (await redis.getConfig(('CURSE_FIX' + `_${symbolLot.toUpperCase()}`) as KeyOfConfig)) as number;
    const nextRate = candidate.rate + fixPerc;
    const oldRate = lot.rate;
    console.log(nextRate, oldRate);
    if (oldRate !== nextRate) {
      logger.info(`Заявка ${lot.id} изменение курса (${oldRate}, ${nextRate})`);
      const isSet = await telegramApi.setAdsCurse(redis, lot.id, nextRate, symbolLot);
      if (isSet) {
        logger.info(`Заявка ${lot.id} курс изменен (${nextRate}), сохранение нового курса`);
      } else logger.warn(`Заявка ${lot.id} не удалось задать курс (${oldRate}, ${nextRate})`);
    }
    logger.log(`Обработка заявки ${lot.id} завершена`);
  }
}

const main = () =>
  new Promise<number>(() => {
    // workers
    logger.log(`Запуск потоков`);
    const workerRedis = new Worker(path.resolve(dirname(fileURLToPath(import.meta.url)), './workers/redis.js'));
    const workerBrowser = new Worker(path.resolve(dirname(fileURLToPath(import.meta.url)), './workers/browser.js'));
    const workerServer = new Worker(path.resolve(dirname(fileURLToPath(import.meta.url)), './workers/server.js'));

    // adapters main
    logger.log(`Создание адаптеров`);
    const workerRedisAdapter = new MessageChannel();
    const workerBrowserAdapter = new MessageChannel();
    const workerServerAdapter = new MessageChannel();

    // adapters other
    const workerRedisBrowserAdapter = new MessageChannel();
    const workerBrowserRedisAdapter = new MessageChannel();

    const workerRedisServerAdapter = new MessageChannel();
    const workerServerRedisAdapter = new MessageChannel();

    const workerBrowserServerAdapter = new MessageChannel();
    const workerServerBrowserAdapter = new MessageChannel();

    // connects main
    logger.log(`Подключение адаптеров (основные)`);
    workerRedis.postMessage({ command: 'connect', port: workerRedisAdapter.port2 }, [workerRedisAdapter.port2 as unknown as TransferListItem]);
    workerBrowser.postMessage({ command: 'connect', port: workerBrowserAdapter.port2 }, [workerBrowserAdapter.port2 as unknown as TransferListItem]);
    workerServer.postMessage({ command: 'connect', port: workerServerAdapter.port2 }, [workerServerAdapter.port2 as unknown as TransferListItem]);

    // connects other
    logger.log(`Подключение адаптеров (redis - browser)`);
    workerRedis.postMessage({ command: 'connect', port: workerRedisBrowserAdapter.port2 }, [workerRedisBrowserAdapter.port2 as unknown as TransferListItem]);
    workerBrowser.postMessage({ command: 'connect', port: workerBrowserRedisAdapter.port2 }, [workerBrowserRedisAdapter.port2 as unknown as TransferListItem]);

    logger.log(`Подключение адаптеров (redis - server)`);
    workerRedis.postMessage({ command: 'connect', port: workerRedisServerAdapter.port2 }, [workerRedisServerAdapter.port2 as unknown as TransferListItem]);
    workerServer.postMessage({ command: 'connect', port: workerServerRedisAdapter.port2 }, [workerServerRedisAdapter.port2 as unknown as TransferListItem]);

    logger.log(`Подключение адаптеров (server - browser)`);
    workerBrowser.postMessage({ command: 'connect', port: workerBrowserServerAdapter.port2 }, [workerBrowserServerAdapter.port2 as unknown as TransferListItem]);
    workerServer.postMessage({ command: 'connect', port: workerServerBrowserAdapter.port2 }, [workerServerBrowserAdapter.port2 as unknown as TransferListItem]);

    // exposes main
    logger.log(`Создание роутеров (основные)`);
    const redis = wrap<WorkerRedis>(workerRedisAdapter.port1);
    const browser = wrap<WorkerBrowser>(workerBrowserAdapter.port1);
    const server = wrap<WorkerServer>(workerServerAdapter.port1);

    // exposes other
    logger.log(`Создание роутеров (redis - browser)`);
    workerRedis.postMessage({ command: 'browser', port: workerBrowserRedisAdapter.port1 }, [workerBrowserRedisAdapter.port1 as unknown as TransferListItem]);
    workerBrowser.postMessage({ command: 'redis', port: workerRedisBrowserAdapter.port1 }, [workerRedisBrowserAdapter.port1 as unknown as TransferListItem]);

    logger.log(`Создание роутеров (redis - server)`);
    workerRedis.postMessage({ command: 'server', port: workerServerRedisAdapter.port1 }, [workerServerRedisAdapter.port1 as unknown as TransferListItem]);
    workerServer.postMessage({ command: 'redis', port: workerRedisServerAdapter.port1 }, [workerRedisServerAdapter.port1 as unknown as TransferListItem]);

    logger.log(`Создание роутеров (server - browser)`);
    workerBrowser.postMessage({ command: 'server', port: workerServerBrowserAdapter.port1 }, [workerServerBrowserAdapter.port1 as unknown as TransferListItem]);
    workerServer.postMessage({ command: 'borwser', port: workerBrowserServerAdapter.port1 }, [workerBrowserServerAdapter.port1 as unknown as TransferListItem]);

    // exit workers
    logger.log(`Создание callback для отключения потоков при выходе процесса`);
    process.on('exit', () => {
      workerBrowser.postMessage({ command: 'exit', code: 1 });
      workerServer.postMessage({ command: 'exit', code: 1 });
      workerRedis.postMessage({ command: 'exit', code: 1 });
    });

    const next = () => {
      browser.updateKeys().then(() => {
        loggerBrowser.info(`Успешное обновление ключей (первое), старт итераций`);
        pollingCurse(redis, updateCurse.bind(null, redis, browser));
      });
    };

    const headless = process.argv.includes('--headless');
    const initBrowser = () => {
      browser
        .initBrowser(headless)
        .then(next)
        .catch(() => {
          logger.warn(`Не удалось запустить браузер, попытка запустить`);
          initBrowser();
        });
    };

    try {
      redis.initClient().then(() => {
        server.init();
        initBrowser();
      });
    } catch (error: unknown) {
      logger.error(error);
    }
  });

main().catch((error: unknown) => {
  logger.error(error);
  process.exit(1);
});
