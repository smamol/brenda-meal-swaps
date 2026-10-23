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
    effectivePools[name] = {...pool, keys};
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
     calories AND protein, fat and carbs, or within 2 g (8 cal) where 10% is
     less than that, so a line with 0.6 g of fat isn't held to 0.06 g. The
     portion isn't matched on one macro: each weighable amount around that
     point is tried, and the one closest on all four is kept, if it fits.
     There is no upper portion limit except a unit food's u.max where one is
     set (rice cakes, corn thins: 4). A line with nothing that fits shows as
     planned. */
  const FLOOR = [8, 2, 2, 2];
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
    for (const k of pool.keys){
      if (k === ing.k && !ing.generic) continue;   /* generic slots list their own base food back, rendered "as planned" */
      const F = FOODS[k], per = F.v[pool.b];
      if (form && F.form && F.form !== form) continue;   /* raw line → raw meats only, cooked → cooked */
      if (!per) continue;
      const need = target / per * 100;
      let best = null;
      for (const [g, label] of portions(F, k, need)){
        const m = scaleV(F.v, g), score = miss(base, m);
        if (!best || score < best.score - 1e-9 || (Math.abs(score - best.score) <= 1e-9 && Math.abs(g - need) < Math.abs(best.g - need)))
          best = {g, label, m, score};
      }
      if (!best || !fits(base, best.m)) continue;
      out.push({k, e:F.e, label:best.label, m:best.m, d:best.m.map((x,i)=>x-base[i]), self:k===ing.k});
    }
    return out;
  }
  /* Whole-meal alternatives (meal.mealSwaps): curated combos that replace the
     entire snack — e.g. protein pancakes + a banana — under the same rule on
     calories and every macro; one that doesn't fit isn't shown. */
  function mealSwapAlts(meal){
    if (!meal.mealSwaps) return [];
    const base = mealMacros(meal);
    return meal.mealSwaps.map(ms => {
      const m = [0,0,0,0];
      for (const p of ms.parts){ const v = ingMacros(p); for (let i=0;i<4;i++) m[i]+=v[i]; }
      return {e: ms.e, label: ms.parts.map(ingLabel).join(' + '), m, d: m.map((x,i)=>x-base[i]), parts: ms.parts};
    }).filter(alt => fits(base, alt.m));
  }
  return { effectivePools, scaleV, ingAmountG, ingMacros, mealMacros, fmtU, unitLabel, roundW, weightTag, ingLabel, computeSwaps, mealSwapAlts, fits };
}

/* Node: evals.js requires this file. Browser: plain script, createEngine is global. */
if (typeof module !== 'undefined' && module.exports) module.exports = { createEngine };
