import type { TransferListItem } from 'node:worker_threads';
import type WorkerRedis from './workers/redis.js';
import type WorkerBrowser from './workers/browser.js';
import type WorkerServer from './workers/server.js';
import type { Remote } from 'comlink';
import type { CacheDeal, CacheNotify, DealGet, KeyOfConfig } from './workers/redis.js';
import type WorkerTelegram from './workers/telegram.js';

import path, { dirname } from 'path';
import { wrap } from 'comlink';
import logger from './utils/logger.js';
import { Worker } from 'node:worker_threads';
import { pollingCurse, pollingDeals, pollingNotify, pollingPanik } from './utils/timer.js';
import { fileURLToPath } from 'node:url';
import { delay, random } from './utils/dateTime.js';
import { sendTgNotify } from './utils/paidMethod.js';

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

type Notify = {
  created_ago: number;
  details: null | { sender: string };
  id: number;
  is_read: boolean;
  type: string;
};

type Message = {
  created_at: string;
  media: null | string;
  message: string;
  receiver: string;
  sender: string;
};

const listDelDeals: string[] = [];

async function updateCurse(redis: Remote<WorkerRedis>, browser: Remote<WorkerBrowser>, telegram: Remote<WorkerTelegram>) {
  const limitLots = (await redis.getConfig('POLLING_CURSE_LIMIT')) as number;
  const evaluteFuncLots = `getLots("[accessKey]", "[authKey]", ${JSON.stringify({ offset: 0, limit: limitLots, page: 1, currency: 'rub', lot_type: 'sell' })})`;
  const lots = (await browser.evalute({ code: evaluteFuncLots })) as Lot[] | null;
  if (!Array.isArray(lots)) return logger.warn(`Не найден список заявок в запросе`);

  const evaluteFuncBrokers = `getBrokers("[accessKey]", "[authKey]", "rub")`;
  const brokers = (await browser.evalute({ code: evaluteFuncBrokers })) as Broker[] | null;
  if (!Array.isArray(brokers)) return logger.warn(`Не найден список брокеров`);

  const market = (symbol: string, broker: string, currency: string, page: number) =>
    `getMarkets("[accessKey]", "[authKey]", ${JSON.stringify({ lot_type: 'sell', symbol, broker, currency, page, limit: 25, offset: 0 })})`;

  const [verif, ignores, minPerc, simpay] = (await redis.getsConfig(['IS_VERIFIED', 'IGNORE_ADS_USER', 'CURSE_DEFAULT_MIN_PERC', 'SIM_PAY_VERIFY'])) as [boolean, string[], number, boolean];
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
      return isIgnore && isVerif && isLimit && isMinCurse;
    });

    if (candidates.length === 0) {
      const nextRate = minPerc + '%';
      const oldRate = lot.rate;
      logger.info(`Заявка ${lot.id} изменение курса (${oldRate}, ${nextRate})`);
      if (await redis.getCandidateIs(lot.id)) {
        logger.log(`Заявка ${lot.id} уже была поставлена в проценты`);
        continue;
      }
      const isSet = await telegram.setCurse(lot.id, nextRate, symbolLot);
      if (isSet) {
        await redis.setCandidateIs(lot.id, true);
        logger.info(`Заявка ${lot.id} курс изменен (${nextRate}), сохранение нового курса`);
      } else logger.warn(`Заявка ${lot.id} не удалось задать курс (${oldRate}, ${nextRate})`);
      logger.log(`Обработка заявки ${lot.id} завершена`);
      continue;
    }

    logger.log(`Найдены конкуренты, производим проверки`);
    for (let indexCandidate = 0; indexCandidate < candidates.length; indexCandidate++) {
      const candidate = candidates[indexCandidate];
      logger.log(`Конкурент ${candidate.id} (${candidate.user.nickname}) записываем курс`);
      const fixPerc = (await redis.getConfig(('CURSE_FIX' + `_${symbolLot.toUpperCase()}`) as KeyOfConfig)) as number;
      const nextRate = candidate.rate + fixPerc;
      const oldRate = lot.rate;
      logger.log(`Конкурент ${candidate.id} (${candidate.user.nickname}) проверка sim pay`);
      const isSimPay = simpay ? await telegram.isSkyPay(candidate.symbol as 'btc' | 'usdt', candidate.user.nickname) : !simpay;
      logger.log(`Конкурент ${candidate.id} (${candidate.user.nickname}) проверка условий (${oldRate !== nextRate}{${oldRate}:${nextRate}}, ${isSimPay})`);
      if (oldRate !== nextRate && isSimPay) {
        logger.info(`Заявка ${lot.id} изменение курса (${oldRate}, ${nextRate})`);
        const isSet = await telegram.setCurse(lot.id, nextRate, symbolLot);
        if (isSet) {
          await redis.setCandidateIs(lot.id, false);
          logger.info(`Заявка ${lot.id} курс изменен (${nextRate}), сохранение нового курса`);
        } else logger.warn(`Заявка ${lot.id} не удалось задать курс (${oldRate}, ${nextRate})`);
        return logger.log(`Обработка заявки ${lot.id} завершена`);
      }

      if (oldRate === nextRate && isSimPay) {
        logger.info(`Конкурент ${candidate.id} (${lot.id}) подходит по условиям и курс уже задан по нему`);
        break;
      }
    }
    logger.log(`Не найдено кандидатов заявки ${lot.id}`);
  }
}

