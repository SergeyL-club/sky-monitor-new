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
