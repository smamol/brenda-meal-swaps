/*
 * data.js — the signed-in person's plan from Supabase, and the phone's copy of
 * it (step 3, 2026-10-23).
 *
 *   const D = createData(supabase, localStorage);
 *   D.fetchBundle(clientId?)  -> bundle (view.js)   own plan when omitted
 *   D.boot()                  -> {bundle, status}
 *   D.cached(), D.save(bundle)
 *   D.saveFood(f), D.deleteFood(id)   the client's own foods (2026-11-22)
 *   D.listCheckIns(), D.setCheckIn(day, status), D.clearCheckIn(day),
 *   D.cachedCheckIns()                the person's own check-ins (step 5)
 *
 * The bundle is cached whole under one key, so an offline phone never pairs an
 * old plan with a newer food library. boot() never saves: the page saves a
 * bundle only once it has drawn it, so a bundle that can't be drawn never
 * replaces a good copy. A failed network never signs anyone out and never
 * drops the cache. The cache goes only when the server definitely refuses the
 * session, when the account has no profile, or when the person signs out.
 */
const BUNDLE_KEY = 'mealswaps-bundle';
const CHECKINS_KEY = 'mealswaps-checkins';
const OFFLINE = "Couldn't check for updates";
const NO_NETWORK = 'Connect to the internet to sign in';
const NO_PLAN = "Your dietitian hasn't added your plan yet";
const SIGN_IN_AGAIN = 'Sign in again to get updates';
const WENT_WRONG = 'Something went wrong. Try again';
const DEFAULT_BRAND = 'nomad8';
/* refresh failures that mean the session is really over */
const REJECTED = /refresh_token_not_found|refresh_token_already_used|session_not_found|session_expired|user_not_found|user_banned/;

/* supabase-js reports a failed fetch as an error object, not a throw */
function isNetworkError(err){
  return /failed to fetch|load failed|networkerror|network request failed|fetch failed/i.test((err && err.message) || '');
}
class DataError extends Error {
  constructor(kind, cause){ super(kind); this.kind = kind; this.cause = cause; }
}

/* a client_products row as the engine's own food */
function ownFoodFromRow(r){
  return {name: r.name, emoji: r.emoji || '🍽️', pools: r.pools || [], unit: r.unit || null, ml: !!r.ml,
    source: r.source === 'recipe' ? 'recipe' : 'label', recipe: r.recipe || null, v: [+r.kcal, +r.p, +r.f, +r.c]};
}

