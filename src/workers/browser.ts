import type { Browser, ElementHandle, Page, PuppeteerLifeCycleEvent } from 'puppeteer';
import type { VanillaPuppeteer } from 'puppeteer-extra';
import type { Remote } from 'comlink';
// import type WorkerServer from './server.js';
import type WorkerRedis from './redis.js';

import stealsPlugin from 'puppeteer-extra-plugin-stealth';
import { delay, random } from '../utils/dateTime.js';
import { loggerBrowser } from '../utils/logger.js';
import { parentPort } from 'node:worker_threads';
import { PuppeteerExtra } from 'puppeteer-extra';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import puppeteer from 'puppeteer';
import { expose, wrap } from 'comlink';
import md5 from 'md5';
import { fileURLToPath } from 'node:url';
import { pollingEvaluteCycle } from '../utils/timer.js';

type ServerCommands = 'server' | 'redis' | 'exit' | 'connect';
type WindowCustom = {
  keysSocketUpdate: (date: string) => void;
};

export type Keys = {
  [key: string]: string;
};

export type Params = {
  headless: boolean;
  args: string[];
  executablePath: string;
  defaultViewport: {
    width: number;
    height: number;
  };
  ignoreDefaultArgs: string[];
  userDataDir: string;
};

export type ProxyData = {
  url: string;
  user: string;
  pass: string;
};

export type InputSet = {
  input: ElementHandle;
  text: string;
  page?: Page;
};

export type DetailsDeal = {
  amount: number;
  amount_currency: number;
  buyer: {
    currency: 'rub' | string;
    deals: {
      amount_currency: number;
      deals: number;
      dislikes: number;
      likes: number;
    };
    nickname: string;
    rating: number;
    verified: boolean;
  };
  lot: {
    id: string;
  };
  buyer_commission: number;
  confirmed_at: string;
  created_at: string;
  deal_id: number;
  dispute: object | null;
  end_time: null;
  id: string;
  rate: number;
  requisite: string;
  state: 'proposed' | 'deleted' | 'paid' | 'closed';
  symbol: 'btc' | 'usdt';
  type: number;
  voted: boolean;
};

type EvaluteCallback = {
  page?: Page;
  code: string;
  cnt: number;
  callback: (data: string | null) => void;
};

// channels
let redis: Remote<WorkerRedis> | null = null;
// let server: Remote<WorkerServer> | null = null;

class WorkerBrowser {
  private static instance: WorkerBrowser;

  // init data
  private proxyParams: ProxyData | string;

  // local params
  private isReAuth: boolean;
  private access: string;
  private refresh: string;

  // browser data
  private keys: Keys;
  private authKey: string;
  private page: Page | null;
  private browser: Browser | null;
  private isCodeUpdate: boolean;
  private evaluteRows: EvaluteCallback[];

  constructor() {
    this.proxyParams = '';
    this.isReAuth = false;
    this, (this.isCodeUpdate = false);
    this.browser = null;
    this.page = null;
    this.authKey = '';
    this.access = '';
    this.refresh = '';
    this.evaluteRows = [];
    this.keys = {};
    if (WorkerBrowser.instance) return WorkerBrowser.instance;
    WorkerBrowser.instance = this;
  }

  loop = () => {
    loggerBrowser.log('loop browser worker');
  };

  generateAuthKey = (keys?: Keys) => {
    const localKeys = keys ?? this.keys;
    const t = 'e' === localKeys['aKM'];
    let r = Object.keys(localKeys).sort();
    if (t) r = r.reverse();
    const o =
      r
        .map(function (t) {
          return localKeys[t];
        })
        .join('') + 'l';
    return md5(o);
  };

  initProxy = (proxy: string = '') => {
    if (proxy != '') {
      const info = new URL(proxy);
      this.proxyParams = {
        url: info.origin,
        user: info.username,
        pass: info.password,
      };
    }
  };

