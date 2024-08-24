import type { Levels } from './logger.js';

import { createReadStream, existsSync, statSync } from 'node:fs';
import { renderTextLine, reversCustomLevels } from './logger.js';

function readFileInReverse(filePath: string, delimiter: string, maxLines?: number) {
  return new Promise((resolve, reject) => {
    const lines = [] as string[];
    let buffer = '';
    const bufferSize = 1024; // Размер буфера для чтения
    let position = statSync(filePath).size;

    const readNextChunk = () => {
      const start = Math.max(0, position - bufferSize);
      const end = position;

      const stream = createReadStream(filePath, {
        encoding: 'utf-8',
        start: start,
        end: end,
      });

      stream.on('data', (chunk) => {
        if (chunk.slice(chunk.length - 1, chunk.length) == buffer.slice(0, 1)) buffer = chunk.slice(0, chunk.length - 1) + buffer;
        else buffer = chunk + buffer;
        const parts = buffer.split(delimiter);
        buffer = parts.shift() ?? ''; // Оставляем начало буфера, которое может быть неполным
        // buffer = buffer.substring(0, buffer.length - 2);

        while (parts.length > 0) {
          const line = parts.pop()?.trim() ?? ''; // Убираем последний \n с каждой строки
          lines.unshift(line);

          if (maxLines !== undefined && lines.length >= maxLines) {
            stream.destroy();
            return resolve(lines);
          }
        }

        position -= bufferSize;
        if (position <= 0) {
          stream.destroy();
          if (buffer.length > 0) {
            lines.unshift(buffer); // Убираем последний \n с оставшейся строки
          }
          return resolve(lines);
        } else {
          stream.destroy();
          readNextChunk(); // Читаем следующую часть
        }
      });

      stream.on('error', (err) => {
        reject(err);
      });

      stream.on('end', () => {
        if (position <= 0 && buffer.length > 0) {
          lines.unshift(buffer); // Убираем последний \n с оставшейся строки
        }
        resolve(lines);
      });
    };

    readNextChunk(); // Начинаем чтение с конца файла
  });
}

export async function readLogs(fname: string, limit?: number) {
  if (!existsSync(fname)) return [];
  const logs = (await readFileInReverse(fname, '$$$', limit)) as string[];
  return logs.reverse();
}

export function getLogs(data: string[]) {
  let s = '<html><head><meta charset="UTF-8"></head><body style="background: #000;">';
  for (let i = 0; i < data.length; i++) {
    try {
      const d = JSON.parse(data[i]);
      const text = renderTextLine(d, reversCustomLevels[d['level'] as number] as Levels, true);
      s += text;
    } catch {
      console.log(data[i]);
    }
  }
  s += '</body></html>';
  return s;
}
