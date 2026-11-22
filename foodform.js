/*
 * foodform.js — add, edit and delete a client's own food (2026-11-22).
 * Pitch: docs/plans/2026-11-22-own-pool-foods-pitch.md. Replaces dishform.js.
 *
 *   mountFoodForm(root, {bundle, data, food?, from?, onDone(changed)})
 *
 * An own food joins one or more of the swap groups on the client's plan and is
 * offered on those lines wherever it fits the normal 10% / 4 g rule. Its
 * macros come from a recipe (library ingredients in grams over the weight
 * once made, or their total when that's blank; water and salt are left out) or from a label, per 100 g. It can be
 * counted in grams or in a unit of a given weight ("slice, 45 g"). from =
 * {meal, ing} when opened from a line: that line's group is preselected and
 * the preview shows how the food lands there. Saving and deleting need a
 * connection; offline the form says so and changes nothing.
 */

/* what the client calls each group, for the add button and the checkboxes */
const GROUP_NAMES = {protein: 'protein', starch: 'carb', bread: 'bread', spreads: 'spread', sweet: 'sweet topping',
  fruit: 'fruit', cereal: 'cereal', treat: 'treat', intra: 'training fuel', veg: 'veg', snackpack: 'snack',
  dessert: 'dessert', oats: 'oats', saladFats: 'salad topping'};
const groupName = g => GROUP_NAMES[g] || g;

/* library foods a recipe can use: not disliked, and no one else's brand */
function pickerFoods(bundle){
  const plan = bundle.plan, dislikes = new Set(plan.dislikes || []);
  const own = new Set((plan.brands || []).map(b => b.k));
  return Object.entries(bundle.foods)
    .filter(([k, F]) => !dislikes.has(k) && (!F.brand || own.has(k)))
    .map(([k, F]) => ({k, l: F.l, e: F.e}))
    .sort((a, b) => a.l.localeCompare(b.l));
}
/* the groups the plan's lines use, in plan order, each with its planned foods */
function planGroups(plan, FOODS){
  const out = new Map();
  for (const day of plan.days) for (const mk of day.meals) for (const ing of plan.meals[mk].ing){
    if (!ing.pool) continue;
    if (!out.has(ing.pool)) out.set(ing.pool, new Set());
    out.get(ing.pool).add(FOODS[ing.k] ? FOODS[ing.k].l : ing.k);
  }
  return [...out].map(([g, foods]) => ({g, name: groupName(g), foods: [...foods]}));
}
/* a label whose calories disagree with 4P + 9F + 4C by more than 15%: warn, still save */
function labelOff({kcal, p, f, c}){
  const est = 4 * p + 9 * f + 4 * c;
  if (!kcal && !est) return false;
  return Math.abs(kcal - est) > 0.15 * Math.max(kcal, est);
}
/* the food as the engine and data.js take it, from the form's state; v null
   until the numbers are complete */
function draftFood(state, FOODS){
  const unit = state.counted === 'unit' && +state.unitG > 0 ? {n: state.unitName.trim() || 'piece', g: +state.unitG} : null;
  const recipe = {parts: state.parts.map(p => ({food: p.food, g: +p.g || 0})), baked: +state.baked || 0};
  const L = state.label;
  const v = state.source === 'recipe' ? recipePer100(recipe, FOODS)
    : [L.kcal, L.p, L.f, L.c].every(x => x !== '' && +x >= 0) ? [+L.kcal, +L.p, +L.f, +L.c] : null;
  return {name: state.name.trim(), emoji: state.emoji.trim() || '🍽️', pools: [...state.pools], unit,
    ml: state.source === 'label' && !unit && !!L.ml, source: state.source,
    recipe: state.source === 'recipe' ? recipe : null, v};
}

