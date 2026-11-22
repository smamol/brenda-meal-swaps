/*
 * checkins.js — mark today done or not done, and see the run (step 5,
 * 2026-11-22). Design: ARCHITECTURE.md, "Step 5: check-ins and streaks".
 *
 *   mountCheckIns(el, {data, today?})
 *
 * One mark per NZ calendar date, kept in check_ins (data.js). The streak and
 * the 28-day dots are worked out here and never stored. An unmarked past day
 * is a miss; "Not done" is optional. Days before the first mark are blank, so
 * a new person doesn't start with four weeks of misses. Tapping the chosen
 * answer again takes it back. Marking needs a connection; offline the strip
 * shows the phone's copy and says so when tapped.
 */

/* the NZ calendar date, YYYY-MM-DD */
function nzDay(d = new Date()){
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-NZ', {timeZone: 'Pacific/Auckland',
    year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function addDays(day, n){
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/* consecutive done days, counting back from today, or from yesterday while
   today isn't marked. marks = {day: 'done' | 'missed'} */
function streak(marks, today){
  if (marks[today] === 'missed') return 0;
  let d = marks[today] === 'done' ? today : addDays(today, -1), n = 0;
  while (marks[d] === 'done'){ n++; d = addDays(d, -1); }
  return n;
}
/* the last n days, oldest first: done, missed, open (today, not marked yet)
   or none (before the first mark) */
function dots(marks, today, n = 28){
  const first = Object.keys(marks).sort()[0];
  return Array.from({length: n}, (_, i) => {
    const day = addDays(today, i - n + 1);
    const state = marks[day] || (day === today ? 'open' : first && day > first ? 'missed' : 'none');
    return {day, state};
  });
}

function mountCheckIns(el, {data, today = nzDay}){
  let marks = data.cachedCheckIns() || {}, msg = '', busy = false;
  const nice = day => {
    const d = new Date(day + 'T00:00:00Z'), f = o => d.toLocaleDateString('en-NZ', {...o, timeZone: 'UTC'});
    return `${f({weekday: 'short'})} ${f({day: 'numeric'})} ${f({month: 'short'})}`;
  };

  function draw(){
    const t = today(), mine = marks[t], n = streak(marks, t), ds = dots(marks, t);
    const done = ds.filter(d => d.state === 'done').length;
    el.innerHTML = `<section class="checkin">
      <div class="ci-head"><span class="ci-day">Today, ${nice(t)}</span>
        <span class="ci-streak">${n ? `<b>${n}</b> day streak` : 'No streak yet'}</span></div>
      <div class="ci-btns">
        <button type="button" data-s="done" class="${mine === 'done' ? 'on' : ''}" aria-pressed="${mine === 'done'}">Done</button>
        <button type="button" data-s="missed" class="${mine === 'missed' ? 'on' : ''}" aria-pressed="${mine === 'missed'}">Not done</button>
      </div>
      <div class="ci-dots" role="img" aria-label="Last 28 days: ${done} done">${ds.map(d => `<i class="${d.state}"></i>`).join('')}</div>
      <p class="ci-msg">${msg}</p></section>`;
    el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => tap(t, b.dataset.s)));
  }
  /* shown at once, put back if the save fails */
  async function tap(day, status){
    if (busy) return;
    busy = true;
    const before = marks, off = marks[day] === status;
    marks = {...marks};
    if (off) delete marks[day]; else marks[day] = status;
    msg = ''; draw();
    try { await (off ? data.clearCheckIn(day) : data.setCheckIn(day, status)); }
    catch (e){
      marks = before;
      msg = e.kind === 'offline' ? 'Connect to the internet to mark today' : 'Something went wrong. Try again';
      draw();
    }
    busy = false;
  }

  draw();
  data.listCheckIns().then(m => { if (!busy && el.isConnected !== false){ marks = m; draw(); } }).catch(() => {});
  return { redraw: draw };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { nzDay, addDays, streak, dots, mountCheckIns };
