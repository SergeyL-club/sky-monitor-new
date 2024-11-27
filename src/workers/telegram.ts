import type WorkerRedis from './redis.js';
import type { Remote } from 'comlink';
import type { KeyOfConfig } from './redis.js';
import type { Dialog } from 'telegram/tl/custom/dialog.js';

import { expose, wrap } from 'comlink';
import { Api, TelegramClient } from 'telegram';
import { parentPort } from 'node:worker_threads';
import { LogLevel } from 'telegram/extensions/Logger.js';
import { StringSession } from 'telegram/sessions/index.js';
import { loggerTelegram } from '../utils/logger.js';
import { delay } from '../utils/dateTime.js';

type ServerCommands = 'redis' | 'exit' | 'connect';

let redis: Remote<WorkerRedis> | null = null;

class WorkerTelegram {
  private client: TelegramClient | null;
  private botBtcDialog: Dialog | null;
  private botUsdtDialog: Dialog | null;

  private queue: (() => Promise<void>)[];
  private workingOnPromise: boolean;
  private static instance: WorkerTelegram;

  constructor() {
    this.client = null;
    this.botBtcDialog = null;
    this.botUsdtDialog = null;

    this.queue = [];
    this.workingOnPromise = false;
    if (WorkerTelegram.instance) return WorkerTelegram.instance;
    WorkerTelegram.instance = this;
  }

