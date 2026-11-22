/*
 * checkins.js — mark today done or not done, and see the run (step 5,
 * 2026-11-22). Design: ARCHITECTURE.md, "Step 5: check-ins and streaks".
 *
 *   mountCheckIns(el, {data, today?})
 *
 * One mark per NZ calendar date, kept in check_ins (data.js). The streak and
 * the 28-day dots are worked out here and never stored. An unmarked past day
 * is a miss; "No" is optional. Days before the first mark are blank, so a
 * new person doesn't start with four weeks of misses. Tapping the chosen
 * answer again takes it back. Yesterday can still be marked while it has no
 * answer, so one forgotten evening doesn't end a streak (Sandy, 2026-11-22). Marking needs a connection; offline the strip
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
  const touched = new Set();   /* a day answered on this screen stays on it, so the answer can be taken back */
  const nice = day => {
    const d = new Date(day + 'T00:00:00Z'), f = o => d.toLocaleDateString('en-NZ', {...o, timeZone: 'UTC'});
    return `${f({weekday: 'short'})} ${f({day: 'numeric'})} ${f({month: 'short'})}`;
  };

  function draw(){
    const t = today(), y = addDays(t, -1), n = streak(marks, t), ds = dots(marks, t);
    const done = ds.filter(d => d.state === 'done').length;
    /* yesterday is asked about while it has no answer, once there are earlier marks */
    const first = Object.keys(marks).sort()[0];
    const askYesterday = touched.has(y) || (!marks[y] && !!first && first < y);
    const row = (day, q) => `<div class="ci-row" data-day="${day}"><div class="ci-q">${q} <span class="ci-day">${nice(day)}</span></div>
      <div class="ci-btns">
        <button type="button" data-s="done" class="${marks[day] === 'done' ? 'on' : ''}" aria-pressed="${marks[day] === 'done'}">Yes</button>
        <button type="button" data-s="missed" class="${marks[day] === 'missed' ? 'on' : ''}" aria-pressed="${marks[day] === 'missed'}">No</button>
      </div></div>`;
    el.innerHTML = `<section class="checkin">
      <div class="ci-head"><span class="ci-title">Check-in</span>
        <span class="ci-streak">${n ? `<b>${n}</b> day streak` : 'No streak yet'}</span></div>
      ${row(t, 'Followed the plan today?')}${askYesterday ? row(y, 'And yesterday?') : ''}
      <div class="ci-dots" role="img" aria-label="Last 28 days: ${done} done">${ds.map(d => `<i class="${d.state}"></i>`).join('')}</div>
      <p class="ci-msg">${msg}</p></section>`;
    el.querySelectorAll('.ci-row').forEach(r => r.querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => tap(r.dataset.day, b.dataset.s))));
  }
  /* shown at once, put back if the save fails */
  async function tap(day, status){
    if (busy) return;
    busy = true;
    const before = marks, off = marks[day] === status;
    touched.add(day);
    marks = {...marks};
    if (off) delete marks[day]; else marks[day] = status;
    msg = ''; draw();
    try { await (off ? data.clearCheckIn(day) : data.setCheckIn(day, status)); }
    catch (e){
      marks = before;
      msg = e.kind === 'offline' ? 'Connect to the internet to mark the day' : 'Something went wrong. Try again';
      draw();
    }
    busy = false;
  }

  draw();
  data.listCheckIns().then(m => { if (!busy && el.isConnected !== false){ marks = m; draw(); } }).catch(() => {});
  return { redraw: draw };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { nzDay, addDays, streak, dots, mountCheckIns };
