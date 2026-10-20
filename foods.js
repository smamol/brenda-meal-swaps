/*
 * foods.js — the food library, shared by index.html (browser) and evals.js (Node).
 * Pulled out of index.html on 2026-10-20 (ARCHITECTURE.md, step 1). Values are
 * still pinned by nz-reference.json and verified by evals.js. Never guess.
 */
/* ---------- food library ----------
   v = [kcal, protein g, fat g, available carb g] per 100 g, straight from the
   NZ Food Composition Database (AFCD fallback, product label where neither has
   the food) — pinned by nz-reference.json, verified by evals.js. Never guess.
   u = unit foods: n/p name (singular/plural), g grams per unit, step rounding,
   min sensible count. ml = measured in millilitres (v per 100 ml).
   No portion limits (Sandy, 2026-10-20), with one exception she set the same
   day: no more than 4 rice cakes or corn thins (u.max). */
const FOODS = {
  /* cookedP = cooked protein per 100 g, from the pinned nz-reference *_cooked
     entries. Cooked weight is derived, not guessed: protein is conserved when
     meat is cooked (water/fat leave, protein stays), so
     cooked g = raw g × raw-protein ÷ cookedP. Prawns are bought cooked.
     form = 'raw' | 'cooked' on every meat that has both entries (step 2,
     2026-10-20): a swap list only offers meats in the planned line's form.
     Prawns and tinned tuna have no form — bought cooked/tinned, no raw pair —
     so they are offered against either. */
  chicken_raw:    {l:'chicken breast (raw)', e:'🍗', v:[98.5,22.5,0.8,0],  cookedP:28.2, form:'raw'},  // chicken_cooked
  fish_raw:       {l:'white fish (raw)',     e:'🐟', v:[96.6,20.3,1.6,0],  cookedP:25.2, form:'raw'},  // fish_cooked
  /* NZ king salmon (the salmon sold here) — far fattier than white fish, so a
     protein-matched swap shows a big fat difference; that is the real number */
  salmon_raw:     {l:'salmon (raw)',         e:'🍣', v:[260.5,18.2,21.2,0], cookedP:20.5, form:'raw'}, // salmon_cooked
  beef_raw:       {l:'lean beef (raw)',      e:'🥩', v:[107.6,20.4,2.8,0], cookedP:30.2, form:'raw'},  // beef_cooked
  pork_raw:       {l:'pork loin (raw)',      e:'🐖', v:[110.2,23.2,1.8,0], cookedP:29.4, form:'raw'},  // pork_cooked
  prawns_cooked:  {l:'prawns (cooked)',      e:'🍤', v:[104.2,23.7,0.9,0]},
  /* tinned tuna is eaten as it comes out of the tin — drained values, no cooked weight */
  tuna_water:     {l:'tinned tuna in spring water (drained)', e:'🐟', v:[117.1,26.6,1.0,0]},
  egg:            {l:'boiled egg',           e:'🥚', v:[130.5,14.6,7.9,0.3], u:{n:'boiled egg',p:'boiled eggs',g:50,step:1,min:1}},
  lentils_cooked: {l:'lentils (cooked)',     e:'🫘', v:[105.4,7.63,0.5,15.5]},

  /* rawC = raw/dry available-carb per 100 g. Available-carb is conserved when a
     carb cooks (only water changes), so raw/dry g = cooked g × cooked-carb ÷ rawC.
     dry:true → weighed dry as a grain (rice, pasta); else raw veg (kumara).
     kumara: NZ FoodFiles raw entry. rice/pasta: NZ retail labels. Couscous and
     potato have no pinned raw counterpart, so they show cooked only. */
  rice_cooked:    {l:'rice (cooked)',        e:'🍚', v:[132.4,2.78,0.4,28.7], rawC:79,   dry:true},
  pasta_cooked:   {l:'pasta (cooked)',       e:'🍝', v:[135.3,5.05,0.8,25.4], rawC:72.5, dry:true},
  couscous:       {l:'couscous (cooked)',    e:'🌾', v:[174.7,6.69,1.0,32.7]},
  kumara_cooked:  {l:'kumara (cooked)',      e:'🍠', v:[86.8,1.25,0.21,18.8], rawC:18.8},
  potato_cooked:  {l:'potato (cooked)',      e:'🥔', v:[54.5,1.67,0.1,10.8], rawC:12.8},

  /* pinned to Abe's "The Natural" (plain) bagel, 90g each — Sandy's brand */
  bagel:          {l:"bagel (Abe's, plain)", e:'🥯', v:[277,9.59,1.35,55.7], u:{n:"Abe's bagel",p:"Abe's bagels",g:90}},
  crumpet:        {l:'crumpet',              e:'🥞', v:[178.3,6.56,1.0,34.0], u:{n:'crumpet',g:50}},
  vogels:         {l:"slice Vogel's",        e:'🍞', v:[267.7,10.8,8.48,33.4], u:{n:"slice Vogel's",p:"slices Vogel's",g:40}},
  fruit_bread:    {l:'slice fruit toast',    e:'🍇', v:[265.8,8.8,3.7,47.3], u:{n:'slice fruit toast',p:'slices fruit toast',g:40}},
  /* pinned to Ceres Organics Brown Rice Cakes, Original — Sandy's brand */
  rice_cake:      {l:'rice cake (Ceres Organic)', e:'🍘', v:[380,8.0,2.1,82], u:{n:'Ceres rice cake',g:9,max:4}},  // Sandy: no more than 4,
  corn_thin:      {l:'corn thin',            e:'🌽', v:[344.2,8.13,1.2,73.3], u:{n:'corn thin',g:6,max:4}},  // Sandy: no more than 4,
  wrap:           {l:'large wrap',           e:'🌯', v:[279.6,8.75,7.31,42.1], u:{n:'large wrap',g:60}},

  /* pinned to Pic's Peanut Butter, Crunchy — Sandy's brand */
  peanut_butter:  {l:"peanut butter (Pic's Crunchy)", e:'🥜', v:[595,26.7,47.8,14.3]},
  almond_butter:  {l:'almond butter',        e:'🥜', v:[595.1,20.1,53.0,5.65]},
  almonds:        {l:'almonds',              e:'🌰', v:[595.1,20.1,53.0,5.65]},
  pumpkin_seeds:  {l:'pumpkin seeds',        e:'🎃', v:[568.8,31.1,47.5,1.4]},
  sunflower_seeds:{l:'sunflower seeds',      e:'🌻', v:[599.9,20.5,55.2,3.6]},
  mixed_seeds:    {l:'mixed seeds (LSA)',    e:'🌱', v:[525.8,19.4,45.7,2.49]},
  avocado:        {l:'avocado',              e:'🥑', v:[218.0,1.78,22.7,0.08]},
  hummus:         {l:'hummus',               e:'🧆', v:[140.5,6.94,6.22,11.3]},

  honey:          {l:'honey',                e:'🍯', v:[291.6,0.28,0.4,70.5]},
  jam:            {l:'jam',                  e:'🫙', v:[279.6,0.25,0.68,66.5]},

  banana:         {l:'banana',               e:'🍌', v:[94.9,1.03,0.3,20.8], u:{n:'banana',g:120}},
  apple:          {l:'apple',                e:'🍎', v:[50.9,0.21,0.3,10.7], u:{n:'apple',g:150}},
  kiwifruit:      {l:'kiwifruit',            e:'🥝', v:[55.9,0.73,0.57,10.7], u:{n:'kiwifruit',p:'kiwifruit',g:75}},
  orange:         {l:'orange',               e:'🍊', v:[41.3,1.06,0.05,8.17], u:{n:'orange',g:130}},
  pear:           {l:'pear',                 e:'🍐', v:[50.9,0.37,0.3,10.0], u:{n:'pear',g:150}},
  mandarin:       {l:'mandarin',             e:'🍊', v:[40.9,0.91,0.2,8.11], u:{n:'mandarin',g:70}},
  blueberries:    {l:'blueberries',          e:'🫐', v:[50.4,0.63,0.3,9.3]},
  strawberries:   {l:'strawberries',         e:'🍓', v:[28.7,0.64,0.37,4.8]},
  raspberries:    {l:'raspberries',          e:'🍓', v:[45.2,1.17,0.95,5.8]},

  /* pinned to Whittaker's 92% Cocoa Ghana Intense Dark label (2530 kJ/100g), not
     generic AFCD dark chocolate — Sandy's brand, per her Sep 2026 base-plan swap */
  dark_choc:      {l:'dark chocolate (Whittaker’s 92%)', e:'🍫', v:[604.7,13.1,47.0,14.2]},
  /* pinned to Sanitarium Ricies — Sandy's brand (NZ's actual product name) */
  rice_bubbles:   {l:'Ricies (Sanitarium)',  e:'🥣', v:[380,6.3,0.5,85.4]},
  granola:        {l:'granola',              e:'🥣', v:[425.4,8.81,14.4,60.0]},
  muesli:         {l:'muesli',               e:'🥣', v:[393.4,10.8,10.8,59.2]},
  weetbix:        {l:'Weet-Bix',             e:'🌾', v:[329.8,12.5,2.3,58.4], u:{n:'Weet-Bix',p:'Weet-Bix',g:15}},

  cheese:         {l:'cheese',               e:'🧀', v:[413.5,24.6,35.6,0.0]},
  /* generic chutney, no NZ/AFCD row — pinned to Barker's Sundried Tomato & Olive
     Chutney label (581 kJ/100g) per FSANZ-RULE.md's label fallback */
  chutney:        {l:'chutney',              e:'🥫', v:[138.9,2.1,2.1,28.8]},
  /* whole-snack alternatives to the PB + jam on both snacks — Livi's Rest day
     footnote ("cheese & tomato / cottage cheese + honey"), added 2026-09-13 at
     Sandy's request for every day. Cottage cheese is the standard full-fat row
     (NZ F11), not the 1% light one — "normal full-fat cottage cheese" */
  tomato:         {l:'tomato',               e:'🍅', v:[14.8,0.38,0.16,2.27]},
  cottage_cheese: {l:'cottage cheese (full-fat)', e:'🧀', v:[94.6,13.7,3.5,2.0]},

  /* whole-snack alternative — per 100g DRY mix (serving = 42g; milk listed separately) */
  swolecake:      {l:'SwoleCakes pancake mix', e:'🥞', v:[365.7,28.4,5.1,49.8]},
  /* whole-serving alternative — pinned to the 425ml Rokeby Dutch Chocolate Protein
     Smoothie bottle label; v is per-100ml so the fixed 1-bottle unit gives the
     label's 287 cal/30g P/6.4g F/27.2g C */
  rokeby_smoothie:{l:'Rokeby protein smoothie (Dutch Chocolate)', e:'🥤', v:[67.5,7.06,1.51,6.4],
    u:{n:'Rokeby protein smoothie',g:425,step:1,min:1}},
  /* whole-serving alternative — pinned to the 250ml Sanitarium Up&Go Protein
     Energize Vanilla bottle label (85 cal/7.1g P/1.8g F/9.6g C per 100ml, so
     212.5 cal/17.75g P/4.5g F/24g C per bottle); considerably less protein-dense
     than Rokeby (30g P/425ml vs 17.75g P/250ml) */
  upandgo_vanilla:{l:'Up&Go Protein Energize (Vanilla)', e:'🥛', v:[85,7.1,1.8,9.6],
    u:{n:'Up&Go Protein Energize (250ml bottle)',g:250,step:1,min:1}},

  /* whole-snack alternative — Sandy's home-baked blueberry protein slice, derived
     over the finished 872 g tray she weighed: 100g raw egg (NZ G1016) + 30g Go Good
     whey isolate + 4g vanilla extract (AFCD F009350) + 125ml almond milk (NZ C1127)
     + 180g rolled oats (NZ E1075) + 40g chia seed (NZ Q1026) + 200g blueberries
     (NZ L1050) + 100g 72% dark chocolate (NZ W1026), no added sweetener.
     Tray totals 1768 cal / 82g P / 78g F / 158g C; v is that ÷ 8.72 */
  blueberry_slice:{l:'blueberry protein slice', e:'🫐', v:[202.7,9.35,8.93,18.11]},

  /* intra fuels — v per unit via nominal 100 g unit (label values, per item) */
  sis_gel:        {l:'SiS isotonic gel',     e:'💧', v:[87,0,0,22], u:{n:'SiS isotonic gel',p:'SiS isotonic gels',g:100,step:0.5}},
  /* pinned to Wattie's for Baby Apple, Peach & Mango 120g pouch label — Sandy's brand */
  fruit_pouch:    {l:"fruit pouch (Wattie's Apple, Peach & Mango)", e:'🧃', v:[70.5,0.4,0.1,15.7], u:{n:'fruit pouch',p:'fruit pouches',g:100,step:0.5}},
  sports_drink:   {l:'sports drink',         e:'🥤', v:[31.2,0,0,7.6], ml:true},

  /* base-only foods (never offered as swaps) */
  feta:           {l:'feta',                 e:'🧀', v:[279.6,16.9,23.4,1.1]},
  yoghurt:        {l:'Greek yoghurt',        e:'🥛', v:[74,9.5,2.8,2.7]},
  salad:          {l:'salad',                e:'🥗', v:[21.3,1.94,0.31,1.8]},
  canned_tomato:  {l:'canned tomatoes',      e:'🍅', v:[18.6,1.13,0.1,2.54]},
  /* veg alternatives to canned tomatoes, all boiled/steamed except bok choy
     (NZ database has no cooked bok choy entry, raw used instead) — Sandy's
     request 2026-09. greens/spinach keys and values match the same NZ-pinned
     entries Anna's app already uses */
  greens:         {l:'broccoli',              e:'🥦', v:[30.4,3.03,0.5,1.75]},
  spinach:        {l:'spinach',               e:'🥬', v:[19.4,2.81,0.4,0.0]},
  courgette:      {l:'courgette',             e:'🥒', v:[16.0,2.1,0.2,0.7]},
  bok_choy:       {l:'bok choy',              e:'🥬', v:[20.1,1.9,0.2,1.7]},
  brussels_sprout:{l:'brussels sprouts',      e:'🥦', v:[45.4,3.2,0.5,5.2]},
  oats:           {l:'oats',                 e:'🥣', v:[360.9,12.2,7.24,56.7]},
  flaxseed:       {l:'flaxseed',             e:'🌱', v:[451.7,18.4,37.0,0.7]},
  /* pinned to Go Good Whey Protein Isolate, Unflavoured. Both Sandy and Brenda
     eat it; in swap terms it is Brenda's brand (plans/brenda.js), and it sits
     in no shared group. Keyed whey_isolate, not whey: Anna's frozen app pins a
     different, generic whey to the "whey" reference key */
  whey_isolate:   {l:'whey (Go Good Isolate, unflavoured)', e:'💪', v:[375,89,1,1]},
  almond_milk:    {l:'almond milk',          e:'🥛', v:[17.0,0.54,1.4,0.2]},
  /* ---------- merged from Brenda's app (step 2, 2026-10-20) ----------
     Same pins as her page had; the 19 foods both apps carried already agreed on
     every value. Units and labels are Sandy's, and a plan
     line that needs Brenda's wording or size says so itself (plans/brenda.js). */
  /* rawP = raw protein per 100 g, from the pinned nz-reference *_raw entries, so
     raw g = cooked g × cooked-protein ÷ rawP */
  chicken_cooked: {l:'chicken (cooked)',      e:'🍗', v:[138.9,28.2,2.73,0.0], rawP:22.5, form:'cooked'},
  beef_cooked:    {l:'lean beef (cooked)',    e:'🥩', v:[188.8,30.2,7.48,0.0], rawP:20.4, form:'cooked'},
  pork_cooked:    {l:'pork loin (cooked)',    e:'🐖', v:[177.1,29.4,6.5,0.0],  rawP:23.2, form:'cooked'},
  fish_cooked:    {l:'fish (cooked)',         e:'🐟', v:[115.7,25.2,1.5,0.0],  rawP:20.3, form:'cooked'},
  /* added in step 2 so salmon exists in both forms like every other meat */
  salmon_cooked:  {l:'salmon (cooked)',       e:'🍣', v:[294,20.5,23.9,0.0],   rawP:18.2, form:'cooked'},
  /* pinned to Sealord Olive Oil Tuna Sensations label — Brenda's brand. Tinned,
     so no raw pair and no form */
  tuna_oil:       {l:'tinned tuna in olive oil (Sealord)', e:'🐟', v:[140,25.6,4.1,0.0]},
  /* kumara/pumpkin: NZ FoodFiles raw entries */
  pumpkin_cooked: {l:'pumpkin (cooked)',      e:'🎃', v:[42.8,1.12,0.42,7.05], rawC:6.7},
  /* pinned to a Sourdough 6-Pita-Breads pack label (brand name not visible in
     the photo Sandy sent — confirm manufacturer if it matters), 70g/pita */
  pita_wholemeal: {l:'wholemeal pita (sourdough)', e:'🫓', v:[253.4,8.0,3.8,49.1], u:{n:'wholemeal pita',p:'wholemeal pitas',g:70}},
  spinach_wrap:   {l:'low carb spinach wrap', e:'🌯', v:[181.7,9.83,7.33,11.17], u:{n:'low carb spinach wrap (Rebel)',p:'low carb spinach wraps (Rebel)',g:60}},
  farrahs_tortilla:{l:"Farrah's low carb tortilla", e:'🌮', v:[241.4,8.0,7.7,24.7], u:{n:"Farrah's low carb tortilla",p:"Farrah's low carb tortillas",g:24}},
  mayo_lite:      {l:'lite mayo / Perinaise', e:'🥄', v:[284.4,0.52,21.2,23.2]},
  /* snack options — edam_snack is per packet via nominal 100 g unit */
  edam_snack:     {l:'Edam + rice crackers snack packet', e:'🧀', v:[125.5,6.6,5.94,11.35], u:{n:'Edam + rice crackers snack packet',p:'Edam + rice crackers snack packets',g:100,step:0.5}},
  biltong:        {l:'biltong / bitemeat',    e:'🥩', v:[315,58.0,7.9,2.7]},
  chickpeas_roasted:{l:'roasted chickpeas',   e:'🫘', v:[320.3,22.4,5.0,38.7]},
  mixed_nuts:     {l:'mixed nuts',            e:'🌰', v:[609.5,22.6,52.5,10.1]},
  /* choc_slab pinned to Whittaker's Dark Ghana 72% — Brenda's brand */
  choc_slab:      {l:"mini Whittaker's Dark Ghana slab", e:'🍫', v:[554,11.4,34,51.1], u:{n:"mini Whittaker's Dark Ghana slab (15g)",p:"mini Whittaker's Dark Ghana slabs (15g)",g:15,step:0.5}},
  kefir:          {l:'kefir',                 e:'🥛', v:[48,3.5,2.1,3.8]},
  /* oats_seeds is per serve via nominal 100 g unit */
  oats_seeds:     {l:'oats + nuts/seeds',     e:'🥣', v:[189.4,6.6,8.02,20.14], u:{n:'serve of 35g oats + 12g nuts/seeds',p:'serves of 35g oats + 12g nuts/seeds',g:100,step:1}},
  chobani_lite:   {l:'natural yoghurt (Chobani lite)', e:'🥛', v:[56,9.3,0.2,4.0]},
};

/* Node: evals.js and the loaders require this file. Browser: plain script, FOODS is global. */
if (typeof module !== 'undefined' && module.exports) module.exports = { FOODS };