  private add<Type>(task: () => Promise<Type>): Promise<Type> {
    return new Promise<Type>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        }
      });
      this.runNext();
    });
  }

  private async runNext() {
    if (this.workingOnPromise) {
      return;
    }

    const nextTask = this.queue.shift();
    if (!nextTask) {
      return;
    }

    this.workingOnPromise = true;
    try {
      await nextTask();
    } finally {
      this.workingOnPromise = false;
      this.runNext();
    }
  }

  async connect() {
    try {
      if (this.client) this.client.disconnect();
      this.client = null;
      if (!redis) throw new Error('Not redis');
      const apiId = (await redis.getConfig('TG_ID_API')) as number;
      const apiHash = (await redis.getConfig('TG_HASH_API')) as string;
      const stringSession = await redis.getConfig('TG_SESSION_API' as KeyOfConfig);
      const client = new TelegramClient(new StringSession(String(stringSession)), Number(apiId), apiHash, {
        connectionRetries: 5,
      });
      client.setLogLevel(LogLevel.DEBUG);
      this.client = client;
      await client.start({
        phoneNumber: async () => '',
        password: async () => '',
        phoneCode: async () => '',
        onError: (err) => loggerTelegram.error(err),
      });
      await this.getDialogBot('btc');
      await this.getDialogBot('usdt');
      return true;
    } catch (error: unknown) {
      loggerTelegram.error(error);
      return false;
    }
  }

  reconnect = this.connect;

  private async getDialogBot(symbol: 'btc' | 'usdt') {
    try {
      if (symbol === 'btc') this.botBtcDialog = null;
      if (symbol === 'usdt') this.botUsdtDialog = null;

      if (!this.client || !this.client.connected) {
        const is = await this.reconnect();
        if (!is) throw new Error('not client telegram');
      }

      const dialogs = await this.client?.getDialogs();
      if (!dialogs) throw new Error('not dialogs telegram');

      //
      const botName = (await redis!.getConfig(('TG_NAME_BOT' + `_${symbol.toUpperCase()}`) as KeyOfConfig)) as string;
      const botDialog = dialogs.find((dialog) => dialog.isUser && dialog.name === botName);
      if (!botDialog) throw new Error('not bot dialog telegram');

      if (symbol === 'btc') this.botBtcDialog = botDialog;
      if (symbol === 'usdt') this.botUsdtDialog = botDialog;

      return true;
    } catch (error: unknown) {
      loggerTelegram.error(error);
      return false;
    }
  }

  setCurse = async (adsId: string | number, curse: number | string, symbol: 'btc' | 'usdt', maxCnt = 3, cnt = 0) =>
    this.add(
      () =>
        new Promise((resolve, reject) => {
          const adsIdPath = `/l${adsId}`;
          const adsText = 'Заявка';
          const adsCurse = 'Курс';
          const adsNewCurse = 'Введите новый курс';
          const adsCurseFinish = 'Готово';
          const botDialog = symbol === 'btc' ? this.botBtcDialog : this.botUsdtDialog;
          if (!botDialog) resolve(false);
          const entity = botDialog?.entity;
          if (entity && this.client)
            this.client
              .sendMessage(entity, { message: adsIdPath })
              .then(async () => {
                const delayTg = (await redis!.getConfig('TG_DELAY_MESSAGE')) as number;
                await delay(delayTg);
                const lastMessagesAds = await this.client!.getMessages(botDialog.entity, { limit: 1 });
                if (lastMessagesAds.length > 0 && lastMessagesAds[0].text.includes(adsText)) {
                  const btnLimit = (lastMessagesAds[0].replyMarkup as Api.ReplyInlineMarkup).rows
                    .find((btnArray) => btnArray.buttons.find((btn) => btn.text.includes(adsCurse)))
                    ?.buttons.find((btn) => btn.text.includes(adsCurse)) as Api.KeyboardButtonCallback;
                  await this.client!.invoke(
                    new Api.messages.GetBotCallbackAnswer({
                      peer: botDialog.entity,
                      msgId: lastMessagesAds[0].id,
                      data: btnLimit.data,
                    }),
                  );
                  await delay(delayTg);
                  const lastMessagesCurse = await this.client!.getMessages(botDialog.entity, { limit: 1 });
                  if (lastMessagesCurse.length > 0 && lastMessagesCurse[0].text.includes(adsNewCurse)) {
                    await this.client!.sendMessage(botDialog.entity!, { message: `${curse}` });
                    await delay(delayTg);
                    const lastMessagesOk = await this.client!.getMessages(botDialog.entity, { limit: 1 });
                    if (lastMessagesOk.length > 0 && (lastMessagesOk[0].text.includes(adsCurseFinish) || lastMessagesOk[0].text.includes(adsCurse))) {
                      resolve(true);
                    } else {
                      resolve(false);
                    }
                  } else {
                    resolve(false);
                  }
                } else {
                  resolve(false);
                }
              })
              .catch((error: unknown) => reject(error));
          else resolve(false);
        }),
    );
  
  blockUser = async (symbol: 'btc' | 'usdt', nickname: string, maxCnt = 3, cnt = 0) => this.add(
    () =>
      new Promise<boolean>((resolve) => {
        const user = `/u${nickname}`;
        loggerTelegram.log(`Пользователь ${user}`);
        const btnBlockText = 'Заблокировать';
        const isBlockText = 'Разблокировать';
        const botDialog = symbol === 'btc' ? this.botBtcDialog : this.botUsdtDialog;
        loggerTelegram.log(`Символ запроса ${symbol}`)
        if (!botDialog) resolve(false);
        const entity = botDialog?.entity;
        if (entity && this.client) {
          loggerTelegram.log(`Отправляем сообщение`);
          this.client.sendMessage(entity, { message: user }).then(async () => {
            try {
              loggerTelegram.log(`Успешно отправлено`);
              const delayTg = (await redis!.getConfig('TG_DELAY_MESSAGE')) as number;
              await delay(delayTg);
              const lastMessages = await this.client!.getMessages(botDialog.entity, { limit: 1 });
              loggerTelegram.log({ obj: lastMessages });
              if (lastMessages.length > 0) {
                loggerTelegram.log(`Получили сообщение`)
                const btnBlock = (lastMessages[0].replyMarkup as Api.ReplyInlineMarkup).rows
                      .find((btnArray) => btnArray.buttons.find((btn) => btn.text.includes(btnBlockText)))
                      ?.buttons.find((btn) => btn.text.includes(btnBlockText)) as Api.KeyboardButtonCallback;
                await this.client!.invoke(
                  new Api.messages.GetBotCallbackAnswer({
                    peer: botDialog.entity,
                    msgId: lastMessages[0].id,
                    data: btnBlock.data,
                  }),
                );
                loggerTelegram.log({ obj: btnBlock });
                await delay(delayTg);
                const lastMessagesBlock = await this.client!.getMessages(botDialog.entity, { limit: 1 });
                console.log(lastMessagesBlock);
                if (lastMessagesBlock.length > 0) {
                  loggerTelegram.log(`Получили сообщение`)
                  const btnIsBlock = (lastMessagesBlock[0].replyMarkup as Api.ReplyInlineMarkup).rows
                    .find((btnArray) => btnArray.buttons.find((btn) => btn.text.includes(isBlockText)))
                    ?.buttons.find((btn) => btn.text.includes(isBlockText)) as Api.KeyboardButtonCallback | undefined;
                  loggerTelegram.log({ obj: btnIsBlock });
                  if (btnIsBlock) resolve(true);
                  else resolve(false);
                }
              }  
            } catch (error: unknown) {
              console.error(error)
              resolve(false)
            }
          }).catch(console.error)
        }
      })
  )

  isSkyPay = async (symbol: 'btc' | 'usdt', nickname: string, maxCnt = 3, cnt = 0) =>
    this.add(
      () =>
        new Promise<boolean>((resolve) => {
          const isVerif = 'SKY PAY V1: ✅';
          const isNoVerif = 'SKY PAY V1: ❌';
          const user = `/u${nickname}`;
          console.log(user, '\n ---->');
          const botDialog = symbol === 'btc' ? this.botBtcDialog : this.botUsdtDialog;
          if (!botDialog) resolve(false);
          const entity = botDialog?.entity;
          if (entity && this.client)
            this.client.sendMessage(entity, { message: user }).then(async () => {
              console.log(user, '\n ---->');
              const delayTg = (await redis!.getConfig('TG_DELAY_MESSAGE')) as number;
              await delay(delayTg);
              const lastMessagesAds = await this.client!.getMessages(botDialog.entity, { limit: 1 });
              console.log(user, '\n ---->');
              if (lastMessagesAds.length > 0 && lastMessagesAds[0].text.includes(isVerif)) {
                resolve(true);
              } else if (lastMessagesAds.length > 0 && lastMessagesAds[0].text.includes(isNoVerif)) {
                resolve(false);
              } else resolve(false);
            });
          else resolve(false);
        }),
    );
}

const worker = new WorkerTelegram();

parentPort?.on('message', async (message) => {
  if ('command' in message)
    switch (message.command as ServerCommands) {
      case 'redis':
        redis = wrap<WorkerRedis>(message['port']);
        break;
      case 'connect':
        expose(worker, message['port']);
        break;
      case 'exit':
        process.exit(message['code']);
    }
});

export default WorkerTelegram;
