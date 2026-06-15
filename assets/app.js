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
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

const sections = [
  ['syllabus', 'Syllabus'],
  ['general-studies', 'General Studies'],
  ['english', 'English'],
  ['mathematics', 'Mathematics'],
  ['reasoning', 'Reasoning'],
  ['computer', 'Computer']
];

const englishModeData = {
  'One Word Substitution': { label: 'One Word Substitution word/phrase', samples: ['philanthropist', 'omniscient', 'bibliophile', 'benevolent'] },
  'Idioms': { label: 'Idiom or phrase', samples: ['break the ice', 'hit the nail on the head', 'once in a blue moon'] },
  'Antonyms & Synonyms': { label: 'Word for antonyms and synonyms', samples: ['diligent', 'prudent', 'mitigate', 'obsolete'] },
  'Spellings': { label: 'Spelling word', samples: ['accommodation', 'committee', 'necessary', 'separate'] },
  'Grammar': { label: 'Grammar topic or rule', samples: ['subject verb agreement', 'tenses', 'active voice', 'direct speech'] }
};

const builtIn = {
  benevolent: { meaning: 'दयालु, परोपकारी', syn: ['kind', 'charitable'], ant: ['cruel', 'selfish'], ex: 'A benevolent officer helped the villagers during the flood.', hi: 'एक दयालु अधिकारी ने बाढ़ के समय ग्रामीणों की मदद की।' },
  diligent: { meaning: 'मेहनती, परिश्रमी', syn: ['hardworking', 'industrious'], ant: ['lazy', 'careless'], ex: 'A diligent aspirant revises vocabulary every day.', hi: 'एक मेहनती अभ्यर्थी रोज़ शब्दावली दोहराता है।' },
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

function init() {
  store.set('active-section', active);
  store.set('english-mode', englishMode);
  renderNav();
  bindEvents();
  renderEnglishModes();
  renderSamples();
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
  const aliases = {
    OWS: 'One Word Substitution',
    'Anto & Syno': 'Antonyms & Synonyms',
    'Anto Syno': 'Antonyms & Synonyms',
    'Antonyms and synonyms': 'Antonyms & Synonyms'
  };
  return englishModeData[mode] ? mode : (aliases[mode] || 'Antonyms & Synonyms');
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
  clearStaleCurrentForSection(id);
  document.querySelectorAll('.section').forEach(section => section.classList.add('hidden'));
  $(id).classList.remove('hidden');
  document.querySelectorAll('#mainNav button').forEach(button => button.classList.remove('active'));
  $('nav-' + id)?.classList.add('active');
}

function clearStaleCurrentForSection(sectionId) {
  if (current && current.sectionId && current.sectionId !== sectionId) current = null;
}

function renderEnglishModes() {
  englishMode = normalizeEnglishMode(englishMode);
  const box = $('englishModes');
  box.innerHTML = '';
  Object.keys(englishModeData).forEach(mode => {
    const chip = document.createElement('span');
    chip.className = 'chip' + (mode === englishMode ? ' active' : '');
    chip.textContent = mode;
    chip.onclick = () => {
      englishMode = mode;
      store.set('english-mode', mode);
      renderEnglishModes();
      renderSamples();
      $('engLabel').textContent = englishModeData[mode].label;
    };
    box.appendChild(chip);
  });
  $('engLabel').textContent = englishModeData[englishMode].label;
}

function renderSamples() {
  englishMode = normalizeEnglishMode(englishMode);
  const box = $('engSamples');
  box.innerHTML = '';
  englishModeData[englishMode].samples.forEach(sample => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = sample;
    chip.onclick = () => { $('engInput').value = sample; generateEnglish(); };
    box.appendChild(chip);
  });
}

function addSyllabus() {
  const text = $('syllabusInput').value.trim();
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
  return (Array.isArray(list) ? list : []).filter(item => item && item.text).map(item => {
    const now = Date.now();
    const created = item.created || item.createdMs || now;
    return {
      id: item.id || `${item.text}-${created}`,
      text: String(item.text).trim(),
      done: Boolean(item.done),
      created,
      updatedMs: item.updatedMs || item.createdMs || created
    };
  });
}

