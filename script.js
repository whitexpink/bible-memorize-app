// =====================
// 設定：揀版本（translation）
// =====================
// ✅ 公開部署建議先用 CUV（和合本繁體）
// 若你有授權/只做私用，可試 CUNP（新標點和合本）
const TRANSLATION = "CUV";
const API_BASE = "https://bolls.life";

// =====================
// DOM
// =====================
const $today = document.getElementById("today");
const $status = document.getElementById("status");
const $ref = document.getElementById("ref");
const $verse = document.getElementById("verse");
const $quiz = document.getElementById("quiz");
const $result = document.getElementById("result");

let todayKey = "";   // YYYY-MM-DD
let current = null;  // { ref: "...", text: "..." }
let quizTokens = []; // [{original, fillable, isBlank, user}]

// =====================
// 日期工具
// =====================
function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// =====================
// localStorage keys
// =====================
function doneKeyForDate(ymd) { return `bible_done_${ymd}`; }
function verseKeyForDate(ymd) { return `bible_verse_${TRANSLATION}_${ymd}`; }
function booksKey() { return `bible_books_${TRANSLATION}`; }

function isDoneToday(ymd) {
  return localStorage.getItem(doneKeyForDate(ymd)) === "1";
}
function setDoneToday(ymd) {
  localStorage.setItem(doneKeyForDate(ymd), "1");
}
function renderStatus(ymd) {
  $status.textContent = isDoneToday(ymd) ? "✅ 今日已完成" : "⬜ 未完成";
}

// =====================
// HTML -> 純文字（API text 會有 HTML）
// =====================
function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent || "").trim();
}

// =====================
// 取得書卷名（book id -> 中文名）
// =====================
async function getBooksMap() {
  const cached = localStorage.getItem(booksKey());
  if (cached) return JSON.parse(cached);

  const url = `${API_BASE}/get-books/${encodeURIComponent(TRANSLATION)}/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`get-books failed: ${res.status}`);
  const books = await res.json(); // [{bookid,name,chapters,...}]
  const map = {};
  books.forEach(b => { map[b.bookid] = b.name; });

  localStorage.setItem(booksKey(), JSON.stringify(map));
  return map;
}

// =====================
// 抽一節隨機經文（全本）
// =====================
async function fetchRandomVerse() {
  const url = `${API_BASE}/get-random-verse/${encodeURIComponent(TRANSLATION)}/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`random-verse failed: ${res.status}`);
  const data = await res.json();
  // data: { book, chapter, verse, text (html), ... }
  const booksMap = await getBooksMap();
  const bookName = booksMap[data.book] || `Book${data.book}`;
  const ref = `${bookName} ${data.chapter}:${data.verse}`;
  const text = htmlToText(data.text);

  return { ref, text };
}

// =====================
// 每日只一節：今日若未抽過，就抽一次並存起來
// =====================
async function getTodayVerse(ymd) {
  const cached = localStorage.getItem(verseKeyForDate(ymd));
  if (cached) return JSON.parse(cached);

  const v = await fetchRandomVerse();
  localStorage.setItem(verseKeyForDate(ymd), JSON.stringify(v));
  return v;
}

// =====================
// 填空：只遮「可背嘅字」，標點/空白照常顯示（避免一堆空位）
// =====================
function isFillableChar(ch) {
  // 中文 + 英文字母/數字可背；空白/標點唔遮
  return /[\u4E00-\u9FFFA-Za-z0-9]/.test(ch);
}

function tokenize(text) {
  return [...text].map(ch => ({
    original: ch,
    fillable: isFillableChar(ch),
    isBlank: false,
    user: ""
  }));
}

function buildQuizTokens(tokens, blanksRatio = 0.28) {
  const candidates = tokens
    .map((t, i) => ({ t, i }))
    .filter(x => x.t.fillable);

  const blanksCount = Math.max(1, Math.floor(candidates.length * blanksRatio));
  const chosen = new Set();

  // 避免連續太多空格（可自行移除）
  while (chosen.size < blanksCount) {
    const r = candidates[Math.floor(Math.random() * candidates.length)];
    if (chosen.has(r.i)) continue;
    if (chosen.has(r.i - 1) || chosen.has(r.i + 1)) continue;
    chosen.add(r.i);
    if (chosen.size >= candidates.length) break;
  }

  return tokens.map((t, i) => ({
    ...t,
    isBlank: chosen.has(i),
    user: ""
  }));
}