function createData(supabase, storage = localStorage){
  async function get(q){
    const { data, error } = await q;
    if (error) throw new DataError(isNetworkError(error) ? 'network' : 'db', error);
    return data;
  }

  async function fetchBundle(clientId){
    if (!clientId){
      /* an expired token is refreshed here; offline that fails with no
         session and a retryable error, which must not read as signed out */
      const { data, error } = await supabase.auth.getSession();
      if (error && (error.name === 'AuthRetryableFetchError' || isNetworkError(error))) throw new DataError('network', error);
      /* supabase-js drops the session on any refresh error it doesn't retry
         (a 500, a 429, a paused project) — only some of those mean it's over */
      if (error) throw new DataError(REJECTED.test(error.code || error.message || '') ||
        [401, 403].includes(error.status) ? 'rejected' : 'auth-unsure', error);
      if (!data.session) throw new DataError('no-session');
      clientId = data.session.user.id;
      const profile = await get(supabase.from('profiles').select('id').eq('id', clientId).maybeSingle());
      if (!profile) throw new DataError('no-profile');
    }
    const profile = await get(supabase.from('profiles').select('*').eq('id', clientId).maybeSingle());
    if (!profile) throw new DataError('no-profile');
    const plan = await get(supabase.from('plans').select('doc, loaded_at').eq('client_id', clientId).eq('active', true).maybeSingle());
    if (!plan) throw new DataError('no-plan');
    const coach = profile.coach_id
      ? await get(supabase.from('coaches').select('display_name, default_brand').eq('id', profile.coach_id).maybeSingle())
      : null;
    const brandId = profile.brand_id || (coach && coach.default_brand);
    const brand = brandId
      ? await get(supabase.from('brands').select('doc').eq('id', brandId).maybeSingle())
      : await get(supabase.from('brands').select('doc').eq('slug', DEFAULT_BRAND).maybeSingle());
    const foods = Object.fromEntries((await get(supabase.from('foods').select('key, doc'))).map(r => [r.key, r.doc]));
    const pools = Object.fromEntries((await get(supabase.from('pools').select('name, doc'))).map(r => [r.name, r.doc]));
    /* the client's own foods (2026-11-22). RLS shows a coach their clients'
       rows; the eq keeps a coach's own client view to that client */
    const ownFoods = Object.fromEntries((await get(supabase.from('client_products').select('*').eq('user_id', clientId)))
      .map(r => [r.id, ownFoodFromRow(r)]));
    const bundle = {plan: plan.doc, foods, pools, brand: brand && brand.doc, coachName: coach ? coach.display_name : null,
      loadedAt: plan.loaded_at, clientId, ownFoods};
    if (!usable(bundle)) throw new DataError('db', new Error('bundle is missing its brand or a food its plan uses'));
    return bundle;
  }

  /* everything the page needs to draw it: a brand, and every food the plan names */
  function usable(b){
    if (!b.brand || !b.plan || !b.plan.meals) return false;
    const keys = [...(b.plan.dislikes || []), ...(b.plan.brands || []).map(x => x.k)];
    for (const m of Object.values(b.plan.meals)){
      for (const i of m.ing || []) keys.push(i.k);
      for (const alt of m.mealSwaps || []) for (const p of alt.parts || []) keys.push(p.k);
    }
    return keys.every(k => b.foods[k]);
  }

  function cached(){
    try { return JSON.parse(storage.getItem(BUNDLE_KEY)) || null; } catch (e){ return null; }
  }
  function save(bundle){
    try { storage.setItem(BUNDLE_KEY, JSON.stringify(bundle)); } catch (e){ /* full or private: still shows */ }
  }
  function clear(){
    try { storage.removeItem(BUNDLE_KEY); storage.removeItem(CHECKINS_KEY); } catch (e){}
  }

  async function boot(){
    try {
      return {bundle: await fetchBundle(), status: null};
    } catch (e){
      const c = cached();
      switch (e.kind){
        case 'network':     return c ? {bundle: c, status: OFFLINE} : {bundle: null, status: NO_NETWORK};
        case 'auth-unsure':
        case 'no-session':  return c ? {bundle: c, status: SIGN_IN_AGAIN, signIn: true} : {bundle: null, status: 'signed-out'};
        case 'rejected':    clear(); return {bundle: null, status: 'signed-out'};
        case 'no-profile':  clear(); return {bundle: null, status: 'no-profile'};
        case 'no-plan':     return {bundle: null, status: NO_PLAN};
        /* any other error: keep showing what the phone has, or say so */
        default:            return c ? {bundle: c, status: OFFLINE} : {bundle: null, status: WENT_WRONG};
      }
    }
  }

  /* ---------- coach and admin views (Task 7) ----------
     Row-level security decides what each of these returns: a coach sees their
     own clients and their own flags, the admin sees everyone's. */
  async function myId(){
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new DataError('signed-out');
    return data.session.user.id;
  }
  async function me(){
    const id = await myId();
    return get(supabase.from('profiles').select('*').eq('id', id).maybeSingle());
  }
  async function listClients(){
    const id = await myId();
    const coaches = Object.fromEntries((await get(supabase.from('coaches').select('id, display_name')))
      .map(c => [c.id, c.display_name]));
    return (await get(supabase.from('profiles').select('id, display_name, slug, coach_id')))
      .filter(p => p.id !== id && p.coach_id)
      .map(p => ({id: p.id, display_name: p.display_name, slug: p.slug, coach: coaches[p.coach_id] || null}))
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }
  async function flagSwap({clientId, day, meal, planned, swap, note}){
    const row = {flagged_by: await myId(), client_id: clientId, day, meal, planned, swap};
    if (note) row.note = note;
    await get(supabase.from('swap_flags').insert(row));
  }
  async function listFlags({open = false} = {}){
    let q = supabase.from('swap_flags').select('*');
    if (open) q = q.is('resolved_at', null);
    const flags = await get(q.order('flagged_at', {ascending: false}));
    const names = Object.fromEntries((await get(supabase.from('profiles').select('id, display_name')))
      .map(p => [p.id, p.display_name]));
    return flags.map(f => ({...f, client_name: names[f.client_id] || '—'}));
  }
  async function resolveFlag(id){
    await get(supabase.from('swap_flags').update({resolved_at: new Date().toISOString()}).eq('id', id));
  }

  /* ---------- own foods (step 4, 2026-10-31; own foods 2026-11-22) ----------
     Writes need a connection: offline they throw DataError('offline') and
     change nothing, and the page says so. RLS lets a person write only their
     own rows. */
  async function put(q){
    try { return await get(q); }
    catch (e){ throw e.kind === 'network' ? new DataError('offline', e.cause) : e; }
  }
  async function upsert(table, id, row){
    if (id){ await put(supabase.from(table).update(row).eq('id', id)); return id; }
    const r = await put(supabase.from(table).insert({...row, user_id: await myId()}).select('id').single());
    return r.id;
  }
  /* v is per 100 g (or ml): the label's figures, or for a recipe the result
     worked out when it was saved, kept for when an ingredient leaves the library */
  async function saveFood({id, name, emoji = '🍽️', pools = [], unit = null, ml = false, source = 'label', recipe = null, v}){
    const [kcal, p, f, c] = v;
    return upsert('client_products', id, {name, emoji, pools, unit, ml, source, recipe: source === 'recipe' ? recipe : null,
      kcal, p, f, c, updated_at: new Date().toISOString()});
  }
  async function deleteFood(id){
    await put(supabase.from('client_products').delete().eq('id', id));
  }

  /* ---------- check-ins (step 5, 2026-11-22) ----------
     {day: 'done' | 'missed'} by NZ calendar date, the person's own only. The
     phone keeps the last list it read, so the streak shows offline; a mark is
     written to the phone's copy only once the server has it. */
  function cachedCheckIns(){
    try { return JSON.parse(storage.getItem(CHECKINS_KEY)) || null; } catch (e){ return null; }
  }
  function keepCheckIns(marks){
    try { storage.setItem(CHECKINS_KEY, JSON.stringify(marks)); } catch (e){}
    return marks;
  }
  async function listCheckIns(){
    const rows = await get(supabase.from('check_ins').select('day, status').eq('user_id', await myId()).order('day', {ascending: false}));
    return keepCheckIns(Object.fromEntries(rows.map(r => [r.day, r.status])));
  }
  async function setCheckIn(day, status){
    await put(supabase.from('check_ins').upsert({user_id: await myId(), day, status, updated_at: new Date().toISOString()},
      {onConflict: 'user_id,day'}));
    keepCheckIns({...(cachedCheckIns() || {}), [day]: status});
  }
  async function clearCheckIn(day){
    await put(supabase.from('check_ins').delete().eq('user_id', await myId()).eq('day', day));
    const m = {...(cachedCheckIns() || {})};
    delete m[day];
    keepCheckIns(m);
  }

  return { fetchBundle, boot, cached, save, clear, me, listClients, flagSwap, listFlags, resolveFlag,
    saveFood, deleteFood, cachedCheckIns, listCheckIns, setCheckIn, clearCheckIn };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { createData, isNetworkError, ownFoodFromRow };
