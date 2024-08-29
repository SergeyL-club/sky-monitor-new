const getBrokers = async (key, currency) =>
    new Promise((resolve, reject) => {
      const headers = {
        Authorization: `Bearer ${getCookie('sky_token')}`,
        AuthKey: key,
        'Access-Control-Allow-Origin': '*',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
      };
  
      const url = 'https://api.skycrypto.me/rest/v1/brokers?' + new URLSearchParams({ currency }).toString();
  
      fetch(url, {
        method: 'GET',
        headers: headers,
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
  