// =====================
// UI helpers
// =====================
function clearResult() {
  $result.textContent = "";
  $result.className = "result";
}
function setResultOk(msg) {
  $result.textContent = msg;
  $result.className = "result ok";
}
function setResultBad(msg) {
  $result.textContent = msg;
  $result.className = "result bad";
}

function lockInputs(locked) {
  const inputs = $quiz.querySelectorAll("input");
  inputs.forEach(inp => (inp.disabled = locked));

  document.getElementById("btnCheck").disabled = locked;
  document.getElementById("btnHint").disabled = locked;
  document.getElementById("btnReveal").disabled = locked;
  document.getElementById("btnReset").disabled = locked;
}

function renderVerse(v) {
  // ✅ 上方完整顯示經文
  $ref.textContent = v.ref;
  $verse.textContent = v.text;
}

function renderQuiz() {
  // ✅ 填空區：連續文字 + 少量輸入框（不再一格一格）
  $quiz.innerHTML = "";
  clearResult();

  quizTokens.forEach((tok) => {
    if (tok.isBlank) {
      const input = document.createElement("input");
      input.className = "qinput"; // 需要你 style.css 加 .qinput/.qchar/.qpunc 樣式
      input.maxLength = 1;
      input.value = tok.user || "";
      input.addEventListener("input", (e) => {
        tok.user = e.target.value;
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") checkAnswers();
      });
      $quiz.appendChild(input);
      return;
    }

    const span = document.createElement("span");
    span.textContent = tok.original;
    span.className = tok.fillable ? "qchar" : "qpunc";
    $quiz.appendChild(span);
  });
}

// =====================
// 核心：載入今日經文 + 生成填空
// =====================
async function loadVerseAndQuiz() {
  todayKey = formatYMD(new Date());
  $today.textContent = todayKey;
  renderStatus(todayKey);

  try {
    current = await getTodayVerse(todayKey);
    renderVerse(current);

    const tokens = tokenize(current.text);
    quizTokens = buildQuizTokens(tokens, 0.28);
    renderQuiz();

    lockInputs(isDoneToday(todayKey));
  } catch (e) {
    setResultBad(`載入經文失敗：${e.message}`);
  }
}

// =====================
// 動作
// =====================
function checkAnswers() {
  let total = 0;
  let correct = 0;

  quizTokens.forEach(tok => {
    if (!tok.isBlank) return;
    total++;
    if ((tok.user || "") === tok.original) correct++;
  });

  if (total === 0) return setResultBad("呢節經文冇空格（重設一次試下）");

  if (correct === total) {
    setDoneToday(todayKey);
    renderStatus(todayKey);
    lockInputs(true);
    setResultOk("✅ 全部正確！今日完成 🎉");
  } else {
    setResultBad(`❌ 命中 ${correct}/${total}。再試下～`);
  }
}

function hintOneChar() {
  if (isDoneToday(todayKey)) return;

  const blanks = quizTokens
    .map((t, i) => ({ t, i }))
    .filter(x => x.t.isBlank && (x.t.user || "") !== x.t.original);

  if (blanks.length === 0) return setResultOk("✅ 已經全部填啱晒！");
  const pick = blanks[Math.floor(Math.random() * blanks.length)];
  quizTokens[pick.i].user = quizTokens[pick.i].original;
  renderQuiz();
  setResultOk("💡 已提示 1 個字");
}

function revealAll() {
  if (isDoneToday(todayKey)) return;

  quizTokens.forEach(tok => {
    if (tok.isBlank) tok.user = tok.original;
  });
  renderQuiz();
  setResultBad("👀 已顯示答案（未算完成）");
}

function resetQuiz() {
  if (isDoneToday(todayKey)) return;

  const tokens = tokenize(current.text);
  quizTokens = buildQuizTokens(tokens, 0.28);
  renderQuiz();
}

// =====================
// 綁定按鈕 + 啟動
// =====================
document.getElementById("btnCheck").addEventListener("click", checkAnswers);
document.getElementById("btnHint").addEventListener("click", hintOneChar);
document.getElementById("btnReveal").addEventListener("click", revealAll);
document.getElementById("btnReset").addEventListener("click", resetQuiz);

loadVerseAndQuiz();