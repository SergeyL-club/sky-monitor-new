const refresh = async (token, key) =>
  new Promise((resolve, reject) => {
    const data = { token };
    const headers = {
      AuthKey: key,
      Accept: 'application/json, text/plain, */*',
      Authorization: `Bearer ${token}`,
      Origin: 'https://skycrypto.me',
      Referer: 'https://skycrypto.me/',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'en-US,en;q=0.9',
      'Content-Length': `${JSON.stringify(data).length}`,
      'Content-Type': 'application/json;charset=UTF-8',
    };

    const refresh = 'https://api.skycrypto.me/rest/v1/auth/refresh';

    fetch(refresh, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(10000),
    })
      .then(async (response) => {
        if (response.status === 200) {
          return await response.json();
        } else {
          throw new Error(`Status: ${response.status}, ${await response.text()}`);
        }
      })
      .then((e) => {
        resolve(e);
      })
      .catch((error) => {
        reject(error);
      });
  });
