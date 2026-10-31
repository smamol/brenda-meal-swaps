/*
 * engine.js — the swap maths, pure. Takes the food library and the swap pools
 * as input and returns the functions the page and evals.js use. Pulled out of
 * index.html on 2026-10-20 (ARCHITECTURE.md, step 1). No globals, no DOM.
 *
 *   const E = createEngine(FOODS, POOLS, {dislikes, brands});
 *   E.mealMacros(meal)   -> [kcal, p, f, c]
 *   E.computeSwaps(ing)  -> [{k, e, label, m, d, self}, ...]
 *
 * person (step 2, 2026-10-20) is the one thing that differs per client: foods
 * they don't like leave every group, and their brand products ({k, pool}) join
 * the named group for them alone. Omit it for the shared groups as they are.
 */
function createEngine(FOODS, POOLS, person = {}){
  const scaleV = (v,g) => v.map(x => x*g/100);
  const dislikes = new Set(person.dislikes || []);
  const effectivePools = {};
  for (const [name, pool] of Object.entries(POOLS)){
    const keys = pool.keys.filter(k => !dislikes.has(k));
    for (const br of person.brands || []) if (br.pool === name && !keys.includes(br.k)) keys.push(br.k);
    const always = (pool.always || []).filter(k => !dislikes.has(k));
    effectivePools[name] = {...pool, keys, always};
  }
  function ingAmountG(ing){
    if (ing.g != null) return ing.g;
    if (ing.ml != null) return ing.ml;
    return ing.u * FOODS[ing.k].u.g;
  }
  function ingMacros(ing){ return scaleV(FOODS[ing.k].v, ingAmountG(ing)); }
  function mealMacros(meal){
    const t = [0,0,0,0];
    for (const ing of meal.ing){ const m = ingMacros(ing); for (let i=0;i<4;i++) t[i]+=m[i]; }
    return t;
  }
  function fmtU(u){
    const w = Math.floor(u), f = u - w;
    return (w ? w : '') + (f >= 0.25 ? '½' : '') || String(w);
  }
  function unitLabel(F, u){ return `${fmtU(u)} ${u > 1 ? (F.u.p || F.u.n + 's') : F.u.n}`; }
  /* second weight, derived not guessed:
       raw meats — protein is conserved, so cooked g = raw g × raw-protein ÷ cookedP
       cooked meats — the same the other way, raw g = cooked g × cooked-protein ÷ rawP
       cooked carbs — available-carb is conserved, so raw/dry g = cooked g × cooked-carb ÷ rawC
     Rounded to 5 g for larger weights, 1 g for the small portions. */
  function roundW(g){ return g >= 50 ? Math.round(g / 5) * 5 : Math.round(g); }
  function weightTag(k, g){
    const F = FOODS[k];
    if (F.cookedP != null) return ` · ${roundW(g * F.v[1] / F.cookedP)}g cooked`;
    if (F.rawP != null) return ` · ${roundW(g * F.v[1] / F.rawP)}g raw`;
    if (F.rawC != null) return ` · ${roundW(g * F.v[3] / F.rawC)}g ${F.dry ? 'dry' : 'raw'}`;
    return '';
  }
  function ingLabel(ing){
    if (ing.t) return ing.t + (ing.g != null ? weightTag(ing.k, ing.g) : '');
    const F = FOODS[ing.k];
    if (ing.u != null) return unitLabel(F, ing.u);
    if (ing.ml != null) return `${ing.ml}ml ${F.l}`;
    return `${ing.g}g ${F.l}${weightTag(ing.k, ing.g)}`;
  }
  /* Sandy's rule (2026-10-23): a swap is within 10% of the original on
     calories AND protein, fat and carbs, or within 4 g (16 cal) where 10% is
     less than that, so a line with 0.6 g of fat isn't held to 0.06 g. (First
     2 g; Sandy raised it to 4 g the same day so pasta stays a swap for rice.) The
     portion isn't matched on one macro: each weighable amount around that
     point is tried, and the one closest on all four is kept, if it fits.
     There is no upper portion limit except a unit food's u.max where one is
     set (rice cakes, corn thins: 4). A line with nothing that fits shows as
     planned. */
  const FLOOR = [16, 4, 4, 4];
  function miss(base, m){
    return Math.max(...[0, 1, 2, 3].map(i => Math.abs(m[i] - base[i]) / Math.max(0.1 * Math.abs(base[i]), FLOOR[i])));
  }
  function fits(base, m){ return miss(base, m) <= 1 + 1e-9; }
  /* every weighable amount of food F between half and twice the amount that
     matches the group's measure: [grams, label] */
  function portions(F, k, need){
    const out = [];
    if (F.u){
      const step = F.u.step || 0.5;
      const hi = Math.max(step, Math.ceil(2 * need / F.u.g / step) * step);
      for (let u = Math.max(step, F.u.min || 0); u <= hi + 1e-9; u += step){
        if (F.u.max && u > F.u.max) break;   /* only rice cakes and corn thins: no more than 4 */
        out.push([u * F.u.g, unitLabel(F, u)]);
      }
    } else if (F.ml){
      for (let ml = 50; ml <= Math.max(50, 2 * need); ml += 50) out.push([ml, `${ml}ml ${F.l}`]);
    } else {
      const seen = new Set();
      for (let x = need / 2; x <= need * 2; x += Math.max(1, need / 200)){
        const g = x < 20 ? Math.round(x) : Math.round(x / 5) * 5;
        if (g < 5 || seen.has(g)) continue;
        seen.add(g); out.push([g, `${g}g ${F.l}${weightTag(k, g)}`]);
      }
    }
    return out;
  }
  function computeSwaps(ing){
    const pool = effectivePools[ing.pool];
    if (!pool) return [];
    const base = ingMacros(ing), target = base[pool.b];
    if (!target) return [];
    const form = FOODS[ing.k].form;
    const out = [];
    for (const k of new Set([...pool.keys, ...pool.always])){
      if (k === ing.k && !ing.generic) continue;   /* generic slots list their own base food back, rendered "as planned" */
      const F = FOODS[k];
      if (form && F.form && F.form !== form) continue;   /* raw line → raw meats only, cooked → cooked */
      /* pool.always: offered on every line, sized on calories alone, no fit check (Sandy, 2026-10-31) */
      const byCal = pool.always.includes(k) && k !== ing.k;
      const b = byCal ? 0 : pool.b, per = F.v[b];
      if (!per) continue;
      const need = base[b] / per * 100;
      let best = null;
      for (const [g, label] of portions(F, k, need)){
        const m = scaleV(F.v, g), score = byCal ? Math.abs(m[0] - base[0]) : miss(base, m);
        if (!best || score < best.score - 1e-9 || (Math.abs(score - best.score) <= 1e-9 && Math.abs(g - need) < Math.abs(best.g - need)))
          best = {g, label, m, score};
      }
      if (!best || (!byCal && !fits(base, best.m))) continue;
      out.push({k, e:F.e, label:best.label, m:best.m, d:best.m.map((x,i)=>x-base[i]), self:k===ing.k, byCal});
    }
    return out;
  }
  /* Whole-meal alternatives (meal.mealSwaps): curated combos that replace the
     entire snack — e.g. protein pancakes + a banana — under the same rule on
     calories and every macro; one that doesn't fit isn't shown, unless it is
     the person's own (own:true, Sandy's pancakes, 2026-10-31). */
  function mealSwapAlts(meal){
    if (!meal.mealSwaps) return [];
    const base = mealMacros(meal);
    return meal.mealSwaps.map(ms => {
      const m = [0,0,0,0];
      for (const p of ms.parts){ const v = ingMacros(p); for (let i=0;i<4;i++) m[i]+=v[i]; }
      return {e: ms.e, label: ms.parts.map(ingLabel).join(' + '), m, d: m.map((x,i)=>x-base[i]), parts: ms.parts, own: !!ms.own};
    }).filter(alt => alt.own || fits(base, alt.m));
  }
  /* A client's own dishes (step 4, 2026-10-31; docs/plans/2026-10-31-step4-own-dishes-design.md).
     person.dishes: [{id, name, emoji, slot:{type,title}, parts}], each part a
     library food {food, g|ml|u} or the client's own product {product, g|ml};
     person.products: {id: {name, v:[cal,P,F,C] per 100, ml}}. Own products
     never enter FOODS or a pool, so no shared swap can offer one. A dish shows
     on every meal with its slot, the whole dish scaled by one factor to the
     meal's calories (Sandy: "it can scale e.g. 1 banana"), each part rounded
     to something you can weigh or count. A dish naming a food or product that
     no longer exists is left out. */
  const products = person.products || {}, dishes = person.dishes || [];
  function dishMatches(dish, meal){
    return !!dish.slot && dish.slot.type === meal.type && dish.slot.title === meal.title;
  }
  /* one part at scale s: [label, macros, fromLabel] */
  function dishPart(part, s){
    if (part.product != null){
      const P = products[part.product];
      const amt = part.ml != null ? part.ml : part.g;
      const x = amt * s, ml = !!P.ml || part.ml != null;
      const q = ml ? Math.max(5, Math.round(x / 5) * 5) : roundG(x, amt);
      return [`${q}${ml ? 'ml' : 'g'} ${P.name}`, scaleV(P.v, q), true];
    }
    const F = FOODS[part.food];
    if (part.u != null){
      const step = F.u.step || 0.5, lo = Math.max(0.5, F.u.min || 0);
      let u = Math.max(lo, Math.round(part.u * s / step) * step);
      if (F.u.max) u = Math.min(u, F.u.max);   /* rice cakes and corn thins: no more than 4 */
      return [unitLabel(F, u), scaleV(F.v, u * F.u.g), false];
    }
    if (part.ml != null){
      const ml = Math.max(5, Math.round(part.ml * s / 5) * 5);
      return [`${ml}ml ${F.l}`, scaleV(F.v, ml), false];
    }
    const g = roundG(part.g * s, part.g);
    return [`${g}g ${F.l}`, scaleV(F.v, g), false];
  }
  /* grams as portions() rounds them: 1 g under 20 g, else 5 g; never below 5 g
     unless the client entered less */
  function roundG(x, entered){
    const g = x < 20 ? Math.round(x) : Math.round(x / 5) * 5;
    return Math.max(entered >= 5 ? 5 : 1, g);
  }
  function dishKnown(dish){
    return Array.isArray(dish.parts) && dish.parts.length > 0 && dish.parts.every(p =>
      p.product != null ? !!products[p.product] :
      !!FOODS[p.food] && (p.u == null || !!FOODS[p.food].u));
  }
  function sizeDish(dish, target){
    const at = s => {
      const parts = dish.parts.map(p => dishPart(p, s)), m = [0,0,0,0];
      for (const [, v] of parts) for (let i=0;i<4;i++) m[i]+=v[i];
      return {parts, m};
    };
    const c0 = at(1).m[0];
    const s0 = c0 > 0 ? target / c0 : 1;
    let best = null;
    for (let f = 0.85; f <= 1.15 + 1e-9; f += 0.01){
      const s = s0 * f, r = at(s), miss = Math.abs(r.m[0] - target);
      if (!best || miss < best.miss - 1e-9 || (Math.abs(miss - best.miss) <= 1e-9 && Math.abs(f - 1) < Math.abs(best.f - 1)))
        best = {...r, miss, f};
    }
    return best;
  }
  function ownDishAlts(meal){
    const base = mealMacros(meal);
    return dishes.filter(d => dishMatches(d, meal) && dishKnown(d)).map(d => {
      const {parts, m} = sizeDish(d, base[0]);
      return {id: d.id, e: d.emoji || '🍽️', label: parts.map(p => p[0]).join(' + '), m,
        d: m.map((x,i)=>x-base[i]), own: true, parts: parts.map(([label, , fromLabel]) => ({label, fromLabel}))};
    });
  }
  return { effectivePools, scaleV, ingAmountG, ingMacros, mealMacros, fmtU, unitLabel, roundW, weightTag, ingLabel, computeSwaps, mealSwapAlts, fits, ownDishAlts, dishMatches, dishKnown };
}

/* Node: evals.js requires this file. Browser: plain script, createEngine is global. */
if (typeof module !== 'undefined' && module.exports) module.exports = { createEngine };
