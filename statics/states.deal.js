const statesNextDeal = async (key, dealId) =>
  new Promise((resolve, reject) => {
    const data = { deal_id: dealId };
    const headers = {
      Authorization: `Bearer ${getCookie('sky_token')}`,
      AuthKey: key,
      'Access-Control-Allow-Origin': '*',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'en-US,en;q=0.9',
      'Content-Length': `${JSON.stringify(data).length}`,
      'Content-Type': 'application/json;charset=UTF-8',
    };

    const url = 'https://api.skycrypto.me/rest/v1/deals/states';

    fetch(url, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify(data),
    })
      .then(async (response) => {
        if (response.status === 200) {
          return true;
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