  initParams = (headless: boolean = false) => {
    const params = {} as Params;
    params['headless'] = headless;
    params['args'] = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--no-default-browser-check',
      ...(this.proxyParams && [`--proxy-server=${(<ProxyData>this.proxyParams).url}`]),
    ];
    params['defaultViewport'] = { width: 1100, height: 600 };
    params['ignoreDefaultArgs'] = ['--enable-automation'];
    params['userDataDir'] = `./user_data`;
    return params;
  };

  incPage = async (page: Page, url: string) => {
    loggerBrowser.info('Установка конфигурации страницы', `(${url})`);
    await page.setBypassCSP(true);
    if (typeof this.proxyParams != 'string')
      await page.authenticate({
        username: this.proxyParams.user,
        password: this.proxyParams.pass,
      });

    await page.evaluateOnNewDocument(`
			navigator.webkitGetUserMedia =
			navigator.mozGetUserMedia =
			navigator.getUserMedia =
			webkitRTCPeerConnection =
			RTCPeerConnection =
			MediaStreamTrack = undefined;
			if (navigator.mediaDevices)
				navigator.mediaDevices.getUserMedia = undefined;`);
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36');
  };

  injectStatic = async (page: Page) => {
    const isInject = await page.evaluate(() => (window as unknown as { inject: boolean | undefined })['inject']);
    const files: string[] = readdirSync(resolve(dirname(fileURLToPath(import.meta.url)), `../../statics`));

    if (!isInject) {
      for (let index = 0; index < files.length; index++) {
        const fileName = files[index];
        await page.addScriptTag({ path: resolve(dirname(fileURLToPath(import.meta.url)), `../../statics/${fileName}`) });
      }
    }
    await page.evaluate(() => {
      (window as unknown as { inject: boolean })['inject'] = true;
    });
  };

  initPage = async (url: string) => {
    let page: Page | null = null;
    if (!this.browser) {
      loggerBrowser.warn('При создание page необходим browser, но он является null');
      return null;
    }
    page = await this.browser.newPage();
    await this.incPage(page, url);
    await this.reload(url, page);
    return page;
  };

  setPageDefault = async () => {
    // set page deals
    loggerBrowser.info(`Создание основной страницы`);
    const url = (await redis!.getConfig('URL_MAIN')) as string;
    const page = await this.initPage(url);
    if (!page) {
      loggerBrowser.error(new Error('Ошибка создания page'), 'Не удалось создать page deals');
      return false;
    }

    // close 0 page
    if (this.browser) {
      loggerBrowser.log('Удаляем ненужную страницу');
      const pagesNull = await this.browser.pages();
      if (pagesNull.length > 1) await pagesNull[0].close();
    }
    this.page = null;

    // check auth
    if (!(await this.authEvalute(page))) {
      loggerBrowser.error(new Error('Ошибка авторизации'), 'Не удалось авторизоваться');
      return false;
    }

    // save page
    loggerBrowser.log('Сохранияем адрес ссылки на сделки');
    this.page = page;

    return page;
  };

  authEvalute = async (page?: Page) => {
    this.isReAuth = true;
    try {
      const [email, password] = (await redis!.getsConfig(['EMAIL', 'PASSWORD'])) as [string, string];
      const evaluateAuthFunc = `authPost("${email}", "${password}")`;
      const { access, refresh } = (await this.evalute({ code: evaluateAuthFunc, page })) as { access: string; refresh: string };
      this.access = access;
      this.refresh = refresh;
      this.isReAuth = false;
      return true;
    } catch (error: unknown) {
      loggerBrowser.error(error);
      this.isReAuth = false;
      return false;
    }
  };

  authRefreshEvalute = async (page?: Page) => {
    this.isReAuth = true;
    try {
      const evaluateAuthRefreshFunc = `refresh("[refreshKey]", "[authKey]")`;
      const { access, refresh } = (await this.evalute({ code: evaluateAuthRefreshFunc, page })) as { access: string; refresh: string };
      this.access = access;
      this.refresh = refresh;
      this.isReAuth = false;
      return true;
    } catch (error: unknown) {
      loggerBrowser.error(error);
      this.isReAuth = false;
      return false;
    }
  };

  updateKeysCode = async (page?: Page) => {
    this.isCodeUpdate = true;
    try {
      const evaluateAuthRefreshFunc = `getCodeData("[accessKey]", "[authKey]")`;
      const code = (await this.evalute({ code: evaluateAuthRefreshFunc, page })) as { [key: string]: string };
      this.keys = code;
      this.authKey = this.generateAuthKey();
      this.isCodeUpdate = false;
      return true;
    } catch (error: unknown) {
      loggerBrowser.error(error);
      this.isCodeUpdate = false;
      return false;
    }
  };

  initBrowser = async (headless?: boolean) => {
    try {
      loggerBrowser.info('Установка конфигурации браузера');
      const params = this.initParams(headless);

      // close old browser
      if (this.browser) await this.browser.close();
      const puppeteerExtra = new PuppeteerExtra(puppeteer as unknown as VanillaPuppeteer);
      puppeteerExtra.use(stealsPlugin());

      loggerBrowser.info(`Создание браузера`);
      this.browser = await puppeteerExtra.launch(params);

      // set page
      pollingEvaluteCycle(this.evaluteCycleRow.bind(this));
      await this.setPageDefault();

      // end
      loggerBrowser.info('Установка базовой конфигурации завершена');
      return true;
    } catch (error: unknown) {
      loggerBrowser.error(error, 'Ошибка без обработки (init browser)');
      return false;
    }
  };

  private evaluteCycleRow = async () => {
    if (this.evaluteRows.length > 0) {
      const dataIndex = this.evaluteRows.findIndex((el) => el.code.includes('refresh') || el.code.includes('getCodeData') || el.code.includes('authPost'));
      let data = undefined as EvaluteCallback | undefined;
      if (dataIndex !== -1) {
        data = this.evaluteRows[dataIndex];
        this.evaluteRows.splice(dataIndex, 1);
      } else data = this.evaluteRows.shift();
      if (!data) return;
      this.evaluteFunc({ page: data.page, code: data.code }, data.cnt)
        .then((value) => {
          data.callback(value as string | null);
        })
        .catch(() => data.callback(null));
    }
  };

  waitReAuth = (): Promise<boolean> =>
    new Promise((res) => {
      let cnt = 0;
      let isDelay = false;

      while (cnt < 250) {
        isDelay = true;
        delay(100).then(() => (isDelay = false));
        if (!this.isReAuth) {
          res(true);
          return;
        }
        if (!isDelay) cnt++;
      }
      res(false);
    });

  waitReCode = (): Promise<boolean> =>
    new Promise((res) => {
      let cnt = 0;
      let isDelay = false;

      while (cnt < 250) {
        isDelay = true;
        delay(100).then(() => (isDelay = false));
        if (!this.isCodeUpdate) {
          res(true);
          return;
        }
        if (!isDelay) cnt++;
      }
      res(false);
    });

  reload = async (url: string, page: Page, count = 1): Promise<void> => {
    try {
      await this.goto(page, 'about:blank');
      await this.goto(page, url);
    } catch (error: unknown) {
      if (count < 4) {
        loggerBrowser.warn({ err: error }, `Не удачная перезагрузка страницы (reload)`);
        return await this.reload(url, page, count + 1);
      }
      loggerBrowser.error(error, 'Окончательная ошибка перезагрузки страницы (reload)');
    }
  };

  goto = async (page: Page, url: string) => {
    const [timeout, unitl] = (await redis?.getsConfig(['WAIT_TIMEOUT', 'WAIT_UNTIL'])) as [number, PuppeteerLifeCycleEvent];
    await page.goto(url, { timeout, waitUntil: unitl });
  };

  inputSet = async ({ input, page, text }: InputSet) => {
    try {
      input.focus();
      if (page) {
        await input.click({ clickCount: 3, delay: random(50, 100) });
        await delay(random(150, 200));
        await page.keyboard.press('Backspace');
      }

      if (text.length <= 25) await input.type(text, { delay: random(100, 150) });
      else await input.type(text);

      loggerBrowser.log(`Запись в input завершёна, text: ${text}`);
      return true;
    } catch (error: unknown) {
      loggerBrowser.warn({ err: error }, 'Ошибка при печати input');
      return false;
    }
  };

  closeBrowser = async () => {
    await this.browser?.close();
  };

  updateKeys = async (page?: Page) =>
    new Promise((resolve) => {
      loggerBrowser.log('Запуск сокета для обновления keys и auth key');
      const localPage = page ?? this.page;
      if (!localPage) {
        loggerBrowser.warn('Не удалось запустить socket для обновления keys (auth key), т.к. нету page');
        return;
      }

      this.injectStatic(localPage).then(() => {
        let first = true;
        localPage
          .exposeFunction('keysSocketUpdate', (data: string) => {
            this.keys = JSON.parse(data);
            loggerBrowser.log(`Обновление keys: ${data}`);
            this.authKey = this.generateAuthKey();
            loggerBrowser.log(`Обновление authKeys: ${this.authKey}`);
            if (first) {
              first = false;
              resolve(true);
            }
          })
          .then(() => {
            localPage.evaluate(() => {
              const socket = io('wss://ws.skycrypto.net', {
                transports: ['websocket'],
                path: '/sky-socket',
              });

              socket.on('update codedata', (data: string) => {
                (window as unknown as WindowCustom).keysSocketUpdate(data);
              });

              socket.on('connect', () => {
                socket.emit('2probe');
              });
            });
          });
      });
    });

  private evaluteFunc = async <Type>({ page, code }: { page?: Page; code: string }, cnt = 0): Promise<Type | null> => {
    const [maxCnt, delayCnt] = (await redis?.getsConfig(['CNT_EVALUTE', 'DELAY_CNT'])) as [number, number];
    loggerBrowser.log(`Запрос на browser, код: ${code}`);

    // проверка регулярок
    let localCode = `${code}`;
    loggerBrowser.log('Поиск регулярок и их замена');
    if (localCode.includes('[authKey]')) localCode = localCode.split('[authKey]').join(`${this.authKey}`);
    if (localCode.includes('[refreshKey]')) localCode = localCode.split('[refreshKey]').join(`${this.refresh}`);
    if (localCode.includes('[accessKey]')) localCode = localCode.split('[accessKey]').join(`${this.access}`);

    try {
      // проверяем page
      const localPage = page ?? this.page;
      await this.injectStatic(localPage as Page);
      if (!localPage) {
        loggerBrowser.warn('Не удалось сделать запрос, т.к. отсутсвует page');
        throw new Error('401, Unauthorized, page null');
      }

      // делаем запрос и отдаем ответ
      loggerBrowser.log(`Производим запрос (${localCode})`);
      const result = await localPage.evaluate(localCode);

      loggerBrowser.log('Запрос прошёл успешно, отправляем ответ');
      return result as Type;
    } catch (error: unknown) {
      loggerBrowser.error(error);
      if (cnt < maxCnt) {
        loggerBrowser.warn(`Ошибка запроса (${localCode}), повторная попытка (${cnt + 1})`);
        if (String(error).includes('401') && !this.isReAuth) {
          if (!(await this.authRefreshEvalute())) await this.authEvalute();
          return await this.evalute<Type>({ page, code }, cnt + 1);
        }

        if (String(error).includes('412') && !this.isCodeUpdate) {
          await this.updateKeysCode();
          return await this.evalute<Type>({ page, code }, cnt + 1);
        }

        // if (!code.includes('getCodeData')) await this.waitReCode();
        // if (!code.includes('refresh') || !code.includes('authPost')) await this.waitReAuth();
        await delay(delayCnt);
        return await this.evalute<Type>({ page, code }, cnt + 1);
      }
      return null;
    }
  };

  evalute = <Type>({ page, code }: { page?: Page; code: string }, cnt = 0): Promise<Type | null> => {
    return new Promise<Type>((resolve) => {
      this.evaluteRows.push({
        cnt,
        code,
        page,
        callback: (data) => resolve(data as Type),
      });
    });
  };
}

const worker = new WorkerBrowser();

parentPort?.on('message', async (message) => {
  if ('command' in message)
    switch (message.command as ServerCommands) {
      case 'redis':
        redis = wrap<WorkerRedis>(message['port']);
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

export default WorkerBrowser;
