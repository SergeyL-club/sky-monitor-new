import path, { dirname } from 'path';
import { DestinationStream, MultiStreamOptions, pino, StreamEntry } from 'pino';
import { getDate } from './dateTime.js';
import { closeSync, existsSync, mkdirSync, openSync, writeSync } from 'fs';
import { threadId } from 'worker_threads';
import { fileURLToPath } from 'url';

const customLevels = {
  log: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export const reversCustomLevels = ['log', 'info', 'warn', 'error'];

const ColorsStart = {
  log: '\x1b[0m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};

const ColorsStartHtml = {
  log: '<span style="color: #fff">',
  info: '<span style="color: #56ff00">',
  warn: '<span style="color: #ffeb00">',
  error: '<span style="color: #f00">',
};

export type Levels = keyof typeof customLevels;

export const renderTextLine = <T extends string>(msg: T, level: Levels, html = false) => {
  const data = typeof msg === 'string' ? JSON.parse(msg) : msg;
  if (data.msg) data.msg = data.msg.split('�').join('');
  const colorStart = html ? ColorsStartHtml[level] : ColorsStart[level];
  const colorEnd = html ? '</span>' : ColorsStart['log'];
  let text = html ? '<pre style="margin: 0; padding: 0">' + ColorsStartHtml['log'] : '';
  text += `(${getDate({ isMore: 'format', actualDate: data['time'] })}) `;
  text += `[PID: ${threadId}, `;
  text += data['channel'] ? `CHANNEL: ${data['channel']}, ` : '';
  text += `${colorStart}${level.toUpperCase()}${colorEnd}]: `;

  text += `${data.msg}`;
  if ('err' in data) {
    text += `\n${colorStart}Message${colorEnd}: ${data['err']['message']}`;
    if ('stack' in data['err']) {
      let stack = data['err']['stack'];
      stack = stack.split('\n');
      if (stack[0].includes('Error:')) stack.shift();
      stack = stack.join('\n');
      text += '\n' + stack;
    }
  }

  if ('obj' in data) {
    text += `\n${colorStart}Object${colorEnd}: `;
    text += `${JSON.stringify(data['obj'], null, 1)}`;
  }

  if (!html) text += '\n';
  if (html) text += '</pre></span>';
  return text;
};

const destinationStreamFile = (level: string): DestinationStream => ({
  write: (msg) => {
    const data = JSON.parse(msg);
    const dirPathLogs = path.resolve(dirname(fileURLToPath(import.meta.url)), `../../logs`);
    const dirPath = path.resolve(dirname(fileURLToPath(import.meta.url)), `../../logs/${getDate({ isMore: 'formatDate', actualDate: data['time'] })}`);
    if (!existsSync(dirPathLogs)) mkdirSync(dirPathLogs);
    if (!existsSync(dirPath)) mkdirSync(dirPath);
    const filePath = `${dirPath}/[${getDate({ isMore: 'formatDate', actualDate: data['time'] })}]${level}.log`;

    const fd = openSync(filePath, 'a');
    writeSync(fd, `$$$` + msg, null, 'utf-8');
    closeSync(fd);
  },
});

const destinationStreamConsole = (level: Levels): DestinationStream => ({
  write: (msg) => {
    process.stdout.write(renderTextLine(msg, level));
  },
});

const steams: StreamEntry<Levels>[] = [
  { level: 'log', stream: destinationStreamFile('console_all') },
  { level: 'info', stream: destinationStreamFile('console_all') },
  { level: 'warn', stream: destinationStreamFile('console_all') },
  { level: 'error', stream: destinationStreamFile('console_all') },
  { level: 'log', stream: destinationStreamFile('console_log') },
  { level: 'info', stream: destinationStreamFile('console_info') },
  { level: 'warn', stream: destinationStreamFile('console_warn') },
  { level: 'error', stream: destinationStreamFile('console_error') },
  { level: 'log', stream: destinationStreamConsole('log') },
  { level: 'info', stream: destinationStreamConsole('info') },
  { level: 'warn', stream: destinationStreamConsole('warn') },
  { level: 'error', stream: destinationStreamConsole('error') },
];

const multistreamOpts: MultiStreamOptions = {
  dedupe: true,
  levels: customLevels,
};

const logger = pino<Levels>(
  {
    customLevels,
    level: 'log',
    useOnlyCustomLevels: true,
  },
  pino.multistream(steams, multistreamOpts),
);

export const loggerCore = logger.child({ channel: 'CORE' });
export const loggerBrowser = logger.child({ channel: 'BROWSER' });
export const loggerServer = logger.child({ channel: 'SERVER' });
export const loggerRedis = logger.child({ channel: 'REDIS' });
export const loggerTelegram = logger.child({ channel: 'TELEGRAM' });

export default loggerCore;
