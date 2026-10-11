const examples = window.DEMO_EXAMPLES || [];
const preferredFirst = { stops: 'C3', early: 'D4' };
const aliases = { soft: 'C3', negation: 'B1', conditional: 'D4' };
const orderedExamples = ['stops', 'early'].flatMap((question) => {
  const items = examples.filter((sample) => sample.question === question);
  return items.sort((a, b) => (a.id === preferredFirst[question] ? -1 : b.id === preferredFirst[question] ? 1 : 0));
});

const fields = {
  count: document.querySelector('#sample-count'),
  id: document.querySelector('#request-id'),
  phrase: document.querySelector('#phrase'),
  sql: document.querySelector('#sql-answer'),
  sqlGloss: document.querySelector('#sql-gloss'),
  sqlStatus: document.querySelector('#sql-status'),
  sqlNote: document.querySelector('#sql-note'),
  code: document.querySelector('#sql-code'),
  jev: document.querySelector('#jev-answer'),
  jevGloss: document.querySelector('#jev-gloss'),
  jevStatus: document.querySelector('#jev-status'),
  jevNote: document.querySelector('#jev-note'),
  metrics: document.querySelector('#jev-metrics'),
  compare: document.querySelector('#comparison-result'),
  compareStatus: document.querySelector('#compare-status'),
  compareSummary: document.querySelector('#compare-summary'),
  human: document.querySelector('#human-answer'),
  humanGloss: document.querySelector('#human-gloss'),
  caption: document.querySelector('#human-caption')
};

const select = document.querySelector('#sample-select');

const explanations = {
  direct_only: 'Requires a direct flight',
  connection_ok: 'A connection is acceptable',
  depends: 'It depends on a condition',
  unknown: 'No keyword found',
  fine: 'Early flights are okay',
  avoid: 'Prefer not to fly early'
};

function explain(label) {
  return explanations[label] || 'No clear preference';
}

function sqlResult(sample, jevAnswer) {
  const text = sample.phrase.toLowerCase();
  const matched = sample.question === 'stops'
    ? ['direct', 'non-stop', 'nonstop', 'no stopover'].some((word) => text.includes(word))
    : text.includes('early');
  const answer = matched ? (sample.question === 'stops' ? 'direct_only' : 'avoid') : 'unknown';

  let note;
  if (sample.question === 'stops' && matched && jevAnswer !== 'direct_only') {
    note = 'It found the keyword and made “direct” mandatory. JEV reads the request as softer or conditional.';
  } else if (sample.question === 'stops' && !matched && jevAnswer === 'direct_only') {
    note = 'The person wants a direct flight, but the rule only checks a few exact words and misses this phrasing.';
  } else if (sample.question === 'stops' && matched) {
    note = 'A keyword matched, so the rule calls it direct-only.';
  } else if (sample.question === 'early' && matched && jevAnswer === 'depends') {
    note = 'The word “early” triggers avoid. The rule has no way to hold the condition in the request.';
  } else if (sample.question === 'early' && !matched && jevAnswer === 'avoid') {
    note = 'The person would rather not leave early, but the rule only looks for the word “early”.';
  } else if (sample.question === 'early' && matched) {
    note = 'It found “early” and marks early departures as unwanted.';
  } else {
    note = 'No keyword matched, so the rule says unknown.';
  }

  return {
    answer,
    matched,
    note,
    code: sample.question === 'stops'
      ? "phrase LIKE '%direct%' OR phrase LIKE '%non-stop%' OR phrase LIKE '%nonstop%' OR phrase LIKE '%no stopover%'"
      : "phrase LIKE '%early%' → avoid; otherwise unknown"
  };
}

function jevAnswer(sample) {
  if (sample.question === 'stops') return sample.jev;
  const score = Number(sample.jev);
  const conditional = Number(sample.conditional || 0);
  if (conditional >= 0.5) return 'depends';
  return score < 0.5 ? 'fine' : 'avoid';
}

