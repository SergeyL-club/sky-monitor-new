import http from 'http';
import https from 'https';

export async function sendTgNotify(str: string, chat_id: number, port: number, tg_token = '1011294800:AAHJ51OwsdglVetposO1NuDit4QKK4p2yUw') {
  https.get(`https://api.telegram.org/bot${tg_token}/sendMessage?chat_id=` + chat_id + '&text=' + encodeURI(str)).on('error', (e) => {
    console.error(e);
  });
  if (str.includes('Паника')) {
    console.log('Отправляем панику для перезапуска');
    http.get('http://127.0.0.1:5050/?port=' + port);
  }
}
