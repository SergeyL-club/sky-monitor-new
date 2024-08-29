import type { WaitForOptions } from 'puppeteer';
export type Channels = 'CORE' | 'BROWSER' | 'CALC';

// конфиг telegram
export const TG_SESSION_API: string =
  '1AgAOMTQ5LjE1NC4xNjcuNDEBu0VTG2XgB6sZ05zN0+Czpd7TFOFKEm2d0hbK7WSx2h6Z3N/rkQiijhoRtNSwh7Aba/RkLl/lBv3fh6B1YS0YJSNlnHDhz8d5+bEpm0/ObqansEywUwD5HlbEy/Pej+SLRAy2J0diMssP4rQF1UgAxHFYwoq+qLVJg2qdGM7MR8tAGexnQJ1zryp1jmq8iQLGYHPxvxeHASGkMwyOaBeqRp2Nd24qjPzht9JBk7m6jJhES7+jPFog8ko+97Kt4J08jMPCu9lf2aLeQv5s6VcWIb++Yaep40fxqx1607lE+6BHpi0uPU/u/BXX9ksx2nhmYbEk1IB16AFiarTJO8Hv8tU=';
export const TG_HASH_API: string = '285f33b052b6546dc0affc1ba8af3c73';
export const TG_ID_API: number = 23141011;
export const TG_NAME_BOT: string = 'SKY BTC BANKER';

// ид тг куда отправлять уведомления
export const TG_ID: number = 280212417;

// порт запуска на сервере (запросы по этому порту отправлять)
export const PORT: number = 13004;

// майл и пороль для входа в sky
export const EMAIL: string = 'nipici9440@acpeak.com';
export const PASSWORD: string = 'Myipad132';

// конфиг заявки
export const IS_VERIFIED: boolean = true;
export const CURSE_MIN: number = 5000000;
export const IGNORE_ADS_USER: string[] = [];
export const CURSE_DEFAULT_MIN_PERC: number = 15;
export const CURSE_FIX_PERC: number = 0;

// конфиг браузера
export const WAIT_TIMEOUT: WaitForOptions['timeout'] = 30000; // ожидание ответа страницы или других загрузок
export const WAIT_UNTIL: WaitForOptions['waitUntil'] = 'domcontentloaded'; // тип ожидания (см. в waitUntil puppeteer)
export const URL_MAIN_AUTH: string = 'https://skycrypto.me'; // ссылка проверка (если он находится тут значит надо авторизация), также ссылка начала авторизации
export const URL_DEALS: string = 'https://skycrypto.me/deals'; // ссылка где находятся сделки
export const DELAY_EVENT_MIN: number = 50; // минимальная задержка действия (пример: клик, ожидание после действия)
export const DELAY_EVENT_MAX: number = 100; // максимальная задержка действия (пример: клик, ожидание после действия)
export const DELAY_AUTH: number = 5000; // ожидание автоматического перехода сайтом, переключение формы с поролем
export const CNT_EVALUTE: number = 3;
export const DELAY_CNT: number = 5000;

// селекторы для авторизации (если список - 0:ru 1:en)
export const SELECTOR_INPUT_EMAIL: string = 'input[name="email"]';
export const SELECTOR_INPUT_PASSWORD: string = 'input[name="password"]';
export const SELECTOR_ERROR: [string, string] = ['//span[text()="Ошибка 404"]', '//span[text()="Error 404"]']; // селектор на ошибку 404
export const SELECTOR_AUTH_FORM: string = '.top-nav > div > div > div:nth-child(5)'; // селектор на вход в форму авторизации
export const SELECTOR_URL_AUTH: string = '.form-wrap > div:nth-child(6) > a'; // селекторы на ссылку для открытия пароля в форме
export const SELECTOR_BTN_AUTH: string = '.form-wrap > div > button'; // селекторы на кнопку входа уже в форме

// конфиг обновлений циклов
export const POLLING_CURSE: boolean = false;
export const DELAY_CURSE_DEALS: number = 10000;
export const POLLING_CURSE_LIMIT: number = 10;

// конфиг который меняется только от сюда и после перезагрузки (вы можете изменить через запрос, но данные будут браться от сюда)
export const DATA_PATH_REDIS_CONFIG: string = `sky-monitor-new:configs`;
export const DATA_PATH_REDIS_RATES_CACHE: string = `sky-monitor-new:reates`;
export const URL_REDIS: string = 'redis://127.0.0.1:6379';
export const DB_REDIS: number = 0;
