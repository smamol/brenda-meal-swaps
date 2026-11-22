/*
 * barcode.js — scan a product's barcode and look up its label figures
 * (2026-11-22), for the "From a label" part of the own-food form.
 *
 *   cleanBarcode(text)          -> the digits, or '' when it isn't a barcode
 *   foodFromOFF(json)           -> {found, name, label: {kcal, p, f, c}, ml, missing}
 *   lookupBarcode(code)         -> the same, from Open Food Facts
 *   startScan(video, onCode)    -> stop()   the camera, reading EAN and UPC codes
 *
 * Open Food Facts is filled in by volunteers and can be wrong or out of date,
 * so what comes back only fills the form: the person checks it against the
 * label and says so before it can be saved (foodform.js). The label stays the
 * source. Only the barcode leaves the phone. The scanner (vendor/zxing.js,
 * @zxing/library 0.21.3, MIT) is loaded when the camera is first opened.
 */
const OFF_URL = 'https://world.openfoodfacts.org/api/v2/product/';
const OFF_FIELDS = 'code,product_name,brands,quantity,nutriments';

function cleanBarcode(text){
  const d = String(text == null ? '' : text).replace(/\D/g, '');
  return [8, 12, 13, 14].includes(d.length) ? d : '';
}
/* Open Food Facts' answer as the form's label fields. NZ labels give energy
   in kJ, so calories come from that when it's there. A figure the database
   doesn't hold stays blank and is named in missing. */
function foodFromOFF(json){
  const p = json && json.status === 1 && json.product;
  if (!p) return {found: false};
  const n = p.nutriments || {}, r1 = x => Math.round(x * 10) / 10;
  const num = k => (n[k] === '' || n[k] == null || isNaN(+n[k]) || +n[k] < 0) ? '' : +n[k];
  const kj = num('energy-kj_100g'), kcal = num('energy-kcal_100g');
  const label = {kcal: kj !== '' ? r1(kj / 4.184) : kcal !== '' ? r1(kcal) : '',
    p: num('proteins_100g'), f: num('fat_100g'), c: num('carbohydrates_100g')};
  for (const k of ['p', 'f', 'c']) if (label[k] !== '') label[k] = r1(label[k]);
  const brand = String(p.brands || '').split(',')[0].trim(), product = String(p.product_name || '').trim();
  const name = brand && product && !product.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${product}` : product || brand;
  return {found: true, name, label, ml: /\d\s*(ml|cl|l|litres?|liters?)\s*$/i.test(String(p.quantity || '').trim()),
    missing: Object.keys(label).filter(k => label[k] === '')};
}
/* throws {kind: 'offline'} when the lookup can't be reached */
async function lookupBarcode(code, fetchFn = fetch){
  let res;
  try { res = await fetchFn(`${OFF_URL}${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`); }
  catch (e){ throw Object.assign(new Error('offline'), {kind: 'offline'}); }
  if (res.status === 404) return {found: false};
  if (!res.ok) throw Object.assign(new Error('lookup ' + res.status), {kind: 'lookup'});
  return foodFromOFF(await res.json());
}

let zxingLoading = null;
function loadZXing(){
  if (typeof ZXing !== 'undefined') return Promise.resolve();
  zxingLoading = zxingLoading || new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'vendor/zxing.js' + (typeof APP_VERSION !== 'undefined' ? '?v=' + APP_VERSION : '');
    s.onload = ok;
    s.onerror = () => { zxingLoading = null; fail(new Error('scanner did not load')); };
    document.head.appendChild(s);
  });
  return zxingLoading;
}
/* opens the back camera on the video element and calls onCode(digits) once,
   at the first barcode it reads; onError(e) if the camera can't be opened.
   Returns stop(), safe to call at any time. */
function startScan(video, onCode, onError = () => {}){
  let reader = null, stopped = false;
  const stop = () => { stopped = true; if (reader){ try { reader.reset(); } catch (e){} } };
  loadZXing().then(() => {
    if (stopped) return;
    const F = ZXing.BarcodeFormat;
    reader = new ZXing.BrowserMultiFormatReader(new Map([[ZXing.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E]]]));
    return reader.decodeFromConstraints({audio: false, video: {facingMode: {ideal: 'environment'}}}, video, result => {
      const code = result && cleanBarcode(result.getText());
      if (!code || stopped) return;
      stop();
      onCode(code);
    });
  }).catch(e => { if (!stopped){ stop(); onError(e); } });
  return stop;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { cleanBarcode, foodFromOFF, lookupBarcode, startScan };
