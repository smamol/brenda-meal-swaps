/*
 * signin.js — email, then a 6-digit code from that email, once per phone
 * (step 3, 2026-10-23). Invite-only: no account is ever created here
 * (shouldCreateUser: false), so an address without a profile is told to ask
 * their dietitian.
 *
 *   await showSignIn(root, supabase, {message})   resolves once signed in
 *
 * A sent code is remembered for an hour: iOS often reloads a home-screen app
 * when you switch to Mail and back, and the code in the inbox must still have
 * somewhere to go.
 */
const SENT_KEY = 'mealswaps-signin';
const CODE_LIFE = 60 * 60e3;
function rememberSent(storage, email, now = Date.now()){
  try { storage.setItem(SENT_KEY, JSON.stringify({email, at: now})); } catch (e){}
}
function pendingCode(storage, now = Date.now()){
  try {
    const p = JSON.parse(storage.getItem(SENT_KEY));
    return p && p.email && now - p.at < CODE_LIFE ? p.email : null;
  } catch (e){ return null; }
}
function forgetSent(storage){
  try { storage.removeItem(SENT_KEY); } catch (e){}
}
function signInMessage(err){
  const m = (err && err.message) || '';
  if (/failed to fetch|load failed|networkerror|fetch failed/i.test(m)) return 'Connect to the internet to sign in';
  if (/signups? not allowed|otp_disabled|user not found/i.test(m)) return 'Ask your dietitian';
  if ((err && err.status === 429) || /only request this after|rate limit/i.test(m)) return 'Wait a minute before asking for another code';
  if (/expired|invalid/i.test(m)) return "That code didn't work. Check it or ask for a new one";
  return 'Something went wrong. Try again';
}

/* iOS keeps a home-screen app's storage apart from Safari's, so signing in
   in Safari and then adding the icon means signing in twice */
function needsHomeScreenFirst(){
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && !navigator.standalone;
}

function showSignIn(root, supabase, opts = {}){
  return new Promise(resolve => {
    let email = pendingCode(localStorage) || '';
    const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

    function homeScreen(){
      root.innerHTML = `<div class="signin">
        <h2>Add to Home Screen first, then sign in</h2>
        <p>Tap the Share button, then <b>Add to Home Screen</b>, and open Meal Swaps from its icon. Signing in here would only last in Safari.</p>
        <p><a href="#" id="anyway">Sign in here anyway</a></p></div>`;
      root.querySelector('#anyway').addEventListener('click', e => { e.preventDefault(); askEmail(); });
    }

    function askEmail(msg = ''){
      root.innerHTML = `<form class="signin" id="f-email">
        <h2>Sign in</h2>
        <p>Enter the email your dietitian has for you. We'll send you a 6-digit code.</p>
        <input type="email" id="email" autocomplete="email" inputmode="email" required value="${esc(email)}" placeholder="you@example.com">
        <button type="submit">Send me a code</button>
        <p class="signin-msg" role="alert">${msg}</p></form>`;
      const f = root.querySelector('#f-email');
      f.addEventListener('submit', async e => {
        e.preventDefault();
        email = f.querySelector('#email').value.trim().toLowerCase();
        f.querySelector('button').disabled = true;
        const { error } = await supabase.auth.signInWithOtp({email, options: {shouldCreateUser: false}});
        /* asked again within a minute of a code we sent: that code still works */
        if (error && signInMessage(error).startsWith('Wait') && pendingCode(localStorage) === email)
          return askCode("We've already sent you a code. Check your email.");
        if (error) return askEmail(signInMessage(error));
        rememberSent(localStorage, email);
        askCode();
      });
    }

    function askCode(msg = ''){
      root.innerHTML = `<form class="signin" id="f-code">
        <h2>Check your email</h2>
        <p>We sent a 6-digit code to ${esc(email)}.</p>
        <input type="text" id="code" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="123456">
        <button type="submit">Sign in</button>
        <p class="signin-msg" role="alert">${msg}</p>
        <p><a href="#" id="again">Use a different email or send a new code</a></p></form>`;
      const f = root.querySelector('#f-code');
      f.querySelector('#again').addEventListener('click', e => { e.preventDefault(); askEmail(); });
      f.addEventListener('submit', async e => {
        e.preventDefault();
        f.querySelector('button').disabled = true;
        const token = f.querySelector('#code').value.trim();
        const { error } = await supabase.auth.verifyOtp({email, token, type: 'email'});
        if (error) return askCode(signInMessage(error));
        forgetSent(localStorage);
        resolve();
      });
    }

    if (pendingCode(localStorage)) askCode(opts.message || '');
    else if (opts.message) askEmail(opts.message);
    else needsHomeScreenFirst() ? homeScreen() : askEmail();
  });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { signInMessage, needsHomeScreenFirst, rememberSent, pendingCode, forgetSent };
