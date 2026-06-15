import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDAcUxeN8DfsBYtg1h_0_90UxDUOrgFYrM',
  authDomain: 'abhyasam-ai.firebaseapp.com',
  projectId: 'abhyasam-ai',
  storageBucket: 'abhyasam-ai.firebasestorage.app',
  messagingSenderId: '198014381698',
  appId: '1:198014381698:web:8bab20f7158daf0b458e9b',
  measurementId: 'G-MPTZBDSW9J'
};

const $ = id => document.getElementById(id);
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
};

const sections = [
  ['syllabus', 'Syllabus'],
  ['general-studies', 'General Studies'],
  ['english', 'English'],
  ['mathematics', 'Mathematics'],
  ['reasoning', 'Reasoning'],
  ['computer', 'Computer']
];
const englishModes = ['One Word Substitution', 'Idioms', 'Antonyms & Synonyms', 'Spellings', 'Grammar'];
const builtIn = {
  benevolent: { meaning: 'दयालु, परोपकारी', syn: ['kind', 'charitable'], ant: ['cruel', 'selfish'], ex: 'A benevolent officer helped the villagers during the flood.', hi: 'एक दयालु अधिकारी ने बाढ़ के समय ग्रामीणों की मदद की।' },
  diligent: { meaning: 'मेहनती', syn: ['hardworking', 'industrious'], ant: ['lazy', 'careless'], ex: 'A diligent aspirant revises vocabulary every day.', hi: 'एक मेहनती अभ्यर्थी रोज़ शब्दावली दोहराता है।' },
  prudent: { meaning: 'समझदार, विवेकपूर्ण', syn: ['wise', 'careful'], ant: ['careless', 'foolish'], ex: 'A prudent decision can save time in the exam.', hi: 'एक विवेकपूर्ण निर्णय परीक्षा में समय बचा सकता है।' },
  mitigate: { meaning: 'कम करना, घटाना', syn: ['reduce', 'lessen'], ant: ['increase', 'worsen'], ex: 'Regular practice can mitigate exam fear.', hi: 'नियमित अभ्यास परीक्षा के डर को कम कर सकता है।' },
  obsolete: { meaning: 'पुराना, अप्रचलित', syn: ['outdated', 'old-fashioned'], ant: ['modern', 'current'], ex: 'Some obsolete words still appear in vocabulary questions.', hi: 'कुछ अप्रचलित शब्द अभी भी शब्दावली प्रश्नों में आते हैं।' },
  philanthropist: { meaning: 'परोपकारी व्यक्ति', syn: ['benefactor', 'humanitarian'], ant: ['miser', 'selfish person'], ex: 'A philanthropist donated books to poor students.', hi: 'एक परोपकारी व्यक्ति ने गरीब छात्रों को किताबें दान कीं।' },
  omniscient: { meaning: 'सर्वज्ञ, सब कुछ जानने वाला', syn: ['all-knowing', 'wise'], ant: ['ignorant', 'unaware'], ex: 'The narrator in the story is omniscient.', hi: 'कहानी का कथावाचक सर्वज्ञ है।' },
  bibliophile: { meaning: 'पुस्तक प्रेमी', syn: ['book lover', 'reader'], ant: ['nonreader', 'book hater'], ex: 'A bibliophile spends most evenings reading.', hi: 'एक पुस्तक प्रेमी अधिकतर शामें पढ़ने में बिताता है।' }
};

let active = normalizeSection(store.get('active-section', 'english'));
let englishMode = normalizeEnglishMode(store.get('english-mode', 'Antonyms & Synonyms'));
let current = null;
let auth, db, user, remoteUnsub, syncTimer;
let applyingRemote = false;

window.addEventListener('DOMContentLoaded', init);

function init() {
  store.set('active-section', active);
  store.set('english-mode', englishMode);
  renderNav();
  bindEvents();
  renderEnglishModes();
  renderSyllabus();
  renderHistory();
  switchSection(active);
  initFirebase();
}

