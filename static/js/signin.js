// Sign-in page script. It runs in two places:
// 1. Inside Telegram as a Mini App: gets a one-time sign-in link and opens it in the real browser,
//    because the WAX Cloud Wallet login popup can't open inside Telegram's webview.
// 2. In the real browser with ?t=<token>: logs in with WAX Cloud Wallet and links the wallet.
const tg = window.Telegram && window.Telegram.WebApp;
const inTelegram = !!(tg && tg.initData);
const token = new URLSearchParams(window.location.search).get('t');

const button = document.getElementById('login');
const status = document.getElementById('status');

function setStatus(text) {
  status.textContent = text;
}

async function postJson(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

function startInTelegram() {
  tg.ready();
  tg.expand();
  button.textContent = 'Continue in browser';
  button.disabled = true;
  setStatus('Preparing your sign-in link...');

  postJson('/api/session', { initData: tg.initData })
    .then(({ url }) => {
      setStatus('WAX Cloud Wallet opens in your browser. Come back to Telegram when you are done.');
      button.disabled = false;
      button.addEventListener('click', () => {
        tg.openLink(url);
        setTimeout(() => tg.close(), 500);
      });
    })
    .catch((error) => {
      console.log(error);
      setStatus(`Could not start sign-in: ${error.message}`);
    });
}

function startInBrowser() {
  const wax = new WaxJS({
    rpcEndpoint: 'https://wax.greymass.com',
    tryAutoLogin: false,
  });

  button.addEventListener('click', async () => {
    button.disabled = true;
    setStatus('Waiting for WAX Cloud Wallet...');
    try {
      const address = await wax.login();
      setStatus(`Signed in as ${address}. Linking your wallet...`);
      await postJson('/api/link', { token: token, address: address });
      button.remove();
      status.innerHTML = '';
      status.append(`Wallet ${address} is linked! `);
      const back = document.createElement('a');
      back.href = 'https://t.me/keyroomjourneybot';
      back.textContent = 'Return to Telegram';
      status.append(back);
    } catch (error) {
      console.log(error);
      setStatus(`Sign-in failed: ${error.message || error}`);
      button.disabled = false;
    }
  });
}

if (inTelegram) {
  startInTelegram();
} else if (token) {
  startInBrowser();
} else {
  button.remove();
  setStatus('Please open this page from the sign-in button in @keyroomjourneybot.');
}