async function getDeals(redis: Remote<WorkerRedis>, browser: Remote<WorkerBrowser>) {
  logger.info(`Получение списка сделок`);
  const params = (symbol: 'btc' | 'usdt', currency: 'rub', offset: number, limit: number) => ({ symbol, currency, offset, limit, lot_type: 'sell' });
  const code = (data: ReturnType<typeof params>) => `getDeals('[accessKey]','[authKey]', ${JSON.stringify(data)})`;

  const btcLimit = await redis.getConfig('POLLING_DEALS_LIMIT_BTC');
  const usdtLimit = await redis.getConfig('POLLING_DEALS_LIMIT_USDT');
  const btcParams = params('btc', 'rub', 0, btcLimit as number);
  const usdtParams = params('usdt', 'rub', 0, usdtLimit as number);

  const btcIs = await redis.getConfig('POLLING_DEALS_BTC');
  let btcDeals = [] as DealGet[];
  if (btcIs) {
    logger.info(`Получение списка с данными ${JSON.stringify(btcParams)}`);
    const btcDealsPre = (await browser.evalute({ code: code(btcParams) })) as DealGet[] | null;
    if (!Array.isArray(btcDealsPre)) return logger.warn(`Запрос на сделки btc не успешный, отмена итерации`);
    btcDeals = btcDealsPre;
    logger.log(`Получено ${btcDeals.length}`);
    const limit = (await redis.getConfig('POLLING_DEALS_LIMIT_BTC')) as number;
    if (btcDeals.length !== limit) {
      logger.warn(`Список btc не равен лимиту (${btcDeals.length}, ${limit})`);
      return;
    }
  }

  const usdtIs = await redis.getConfig('POLLING_DEALS_USDT');
  let usdtDeals = [] as DealGet[];
  if (usdtIs) {
    logger.info(`Получение списка с данными ${JSON.stringify(usdtParams)}`);
    const usdtDealsPre = (await browser.evalute({ code: code(usdtParams) })) as DealGet[] | null;
    if (!Array.isArray(usdtDealsPre)) return logger.warn(`Запрос на сделки usdt не успешный, отмена итерации`);
    usdtDeals = usdtDealsPre;
    logger.log(`Получено ${usdtDeals.length}`);
    const limit = (await redis.getConfig('POLLING_DEALS_LIMIT_USDT')) as number;
    if (usdtDeals.length !== limit) {
      logger.warn(`Список usdt не равен лимиту (${usdtDeals.length}, ${limit})`);
      return;
    }
  }

  const getNewDeals = async (deals: DealGet[]) => {
    const oldDeals = await redis.getCacheDeals();

    const findNewDeals = deals
      .filter((now) => {
        const candidate = oldDeals.find((old) => now.id === old.id);
        const actualState = ['proposed'];
        const isNow = candidate === undefined;
        const isState = actualState.includes(now.state);
        const isNowState = !isNow && now.state !== candidate.state && isState;
        return (isNow && isState) || isNowState;
      })
      .map((now) => ({ id: now.id, state: now.state, symbol: now.symbol.toUpperCase() }));

    return findNewDeals;
  };

  let newDeals = [] as CacheDeal[];
  const allDeals = btcDeals.concat(usdtDeals);
  newDeals = newDeals.concat(await getNewDeals(allDeals));

  logger.info(`Общее количество сделок ${allDeals.length}`);
  logger.info(`Количество новых сделок ${newDeals.length}`);
  logger.log(`Обновление списка в памяти`);
  await redis.setCacheDeal(allDeals);

  if (newDeals.length > 0) logger.log(`Отправляем на панику сделки`);
  for (let indexNewDeal = 0; indexNewDeal < newDeals.length; indexNewDeal++) {
    const deal = newDeals[indexNewDeal];
    redis.setPanikDeal(deal.id, deal.symbol);
  }
}

