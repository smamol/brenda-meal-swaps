/*
 * plans/brenda.js — Brenda's plan (step 2, 2026-10-20). Meals verbatim from her
 * guide "2. BL nutrition updates (Aug 2026)", moved out of mealapp-brenda/
 * index.html. Group renames: carbs → starch, fats → saladFats, bmuesli → oats.
 * Her apple and banana keep her guide's "medium" wording and her 130 g apple,
 * stated on the line, since the shared library uses Sandy's 150 g apple.
 * Pinned in evals.js (BRENDA_BASE). deploy.js ships this file as plan.js.
 */
const PLAN = {
  id: 'brenda',
  header: 'targets',
  /* verbatim from the guide, fibre included (not shown, pinned in evals) */
  targets: {cal:1693, p:135, f:56, c:145, fib:28},
  /* her guide lists one breakfast alternative (homemade muesli), so her
     breakfast is swappable */
  swapFreeBreakfast: false,
  /* starting dislikes, set 2026-10-20 so her swap lists stay as they were when
     the groups became shared (test/dislikes.js) */
  dislikes: ['blueberries', 'strawberries', 'raspberries', 'salmon_cooked', 'tuna_water', 'egg',
             'lentils_cooked', 'couscous', 'pumpkin_seeds', 'sunflower_seeds', 'mixed_seeds', 'hummus'],
  /* her own products: they join the named group for her alone */
  brands: [
    {k:'tuna_oil', pool:'protein'},     // Sealord Olive Oil Tuna Sensations
    {k:'choc_slab', pool:'dessert'},    // Whittaker's Dark Ghana slab
    {k:'whey_isolate'},                 // Go Good Isolate — in her breakfast, no swaps
  ],
  meals: {
    preGym: {type:'pre', title:'Pre-Gym', ing:[
      {k:'banana', u:1, t:'1 medium banana', pool:'fruit'}]},
    breakfast: {type:'breakfast', title:'Breakfast', folded:true, ing:[
      {k:'oats_seeds', u:1, t:'35g rolled oats + 1 Tbsp (12g) nuts/seeds', pool:'oats'},
      {k:'almond_milk', ml:200, t:'unsweetened almond milk'},
      {k:'whey_isolate', g:30},
      {k:'chobani_lite', g:120, t:'120g natural yoghurt (Chobani lite)'},
      {k:'blueberries', g:100, t:'100g frozen blueberries'}]},
    snack1: {type:'snack', title:'Snack', ing:[
      {k:'apple', g:130, t:'1 medium apple', pool:'fruit'}]},
    lunch: {type:'lunch', title:'Lunch', ing:[
      {k:'chicken_cooked', g:120, pool:'protein'},
      {k:'rice_cooked', g:80, pool:'starch'},
      {k:'salad', g:140, t:'2 cups salad / vegetables'},
      {k:'avocado', g:50, t:'¼ avocado (50g)', pool:'saladFats'}]},
    snack2: {type:'snack', title:'Snack', ing:[
      {k:'apple', g:130, t:'1 medium apple', pool:'fruit'},
      {k:'edam_snack', u:1, pool:'snackpack'}],
      /* blueberry slice, added 2026-09-12 — lands on all four macros exactly */
      mealSwaps:[
        {e:'🫐', parts:[{k:'blueberry_slice', g:70}, {k:'banana', u:0.5, t:'½ medium banana'}]}
      ]},
    dinner: {type:'dinner', title:'Dinner', ing:[
      {k:'chicken_cooked', g:120, pool:'protein'},
      {k:'kumara_cooked', g:150, pool:'starch'},
      {k:'salad', g:140, t:'2 cups salad / vegetables'},
      {k:'avocado', g:50, t:'¼ avocado (50g)', pool:'saladFats'}]},
    dessert: {type:'dessert', title:'Dessert', ing:[
      {k:'choc_slab', u:1, pool:'dessert'}],
      /* blueberry slice, added 2026-09-12 — trades 2g of fat for 2g of protein
         against her 135g protein target, so it beats the chocolate it replaces.
         The 1-apple snack gets no slice swap: a plain apple is pure carbohydrate
         and the slice is protein- and fat-dense, so nothing calorie-matched lands
         near it on a 66 cal card. */
      mealSwaps:[
        {e:'🫐', parts:[{k:'blueberry_slice', g:40}]}
      ]},
  },
  days: [
    {name:'base', meals:['preGym','breakfast','snack1','lunch','snack2','dinner','dessert']},
  ],
};

/* Node: evals.js requires this file. Browser: plain script (as plan.js), PLAN is global. */
if (typeof module !== 'undefined' && module.exports) module.exports = { PLAN };
