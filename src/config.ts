import type { WaitForOptions } from 'puppeteer';
export type Channels = 'CORE' | 'BROWSER' | 'CALC';

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
export const DELAY_CURSE_DEALS: number = 30000;
export const DELAY_CURSE_ARAGE_DEALS: number = 5000;
export const POLLING_CURSE_LIMIT: number = 10;
export const CURSE_DELAY: number = 5000;
export const CURSE_ARAGE_DELAY: number = 2000;

// конфиг который меняется только от сюда и после перезагрузки (вы можете изменить через запрос, но данные будут браться от сюда)
export const DATA_PATH_REDIS_CONFIG: string = `sky-monitor-new:configs`;
export const DATA_PATH_REDIS_RATES_CACHE: string = `sky-monitor-new:rates`;
export const URL_REDIS: string = 'redis://127.0.0.1:6379';
export const DB_REDIS: number = 0;