async function getNotifys(redis: Remote<WorkerRedis>, browser: Remote<WorkerBrowser>) {
  logger.info(`Получение списка уведомлений`);
  const limit = (await redis.getConfig('POLLING_NOTIFY_LIMIT')) as number;
  const evaluteFunc = `getNotify("[accessKey]", "[authKey]", ${limit})`;
  const notifys = (await browser.evalute({ code: evaluteFunc })) as Notify[] | null;
  if (notifys === null) {
    return logger.warn(`Не удалось получить список уведомлений`);
  }
  const oldNotifys = await redis.getCacheNotify();
  const nowNotifys = [] as CacheNotify[];
  for (let indexNotify = 0; indexNotify < notifys.length; indexNotify++) {
    const notify = notifys[indexNotify];
    if (notify.type === 'message') {
      const candidate = oldNotifys.find((old) => old.id === notify.id);
      if (!candidate) nowNotifys.push({ id: notify.id, sender: notify.details?.sender });
    }
  }

  logger.info(`Количество новых уведомлений ${nowNotifys.length} (${oldNotifys.length}, ${notifys.length})`);
  logger.log(`Обновление списка уведомлений`);
  await redis.setCacheNotify(notifys.map((notify) => ({ id: notify.id, sender: notify.details?.sender })));

  const [delayNotify, nickname, tgId, mainPort] = (await redis.getsConfig(['DELAY_NOTIFY', 'PANIK_NICKNAME', 'TG_ID', 'PORT'])) as [number, string, number, number];
  for (let indexNotify = 0; indexNotify < nowNotifys.length; indexNotify++) {
    const notify = nowNotifys[indexNotify];
    if (indexNotify > 0) await delay(delayNotify);
    logger.log({ obj: { ...notify, nickname, tgId, mainPort } }, `Отправляем уведомление о сообщении`);
    if (notify.sender) {
      const evaluteFuncMessages = `getMessages("[accessKey]", "[authKey]", "${notify.sender}")`;
      const messages = (await browser.evalute({ code: evaluteFuncMessages })) as Message[] | null;
      if (!messages || messages.length === 0) return await sendTgNotify(`(sky, ${nickname}) Получено уведомление о сообщении от пользователя ${notify.sender}`, tgId, mainPort);
      if (messages[0].media)
        return await sendTgNotify(
          `(sky, ${nickname}) Получено уведомление о сообщении от пользователя ${notify.sender}, последнее сообщение: ${messages[0].message}, есть изображение: ${messages[0].media}`,
          tgId,
          mainPort,
        );
      return await sendTgNotify(`(sky, ${nickname}) Получено уведомление о сообщении от пользователя ${notify.sender}, последнее сообщение: ${messages[0].message}`, tgId, mainPort);
    } else await sendTgNotify(`(sky, ${nickname}) Получено уведомление о сообщении от пользователя ${notify.sender}`, tgId, mainPort);
  }
}

async function panikDeal(redis: Remote<WorkerRedis>) {
  const deals = await redis.getsPanikDeal();
  if (deals === false) return;
  const [delay, tgId, mainPort, botToken, nickname] = (await redis.getsConfig(['DELAY_PANIK_DEAL', 'TG_ID', 'PORT', 'PANIK_BOT_TOKEN', 'PANIK_NICKNAME'])) as [number, number, number, string, string];
  for (let indexDeal = 0; indexDeal < deals.length; indexDeal++) {
    const deal = deals[indexDeal];
    const listIndexDeal = listDelDeals.findIndex((id) => deal.id === id);
    if (listIndexDeal !== -1) {
      listDelDeals.splice(listIndexDeal, 1);
      await redis.delPanikDeal(deal.id);
      continue;
    }

    const now = Date.now();
    if (now - deal.now > delay) {
      await sendTgNotify(`${nickname} ${deal.symbol} Не получено подтверждение по сделки ${deal.id}`, tgId, mainPort, botToken);
    }
  }
}

