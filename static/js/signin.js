// Sign-in page script. The bot's sign-in button links here with a one-time ?t=<token>;
// the user logs in with WAX Cloud Wallet (waxjs), Anchor or Wombat (WharfKit) and the wallet is linked
// to the chat that token belongs to.
const token = new URLSearchParams(window.location.search).get('t');

const logins = document.getElementById('logins');
const buttons = logins.querySelectorAll('button');
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

const walletNames = { cloud: 'WAX Cloud Wallet', anchor: 'Anchor', wombat: 'Wombat' };

function setBusy(busy) {
  buttons.forEach((b) => { b.disabled = busy; });
}

if (!token) {
  logins.remove();
  setStatus('Please open this page from the sign-in button in @keyroomjourneybot.');
} else {
  const wax = new WaxJS({
    rpcEndpoint: 'https://wax.greymass.com',
    tryAutoLogin: false,
  });

  async function login(wallet) {
    if (wallet === 'cloud') {
      return wax.login();
    }
    if (!window.wharfLogin) {
      throw new Error('Wallet support is still loading, try again in a moment.');
    }
    return window.wharfLogin(wallet);
  }

  logins.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-wallet]');
    if (!button) {
      return;
    }
    const wallet = button.dataset.wallet;
    setBusy(true);
    setStatus(`Waiting for ${walletNames[wallet]}...`);
    try {
      const address = await login(wallet);
      setStatus(`Signed in as ${address}. Checking for keys...`);
      const result = await postJson('/api/link', { token: token, address: address });
      if (result.keys === 0) {
        showNoKey(address, result.buyUrl, result.findUrl);
        return;
      }
      logins.remove();
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
      setBusy(false);
    }
  });
}
