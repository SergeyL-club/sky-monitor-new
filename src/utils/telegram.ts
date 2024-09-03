import type { Remote } from 'comlink';
import type WorkerRedis from '../workers/redis.js';
import type { KeyOfConfig } from '../workers/redis.js';

import { StringSession } from 'telegram/sessions/index.js';
import { Api, TelegramClient } from 'telegram';
import loggerCore from './logger.js';
import { NewMessage } from 'telegram/events/NewMessage.js';
import { LogLevel } from 'telegram/extensions/Logger.js';
import { delay } from './dateTime.js';

class TelegramAPI {
  private queue: (() => Promise<void>)[];
  private workingOnPromise: boolean;
  private static instance: TelegramAPI;
  constructor() {
    this.queue = [];
    this.workingOnPromise = false;
    if (TelegramAPI.instance) return TelegramAPI.instance;
    TelegramAPI.instance = this;
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

  private async generateTelegram(redis: Remote<WorkerRedis>, symbol: 'btc' | 'usdt') {
    const apiId = (await redis.getConfig('TG_ID_API')) as number;
    const apiHash = (await redis.getConfig('TG_HASH_API')) as string;
    const stringSession = await redis.getConfig('TG_SESSION_API' as KeyOfConfig);
    const botName = (await redis.getConfig(('TG_NAME_BOT' + `_${symbol.toUpperCase()}`) as KeyOfConfig)) as string;
    const client = new TelegramClient(new StringSession(String(stringSession)), Number(apiId), apiHash, {
      connectionRetries: 5,
    });
    console.log(apiId, apiHash, stringSession, botName);
    client.setLogLevel(LogLevel.DEBUG);

    try {
      await client.start({
        phoneNumber: async () => '',
        password: async () => '',
        phoneCode: async () => '',
        onError: (err) => loggerCore.error(err),
      });

      return { client, botName };
    } catch (error: unknown) {
      console.error(error);
      throw error;
    }
  }

  setAdsLimit = async (redis: Remote<WorkerRedis>, adsId: string, min: number, max: number, symbol: 'btc' | 'usdt' = 'btc') =>
    new Promise((resolve, reject) => {
      this.add(
        () =>
          new Promise((resolve) => {
            this.generateTelegram(redis, symbol)
              .then(({ client, botName }) => {
                const adsIdPath = `/l${adsId}`;
                try {
                  client.getDialogs().then((dialogs) => {
                    const botDialog = dialogs.find((dialog) => dialog.isUser && dialog.name === botName);
                    if (botDialog?.entity) {
                      const event = new NewMessage();
                      const handler = async (update: Api.UpdateNewMessage) => {
                        const message = update.message as Api.Message;
                        client.removeEventHandler(handler, event);
                        if (message.replyMarkup) {
                          const btnLimit = (message.replyMarkup as Api.ReplyInlineMarkup).rows
                            .find((btnArray) => btnArray.buttons.find((btn) => btn.text.includes('Лимиты')))
                            ?.buttons.find((btn) => btn.text.includes('Лимиты')) as Api.KeyboardButtonCallback;
                          const eventLimit = new NewMessage();
                          const handlerLimit = async (update: Api.UpdateNewMessage) => {
                            const messageLimit = update.message as Api.Message;
                            client.removeEventHandler(handlerLimit, eventLimit);
                            if (messageLimit.text.includes('Введите новые лимиты')) {
                              const eventOk = new NewMessage();
                              const handlerOk = async (update: Api.UpdateNewMessage) => {
                                const messageOk = update.message as Api.Message;
                                client.removeEventHandler(handlerOk, eventOk);
                                if (messageOk.text.includes('Готово') || messageOk.text.includes('Заявка')) {
                                  await client.disconnect();
                                  resolve(true);
                                } else {
                                  await client.disconnect();
                                  resolve(false);
                                }
                              };

                              client.addEventHandler(handlerOk, eventOk);
                              await client.sendMessage(botDialog.entity!, { message: `${min}-${max}` });
                            } else {
                              await client.disconnect();
                              resolve(false);
                            }
                          };

                          client.addEventHandler(handlerLimit, eventLimit);
                          if (!btnLimit) {
                            await client.disconnect();
                            resolve(false);
                          }
                          await client.invoke(
                            new Api.messages.GetBotCallbackAnswer({
                              peer: botDialog.entity,
                              msgId: message.id,
                              data: btnLimit.data,
                            }),
                          );
                        }
                      };
                      client.addEventHandler(handler, event);

                      Promise.resolve(client.sendMessage(botDialog.entity, { message: adsIdPath }));
                    }
                  });
                } catch (error: unknown) {
                  client.disconnect().then(() => reject(error));
                }
              })
              .catch(console.error);
          }),
      )
        .then(resolve)
        .catch(reject);
    });

  setAdsCurse = async (redis: Remote<WorkerRedis>, adsId: string, curse: number | string, symbol: 'btc' | 'usdt' = 'btc') =>
    new Promise<boolean>((resolve, reject) => {
      this.add(
        () =>
          new Promise<boolean>((resolve) => {
            this.generateTelegram(redis, symbol).then(({ client, botName }) => {
              const adsIdPath = `/l${adsId}`;
              try {
                client.getDialogs().then((dialogs) => {
                  const botDialog = dialogs.find((dialog) => dialog.isUser && dialog.name === botName);
                  if (botDialog?.entity) {
                    client.sendMessage(botDialog.entity, { message: adsIdPath }).then(async () => {
                      const delayTg = (await redis.getConfig('TG_DELAY_MESSAGE')) as number;
                      await delay(delayTg);
                      const lastMessagesAds = await client.getMessages(botDialog.entity, { limit: 1 });
                      if (lastMessagesAds.length > 0 && lastMessagesAds[0].text.includes('Заявка')) {
                        const btnLimit = (lastMessagesAds[0].replyMarkup as Api.ReplyInlineMarkup).rows
                          .find((btnArray) => btnArray.buttons.find((btn) => btn.text.includes('Курс')))
                          ?.buttons.find((btn) => btn.text.includes('Курс')) as Api.KeyboardButtonCallback;
                        await client.invoke(
                          new Api.messages.GetBotCallbackAnswer({
                            peer: botDialog.entity,
                            msgId: lastMessagesAds[0].id,
                            data: btnLimit.data,
                          }),
                        );
                        await delay(delayTg);
                        const lastMessagesCurse = await client.getMessages(botDialog.entity, { limit: 1 });
                        if (lastMessagesCurse.length > 0 && lastMessagesCurse[0].text.includes('Введите новый курс')) {
                          await client.sendMessage(botDialog.entity!, { message: `${curse}` });
                          await delay(delayTg);
                          const lastMessagesOk = await client.getMessages(botDialog.entity, { limit: 1 });
                          if (lastMessagesOk.length > 0 && (lastMessagesOk[0].text.includes('Готово') || lastMessagesOk[0].text.includes('Заявка'))) {
                            await client.disconnect();
                            resolve(true);
                          } else {
                            await client.disconnect();
                            resolve(false);
                          }
                        } else {
                          await client.disconnect();
                          resolve(false);
                        }
                      } else {
                        await client.disconnect();
                        resolve(false);
                      }
                    });
                  }
                });
              } catch (error: unknown) {
                client.disconnect().then(() => reject(error));
              }
            });
          }),
      )
        .then(resolve)
        .catch(reject);
    });
}

export default new TelegramAPI();
