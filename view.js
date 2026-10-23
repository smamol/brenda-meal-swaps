/*
 * view.js — draws one person's plan (step 3, 2026-10-23). Moved out of
 * index.html so the same code renders a plan from the database, from the
 * phone's cache, or straight from the vault files (test/render.html).
 *
 *   mountPlan(root, bundle, {onFlag, status})
 *
 * bundle = {plan, foods, pools, brand, coachName, loadedAt, clientId}. The
 * engine is built from the bundle's own plan, so a coach opening a client sees
 * that client's dislikes, brands and colours, never their own. onFlag, when
 * given, puts a "Something's wrong with this swap" button on every swap row
 * (coach and admin views only). The chosen day is remembered by name.
 */
const STYLE = {
  pre:      {em:"☕", bg:"#FCF2D3", fg:"#082B35"},
  breakfast:{em:"🥣", bg:"#E0F3F7", fg:"#082B35"},
  intra:    {em:"💧", bg:"#E9F5D9", fg:"#082B35"},
  snack:    {em:"🍎", bg:"#FDEEEB", fg:"#082B35"},
  lunch:    {em:"🍽️", bg:"#DDECC6", fg:"#082B35"},
  dinner:   {em:"🌙", bg:"#F9EAE7", fg:"#082B35"},
  dessert:  {em:"🍫", bg:"#FBF2D5", fg:"#082B35"},
};
const BASIS_NAME = {0:'same calories', 1:'same protein', 2:'same fat', 3:'same carbs'};
const DAY_KEY = 'mealday-name';

const R = x => Math.round(x);
function macroLine(m){
  return `<span class="m-cal">${R(m[0])} cal</span> · <span class="m-pro">${R(m[1])}g P</span> · <span class="m-fat">${R(m[2])}g F</span> · <span class="m-carb">${R(m[3])}g C</span>`;
}
function ingSub(m){
  return `${R(m[0])} cal · ${R(m[1])}P · ${R(m[2])}F · ${R(m[3])}C`;
}
function deltaLine(swap, basis){
  if (swap.self) return 'as planned';   /* generic slot listing its own base */
  const DEF = [[0,'m-cal','cal',''],[1,'m-pro','P','g '],[2,'m-fat','F','g '],[3,'m-carb','C','g ']];
  const parts = [];
  const [bi, bcls, bltr, bunit] = DEF[basis];
  const db = R(swap.d[basis]);
  parts.push(`<span class="${bcls}">${Math.abs(db) < 1 ? '=' : (db > 0 ? '+' : '−') + Math.abs(db) + bunit}${bltr}</span>`);
  for (const [i, cls, ltr, unit] of DEF){
    if (i === basis) continue;
    const d = R(swap.d[i]);
    const min = i === 0 ? 5 : 1;
    if (Math.abs(d) < min) continue;
    parts.push(`<span class="${cls}">${d > 0 ? '+' : '−'}${Math.abs(d)}${unit}${ltr}</span>`);
  }
  return parts.length > 1 || Math.abs(db) >= 1 ? parts.join(' · ') : parts[0] + ' · near-exact match';
}
/* "22 Oct", on the NZ calendar */
function shortDate(iso){
  return new Date(iso).toLocaleDateString('en-NZ', {day:'numeric', month:'short', timeZone:'Pacific/Auckland'});
}

