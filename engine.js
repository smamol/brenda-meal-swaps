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
  /* A swap qualifies when its re-portioned amount lands within 10% of the base
     ingredient's pool macro after rounding to a weighable portion (Sandy's
     rule: nothing gets more headroom than 10%, so coarse unit roundings like
     half a bagel for a crumpet simply don't appear). There is no upper
     portion limit (Sandy, 2026-10-20: "No limits" — 610 g of pumpkin is fine)
     except a unit food's u.max where one is set (rice cakes, corn thins: 4). */
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
      let g, label;
      if (F.u){
        const step = F.u.step || 0.5;
        let u = Math.round(need / F.u.g / step) * step;
        if (F.u.min && u < F.u.min) u = F.u.min;
        if (u < step) u = step;
        if (F.u.max && u > F.u.max) continue;   /* only rice cakes and corn thins: no more than 4 */
        g = u * F.u.g; label = unitLabel(F, u);
      } else if (F.ml){
        const ml = Math.round(need / 50) * 50;
        if (ml < 50) continue;
        g = ml; label = `${ml}ml ${F.l}`;
      } else {
        g = need < 20 ? Math.round(need) : Math.round(need / 5) * 5;
        if (g < 5) continue;
        label = `${g}g ${F.l}${weightTag(k, g)}`;
      }
      const m = scaleV(F.v, g);
      if (Math.abs(m[pool.b] - target) / target > 0.10) continue;
      out.push({k, e:F.e, label, m, d:m.map((x,i)=>x-base[i]), self:k===ing.k});
    }
    return out;
  }
  /* Whole-meal alternatives (meal.mealSwaps): curated combos that replace the
     entire snack — e.g. protein pancakes + a banana — calorie-matched to the
     meal within the same 10% rule, other macros shown as honest differences. */
  function mealSwapAlts(meal){
    if (!meal.mealSwaps) return [];
    const base = mealMacros(meal);
    return meal.mealSwaps.map(ms => {
      const m = [0,0,0,0];
      for (const p of ms.parts){ const v = ingMacros(p); for (let i=0;i<4;i++) m[i]+=v[i]; }
      return {e: ms.e, label: ms.parts.map(ingLabel).join(' + '), m, d: m.map((x,i)=>x-base[i]), parts: ms.parts};
    });
  }
  return { effectivePools, scaleV, ingAmountG, ingMacros, mealMacros, fmtU, unitLabel, roundW, weightTag, ingLabel, computeSwaps, mealSwapAlts };
}

/* Node: evals.js requires this file. Browser: plain script, createEngine is global. */
if (typeof module !== 'undefined' && module.exports) module.exports = { createEngine };
