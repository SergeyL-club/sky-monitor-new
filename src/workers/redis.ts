import type { PuppeteerLifeCycleEvent } from 'puppeteer';
// import type WorkerBrowser from './browser.js';
// import type WorkerServer from './server.js';
// import type { Remote } from 'comlink';

import { expose } from 'comlink';
import * as CONFIG from '../config.js';
import { parentPort } from 'node:worker_threads';
import { createClient, RedisClientType } from 'redis';
import { loggerRedis } from '../utils/logger.js';

type ServerCommands = 'server' | 'browser' | 'exit' | 'connect';
export type KeyOfConfig = keyof typeof CONFIG;
export type TypeOfConfig = typeof CONFIG;
export type ValueType = TypeOfConfig[keyof TypeOfConfig];

export type DealGet = {
  amount: number;
  amount_currency: number;
  broker_id: string;
  created_at: string;
  currency: string;
  dispute: boolean;
  id: string;
  is_lot_owner: boolean;
  lot_id: string;
  opponent: string;
  state: string;
  symbol: string;
  type: string;
};

export type CacheDeal = {
  id: string;
  state: string;
  symbol: string;
};

// channels
// let browser: Remote<WorkerBrowser> | null = null;
// let server: Remote<WorkerServer> | null = null;

class WorkerRedis {
  private static instance: WorkerRedis;

  private redis: RedisClientType = createClient({ url: CONFIG['URL_REDIS'], database: CONFIG['DB_REDIS'] });

  constructor() {
    if (WorkerRedis.instance) return WorkerRedis.instance;
    WorkerRedis.instance = this;
  }

  private convertRedisToConfig = <Type extends KeyOfConfig>(data: string, key: Type): TypeOfConfig[Type] => {
    if (typeof CONFIG[key] == 'boolean') return Boolean(Number(data)) as TypeOfConfig[Type];
    if (typeof CONFIG[key] == 'number') return Number(data) as TypeOfConfig[Type];
    if (Array.isArray(CONFIG[key]) || typeof CONFIG[key] == 'object') return JSON.parse(data);
    return data as TypeOfConfig[Type];
  };

  private convertConfigToRedis = (data: ValueType, key: KeyOfConfig): string => {
    if (typeof CONFIG[key] == 'boolean') return String(Number(data));
    if (typeof CONFIG[key] == 'number') return String(data);
    if (Array.isArray(CONFIG[key]) || typeof CONFIG[key] == 'object') return JSON.stringify(data);
    return data as string;
  };

  setConfig = async <Type extends KeyOfConfig>(key: Type, value: TypeOfConfig[Type]) => {
    try {
      const data = this.convertConfigToRedis(value, key);
      await this.redis?.hSet(CONFIG['DATA_PATH_REDIS_CONFIG'], key, data);
      return true;
    } catch {
      return false;
    }
  };

  getConfig = async <Type extends KeyOfConfig>(key: Type): Promise<TypeOfConfig[Type]> => {
    const data = await this.redis?.hGet(CONFIG['DATA_PATH_REDIS_CONFIG'], key);
    if (!data) return CONFIG[key] as TypeOfConfig[Type];
    return this.convertRedisToConfig(data, key) as TypeOfConfig[Type];
  };

  getsConfig = async <Type extends KeyOfConfig>(keys: Type[]): Promise<TypeOfConfig[Type][]> => {
    const datas = [] as TypeOfConfig[Type][];
    for (let indexKey = 0; indexKey < keys.length; indexKey++) {
      const key = keys[indexKey];
      const data = await this.redis?.hGet(CONFIG['DATA_PATH_REDIS_CONFIG'], key);
      if (!data) datas.push(CONFIG[key] as TypeOfConfig[Type]);
      else datas.push(this.convertRedisToConfig(data, key) as TypeOfConfig[Type]);
    }
    return datas;
  };

  setCandidateIs = async (id: number | string, is: boolean) => {
    try {
      const path = (await this.getConfig('DATA_PATH_REDIS_RATES_CACHE')) as string;
      await this.redis.set(`${path}:${id}`, String(Number(is)));
      return true;
    } catch {
      return false;
    }
  };

  getCandidateIs = async (id: number | string) => {
    try {
      const path = (await this.getConfig('DATA_PATH_REDIS_RATES_CACHE')) as string;
      const is = await this.redis.get(`${path}:${id}`);
      return is === null ? false : Boolean(Number(is));
    } catch {
      return false;
    }
  };

  clearCandidateIs = async () => {
    try {
      const path = (await this.getConfig('DATA_PATH_REDIS_RATES_CACHE')) as string;
      const keys = await this.redis.keys(`${path}:*`);
      for (let indexKey = 0; indexKey < keys.length; indexKey++) {
        const key = keys[indexKey];
        await this.redis.del(key);
      }
      return true;
    } catch {
      return false;
    }
  };

  setPanikDeal = async (dealId: string, symbol: string) => {
    try {
      const now = Date.now();
      const path = (await this.getConfig('DATA_PATH_REDIS_PANIK_DEALS')) as string;
      await this.redis.set(`${path}:${dealId}`, JSON.stringify({ id: dealId, now, symbol }));
      return true;
    } catch {
      return false;
    }
  };

  getPanikDeal = async (dealId: string) => {
    try {
      const path = (await this.getConfig('DATA_PATH_REDIS_PANIK_DEALS')) as string;
      const now = await this.redis.get(`${path}:${dealId}`);
      return now ? JSON.parse(now) : false;
    } catch {
      return false;
    }
  };

  getsPanikDeal = async () => {
    try {
      const path = (await this.getConfig('DATA_PATH_REDIS_PANIK_DEALS')) as string;
      const keys = await this.redis.keys(`${path}:*`);
      const deals = [] as { id: string; now: number; symbol: string }[];
      for (let indexDeal = 0; indexDeal < keys.length; indexDeal++) {
        const path = keys[indexDeal];
        const select = path.split(':');
        const now = await this.redis.get(path);
        if (now) deals.push(JSON.parse(now));
      }

      return deals;
    } catch {
      return false;
    }
  };

  setCacheDeal = async (deals: CacheDeal[]) => {
    try {
      const path = (await this.getConfig('DATA_PATH_REDIS_DEALS_CACHE')) as string;
      await this.redis.set(path, JSON.stringify(deals));
      return true;
    } catch {
      return false;
    }
  };

  delPanikDeal = async (dealId: string) => {
    try {
      const path = (await this.getConfig('DATA_PATH_REDIS_PANIK_DEALS')) as string;
      await this.redis.del(`${path}:${dealId}`);
      return true;
    } catch {
      return false;
    }
  };

  getCacheDeals = async (): Promise<CacheDeal[]> => {
    try {
      const path = (await this.getConfig('DATA_PATH_REDIS_DEALS_CACHE')) as string;
      const data = await this.redis.get(path);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  };

  initClient = async () => {
    loggerRedis.log(`Инициализация сокета redis`);
    await this.redis.connect();
    loggerRedis.info(`Инициализация сокета redis успешно`);
  };
}

const worker = new WorkerRedis();

parentPort?.on('message', async (message) => {
  if ('command' in message)
    switch (message.command as ServerCommands) {
      case 'browser':
        // browser = wrap<WorkerBrowser>(message['port']);
        break;
      case 'server':
        // server = wrap<WorkerServer>(message['port']);
        break;
      case 'connect':
        expose(worker, message['port']);
        break;
      case 'exit':
        process.exit(message['code']);
    }
});

export default WorkerRedis;
