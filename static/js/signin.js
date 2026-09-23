// Sign-in page script. The bot's sign-in button links here with a one-time ?t=<token>;
// the user logs in with WAX Cloud Wallet and the wallet is linked to the chat that token belongs to.
const token = new URLSearchParams(window.location.search).get('t');

const button = document.getElementById('login');
const status = document.getElementById('status');

function setStatus(text, kind) {
  status.textContent = text;
  status.dataset.kind = kind || '';
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

function showNoKey(address, buyUrl, findUrl) {
  document.getElementById('nokey-wallet').textContent = address;
  document.getElementById('buy-key').href = buyUrl;
  document.getElementById('find-key').href = findUrl;
  document.getElementById('signin').hidden = true;
  document.getElementById('nokey').hidden = false;
}

if (!token) {
  button.remove();
  setStatus('Please open this page from the sign-in button in @keyroomjourneybot.');
} else {
  const wax = new WaxJS({
    rpcEndpoint: 'https://wax.greymass.com',
    tryAutoLogin: false,
  });

  button.addEventListener('click', async () => {
    button.disabled = true;
    setStatus('Waiting for WAX Cloud Wallet...');
    try {
      const address = await wax.login();
      setStatus(`Signed in as ${address}. Checking for keys...`);
      const result = await postJson('/api/link', { token: token, address: address });
      if (result.keys === 0) {
        showNoKey(address, result.buyUrl, result.findUrl);
        return;
      }
      button.remove();
      if (result.keys > 0) {
        setStatus(`You carry ${result.keys} ${result.keys === 1 ? 'key' : 'keys'}! Head back to Telegram to open a door.`, 'ok');
      } else {
        setStatus(`Wallet ${address} is linked!`, 'ok');
      }
      const back = document.createElement('a');
      back.href = 'https://t.me/keyroomjourneybot';
      back.textContent = 'Return to Telegram';
      back.className = 'pixel-btn';
      status.append(document.createElement('br'), back);
    } catch (error) {
      console.log(error);
      setStatus(`Sign-in failed: ${error.message || error}`, 'error');
      button.disabled = false;
    }
  });
}
