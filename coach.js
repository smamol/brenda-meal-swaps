/*
 * coach.js — the coach and admin views (step 3, 2026-10-23). A coach sees
 * their clients; the admin sees every coach's, plus the open swap flags.
 * Opening a client draws their plan exactly as on their phone (their dislikes,
 * brands and colours), with a "Something's wrong with this swap" button on
 * every swap. Read-only otherwise: nothing here edits a plan.
 *
 *   mountClients(root, data, me, {onOwnPlan})
 */
const escHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function mountClients(root, data, me, opts = {}){
  const admin = me.role === 'admin';
  root.innerHTML = '<div class="clients"><p class="muted">Loading…</p></div>';
  let clients, flags = [];
  try {
    clients = await data.listClients();
    if (admin) flags = await data.listFlags({open: true});
  } catch (e){
    root.innerHTML = `<div class="clients"><p>Couldn't load your clients. Check your connection and try again.</p></div>`;
    return;
  }

  const byCoach = {};
  for (const c of clients) (byCoach[c.coach || '—'] ||= []).push(c);
  const list = Object.entries(byCoach).map(([coach, cs]) =>
    `${admin ? `<h3>${escHtml(coach)}'s clients</h3>` : ''}${cs.map(c =>
      `<button class="client" type="button" data-id="${escHtml(c.id)}" data-name="${escHtml(c.display_name)}">${escHtml(c.display_name)}</button>`).join('')}`).join('');

  const flagList = !admin ? '' : `<h2>Open flags</h2>${flags.length ? flags.map(f => `<div class="flagrow">
      <div><b>${escHtml(f.client_name)}</b> · ${escHtml(f.day)} · ${escHtml(f.meal)}</div>
      <div>${escHtml(f.planned)} → ${escHtml(f.swap)}</div>
      ${f.note ? `<div class="note">“${escHtml(f.note)}”</div>` : ''}
      <div class="muted">${new Date(f.flagged_at).toLocaleDateString('en-NZ', {day: 'numeric', month: 'short', timeZone: 'Pacific/Auckland'})}
        <button class="resolve" type="button" data-id="${escHtml(f.id)}">Resolved</button></div>
    </div>`).join('') : '<p class="muted">None.</p>'}`;

  root.innerHTML = `<div class="clients">
    ${opts.onOwnPlan ? '<p><a href="#" class="back">← My plan</a></p>' : ''}
    <h2>${admin ? 'All clients' : 'Your clients'}</h2>
    ${list || '<p class="muted">No clients yet.</p>'}
    ${flagList}
  </div>`;

  if (opts.onOwnPlan) root.querySelector('.back').addEventListener('click', e => { e.preventDefault(); opts.onOwnPlan(); });
  root.querySelectorAll('.client').forEach(b => b.addEventListener('click', () =>
    openClient(root, data, me, b.dataset.id, b.dataset.name, opts)));
  root.querySelectorAll('.resolve').forEach(b => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await data.resolveFlag(b.dataset.id); mountClients(root, data, me, opts); }
    catch (e){ b.disabled = false; b.textContent = 'Try again'; }
  }));
}

async function openClient(root, data, me, id, name, opts){
  root.innerHTML = '<div class="clients"><p class="muted">Loading…</p></div>';
  let bundle;
  try { bundle = await data.fetchBundle(id); }
  catch (e){
    const why = e.kind === 'no-plan' ? `${escHtml(name)} has no plan yet.` : `Couldn't load ${escHtml(name)}'s plan.`;
    root.innerHTML = `<div class="clients"><p><a href="#" class="back">← Clients</a></p><p>${why}</p></div>`;
    root.querySelector('.back').addEventListener('click', e2 => { e2.preventDefault(); mountClients(root, data, me, opts); });
    return;
  }
  mountPlan(root, bundle, {status: `${escHtml(name)}'s plan, as it shows on their phone`,
    onFlag: f => flagSheet(data, id, f)});
  root.insertAdjacentHTML('afterbegin', '<p class="viewing"><a href="#" class="back">← Clients</a></p>');
  root.querySelector('.back').addEventListener('click', e => { e.preventDefault(); mountClients(root, data, me, opts); });
  window.scrollTo({top: 0});
}

function flagSheet(data, clientId, f){
  document.querySelector('.sheet')?.remove();
  document.body.insertAdjacentHTML('beforeend', `<div class="sheet" role="dialog" aria-label="Something's wrong with this swap">
    <p><b>Something's wrong with this swap</b><br>${escHtml(f.planned)} → ${escHtml(f.swap)}</p>
    <textarea rows="3" placeholder="What's wrong with it? (optional)"></textarea>
    <p><button type="button" class="send">Send</button> <a href="#" class="cancel">Cancel</a></p>
    <p class="sheet-msg" role="status"></p></div>`);
  const sheet = document.querySelector('.sheet');
  sheet.querySelector('.cancel').addEventListener('click', e => { e.preventDefault(); sheet.remove(); });
  sheet.querySelector('.send').addEventListener('click', async e => {
    e.target.disabled = true;
    try {
      await data.flagSwap({clientId, ...f, note: sheet.querySelector('textarea').value.trim()});
      sheet.querySelector('.sheet-msg').textContent = 'Sent. Thank you.';
      setTimeout(() => sheet.remove(), 1200);
    } catch (err){
      e.target.disabled = false;
      sheet.querySelector('.sheet-msg').textContent = "Couldn't send it. Check your connection and try again.";
    }
  });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { mountClients, escHtml };
