import type { WaitForOptions } from 'puppeteer';
export type Channels = 'CORE' | 'BROWSER' | 'CALC';

export interface Ads {
  id: string;
  perc: number;
  minBtc: number;
  minUsdt: number;
}

// конфиг telegram
export const TG_SESSION_API: string =
  '1AgAOMTQ5LjE1NC4xNjcuNDEBu4jeq/onhol/UVqRWndECIervlNHBeAFE49l1OLHhe9+gtn67sSh4hEtyH62e0sZ8z9KGziBBVjNPF07Tv6Do3R6h/4hsskA0RGSgQf/8i7h03yNIlxxwSgYeFiE3vsqC/xtCm/n3tKkecK4to8IOFFrSmoxkPS+5xRW64qRgmPpI0Lf2VONHiKwqLrgv6YFdSlCfHCaXyLDmag1TEGxva89/LFWEVIck4wnB9Hqnv20yWDFpPf7806HQcgN6+3VZ4mfqUkyVPTQaBtU3ECEndQ2CRgxQK61svBPhelrF6eNKvwELl0/+ukQ9+PQRPRavdo78c0A+6o6q07rxSYMJcc=';
export const TG_HASH_API: string = '03834fb0bea411df5b80c614370bd196';
export const TG_ID_API: number = 21126497;
export const TG_NAME_BOT_BTC: string = 'SKY BTC BANKER';
export const TG_NAME_BOT_USDT: string = 'SKY USDT BANKER';
export const TG_DELAY_MESSAGE: number = 5000;

// ид тг куда отправлять уведомления
export const TG_ID: number = 280212417;

// порт запуска на сервере (запросы по этому порту отправлять)
export const PORT: number = 8014;

// майл и пороль для входа в sky
export const EMAIL: string = 'mecherycova@yandex.ru';
export const PASSWORD: string = 'Dar19810';

// конфиг заявки
export const IS_VERIFIED: boolean = true;
export const CURSE_MIN_BTC: number = 5000000;
export const CURSE_MIN_USDT: number = 100;
export const IGNORE_ADS_USER: string[] = [];
export const CURSE_DEFAULT_MIN_PERC: number = 15;
export const CURSE_FIX_BTC: number = 0;
export const CURSE_FIX_USDT: number = 0;
export const PARAM_ADS: Ads[] = [];

// конфиг браузера
export const WAIT_TIMEOUT: WaitForOptions['timeout'] = 30000; // ожидание ответа страницы или других загрузок
export const WAIT_UNTIL: WaitForOptions['waitUntil'] = 'domcontentloaded'; // тип ожидания (см. в waitUntil puppeteer)
export const URL_MAIN: string = 'https://skycrypto.me/deals'; // ссылка проверка (если он находится тут значит надо авторизация), также ссылка начала авторизации
export const CNT_EVALUTE: number = 3;
export const DELAY_CNT: number = 5000;

// конфиг обновлений циклов (курс)
export const POLLING_CURSE: boolean = false;
export const DELAY_CURSE_DEALS: number = 30000;
export const DELAY_CURSE_ARAGE_DEALS: number = 5000;
export const POLLING_CURSE_LIMIT: number = 10;
export const CURSE_DELAY: number = 5000;
export const CURSE_ARAGE_DELAY: number = 2000;

// обновление списка сделок
export const POLLING_DEALS: boolean = false;
export const POLLING_DEALS_BTC: boolean = true;
export const POLLING_DEALS_USDT: boolean = true;
export const DELAY_POLLING_DEALS: number = 10000;
export const POLLING_DEALS_LIMIT_BTC: number = 20;
export const POLLING_DEALS_LIMIT_USDT: number = 20;

// параметры самого цикла паники
export const PANIK_DEALS: boolean = false;
export const DELAY_PANIK_DEALS_TIMER: number = 5000;
export const DELAY_PANIK_DEAL: number = 30000;
export const PANIK_BOT_TOKEN: string = '7182805633:AAEqnGu7bosOIDa7I0SubePo0QUHfmOHSck';
export const PANIK_NICKNAME: string = '000yy';

// параметры цикла уведы сообщения
export const POLLING_NOTIFY: boolean = false;
export const DELAY_POLLING_NOTIFY: number = 10000;
export const DELAY_NOTIFY: number = 1000;
export const POLLING_NOTIFY_LIMIT: number = 20;

// проверка сим пея
export const SIM_PAY_VERIFY: boolean = false;

// конфиг который меняется только от сюда и после перезагрузки (вы можете изменить через запрос, но данные будут браться от сюда)
export const DATA_PATH_REDIS_CONFIG: string = `sky-monitor-new:configs`;
export const DATA_PATH_REDIS_PANIK_DEALS: string = `sky-monitor-new:panik:deals`;
export const DATA_PATH_REDIS_RATES_CACHE: string = `sky-monitor-new:rates`;
export const DATA_PATH_REDIS_DEALS_CACHE: string = `sky-monitor-new:deals:cache`;
export const DATA_PATH_REDIS_NOTIFY_CACHE: string = `sky-monitor-new:notifys:cache`;
export const URL_REDIS: string = 'redis://127.0.0.1:6379';
export const DB_REDIS: number = 0;
