const getCookie = (key) => {
  const keyVal = document.cookie.split(' ');

  for (let index = 0; index < keyVal.length; index++) {
    const text = keyVal[index];
    const [localKey, value] = text.split('=');
    if (key == localKey) return value.split(';').join('');
  }

  if (window['key']) return window['key'];

  return undefined;
};
