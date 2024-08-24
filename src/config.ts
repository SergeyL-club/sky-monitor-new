import type { WaitForOptions } from 'puppeteer';
export type Channels = 'CORE' | 'BROWSER' | 'CALC';

// конфиг mts
export const MTS_PORT: number = 29980;
export const MTS_PAY: string[] = ['pcnOGGmbT', 'M7wEYcWleG'];

// адрес на службы (mts, qiwi, yandex, payeer)
export const PAID_URL: string = 'http://145.239.95.220';
export const PAID_SECRET: string = 'm0nEy$ecrET';

// ид тг куда отправлять уведомления
export const TG_ID: number = 280212417;

// порт запуска на сервере (запросы по этому порту отправлять)
export const PORT: number = 13004;

// майл и пороль для входа в sky
export const EMAIL: string = 'support@bizoninvest.com';
export const PASSWORD: string = 'fMwbh7XeXdTYNci';

// конфиг сделки
export const IS_VERIFIED: boolean = false;

// автоматическая отмена или открытие спора по истечению времени телефона
export const TIMER_PHONE: boolean = true;
export const TIME_DISPUTE_TIMER_PHONE: number = 900000;
export const DELAY_TIMER_PHONE: number = 1000;

// конфиг браузера
export const WAIT_TIMEOUT: WaitForOptions['timeout'] = 60000; // ожидание ответа страницы или других загрузок
export const WAIT_UNTIL: WaitForOptions['waitUntil'] = 'networkidle2'; // тип ожидания (см. в waitUntil puppeteer)
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
export const POLLING_DEALS: boolean = false;
export const POLLING_DEALS_BTC: boolean = true;
export const POLLING_DEALS_USDT: boolean = true;
export const DELAY_POLLING_DEALS: number = 10000;
export const POLLING_DEALS_LIMIT_BTC: number = 20;
export const POLLING_DEALS_LIMIT_USDT: number = 20;

// конфиг который меняется только от сюда и после перезагрузки (вы можете изменить через запрос, но данные будут браться от сюда)
export const DATA_PATH_REDIS_CONFIG: string = `sky-new:configs`;
export const DATA_PATH_REDIS_DEALS_CACHE: string = `sky-new:deals:cache`;
export const DATA_PATH_REDIS_PHONE: string = `sky-new:phone`;
export const URL_REDIS: string = 'redis://127.0.0.1:6379';
export const DB_REDIS: number = 0;