function removeSyllabus(id) {
  if (!confirm('Remove this syllabus topic?')) return;
  setSyllabus(normalizeSyllabus(store.get('syllabus', [])).filter(item => item.id !== id));
}

function renderSyllabus() {
  const list = normalizeSyllabus(store.get('syllabus', []));
  const box = $('syllabusList');
  const progress = $('syllabusProgress');
  const done = list.filter(item => item.done).length;
  progress.textContent = `${done} / ${list.length} completed`;
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
  const text = $(ids[type]).value.trim();
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
  if (/constitution|parliament|president|polity/.test(t)) return 'Polity';
  if (/economy|inflation|gdp|budget|tax/.test(t)) return 'Economics';
  if (/environment|biodiversity|pollution/.test(t)) return 'Environment';
  if (/current|appointment|award|scheme/.test(t)) return 'Current Affairs';
  return 'Static GK';
}

function generateEnglish() {
  const term = $('engInput').value.trim();
  if (!term) return;
  const key = term.toLowerCase();
  const data = builtIn[key] || { meaning: 'Hindi meaning to be refined later', syn: ['related word 1', 'related word 2'], ant: ['opposite word 1', 'opposite word 2'], ex: `${term} is useful for exam vocabulary revision.`, hi: 'यह परीक्षा शब्दावली पुनरावृत्ति के लिए उपयोगी है।' };
  const body = `Category: ${englishMode}\nHindi Meaning: ${data.meaning}\nSynonyms: ${data.syn.join(', ')}\nAntonyms: ${data.ant.join(', ')}\nExample: ${data.ex}\nExample Hindi: ${data.hi}`;
  current = { id: crypto.randomUUID(), sectionId: 'english', section: 'English', title: term, body, created: new Date().toLocaleString(), createdMs: Date.now() };
  $('engOut').innerHTML = cards([
    ['Word / Phrase', term], ['Category', englishMode], ['Hindi Meaning', data.meaning],
    ['Synonyms', data.syn.join(', ')], ['Antonyms', data.ant.join(', ')], ['Example', data.ex], ['Example Hindi', data.hi]
  ]);
}

function cards(rows) { return rows.map(([title, value]) => `<div class="box"><div class="out-title">${esc(title)}</div><div class="out">${esc(value)}</div></div>`).join(''); }

function clearEnglish() { $('engInput').value = ''; $('engOut').innerHTML = ''; current = null; }

function activeMatchesCurrent() {
  if (!current) return false;
  if (!current.sectionId) return true;
  return current.sectionId === active;
}

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

function deleteItem(id) {
  if (confirm('Delete this item?')) {
    const items = store.get('saved', []);
    setSaved(items.filter(item => item.id !== id));
  }
}

function renderHistory() {
  const h = $('history');
  const items = dedupe(store.get('saved', []));
  h.innerHTML = items.length ? '' : '<div class="empty-state">No saved revision entries yet.</div>';
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'card-delete no-print';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete item';
    deleteBtn.onclick = (e) => { e.preventDefault(); deleteItem(item.id); };
    card.innerHTML = `<span class="tag">${esc(displaySection(item.section))}</span><h3>${esc(item.title)}</h3><div class="small">${esc(item.created || '')}</div><div class="out">${esc(item.body)}</div>`;
    card.appendChild(deleteBtn);
    h.appendChild(card);
  });
}

function displaySection(section) {
  if (section === 'Computer Mode') return 'Computer';
  if (section === 'Anto & Syno' || section === 'Anto Syno') return 'Antonyms & Synonyms';
  if (section === 'OWS') return 'One Word Substitution';
  return section || 'Revision';
}

function clearSaved() { if (confirm('Clear saved revision list?')) setSaved([]); }