function bindEvents() {
  $('addSyllabusBtn').onclick = addSyllabus;
  $('clearSyllabusBtn').onclick = clearSyllabus;
  $('generateEnglishBtn').onclick = generateEnglish;
  $('saveEnglishBtn').onclick = saveCurrent;
  $('clearEnglishBtn').onclick = clearEnglish;
  $('saveGsBtn').onclick = saveCurrent;
  $('saveMathBtn').onclick = saveCurrent;
  $('saveReasonBtn').onclick = saveCurrent;
  $('saveComputerBtn').onclick = saveCurrent;
  $('printBtn').onclick = () => window.print();
  $('jsonBtn').onclick = downloadJSON;
  $('clearSavedBtn').onclick = clearSaved;
  $('loginBtn').onclick = login;
  $('logoutBtn').onclick = logout;
  $('syncNowBtn').onclick = () => syncToCloud(true);
  $('syllabusInput').addEventListener('keydown', event => { if (event.key === 'Enter') addSyllabus(); });
  $('engInput').addEventListener('keydown', event => { if (event.key === 'Enter') generateEnglish(); });
  document.querySelectorAll('[data-analyse]').forEach(button => button.onclick = () => analysePaste(button.dataset.analyse));
}

function normalizeSection(id) {
  if (id === 'computer-mode') return 'computer';
  return sections.some(section => section[0] === id) ? id : 'english';
}

function normalizeEnglishMode(mode) {
  const aliases = { OWS: 'One Word Substitution', 'Anto & Syno': 'Antonyms & Synonyms', 'Anto Syno': 'Antonyms & Synonyms', 'Antonyms and synonyms': 'Antonyms & Synonyms' };
  if (englishModes.includes(mode)) return mode;
  return aliases[mode] || 'Antonyms & Synonyms';
}

function displaySectionLabel(label) {
  const aliases = { 'Computer Mode': 'Computer', OWS: 'One Word Substitution', 'Anto & Syno': 'Antonyms & Synonyms', 'Anto Syno': 'Antonyms & Synonyms' };
  return aliases[label] || label || 'Revision';
}

function renderNav() {
  const nav = $('mainNav');
  nav.innerHTML = '';
  sections.forEach(([id, label]) => {
    const button = document.createElement('button');
    button.textContent = label;
    button.id = 'nav-' + id;
    button.onclick = () => switchSection(id);
    nav.appendChild(button);
  });
}

function switchSection(id) {
  id = normalizeSection(id);
  active = id;
  store.set('active-section', id);
  if (current?.sectionId && current.sectionId !== id) current = null;
  document.querySelectorAll('.section').forEach(section => section.classList.add('hidden'));
  $(id).classList.remove('hidden');
  document.querySelectorAll('#mainNav button').forEach(button => button.classList.remove('active'));
  $('nav-' + id)?.classList.add('active');
}

function renderEnglishModes() {
  englishMode = normalizeEnglishMode(englishMode);
  const box = $('englishModes');
  box.innerHTML = '';
  englishModes.forEach(mode => {
    const chip = document.createElement('span');
    chip.className = 'chip' + (mode === englishMode ? ' active' : '');
    chip.textContent = mode;
    chip.onclick = () => {
      englishMode = mode;
      store.set('english-mode', mode);
      current = null;
      $('engOut').innerHTML = '';
      renderEnglishModes();
    };
    box.appendChild(chip);
  });
}

function addSyllabus() {
  const text = clean($('syllabusInput').value);
  if (!text) return;
  const list = normalizeSyllabus(store.get('syllabus', []));
  if (list.some(item => item.text.toLowerCase() === text.toLowerCase())) {
    $('syllabusInput').value = '';
    return;
  }
  const now = Date.now();
  list.push({ id: crypto.randomUUID(), text, done: false, created: now, updatedMs: now });
  setSyllabus(list);
  $('syllabusInput').value = '';
}

function clearSyllabus() { if (confirm('Clear syllabus list?')) setSyllabus([]); }
function setSyllabus(list) { store.set('syllabus', normalizeSyllabus(list)); renderSyllabus(); queueSync(); }

