type DateType = 'base' | 'more' | 'format' | 'formatDate';
type ReturnDateType<MoreType extends DateType> = MoreType extends 'base' ? DateForm : MoreType extends 'format' | 'formatDate' ? string : MoreDateForm;

type DateForm = {
  day: string;
  month: string;
  year: string;
};

type MoreDateForm = {
  hours: string;
  minutes: string;
  seconds: string;
  milliseconds: string;
} & DateForm;

export const getDate = <MoreType extends DateType>({ isMore, actualDate }: { actualDate?: Date | number; isMore: MoreType }): ReturnDateType<MoreType> => {
  const date = actualDate ? new Date(actualDate) : new Date();

  const dateForm: DateForm = {
    year: date.getFullYear().toString(),
    month: (date.getMonth() + 1).toString().padStart(2, '0'),
    day: date.getDate().toString().padStart(2, '0'),
  };

  if (isMore === 'base') return dateForm as ReturnDateType<MoreType>;
  const moreDateForm: MoreDateForm = {
    ...dateForm,
    hours: date.getHours().toString().padStart(2, '0'),
    minutes: date.getMinutes().toString().padStart(2, '0'),
    seconds: date.getSeconds().toString().padStart(2, '0'),
    milliseconds: date.getMilliseconds().toString(),
  };

  if (isMore === 'format') {
    return `${moreDateForm.year}-${moreDateForm.month}-${moreDateForm.day} ${moreDateForm.hours}:${moreDateForm.minutes}:${moreDateForm.seconds}` as ReturnDateType<MoreType>;
  }
  if (isMore === 'formatDate') {
    return `${moreDateForm.year}-${moreDateForm.month}-${moreDateForm.day}` as ReturnDateType<MoreType>;
  }
  return moreDateForm as ReturnDateType<MoreType>;
};

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const random = (min: number, max: number) => Math.floor(min + Math.random() * (max + 1 - min));
