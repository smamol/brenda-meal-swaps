/*
 * dishform.js — add, edit and delete a client's own dish (step 4, 2026-10-31).
 * Design: docs/plans/2026-10-31-step4-own-dishes-design.md
 *
 *   mountDishForm(root, {bundle, data, meal?, dish?, onDone(changed)})
 *
 * A dish is one or more parts: library foods (the picker hides the client's
 * dislikes and anyone else's brand foods) or the client's own products typed
 * in per 100 g from a label. Each part gets the amount the client eats; the
 * engine scales the whole dish to the meal's calories, so the preview shows
 * how it lands. Saving and deleting need a connection; offline the form says
 * so and changes nothing.
 */

/* library foods the picker offers: not disliked, and no one else's brand */
function pickerFoods(bundle){
  const plan = bundle.plan, dislikes = new Set(plan.dislikes || []);
  const own = new Set((plan.brands || []).map(b => b.k));
  return Object.entries(bundle.foods)
    .filter(([k, F]) => !dislikes.has(k) && (!F.brand || own.has(k)))
    .map(([k, F]) => ({k, l: F.l, e: F.e}))
    .sort((a, b) => a.l.localeCompare(b.l));
}
/* the meals a dish can go on: one per type and title, in plan order */
function mealSlots(plan){
  const seen = new Set(), out = [];
  for (const day of plan.days) for (const k of day.meals){
    const m = plan.meals[k], key = m.type + '|' + m.title;
    if (!seen.has(key)){ seen.add(key); out.push({type: m.type, title: m.title}); }
  }
  return out;
}
/* a label whose calories disagree with 4P + 9F + 4C by more than 15%: warn, don't block */
function labelOff({kcal, p, f, c}){
  const est = 4 * p + 9 * f + 4 * c;
  if (!kcal && !est) return false;
  return Math.abs(kcal - est) > 0.15 * Math.max(kcal, est);
}
/* the dish's calories at the amounts entered; a part whose food has gone counts 0 */
function partsKcal(parts, FOODS, products){
  let t = 0;
  for (const p of parts){
    const amt = p.u != null ? p.u : p.ml != null ? p.ml : p.g;
    if (p.draft){ t += (+p.draft.kcal || 0) * amt / 100; continue; }
    if (p.product != null){ const P = products[p.product]; if (P) t += P.v[0] * amt / 100; continue; }
    const F = FOODS[p.food];
    if (!F) continue;
    t += F.v[0] * (p.u != null ? (F.u ? p.u * F.u.g : 0) : amt) / 100;
  }
  return t;
}
function defaultPart(k, FOODS){
  const F = FOODS[k];
  if (F.u) return {food: k, u: 1};
  if (F.ml) return {food: k, ml: 100};
  return {food: k, g: 100};
}