function mountPlan(root, bundle, opts = {}){
  const { plan: PLAN, foods: FOODS, pools: POOLS, brand } = bundle;
  const { ingMacros, mealMacros, ingLabel, computeSwaps, mealSwapAlts } =
    createEngine(FOODS, POOLS, {dislikes: PLAN.dislikes, brands: PLAN.brands});
  const DAYS = PLAN.days.map(d => ({...d, meals: d.meals.map(k => PLAN.meals[k])}));
  for (const [k, v] of Object.entries((brand && brand.vars) || {})) root.style.setProperty(k, v);

  root.innerHTML = `<div class="tabs" id="tabs"></div>
  <div class="targets">
    <h2 id="targets-title">Day Targets</h2>
    <p class="targets-sub" id="targets-sub"></p>
    <div class="stats" id="stats"></div>
  </div>
  <div id="meals"></div>
  <footer id="foot"></footer>`;
  const tabsEl = root.querySelector('#tabs'), statsEl = root.querySelector('#stats'),
    mealsEl = root.querySelector('#meals'), titleEl = root.querySelector('#targets-title'),
    subEl = root.querySelector('#targets-sub'), footEl = root.querySelector('#foot');

  /* what a flag button reports, by row */
  let flags = [];
  function swapRows(swaps, basis, ctx){
    return swaps.map(sw => {
      let btn = '';
      if (opts.onFlag){
        flags.push({...ctx, swap: sw.label});
        btn = `<button class="flag" type="button" data-f="${flags.length - 1}">Something's wrong with this swap</button>`;
      }
      return `<div class="swap"><div class="swap-em">${sw.e}</div><div class="swap-txt">
    <div class="swap-name">${sw.label}</div>
    <div class="swap-d">${deltaLine(sw, basis)}</div>${btn}</div></div>`;
    }).join('');
  }

  function render(day){
    flags = [];
    const t = day.meals.reduce((a,meal)=>{
      const m = mealMacros(meal);
      return [a[0]+m[0], a[1]+m[1], a[2]+m[2], a[3]+m[3]];
    }, [0,0,0,0]);
    if (PLAN.header === 'targets'){
      /* the dietitian's targets, verbatim, under a fixed "Day Targets" heading */
      const T = PLAN.targets;
      statsEl.innerHTML = `
    <div class="stat cal"><b>~${T.cal}</b><span>cal</span></div>
    <div class="stat pro"><b>${T.p}g</b><span>protein</span></div>
    <div class="stat fat"><b>${T.f}g</b><span>fat</span></div>
    <div class="stat carb"><b>${T.c}g</b><span>carbs</span></div>`;
    } else {
      titleEl.textContent = `${day.name} — Day Total`;
      subEl.textContent = `${day.hint} · ${day.was}`;
      statsEl.innerHTML = `
    <div class="stat cal"><b>${R(t[0])}</b><span>cal</span></div>
    <div class="stat pro"><b>${R(t[1])}g</b><span>protein</span></div>
    <div class="stat fat"><b>${R(t[2])}g</b><span>fat</span></div>
    <div class="stat carb"><b>${R(t[3])}g</b><span>carbs</span></div>`;
    }

    mealsEl.innerHTML = day.meals.map((meal, mi)=>{
      const s = STYLE[meal.type];
      const mm = mealMacros(meal);
      const whole = {day: day.name, meal: meal.title, planned: meal.title};
      if (meal.folded){
        const fSwaps = meal.ing.filter(i=>i.pool).map(ing=>({ing, swaps:computeSwaps(ing)})).filter(x=>x.swaps.length);
        const mAlts = mealSwapAlts(meal);
        const hasSwaps = fSwaps.length > 0 || mAlts.length > 0;
        const badge = hasSwaps ? `<span class="badge">${fSwaps.length + (mAlts.length ? 1 : 0)} swappable</span>`
                                : `<span class="badge none">as planned</span>`;
        const ingSwapHtml = fSwaps.map(({ing, swaps})=>
            `<div class="swaps-label">Swap for — ${BASIS_NAME[POOLS[ing.pool].b]} — instead of ${ingLabel(ing)}</div>${
            swapRows(swaps, POOLS[ing.pool].b, {day: day.name, meal: meal.title, planned: ingLabel(ing)})}`).join('');
        const mealSwapHtml = mAlts.length ? `<div class="swaps-label">Swap the whole meal — ${BASIS_NAME[0]}</div>${swapRows(mAlts, 0, whole)}` : '';
        const swapHtml = hasSwaps ? `<div class="fold-swaps">${ingSwapHtml}${mealSwapHtml}</div>` : '';
        return `<div class="meal ${hasSwaps?'swappable':''}">
        <div class="meal-head">
          <div class="icon" style="background:${s.bg};color:${s.fg}">${s.em}</div>
          <div class="meal-body">
            <div class="meal-kicker"><span class="name">${meal.title}</span>${badge}</div>
            <div class="items">${meal.ing.map(ingLabel).join(' + ')}</div>
            <div class="macros">${macroLine(mm)}</div>
          </div>
          ${hasSwaps?'<div class="chev">▼</div>':''}
        </div>${swapHtml}</div>`;
      }
      const rows = meal.ing.map((ing, ii)=>{
        const F = FOODS[ing.k];
        const swaps = ing.pool ? computeSwaps(ing) : [];
        const swappable = swaps.length > 0;
        const swapHtml = swappable ? `<div class="swaps">
          <div class="swaps-label">Swap for — ${BASIS_NAME[POOLS[ing.pool].b]}</div>${
          swapRows(swaps, POOLS[ing.pool].b, {day: day.name, meal: meal.title, planned: ingLabel(ing)})
        }</div>` : '';
        return `<div class="ing ${swappable?'swappable':''}" data-m="${mi}" data-i="${ii}">
        <div class="ing-line">
          <div class="ing-em">${F.e}</div>
          <div class="ing-txt">
            <div class="ing-name">${ingLabel(ing)}</div>
            <div class="ing-sub">${ingSub(ingMacros(ing))}</div>
          </div>
          ${swappable?'<div class="chev">▼</div>':''}
        </div>${swapHtml}</div>`;
      }).join('');
      const nSwap = meal.ing.filter(i=>i.pool && computeSwaps(i).length).length;
      const badge = nSwap ? `<span class="badge">${nSwap} swappable</span>`
                          : `<span class="badge none">as planned</span>`;
      const mAlts = mealSwapAlts(meal);
      const msHtml = mAlts.length ? `<div class="fold-swaps">
        <div class="swaps-label">Swap the whole snack — ${BASIS_NAME[0]}</div>${swapRows(mAlts, 0, whole)}</div>` : '';
      return `<div class="meal ${mAlts.length?'swappable':''}">
      <div class="meal-head">
        <div class="icon" style="background:${s.bg};color:${s.fg}">${s.em}</div>
        <div class="meal-body">
          <div class="meal-kicker"><span class="name">${meal.title}</span>${badge}</div>
          <div class="macros">${macroLine(mm)}</div>
        </div>
        ${mAlts.length?'<div class="chev">▼</div>':''}
      </div>
      <div class="ings">${rows}</div>${msHtml}</div>`;
    }).join('');

    mealsEl.querySelectorAll('.ing.swappable .ing-line').forEach(h=>{
      h.addEventListener('click',()=>h.parentElement.classList.toggle('open'));
    });
    mealsEl.querySelectorAll('.meal.swappable .meal-head').forEach(h=>{
      h.addEventListener('click',()=>h.parentElement.classList.toggle('open'));
    });
    mealsEl.querySelectorAll('.flag').forEach(b=>{
      b.addEventListener('click', e=>{ e.stopPropagation(); opts.onFlag(flags[+b.dataset.f]); });
    });

    const planLine = bundle.loadedAt
      ? `<br>Plan from ${bundle.coachName || 'your dietitian'}, updated ${shortDate(bundle.loadedAt)}` : '';
    const statusLine = opts.status ? `<br><span class="status">${opts.status}</span>` : '';
    footEl.innerHTML = `<img class="n8mark" src="${brand.logo}" alt="${brand.logoAlt}">
    ${brand.footer}${planLine}${statusLine}<br>
    <span style="opacity:.6">v${typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''}</span>`;
  }

  /* the day by name, so a changed plan never opens on the wrong day; the
     step 2 index key is read once for phones that still carry it */
  let active = 0;
  function buildTabs(){
    tabsEl.innerHTML=DAYS.map((d,i)=>
      `<div class="tab ${i===active?'active':''}${d.archived?' archived':''}" data-i="${i}">${d.name}<span class="kc">${d.was}</span></div>`
    ).join('');
    tabsEl.querySelectorAll('.tab').forEach(t=>{
      t.addEventListener('click',()=>{
        active=+t.dataset.i;
        try { localStorage.setItem(DAY_KEY, DAYS[active].name); } catch (e) {}
        buildTabs(); render(DAYS[active]);
        window.scrollTo({top:0,behavior:'smooth'});
      });
    });
  }

  /* one day → no tabs; a fixed targets header → no day sub-line */
  if (PLAN.header === 'targets') subEl.remove();
  if (DAYS.length > 1){
    let stored = null, old = null;
    try { stored = localStorage.getItem(DAY_KEY); old = localStorage.getItem('mealday2'); } catch (e) {}
    const byName = DAYS.findIndex(d => d.name === stored);
    active = byName >= 0 ? byName : (stored == null && old != null ? Math.min(+old || 0, DAYS.length-1) : 0);
    buildTabs();
  } else tabsEl.remove();
  render(DAYS[active]);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { mountPlan };
