// ===== 1) 經文清單（你可以自己加/改） =====
const VERSES = [
  { ref: "詩篇 23:1", text: "耶和華是我的牧者，我必不致缺乏。" },
  { ref: "箴言 3:5", text: "你要專心仰賴耶和華，不可倚靠自己的聰明。" },
  { ref: "腓立比書 4:6", text: "應當一無掛慮，只要凡事藉著禱告、祈求和感謝，將你們所要的告訴神。" },
  { ref: "馬太福音 11:28", text: "凡勞苦擔重擔的人可以到我這裡來，我就使你們得安息。" },
  { ref: "羅馬書 8:28", text: "我們曉得萬事都互相效力，叫愛神的人得益處。" },
  { ref: "以賽亞書 41:10", text: "你不要害怕，因為我與你同在；不要驚惶，因為我是你的神。" },
];

// ===== 2) 工具：每日固定選一節 =====
function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function hashStringToInt(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
function pickDailyVerse(date = new Date()) {
  const key = formatYMD(date);
  const idx = hashStringToInt(key) % VERSES.length;
  return { verse: VERSES[idx], key };
}

// ===== 3) 填空（逐字） =====
function tokenize(text) {
  // 簡單逐字拆分（中文好用；英文會變逐字）
  const tokens = [];
  for (const ch of text) tokens.push(ch);
  return tokens;
}
function buildQuizTokens(tokens, blanksRatio = 0.28) {
  const candidates = tokens
    .map((t, i) => ({ t, i }))
    .filter(x => x.t.trim() !== "");

  const blanksCount = Math.max(1, Math.floor(candidates.length * blanksRatio));
  const chosen = new Set();

  while (chosen.size < blanksCount) {
    const r = candidates[Math.floor(Math.random() * candidates.length)];
    if (chosen.has(r.i)) continue;
    if (chosen.has(r.i - 1) || chosen.has(r.i + 1)) continue;
    chosen.add(r.i);
    if (chosen.size >= candidates.length) break;
  }

  return tokens.map((t, i) => ({
    original: t,
    isBlank: chosen.has(i),
    user: "",
  }));
}

// ===== 4) 完成狀態（localStorage） =====
function doneKeyForDate(ymd) {
  return `bible_done_${ymd}`;
}
function isDoneToday(ymd) {
  return localStorage.getItem(doneKeyForDate(ymd)) === "1";
}
function setDoneToday(ymd) {
  localStorage.setItem(doneKeyForDate(ymd), "1");
}

// ===== 5) UI =====
const $today = document.getElementById("today");
const $status = document.getElementById("status");
const $ref = document.getElementById("ref");
const $verse = document.getElementById("verse");
const $quiz = document.getElementById("quiz");
const $result = document.getElementById("result");

let current = null;     // {ref,text}
let quizTokens = [];    // [{original,isBlank,user}]
let todayKey = "";      // "YYYY-MM-DD"

function renderStatus(ymd) {
  $status.textContent = isDoneToday(ymd) ? "✅ 今日已完成" : "⬜ 未完成";
}

function renderVerse(v) {
  $ref.textContent = v.ref;
  $verse.textContent = v.text;
}

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

function renderQuiz() {
  $quiz.innerHTML = "";

  quizTokens.forEach((tok) => {
    const wrap = document.createElement("span");
    wrap.className = "word";

    if (tok.isBlank) {
      const input = document.createElement("input");
      input.setAttribute("maxlength", "1");
      input.value = tok.user || "";
      input.addEventListener("input", (e) => {
        tok.user = e.target.value;
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") checkAnswers();
      });
      wrap.appendChild(input);
    } else {
      const span = document.createElement("span");
      span.className = "mask";
      span.textContent = tok.original;
      wrap.appendChild(span);
    }

    $quiz.appendChild(wrap);
  });

  clearResult();
}

function loadVerseAndQuiz() {
  const { verse, key } = pickDailyVerse(new Date());
  todayKey = key;

  $today.textContent = key;
  renderStatus(todayKey);

  current = verse;
  renderVerse(current);

  const tokens = tokenize(current.text);
  quizTokens = buildQuizTokens(tokens, 0.28);
  renderQuiz();

  // 今日已完成就鎖住
  lockInputs(isDoneToday(todayKey));
}

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

// ===== 6) 綁定按鈕 =====
document.getElementById("btnCheck").addEventListener("click", checkAnswers);
document.getElementById("btnHint").addEventListener("click", hintOneChar);
document.getElementById("btnReveal").addEventListener("click", revealAll);
document.getElementById("btnReset").addEventListener("click", resetQuiz);

// ===== 7) 啟動 =====
loadVerseAndQuiz();