function normalizeSyllabus(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .filter(item => item && item.text)
    .map(item => {
      const now = Date.now();
      const text = clean(item.text);
      const created = item.created || item.createdMs || now;
      return { id: item.id || `${text}-${created}`, text, done: Boolean(item.done), created, updatedMs: item.updatedMs || item.createdMs || created };
    })
    .filter(item => {
      const key = item.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function removeSyllabus(id) {
  if (!confirm('Remove this syllabus topic?')) return;
  setSyllabus(normalizeSyllabus(store.get('syllabus', [])).filter(item => item.id !== id));
}

function renderSyllabus() {
  const list = normalizeSyllabus(store.get('syllabus', []));
  const done = list.filter(item => item.done).length;
  $('syllabusProgress').textContent = `${done} / ${list.length} completed`;
  const box = $('syllabusList');
  box.innerHTML = '';
  if (!list.length) {
    box.innerHTML = '<div class="empty-state">No syllabus topics added yet.</div>';
    return;
  }
  list.forEach(item => {
    const row = document.createElement('div');
    row.className = 'syllabus-row';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = item.done;
    check.onchange = () => {
      const next = normalizeSyllabus(store.get('syllabus', [])).map(topic => topic.id === item.id ? { ...topic, done: check.checked, updatedMs: Date.now() } : topic);
      setSyllabus(next);
    };
    const span = document.createElement('span');
    span.textContent = item.text;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'mini-remove no-print';
    remove.textContent = 'Remove';
    remove.onclick = () => removeSyllabus(item.id);
    row.append(check, span, remove);
    box.appendChild(row);
  });
}

function analysePaste(type) {
  const ids = { gs: 'gsPaste', math: 'mathPaste', reason: 'reasonPaste', computer: 'computerPaste' };
  const outs = { gs: 'gsOut', math: 'mathOut', reason: 'reasonOut', computer: 'computerOut' };
  const sectionIds = { gs: 'general-studies', math: 'mathematics', reason: 'reasoning', computer: 'computer' };
  const text = clean($(ids[type]).value);
  if (!text) return;
  const title = text.split(/[\n.]/)[0].slice(0, 80) || 'Revision note';
  const subject = detectSubject(type, text);
  const body = `Subject - ${title}\n\nSubject: ${subject}\n\nExam perspective:\n- Keep facts, formulas, definitions, and exceptions separately.\n- Convert long paragraphs into bullet points.\n- Mark PYQ/revision-worthy lines.\n\nClean note:\n${text}`;
  current = { id: crypto.randomUUID(), sectionId: sectionIds[type], section: sectionLabel(type), title, body, created: new Date().toLocaleString(), createdMs: Date.now() };
  $(outs[type]).innerHTML = `<div class="out-title">${esc(current.section)}</div><div class="out">${esc(body)}</div>`;
}

function sectionLabel(type) { return { gs: 'General Studies', math: 'Mathematics', reason: 'Reasoning', computer: 'Computer' }[type] || type; }
function detectSubject(type, text) {
  const t = text.toLowerCase();
  if (type === 'math') return 'Mathematics';
  if (type === 'reason') return 'Reasoning';
  if (type === 'computer') return 'Computer';
  if (/river|mountain|monsoon|climate|soil|ocean|geography/.test(t)) return 'Geography';
  if (/ancient|medieval|modern|mughal|british|history/.test(t)) return 'History';
  if (/physics|chemistry|biology|cell|force|acid|science/.test(t)) return 'Science';
  if (/constitution|parliament|president|governor|polity|article/.test(t)) return 'Polity';
  if (/economy|gdp|inflation|budget|bank|tax|economics/.test(t)) return 'Economics';
  if (/environment|biodiversity|climate change|pollution/.test(t)) return 'Environment';
  if (/current|appointment|award|scheme/.test(t)) return 'Current Affairs';
  return 'Static GK';
}

async function generateEnglish() {
  const term = clean($('engInput').value);
  if (!term) return;
  const button = $('generateEnglishBtn');
  button.disabled = true;
  $('engOut').innerHTML = '<div class="box english-main"><div class="out">Preparing entry...</div></div>';
  try {
    const data = await buildEnglishEntry(term);
    const body = englishBody(term, data);
    current = { id: crypto.randomUUID(), sectionId: 'english', section: 'English', title: term, body, created: new Date().toLocaleString(), createdMs: Date.now() };
    renderEnglishOutput(term, data);
  } catch {
    const data = fallbackEnglishData(term);
    const body = englishBody(term, data);
    current = { id: crypto.randomUUID(), sectionId: 'english', section: 'English', title: term, body, created: new Date().toLocaleString(), createdMs: Date.now() };
    renderEnglishOutput(term, data);
  } finally {
    button.disabled = false;
  }
}

async function buildEnglishEntry(term) {
  const key = term.toLowerCase();
  if (builtIn[key]) return { ...builtIn[key] };
  const [meaning, syn, ant, example] = await Promise.all([
    translateToHindi(term),
    getDatamuseWords(term, 'rel_syn'),
    getDatamuseWords(term, 'rel_ant'),
    getDictionaryExample(term)
  ]);
  const ex = example || defaultExample(term);
  const hi = await translateToHindi(ex);
  return { meaning: meaning || 'Not found automatically', syn, ant, ex, hi: hi || '' };
}

function fallbackEnglishData(term) {
  return { meaning: 'Not found automatically', syn: [], ant: [], ex: defaultExample(term), hi: '' };
}

async function translateToHindi(text) {
  if (!text) return '';
  try {
    const response = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=en|hi');
    if (!response.ok) return '';
    const json = await response.json();
    return clean(json?.responseData?.translatedText || '');
  } catch { return ''; }
}

async function getDatamuseWords(term, relation) {
  try {
    const response = await fetch(`https://api.datamuse.com/words?${relation}=${encodeURIComponent(term)}&max=16`);
    if (!response.ok) return [];
    const json = await response.json();
    return [...new Set((Array.isArray(json) ? json : [])
      .map(item => clean(item.word))
      .filter(Boolean)
      .filter(word => word.toLowerCase() !== term.toLowerCase())
      .filter(word => word.length > 3 || word.includes(' '))
      .filter(word => !/^[-'\s]+$/.test(word))
    )].slice(0, 2);
  } catch { return []; }
}

async function getDictionaryExample(term) {
  if (/\s/.test(term)) return '';
  try {
    const response = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(term));
    if (!response.ok) return '';
    const json = await response.json();
    for (const meaning of (json?.[0]?.meanings || [])) {
      for (const definition of (meaning.definitions || [])) {
        if (definition.example) return clean(definition.example);
      }
    }
  } catch {}
  return '';
}

function defaultExample(term) {
  if (englishMode === 'Grammar') return `${term} is important for error spotting and sentence improvement.`;
  if (englishMode === 'Spellings') return `Check the spelling of ${term} carefully before marking the answer.`;
  if (englishMode === 'Idioms') return `The phrase "${term}" can appear in an idiom-based question.`;
  if (englishMode === 'One Word Substitution') return `The expression "${term}" can be revised as a one word substitution item.`;
  return `${term} is useful for English vocabulary revision.`;
}

function firstMeaning(meaning) {
  const first = clean(String(meaning || '').split(/[;,।]/)[0]);
  return first || 'Not found automatically';
}

function listText(values) {
  const valuesClean = (Array.isArray(values) ? values : []).map(clean).filter(Boolean).filter(value => value !== '—');
  return valuesClean.length ? valuesClean.join(', ') : 'Not available automatically';
}

function englishBody(term, data) {
  return `${term} - ${firstMeaning(data.meaning)}\n\n${data.ex}\n\nSynonym - ${listText(data.syn)}\n\nAntonym - ${listText(data.ant)}\n\n${englishMode}`;
}

function renderEnglishOutput(term, data) {
  const body = englishBody(term, data);
  const rows = [
    ['Input', `${term} - ${firstMeaning(data.meaning)}`],
    ['Example', data.ex],
    ['Synonym', listText(data.syn)],
    ['Antonym', listText(data.ant)],
    ['Category', englishMode]
  ];
  $('engOut').innerHTML = `<div class="box english-main" style="grid-column:1/-1"><div class="out">${esc(body)}</div></div>${cards(rows)}`;
}

function cards(rows) {
  return rows.map(([title, value]) => `<div class="box"><div class="out-title">${esc(title)}</div><div class="out">${esc(value)}</div></div>`).join('');
}

function clearEnglish() { $('engInput').value = ''; $('engOut').innerHTML = ''; current = null; }
function activeMatchesCurrent() { return Boolean(current && (!current.sectionId || current.sectionId === active)); }

function saveCurrent() {
  if (!activeMatchesCurrent()) {
    setSyncStatus('Generate or organise content in the active section before saving.');
    return;
  }
  const items = store.get('saved', []);
  items.unshift({ ...current, id: current.id || crypto.randomUUID(), sectionId: current.sectionId || active, savedMs: Date.now() });
  setSaved(dedupe(items));
  current = null;
}

function setSaved(items) { store.set('saved', dedupe(items)); renderHistory(); queueSync(); }
function dedupe(items) {
  const map = new Map();
  (Array.isArray(items) ? items : []).forEach(item => {
    if (!item) return;
    const id = item.id || `${item.section || ''}-${item.title || ''}-${item.createdMs || item.savedMs || Date.now()}`;
    const normalized = { ...item, id, section: displaySectionLabel(item.section), sectionId: normalizeSection(item.sectionId || item.section || 'english') };
    const existing = map.get(id);
    if (!existing || (normalized.savedMs || normalized.createdMs || 0) > (existing.savedMs || existing.createdMs || 0)) map.set(id, normalized);
  });
  return [...map.values()].sort((a, b) => (b.savedMs || b.createdMs || 0) - (a.savedMs || a.createdMs || 0));
}

function removeSaved(id) {
  if (!confirm('Remove this saved item?')) return;
  setSaved(store.get('saved', []).filter(item => item.id !== id));
}

function renderHistory() {
  const history = $('history');
  const items = dedupe(store.get('saved', []));
  if (!items.length) {
    history.innerHTML = '<div class="empty-state">No saved revision entries yet.</div>';
    return;
  }
  history.innerHTML = items.map(item => `<article class="card"><button class="card-delete no-print" data-delete="${esc(item.id)}" title="Remove">×</button><span class="tag">${esc(displaySectionLabel(item.section))}</span><h3>${esc(item.title || 'Revision item')}</h3><p class="small">${esc(item.created || '')}</p><div class="out">${esc(item.body || '')}</div></article>`).join('');
  history.querySelectorAll('[data-delete]').forEach(button => button.onclick = () => removeSaved(button.dataset.delete));
}

function clearSaved() { if (confirm('Clear all saved revision entries?')) setSaved([]); }
function downloadJSON() {
  const payload = JSON.stringify({ saved: store.get('saved', []), syllabus: store.get('syllabus', []) }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'abhyasam-ai-revision.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function initFirebase() {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    onAuthStateChanged(auth, async account => {
      user = account;
      if (remoteUnsub) { remoteUnsub(); remoteUnsub = null; }
      updateAuthUI();
      if (user) {
        setSyncStatus(`Signed in as ${esc(user.email || 'Google user')}. Loading sync...`);
        await pullFromCloud(true);
        listenCloud();
        queueSync();
      } else {
        setSyncStatus('Local mode. Sign in to sync across devices.');
      }
    });
  } catch (error) {
    setSyncStatus('Firebase setup error: ' + (error.code || error.message || error));
  }
}

function userDoc() { return doc(db, 'users', user.uid, 'state', 'main'); }
async function login() { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (error) { setSyncStatus('Sign-in failed: ' + (error.code || error.message || error)); } }
async function logout() { try { await signOut(auth); } catch (error) { setSyncStatus('Sign-out failed: ' + (error.code || error.message || error)); } }
function updateAuthUI() {
  $('loginBtn').classList.toggle('hidden', Boolean(user));
  $('logoutBtn').classList.toggle('hidden', !user);
  $('syncNowBtn').classList.toggle('hidden', !user);
}
function setSyncStatus(message) { $('syncStatus').innerHTML = message; }
function queueSync() {
  if (applyingRemote || !user || !db) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncToCloud(false), 700);
}
function localState() { return { saved: dedupe(store.get('saved', [])), syllabus: normalizeSyllabus(store.get('syllabus', [])) }; }

async function pullFromCloud(merge = true) {
  if (!user || !db) return;
  try {
    const snap = await getDoc(userDoc());
    if (!snap.exists()) return syncToCloud(false);
    const remote = snap.data() || {};
    if (merge) applyRemoteState(remote);
    setSyncStatus('<strong>Synced.</strong> Your revision data is connected to Google sign-in.');
  } catch (error) {
    setSyncStatus('Sync load failed: ' + (error.code || error.message || error));
  }
}

async function syncToCloud(manual) {
  if (!user || !db) { setSyncStatus('Sign in first to sync.'); return; }
  try {
    await setDoc(userDoc(), { ...localState(), updatedAt: serverTimestamp(), updatedMs: Date.now() }, { merge: true });
    if (manual) setSyncStatus('<strong>Synced now.</strong>');
  } catch (error) {
    setSyncStatus('Sync failed: ' + (error.code || error.message || error));
  }
}

function listenCloud() {
  if (!user || !db) return;
  remoteUnsub = onSnapshot(userDoc(), snap => {
    if (!snap.exists()) return;
    applyRemoteState(snap.data() || {});
  }, error => setSyncStatus('Live sync error: ' + (error.code || error.message || error)));
}

function applyRemoteState(remote) {
  applyingRemote = true;
  store.set('saved', dedupe([...(store.get('saved', []) || []), ...(remote.saved || [])]));
  store.set('syllabus', mergeSyllabus(store.get('syllabus', []), remote.syllabus || []));
  renderHistory();
  renderSyllabus();
  applyingRemote = false;
}

function mergeSyllabus(local, remote) {
  const map = new Map();
  [...normalizeSyllabus(local), ...normalizeSyllabus(remote)].forEach(item => {
    const key = item.id || item.text.toLowerCase();
    const old = map.get(key);
    if (!old || (item.updatedMs || 0) >= (old.updatedMs || 0)) map.set(key, item);
  });
  return normalizeSyllabus([...map.values()]).sort((a, b) => (a.created || 0) - (b.created || 0));
}