function downloadJSON() {
  const blob = new Blob([JSON.stringify({ saved: store.get('saved', []), syllabus: store.get('syllabus', []) }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'abhyasam-ai-revision.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function dedupe(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter(item => item && item.title).filter(item => {
    const id = item.id || `${item.section}-${item.title}-${item.created}`;
    item.id = id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).sort((a, b) => (b.createdMs || b.savedMs || 0) - (a.createdMs || a.savedMs || 0));
}

function setSyncStatus(html) { $('syncStatus').innerHTML = html; }

function localState() { return { saved: dedupe(store.get('saved', [])), syllabus: normalizeSyllabus(store.get('syllabus', [])) }; }

function applyState(data) {
  applyingRemote = true;
  store.set('saved', dedupe(data.saved || []));
  store.set('syllabus', normalizeSyllabus(data.syllabus || []));
  renderHistory();
  renderSyllabus();
  applyingRemote = false;
}

async function initFirebase() {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    onAuthStateChanged(auth, handleAuthState);
  } catch (error) {
    setSyncStatus(`Firebase not ready. Local mode is active. ${esc(error.code || error.message || '')}`);
  }
}

async function login() {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (error) { setSyncStatus(`Sign-in failed: ${esc(error.code || error.message)}`); }
}

async function logout() { if (auth) await signOut(auth); }

async function handleAuthState(currentUser) {
  user = currentUser;
  if (remoteUnsub) { remoteUnsub(); remoteUnsub = null; }
  if (!user) {
    $('loginBtn').classList.remove('hidden');
    $('logoutBtn').classList.add('hidden');
    $('syncNowBtn').classList.add('hidden');
    setSyncStatus('Local mode. Sign in to sync across devices.');
    return;
  }
  $('loginBtn').classList.add('hidden');
  $('logoutBtn').classList.remove('hidden');
  $('syncNowBtn').classList.remove('hidden');
  setSyncStatus(`Signed in as <strong>${esc(user.email || 'user')}</strong>. Sync starting...`);
  const ref = doc(db, 'users', user.uid, 'state', 'main');
  try {
    const snap = await getDoc(ref);
    const local = localState();
    let merged = local;
    if (snap.exists()) {
      const cloud = snap.data() || {};
      merged = { saved: dedupe([...(local.saved || []), ...(cloud.saved || [])]), syllabus: mergeSyllabus(local.syllabus || [], cloud.syllabus || []) };
      applyState(merged);
    }
    await setDoc(ref, { ...merged, updatedAt: serverTimestamp() }, { merge: true });
    remoteUnsub = onSnapshot(ref, snapshot => {
      if (applyingRemote || !snapshot.exists()) return;
      applyState(snapshot.data() || {});
      setSyncStatus(`Signed in as <strong>${esc(user.email || 'user')}</strong>. Synced.`);
    }, error => {
      setSyncStatus(`Sync listener failed: ${esc(error.code || error.message)}`);
    });
    setSyncStatus(`Signed in as <strong>${esc(user.email || 'user')}</strong>. Synced.`);
  } catch (error) {
    setSyncStatus(`Signed in, but sync failed: ${esc(error.code || error.message)}`);
  }
}

function mergeSyllabus(local, cloud) {
  const map = new Map();
  [...normalizeSyllabus(local), ...normalizeSyllabus(cloud)].forEach(item => {
    const id = item.id || item.text;
    const existing = map.get(id);
    if (!existing || (item.updatedMs || 0) >= (existing.updatedMs || 0)) map.set(id, { ...item, id });
  });
  return [...map.values()].sort((a, b) => (a.created || 0) - (b.created || 0));
}

function queueSync() {
  if (applyingRemote || !user || !db) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncToCloud(false), 700);
}

async function syncToCloud(manual) {
  if (!user || !db) { if (manual) setSyncStatus('Sign in first to sync.'); return; }
  try {
    await setDoc(doc(db, 'users', user.uid, 'state', 'main'), { ...localState(), updatedAt: serverTimestamp() }, { merge: true });
    setSyncStatus(`Signed in as <strong>${esc(user.email || 'user')}</strong>. Synced.`);
  } catch (error) {
    setSyncStatus(`Sync failed: ${esc(error.code || error.message)}`);
  }
}

init();