function jevNote(question, answer) {
  if (question === 'stops') {
    if (answer === 'direct_only') return 'JEV reads a direct flight: no stops, no plane changes.';
    if (answer === 'connection_ok') return 'JEV reads a connection as okay.';
    return 'JEV reads it as conditional: a connection may be okay, depending on something else in the request.';
  }
  if (answer === 'fine') return 'JEV reads no objection to leaving early.';
  if (answer === 'avoid') return 'JEV reads a wish not to leave early.';
  return 'JEV reads it as conditional: leaving early is okay only in some cases.';
}

function fillSelect() {
  select.replaceChildren();
  [
    { key: 'stops', label: 'Stops & connections' },
    { key: 'early', label: 'Early departures' }
  ].forEach(({ key, label }) => {
    const group = document.createElement('optgroup');
    group.label = label;
    orderedExamples.filter((sample) => sample.question === key).forEach((sample) => {
      const option = document.createElement('option');
      option.value = sample.id;
      option.textContent = sample.phrase;
      group.append(option);
    });
    select.append(group);
  });
}

function selectExample(id, updateHash = true) {
  const index = orderedExamples.findIndex((sample) => sample.id === id);
  const sample = orderedExamples[index] || orderedExamples[0];
  if (!sample) return;
  select.value = sample.id;

  const answer = jevAnswer(sample);
  const sql = sqlResult(sample, answer);
  const sameAnswer = sql.answer === answer;
  fields.count.innerHTML = `${String(index + 1).padStart(2, '0')} <i>/</i> ${String(orderedExamples.length).padStart(2, '0')}`;
  fields.id.textContent = `EXAMPLE ${String(index + 1).padStart(2, '0')} · ${sample.question.toUpperCase()}`;
  fields.phrase.textContent = `“${sample.phrase}”`;

  fields.sql.textContent = sql.answer;
  fields.sqlGloss.textContent = explain(sql.answer);
  fields.sqlStatus.textContent = sql.matched ? 'KEYWORD MATCH' : 'NO KEYWORD MATCH';
  fields.sqlNote.textContent = sql.note;
  fields.code.textContent = sql.code;

  fields.jev.textContent = answer;
  fields.jevGloss.textContent = explain(answer);
  fields.jevStatus.textContent = 'SAVED ANSWER';
  fields.jevNote.textContent = jevNote(sample.question, answer);
  fields.metrics.innerHTML = sample.question === 'stops'
    ? `<span>CONFIDENCE <b>${Number(sample.confidence || 0).toFixed(2)}</b></span><span>TYPE <b>choice</b></span>`
    : `<span>RAW SCORE <b>${Number(sample.jev || 0).toFixed(2)}</b></span><span>CONFIDENCE <b>${Number(sample.confidence || 0).toFixed(2)}</b></span><span>CONDITIONAL <b>${Number(sample.conditional || 0).toFixed(2)}</b></span>`;

  fields.compare.classList.toggle('is-same', sameAnswer);
  fields.compare.classList.toggle('is-different', !sameAnswer);
  fields.compareStatus.textContent = sameAnswer ? 'SQL and JEV agree' : 'SQL and JEV disagree';
  fields.compareSummary.textContent = sameAnswer
    ? `Both return: ${explain(sql.answer).toLowerCase()}.`
    : `SQL: ${explain(sql.answer).toLowerCase()}. JEV: ${explain(answer).toLowerCase()}.`;

  fields.human.textContent = sample.human || '—';
  fields.humanGloss.textContent = sample.human ? explain(sample.human) : '';
  fields.caption.textContent = sample.human ? 'My own label' : 'No label of mine for this one';

  if (updateHash && location.hash !== `#${sample.id}`) history.replaceState(null, '', `#${sample.id}`);
}

fillSelect();
select.addEventListener('change', () => selectExample(select.value));

const initialHash = location.hash.slice(1);
const initialId = aliases[initialHash] || initialHash;
const defaultId = orderedExamples.some((sample) => sample.id === 'C3') ? 'C3' : orderedExamples[0]?.id;
selectExample(orderedExamples.some((sample) => sample.id === initialId) ? initialId : defaultId, false);
