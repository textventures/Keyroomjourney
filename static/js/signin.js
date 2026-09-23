// Sign-in page script. Runs as a Telegram Mini App when opened from the bot,
// or as a normal web page (with ?chat_id= in the URL) as a fallback.
const tg = window.Telegram && window.Telegram.WebApp;
const inTelegram = !!(tg && tg.initData);

if (inTelegram) {
  tg.ready();
  tg.expand();
}

const wax = new WaxJS({
  rpcEndpoint: 'https://wax.greymass.com',
  tryAutoLogin: false,
});

const button = document.getElementById('login');
const status = document.getElementById('status');

function setStatus(text) {
  status.textContent = text;
}

// Telegram Mini App: the server verifies Telegram's signed initData to learn who the user is.
async function linkFromTelegram(address) {
  const res = await fetch('/api/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: tg.initData, address: address }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  setStatus(`Signed in as ${address}. Returning to the bot...`);
  setTimeout(() => tg.close(), 1200);
}

// Plain browser fallback: same form post the old sign-in page used.
function linkFromBrowser(address) {
  const params = new URLSearchParams(window.location.search);
  const form = document.createElement('form');
  form.method = 'post';
  form.action = '/';
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'data';
  input.value = JSON.stringify({
    chat_id: params.get('chat_id'),
    name: params.get('name'),
    address: address,
  });
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
}

button.addEventListener('click', async () => {
  button.disabled = true;
  setStatus('Waiting for WAX Cloud Wallet...');
  try {
    const address = await wax.login();
    setStatus(`Signed in as ${address}`);
    if (inTelegram) {
      await linkFromTelegram(address);
    } else {
      linkFromBrowser(address);
    }
  } catch (error) {
    console.log(error);
    setStatus(`Sign-in failed: ${error.message || error}. Please try again.`);
    button.disabled = false;
  }
});
