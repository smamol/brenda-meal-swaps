/*
 * pools.js — the shared swap groups, the same for every client (step 2,
 * 2026-10-20). Swaps are Sandy's own layer on top of the dietitian's plan;
 * per person only their dislikes and their brand products change what they
 * see (plans/<id>.js, applied by createEngine). Brand foods never sit here.
 *
 *   b = what a swap must hold, as an index into [cal,P,F,C]: 0 calories,
 *   1 protein, 2 fat, 3 carbs — the group's main macro, or calories when its
 *   foods share none (veg, snack packs, dessert).
 */
const POOLS = {
  /* raw and cooked meats share one group; the engine only offers members in
     the planned line's form (FOODS[k].form), plus the form-less ones */
  protein: {b:1, keys:['chicken_raw','fish_raw','salmon_raw','beef_raw','pork_raw',
                       'chicken_cooked','fish_cooked','salmon_cooked','beef_cooked','pork_cooked',
                       'prawns_cooked','tuna_water','egg','lentils_cooked']},
  /* wraps and Farrah's tortillas sit here, not in bread: Sandy wants them only
     as a lunch or dinner swap, never for a snack or around training
     (2026-10-20), and only lunches and dinners carry these carbs */
  starch:  {b:3, keys:['rice_cooked','pasta_cooked','couscous','kumara_cooked','potato_cooked','pumpkin_cooked',
                       'wrap','spinach_wrap','farrahs_tortilla']},
  /* English muffin dropped 2026-09-12 — Sandy doesn't like them ("remove them
     from my list"), so it leaves every bread swap, not just the slice ones.
     Brenda's pita moved here from her old carbs group; all wraps went to
     starch (lunch and dinner only). */
  bread:   {b:3, keys:['bagel','crumpet','vogels','fruit_bread','rice_cake','corn_thin','pita_wholemeal']},
  /* spreads for rice cakes and crackers (was Sandy's "fats"). Sunflower seeds,
     pumpkin seeds and LSA (mixed_seeds — Linseed/Sunflower/Almond) dropped
     2026-09: loose seeds don't work as a spread ("just doesn't taste good") */
  spreads: {b:2, keys:['peanut_butter','almond_butter','almonds','avocado']},
  /* salad fats: Sandy's old fetaFree list merged with Brenda's old fats. The
     no-feta rule is gone (2026-10-20), so feta is an ordinary member */
  saladFats:{b:2, keys:['avocado','feta','mayo_lite','egg','pumpkin_seeds','sunflower_seeds','mixed_seeds','hummus']},
  sweet:   {b:3, keys:['honey','jam']},
  fruit:   {b:3, keys:['banana','apple','kiwifruit','orange','pear','mandarin','blueberries','strawberries','raspberries']},
  cereal:  {b:3, keys:['rice_bubbles','granola','muesli','weetbix']},
  treat:   {b:2, keys:['dark_choc','almonds','almond_butter','peanut_butter']},
  intra:   {b:3, keys:['sis_gel','fruit_pouch','sports_drink']},
  /* basis 0 (calories): these veg are too low and mismatched on P/F/C to
     macro-match sensibly — courgette/spinach/broccoli read protein-dominant
     boiled, brussels sprouts/tomatoes carb-dominant, so calorie parity is
     the only basis that makes portions come out sane across all of them */
  veg:     {b:0, keys:['canned_tomato','greens','spinach','courgette','bok_choy','brussels_sprout']},
  /* mixed snacks (cheese + crackers, jerky, chickpeas, nuts): no shared main macro */
  snackpack:{b:0, keys:['edam_snack','biltong','chickpeas_roasted','mixed_nuts']},
  /* dessert: Brenda's Whittaker's slab joins this group as her brand */
  dessert: {b:0, keys:['mandarin','kefir']},
  /* Brenda's breakfast guide alternative: oats + nuts/seeds or homemade muesli */
  oats:    {b:3, keys:['oats_seeds','muesli']},
};

/* Node: evals.js and the tests require this file. Browser: plain script, POOLS is global. */
if (typeof module !== 'undefined' && module.exports) module.exports = { POOLS };