function mountDishForm(root, {bundle, data, meal = null, dish = null, onDone: done}){
  /* the form listens for the connection coming and going; once it closes it
     must stop, or it would redraw itself over the plan */
  let live = true;
  const onNet = () => { if (live) draw(); };
  function onDone(changed){
    live = false;
    if (typeof window !== 'undefined'){ window.removeEventListener('online', onNet); window.removeEventListener('offline', onNet); }
    done(changed);
  }
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const FOODS = bundle.foods, PLAN = bundle.plan;
  const slots = mealSlots(PLAN), picker = pickerFoods(bundle);
  const slotKey = s => s ? s.type + '|' + s.title : '';
  const state = {
    name: dish ? dish.name : '',
    emoji: dish ? dish.emoji : '🍽️',
    slot: dish ? dish.slot : meal ? {type: meal.type, title: meal.title} : slots[0],
    /* parts as edited; a new own product is {draft:{name,kcal,p,f,c,ml}, g|ml} until saved */
    parts: dish ? dish.parts.map(p => ({...p})) : [],
    search: '', adding: null, confirmDelete: false, msg: '', busy: false,
  };
  const slotGone = dish && !slots.some(s => slotKey(s) === slotKey(dish.slot));
  if (slotGone) state.slot = slots[0];

  function partName(p){
    if (p.draft) return p.draft.name || 'My product';
    if (p.product != null) return (bundle.products[p.product] || {}).name || 'My product (no longer available)';
    return FOODS[p.food] ? FOODS[p.food].l : `${p.food} (no longer available)`;
  }
  function partUnit(p){
    if (p.u != null) return FOODS[p.food] && FOODS[p.food].u ? FOODS[p.food].u.n + (p.u === 1 ? '' : 's') : '';
    return p.ml != null ? 'ml' : 'g';
  }
  function amountKey(p){ return p.u != null ? 'u' : p.ml != null ? 'ml' : 'g'; }

  /* how the dish lands on the chosen meal, through the same engine the plan uses */
  function preview(){
    const target = Object.values(PLAN.meals).find(m => slotKey(m) === slotKey(state.slot));
    if (!target || !state.parts.length) return '';
    const products = {...bundle.products};
    const parts = state.parts.map((p, i) => {
      if (!p.draft) return p;
      products['draft' + i] = {name: p.draft.name || 'My product', v: [+p.draft.kcal || 0, +p.draft.p || 0, +p.draft.f || 0, +p.draft.c || 0], ml: !!p.draft.ml};
      const {draft, ...rest} = p;
      return {...rest, product: 'draft' + i};
    });
    const E = createEngine(FOODS, bundle.pools, {dislikes: PLAN.dislikes, brands: PLAN.brands, products,
      dishes: [{id: 'preview', slot: state.slot, parts}]});
    const [alt] = E.ownDishAlts(target);
    if (!alt) return '';
    return `<div class="dish-preview"><div class="swaps-label">On your ${h(state.slot.title)}</div>
      <div class="swap-name">${alt.parts.map(p => h(p.label)).join(' + ')}</div>
      <div class="swap-d">${Math.round(alt.m[0])} cal · ${Math.round(alt.m[1])}g P · ${Math.round(alt.m[2])}g F · ${Math.round(alt.m[3])}g C
        — the meal is ${Math.round(E.mealMacros(target)[0])} cal</div></div>`;
  }

  function draw(){
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const q = state.search.trim().toLowerCase();
    const hits = q ? picker.filter(f => f.l.toLowerCase().includes(q)).slice(0, 8) : [];
    const saved = Object.entries(bundle.products || {});
    const a = state.adding;
    root.innerHTML = `<div class="dishform">
      <h2>${dish ? 'Edit your dish' : 'Add my own dish'}</h2>
      ${slotGone ? `<p class="dish-warn">The meal this dish was for has gone from your plan. Pick another.</p>` : ''}
      <label>Name <input name="name" value="${h(state.name)}" placeholder="Protein pancakes"></label>
      <label>Emoji <input name="emoji" value="${h(state.emoji)}" maxlength="4" class="short"></label>
      <label>For <select name="slot">${slots.map(s =>
        `<option value="${h(slotKey(s))}"${slotKey(s) === slotKey(state.slot) ? ' selected' : ''}>${h(s.title)}</option>`).join('')}</select></label>
      <h3>What's in it</h3>
      ${state.parts.length ? state.parts.map((p, i) => `<div class="dish-part">
        <span class="dp-name">${h(partName(p))}${p.draft || p.product != null ? ' <span class="from-label">from label</span>' : ''}</span>
        <input class="short" type="number" inputmode="decimal" min="0" step="any" data-amt="${i}" value="${h(p[amountKey(p)])}"> ${h(partUnit(p))}
        <button type="button" class="dp-remove" data-rm="${i}" aria-label="Remove">✕</button></div>`).join('')
        : '<p class="muted">Add the foods you eat together, in the amounts you usually have.</p>'}
      <label>Add a food <input name="search" value="${h(state.search)}" placeholder="banana, honey…" autocomplete="off"></label>
      ${hits.map(f => `<button type="button" class="dish-hit" data-k="${h(f.k)}">${h(f.e)} ${h(f.l)}</button>`).join('')}
      ${a ? `<div class="dish-product">
        <h3>My own product</h3>
        <p class="muted">From the nutrition panel, per 100 ${a.ml ? 'ml' : 'g'}.</p>
        <label>Name <input name="p-name" value="${h(a.name)}"></label>
        ${['kcal', 'p', 'f', 'c'].map(k => `<label>${{kcal: 'Calories (kcal)', p: 'Protein (g)', f: 'Fat (g)', c: 'Carbs (g)'}[k]}
          <input class="short" type="number" inputmode="decimal" min="0" step="any" name="p-${k}" value="${h(a[k])}"></label>`).join('')}
        <label><input type="checkbox" name="p-ml"${a.ml ? ' checked' : ''}> Measured in ml</label>
        <div class="dish-warn-slot">${labelWarn()}</div>
        <button type="button" class="dish-btn" data-act="product-add">Add to dish</button>
        <button type="button" class="dish-link" data-act="product-cancel">Cancel</button></div>`
      : `<button type="button" class="dish-link" data-act="product-new">+ My own product from a label</button>
        ${saved.length ? `<label>Or one of mine <select name="p-saved"><option value="">Choose…</option>${saved.map(([id, P]) =>
          `<option value="${h(id)}">${h(P.name)}</option>`).join('')}</select></label>` : ''}`}
      <div class="dish-preview-slot">${preview()}</div>
      <p class="dish-msg">${h(offline && !state.msg ? 'You need a connection to add or change a dish.' : state.msg)}</p>
      <div class="dish-actions">
        <button type="button" class="dish-btn" data-act="save"${state.busy || offline ? ' disabled' : ''}>Save</button>
        <button type="button" class="dish-link" data-act="cancel">Cancel</button>
        ${dish ? (state.confirmDelete
          ? `<span class="dish-confirm">Delete this dish? <button type="button" class="dish-link" data-act="delete-yes">Delete</button>
             <button type="button" class="dish-link" data-act="delete-no">Keep it</button></span>`
          : `<button type="button" class="dish-link danger" data-act="delete"${offline ? ' disabled' : ''}>Delete this dish</button>`) : ''}
      </div></div>`;
    wire();
  }

  function labelWarn(){
    const a = state.adding;
    return a && labelOff({kcal: +a.kcal, p: +a.p, f: +a.f, c: +a.c})
      ? `<p class="dish-warn">The calories don't add up from the protein, fat and carbs. Check the label; you can still save it.</p>` : '';
  }
  /* field edits refresh only what depends on them: redrawing the whole form
     would replace the field the next tap lands on, and close the keyboard */
  function refresh(){
    const p = root.querySelector('.dish-preview-slot'), w = root.querySelector('.dish-warn-slot');
    if (p) p.innerHTML = preview();
    if (w) w.innerHTML = labelWarn();
  }
  function wire(){
    const $ = s => root.querySelector(s);
    $('[name=name]').addEventListener('input', e => { state.name = e.target.value; });
    $('[name=emoji]').addEventListener('input', e => { state.emoji = e.target.value; });
    $('[name=slot]').addEventListener('change', e => { state.slot = slots.find(s => slotKey(s) === e.target.value); draw(); });
    const search = $('[name=search]');
    search.addEventListener('input', e => {
      state.search = e.target.value; draw();
      const s = root.querySelector('[name=search]'); s.focus(); s.setSelectionRange(s.value.length, s.value.length);
    });
    root.querySelectorAll('[data-amt]').forEach(i => i.addEventListener('change', e => {
      const p = state.parts[+i.dataset.amt]; p[amountKey(p)] = Math.max(0, +e.target.value || 0); refresh();
    }));
    root.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { state.parts.splice(+b.dataset.rm, 1); draw(); }));
    root.querySelectorAll('.dish-hit').forEach(b => b.addEventListener('click', () => {
      state.parts.push(defaultPart(b.dataset.k, FOODS)); state.search = ''; draw();
    }));
    const savedSel = $('[name=p-saved]');
    if (savedSel) savedSel.addEventListener('change', e => {
      if (!e.target.value) return;
      const P = bundle.products[e.target.value];
      state.parts.push(P.ml ? {product: e.target.value, ml: 100} : {product: e.target.value, g: 100}); draw();
    });
    if (state.adding){
      for (const k of ['name', 'kcal', 'p', 'f', 'c']) $(`[name=p-${k}]`).addEventListener('input', e => { state.adding[k] = e.target.value; refresh(); });
      $('[name=p-ml]').addEventListener('change', e => { state.adding.ml = e.target.checked; draw(); });
    }
    root.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => act(b.dataset.act)));
  }

  async function act(what){
    if (what === 'cancel') return onDone(false);
    if (what === 'product-new'){ state.adding = {name: '', kcal: '', p: '', f: '', c: '', ml: false}; return draw(); }
    if (what === 'product-cancel'){ state.adding = null; return draw(); }
    if (what === 'product-add'){
      const a = state.adding;
      if (!a.name.trim() || [a.kcal, a.p, a.f, a.c].some(x => x === '' || !(+x >= 0))){ state.msg = 'Give the product a name and all four numbers.'; return draw(); }
      const draft = {name: a.name.trim(), kcal: +a.kcal, p: +a.p, f: +a.f, c: +a.c, ml: !!a.ml};
      state.parts.push(draft.ml ? {draft, ml: 100} : {draft, g: 100});
      state.adding = null; state.msg = ''; return draw();
    }
    if (what === 'delete'){ state.confirmDelete = true; return draw(); }
    if (what === 'delete-no'){ state.confirmDelete = false; return draw(); }
    if (what === 'delete-yes') return write(() => data.deleteDish(dish.id));
    if (what === 'save'){
      if (!state.name.trim()){ state.msg = 'Give your dish a name.'; return draw(); }
      if (!state.parts.length){ state.msg = 'Add at least one food.'; return draw(); }
      if (!(partsKcal(state.parts, FOODS, bundle.products || {}) > 0)){ state.msg = 'This dish has no calories. Check the amounts.'; return draw(); }
      return write(async () => {
        const parts = [];
        for (const p of state.parts){
          if (!p.draft){ parts.push(p); continue; }
          const {draft, ...rest} = p;
          parts.push({...rest, product: await data.saveProduct(draft)});
        }
        state.parts = parts;   /* a retry after a failure doesn't save the products twice */
        await data.saveDish({id: dish && dish.id, name: state.name.trim(), emoji: state.emoji.trim() || '🍽️', slot: state.slot, parts});
      });
    }
  }
  async function write(fn){
    state.busy = true; state.msg = ''; draw();
    try { await fn(); onDone(true); }
    catch (e){
      state.busy = false;
      state.msg = e && e.kind === 'offline' ? 'You need a connection to add or change a dish.' : 'Something went wrong. Try again';
      draw();
    }
  }

  draw();
  if (typeof window !== 'undefined'){
    window.addEventListener('online', onNet);
    window.addEventListener('offline', onNet);
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { pickerFoods, mealSlots, labelOff, defaultPart, partsKcal, mountDishForm };
