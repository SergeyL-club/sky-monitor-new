import type { Remote } from 'comlink';
import type WorkerRedis from '../workers/redis.js';
import { StringSession } from 'telegram/sessions/index.js';
import { Api, TelegramClient } from 'telegram';
import loggerCore from './logger.js';
import { delay } from './dateTime.js';
import { NewMessage } from 'telegram/events/NewMessage.js';
import { LogLevel } from 'telegram/extensions/Logger.js';

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

  private async generateTelegram(redis: Remote<WorkerRedis>) {
    const apiId = (await redis.getConfig('TG_ID')) as number;
    const apiHash = (await redis.getConfig('TG_HASH_API')) as string;
    const stringSession = await redis.getConfig('TG_SESSION_API');
    const botName = (await redis.getConfig('TG_NAME_BOT')) as string;
    const client = new TelegramClient(new StringSession(String(stringSession)), apiId, apiHash, {
      connectionRetries: 5,
    });
    client.setLogLevel(LogLevel.NONE);

    await client.start({
      phoneNumber: async () => '',
      password: async () => '',
      phoneCode: async () => '',
      onError: (err) => loggerCore.error(err),
    });

    return { client, botName };
  }

  setAdsLimit = async (redis: Remote<WorkerRedis>, adsId: string, min: number, max: number) =>
    new Promise((resolve, reject) => {
      this.add(
        () =>
          new Promise((resolve) => {
            this.generateTelegram(redis).then(({ client, botName }) => {
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
                              if (messageOk.text.includes('Готово')) {
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
            });
          }),
      )
        .then(resolve)
        .catch(reject);
    });

  setAdsCurse = async (redis: Remote<WorkerRedis>, adsId: string, curse: number) =>
    new Promise<boolean>((resolve, reject) => {
      this.add(
        () =>
          new Promise<boolean>((resolve) => {
            this.generateTelegram(redis).then(({ client, botName }) => {
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
                          .find((btnArray) => btnArray.buttons.find((btn) => btn.text.includes('Курс')))
                          ?.buttons.find((btn) => btn.text.includes('Курс')) as Api.KeyboardButtonCallback;
                        const eventLimit = new NewMessage();
                        const handlerLimit = async (update: Api.UpdateNewMessage) => {
                          const messageLimit = update.message as Api.Message;
                          client.removeEventHandler(handlerLimit, eventLimit);
                          if (messageLimit.text.includes('Введите новый курс')) {
                            const eventOk = new NewMessage();
                            const handlerOk = async (update: Api.UpdateNewMessage) => {
                              const messageOk = update.message as Api.Message;
                              client.removeEventHandler(handlerOk, eventOk);
                              if (messageOk.text.includes('Готово')) {
                                await client.disconnect();
                                resolve(true);
                              } else {
                                await client.disconnect();
                                resolve(false);
                              }
                            };

                            client.addEventHandler(handlerOk, eventOk);
                            await client.sendMessage(botDialog.entity!, { message: `${curse}` });
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
            });
          }),
      )
        .then(resolve)
        .catch(reject);
    });
}

export default new TelegramAPI();