function mountFoodForm(root, {bundle, data, food = null, from = null, onDone: done}){
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
  const groups = planGroups(PLAN, FOODS), picker = pickerFoods(bundle);
  const o = food ? (bundle.ownFoods || {})[food] : null;
  const r1 = x => Math.round(x * 10) / 10;
  const state = {
    name: o ? o.name : '',
    emoji: o ? o.emoji : '🍽️',
    pools: new Set(o ? o.pools : from && from.ing.pool ? [from.ing.pool] : []),
    counted: o && o.unit ? 'unit' : 'g',
    unitName: o && o.unit ? o.unit.n : 'slice',
    unitG: o && o.unit ? o.unit.g : '',
    source: o ? o.source : 'recipe',
    parts: o && o.recipe ? o.recipe.parts.map(p => ({...p})) : [],
    baked: o && o.recipe && o.recipe.baked > 0 ? o.recipe.baked : '',
    label: o && o.source === 'label' ? {kcal: o.v[0], p: o.v[1], f: o.v[2], c: o.v[3], ml: !!o.ml} : {kcal: '', p: '', f: '', c: '', ml: false},
    search: '', confirmDelete: false, msg: '', busy: false,
  };

  function result(){
    const d = draftFood(state, FOODS);
    if (!d.v) return state.source === 'recipe'
      ? '<p class="muted">Add the ingredients to see it per 100 g.</p>' : '';
    const per = `Per 100 ${d.ml ? 'ml' : 'g'}: ${Math.round(d.v[0])} cal · ${r1(d.v[1])}g P · ${r1(d.v[2])}g F · ${r1(d.v[3])}g C`;
    const u = d.unit ? `<br>One ${h(d.unit.n)} (${d.unit.g} g): ${Math.round(d.v[0] * d.unit.g / 100)} cal` : '';
    return `<div class="food-result">${per}${u}</div>`;
  }
  /* how it lands on the line it was opened from, through the same engine */
  function preview(){
    if (!from || !from.ing.pool || !state.pools.has(from.ing.pool)) return '';
    const d = draftFood(state, FOODS);
    if (!d.v || !(d.v[0] > 0)) return '';
    const E = createEngine(FOODS, bundle.pools, {dislikes: PLAN.dislikes, brands: PLAN.brands,
      ownFoods: {...(bundle.ownFoods || {}), [food || 'draft']: {...d, name: d.name || 'my food'}}});
    const k = OWN_PREFIX + (food || 'draft');
    const sw = E.computeSwaps(from.ing).find(s => s.k === k);
    return `<div class="food-preview"><div class="swaps-label">Instead of ${h(E.ingLabel(from.ing))} at ${h(from.meal.title)}</div>
      ${sw ? `<div class="swap-name">${h(sw.label)}</div>
        <div class="swap-d">${Math.round(sw.m[0])} cal · ${Math.round(sw.m[1])}g P · ${Math.round(sw.m[2])}g F · ${Math.round(sw.m[3])}g C</div>`
        : `<div class="swap-d">Doesn't fit this line within 10%, so it won't show here.</div>`}</div>`;
  }
  function labelWarn(){
    const L = state.label;
    return state.source === 'label' && labelOff({kcal: +L.kcal, p: +L.p, f: +L.f, c: +L.c})
      ? `<p class="food-warn">The calories don't add up from the protein, fat and carbs. Check the label; you can still save it.</p>` : '';
  }

  function draw(){
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const q = state.search.trim().toLowerCase();
    const hits = q ? picker.filter(f => f.l.toLowerCase().includes(q)).slice(0, 8) : [];
    const L = state.label;
    root.innerHTML = `<div class="foodform">
      <h2>${o ? 'Edit your food' : 'Add my own food'}</h2>
      <label>Name <input name="name" value="${h(state.name)}" placeholder="sourdough"></label>
      <label>Emoji <input name="emoji" value="${h(state.emoji)}" maxlength="4" class="short"></label>
      <h3>Offer it instead of</h3>
      ${groups.map(g => `<label><input type="checkbox" name="pool" value="${h(g.g)}"${state.pools.has(g.g) ? ' checked' : ''}>
        ${h(g.name[0].toUpperCase() + g.name.slice(1))} <span class="muted">(${h(g.foods.join(', '))})</span></label>`).join('')}
      <h3>Counted in</h3>
      <label><input type="radio" name="counted" value="g"${state.counted === 'g' ? ' checked' : ''}> Grams</label>
      <label><input type="radio" name="counted" value="unit"${state.counted === 'unit' ? ' checked' : ''}> Pieces</label>
      ${state.counted === 'unit' ? `<label>Piece <input name="unitName" class="short" value="${h(state.unitName)}"></label>
        <label>Weighs <input name="unitG" class="short" type="number" inputmode="decimal" min="0" step="any" value="${h(state.unitG)}"> g</label>` : ''}
      <h3>Its numbers</h3>
      <label><input type="radio" name="source" value="recipe"${state.source === 'recipe' ? ' checked' : ''}> From my recipe</label>
      <label><input type="radio" name="source" value="label"${state.source === 'label' ? ' checked' : ''}> From a label</label>
      ${state.source === 'recipe' ? `
        <p class="muted">Leave out water and salt. If cooking or baking changes the weight, weigh it once made. Otherwise leave the weight blank.</p>
        ${state.parts.map((p, i) => `<div class="food-part">
          <span class="fp-name">${h(FOODS[p.food] ? FOODS[p.food].l : p.food + ' (no longer available)')}</span>
          <input class="short" type="number" inputmode="decimal" min="0" step="any" data-g="${i}" value="${h(p.g)}"> g
          <button type="button" class="fp-remove" data-rm="${i}" aria-label="Remove">✕</button></div>`).join('')}
        <label>Add an ingredient <input name="search" value="${h(state.search)}" placeholder="oats, flour…" autocomplete="off"></label>
        ${hits.map(f => `<button type="button" class="food-hit" data-k="${h(f.k)}">${h(f.e)} ${h(f.l)}</button>`).join('')}
        <label>Weight once made <input name="baked" class="short" type="number" inputmode="decimal" min="0" step="any" value="${h(state.baked)}"> g</label>`
      : `<p class="muted">From the nutrition panel, per 100 ${L.ml ? 'ml' : 'g'}.</p>
        ${['kcal', 'p', 'f', 'c'].map(k => `<label>${{kcal: 'Calories (kcal)', p: 'Protein (g)', f: 'Fat (g)', c: 'Carbs (g)'}[k]}
          <input class="short" type="number" inputmode="decimal" min="0" step="any" name="l-${k}" value="${h(L[k])}"></label>`).join('')}
        ${state.counted === 'g' ? `<label><input type="checkbox" name="l-ml"${L.ml ? ' checked' : ''}> Measured in ml</label>` : ''}`}
      <div class="food-result-slot">${result()}</div>
      <div class="food-warn-slot">${labelWarn()}</div>
      <div class="food-preview-slot">${preview()}</div>
      <p class="food-msg">${h(offline && !state.msg ? 'You need a connection to add or change a food.' : state.msg)}</p>
      <div class="food-actions">
        <button type="button" class="food-btn" data-act="save"${state.busy || offline ? ' disabled' : ''}>Save</button>
        <button type="button" class="food-link" data-act="cancel">Cancel</button>
        ${o ? (state.confirmDelete
          ? `<span class="food-confirm">Delete this food? <button type="button" class="food-link" data-act="delete-yes">Delete</button>
             <button type="button" class="food-link" data-act="delete-no">Keep it</button></span>`
          : `<button type="button" class="food-link danger" data-act="delete"${offline ? ' disabled' : ''}>Delete this food</button>`) : ''}
      </div></div>`;
    wire();
  }

  /* field edits refresh only what depends on them: redrawing the whole form
     would replace the field the next tap lands on, and close the keyboard */
  function refresh(){
    for (const [sel, fn] of [['.food-result-slot', result], ['.food-warn-slot', labelWarn], ['.food-preview-slot', preview]]){
      const el = root.querySelector(sel); if (el) el.innerHTML = fn();
    }
  }
  function wire(){
    const $ = s => root.querySelector(s);
    $('[name=name]').addEventListener('input', e => { state.name = e.target.value; refresh(); });
    $('[name=emoji]').addEventListener('input', e => { state.emoji = e.target.value; });
    root.querySelectorAll('[name=pool]').forEach(b => b.addEventListener('change', e => {
      if (e.target.checked) state.pools.add(e.target.value); else state.pools.delete(e.target.value); refresh();
    }));
    root.querySelectorAll('[name=counted]').forEach(b => b.addEventListener('change', e => { state.counted = e.target.value; draw(); }));
    root.querySelectorAll('[name=source]').forEach(b => b.addEventListener('change', e => { state.source = e.target.value; draw(); }));
    for (const k of ['unitName', 'unitG', 'baked']){
      const el = $(`[name=${k}]`); if (el) el.addEventListener('input', e => { state[k] = e.target.value; refresh(); });
    }
    root.querySelectorAll('[data-g]').forEach(i => i.addEventListener('input', e => {
      state.parts[+i.dataset.g].g = e.target.value; refresh();
    }));
    root.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { state.parts.splice(+b.dataset.rm, 1); draw(); }));
    const search = $('[name=search]');
    if (search) search.addEventListener('input', e => {
      state.search = e.target.value; draw();
      const s = root.querySelector('[name=search]'); s.focus(); s.setSelectionRange(s.value.length, s.value.length);
    });
    root.querySelectorAll('.food-hit').forEach(b => b.addEventListener('click', () => {
      state.parts.push({food: b.dataset.k, g: ''}); state.search = ''; draw();
      const inputs = root.querySelectorAll('[data-g]'); if (inputs.length) inputs[inputs.length - 1].focus();
    }));
    for (const k of ['kcal', 'p', 'f', 'c']){
      const el = $(`[name=l-${k}]`); if (el) el.addEventListener('input', e => { state.label[k] = e.target.value; refresh(); });
    }
    const ml = $('[name=l-ml]');
    if (ml) ml.addEventListener('change', e => { state.label.ml = e.target.checked; draw(); });
    root.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => act(b.dataset.act)));
  }

  /* what stops a save, or '' */
  function problem(d){
    if (!d.name) return 'Give your food a name.';
    if (!d.pools.length) return 'Pick at least one thing to offer it instead of.';
    if (state.counted === 'unit' && !d.unit) return 'Say what one piece weighs.';
    if (d.source === 'recipe'){
      if (!state.parts.length) return 'Add the ingredients.';
      if (state.parts.some(p => !FOODS[p.food])) return 'Remove the ingredient that is no longer available.';
    } else if (!d.v) return 'Add all four numbers from the label.';
    if (!d.v || !(d.v[0] > 0)) return 'This food has no calories. Check the amounts.';
    return '';
  }
  async function act(what){
    if (what === 'cancel') return onDone(false);
    if (what === 'delete'){ state.confirmDelete = true; return draw(); }
    if (what === 'delete-no'){ state.confirmDelete = false; return draw(); }
    if (what === 'delete-yes') return write(() => data.deleteFood(food));
    if (what === 'save'){
      const d = draftFood(state, FOODS), why = problem(d);
      if (why){ state.msg = why; return draw(); }
      return write(() => data.saveFood({id: food, ...d}));
    }
  }
  async function write(fn){
    state.busy = true; state.msg = ''; draw();
    try { await fn(); onDone(true); }
    catch (e){
      state.busy = false;
      state.msg = e && e.kind === 'offline' ? 'You need a connection to add or change a food.' : 'Something went wrong. Try again';
      draw();
    }
  }

  draw();
  if (typeof window !== 'undefined'){
    window.addEventListener('online', onNet);
    window.addEventListener('offline', onNet);
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { GROUP_NAMES, groupName, pickerFoods, planGroups, labelOff, draftFood, mountFoodForm };