const main = () =>
  new Promise<number>(() => {
    // workers
    logger.log(`Запуск потоков`);
    const workerRedis = new Worker(path.resolve(dirname(fileURLToPath(import.meta.url)), './workers/redis.js'));
    const workerBrowser = new Worker(path.resolve(dirname(fileURLToPath(import.meta.url)), './workers/browser.js'));
    const workerServer = new Worker(path.resolve(dirname(fileURLToPath(import.meta.url)), './workers/server.js'));
    const workerTelegram = new Worker(path.resolve(dirname(fileURLToPath(import.meta.url)), './workers/telegram.js'));

    // adapters main
    logger.log(`Создание адаптеров`);
    const workerRedisAdapter = new MessageChannel();
    const workerBrowserAdapter = new MessageChannel();
    const workerServerAdapter = new MessageChannel();
    const workerTelegramAdapter = new MessageChannel();

    // adapters other
    const workerRedisBrowserAdapter = new MessageChannel();
    const workerBrowserRedisAdapter = new MessageChannel();

    const workerRedisServerAdapter = new MessageChannel();
    const workerServerRedisAdapter = new MessageChannel();

    const workerBrowserServerAdapter = new MessageChannel();
    const workerServerBrowserAdapter = new MessageChannel();

    const workerTelegramRedisAdapter = new MessageChannel();

    // connects main
    logger.log(`Подключение адаптеров (основные)`);
    workerRedis.postMessage({ command: 'connect', port: workerRedisAdapter.port2 }, [workerRedisAdapter.port2 as unknown as TransferListItem]);
    workerBrowser.postMessage({ command: 'connect', port: workerBrowserAdapter.port2 }, [workerBrowserAdapter.port2 as unknown as TransferListItem]);
    workerServer.postMessage({ command: 'connect', port: workerServerAdapter.port2 }, [workerServerAdapter.port2 as unknown as TransferListItem]);
    workerTelegram.postMessage({ command: 'connect', port: workerTelegramAdapter.port2 }, [workerTelegramAdapter.port2 as unknown as TransferListItem]);

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

    logger.log(`Подключение адаптеров (telegram - redis)`);
    workerRedis.postMessage({ command: 'connect', port: workerTelegramRedisAdapter.port2 }, [workerTelegramRedisAdapter.port2 as unknown as TransferListItem]);

    // exposes main
    logger.log(`Создание роутеров (основные)`);
    const redis = wrap<WorkerRedis>(workerRedisAdapter.port1);
    const browser = wrap<WorkerBrowser>(workerBrowserAdapter.port1);
    const server = wrap<WorkerServer>(workerServerAdapter.port1);
    const telegram = wrap<WorkerTelegram>(workerTelegramAdapter.port1);

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

    // telegram
    logger.log(`Создание роутеров (telegram - redis)`);
    workerTelegram.postMessage({ command: 'redis', port: workerTelegramRedisAdapter.port1 }, [workerTelegramRedisAdapter.port1 as unknown as TransferListItem]);

    // exit workers
    logger.log(`Создание callback для отключения потоков при выходе процесса`);
    process.on('exit', () => {
      workerBrowser.postMessage({ command: 'exit', code: 1 });
      workerServer.postMessage({ command: 'exit', code: 1 });
      workerRedis.postMessage({ command: 'exit', code: 1 });
      workerTelegram.postMessage({ command: 'exit', code: 1 });
    });

    const next = async () => {
      browser.updateKeys();
      // loggerBrowser.info(`Успешное обновление ключей (первое), старт итераций`);
      Promise.resolve(pollingCurse(redis, updateCurse.bind(null, redis, browser, telegram)));
      Promise.resolve(pollingPanik(redis, panikDeal.bind(null, redis)));
      Promise.resolve(pollingDeals(redis, getDeals.bind(null, redis, browser)));
      Promise.resolve(pollingNotify(redis, getNotifys.bind(null, redis, browser)));
    };

    const headless = process.argv.includes('--headless');
    const initBrowser = () => {
      browser
        .initBrowser(headless)
        .then(async () => {
          await telegram.connect();
        })
        .then(next)
        .catch(() => {
          logger.warn(`Не удалось запустить браузер, попытка запустить`);
          initBrowser();
        });
    };

    // on message server
    workerServer.on('message', (message) => {
      if ('command' in message && message['command'] === 'deal_process') {
        listDelDeals.push(message['id']);
      }
    });

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
