const TRANSLATION = "CUV";
const API_BASE = "https://bolls.life";

const $today = document.getElementById("today");
const $status = document.getElementById("status");
const $ref = document.getElementById("ref");
const $verse = document.getElementById("verse");
const $quiz = document.getElementById("quiz");
const $result = document.getElementById("result");

let quizTokens = [];
let todayKey = new Date().toISOString().slice(0, 10);

function doneKey() {
  return `bible_done_${todayKey}`;
}
function isDoneToday() {
  return localStorage.getItem(doneKey()) === "1";
}
function setDoneToday() {
  localStorage.setItem(doneKey(), "1");
}

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent.trim();
}

async function fetchRandomVerse() {
  const res = await fetch(`${API_BASE}/get-random-verse/${TRANSLATION}/`);
  const v = await res.json();
  return {
    ref: `${v.book} ${v.chapter}:${v.verse}`,
    text: htmlToText(v.text),
  };
}

function tokenize(text) {
  return [...text];
}

function buildQuizTokens(tokens) {
  const blanks = Math.max(1, Math.floor(tokens.length * 0.25));
  const blankSet = new Set();
  while (blankSet.size < blanks) {
    const i = Math.floor(Math.random() * tokens.length);
    if (tokens[i].trim()) blankSet.add(i);
  }
  return tokens.map((t, i) => ({
    original: t,
    isBlank: blankSet.has(i),
    user: "",
  }));
}

function renderQuiz() {
  $quiz.innerHTML = "";
  quizTokens.forEach(tok => {
    const span = document.createElement("span");
    span.className = "word";
    if (tok.isBlank) {
      const input = document.createElement("input");
      input.maxLength = 1;
      input.value = tok.user;
      input.oninput = e => (tok.user = e.target.value);
      span.appendChild(input);
    } else {
      span.textContent = tok.original;
      span.style.opacity = 0.5;
    }
    $quiz.appendChild(span);
  });
}

function checkAnswers() {
  const blanks = quizTokens.filter(t => t.isBlank);
  const correct = blanks.filter(t => t.user === t.original).length;
  if (correct === blanks.length) {
    setDoneToday();
    $status.textContent = "✅ 今日完成";
    $result.textContent = "做得好 🎉";
  } else {
    $result.textContent = `啱 ${correct}/${blanks.length}`;
  }
}

document.getElementById("btnCheck").onclick = checkAnswers;

async function init() {
  $today.textContent = todayKey;
  $status.textContent = isDoneToday() ? "✅ 今日完成" : "⬜ 未完成";

  const v = await fetchRandomVerse();
  $ref.textContent = v.ref;
  $verse.textContent = v.text;

  quizTokens = buildQuizTokens(tokenize(v.text));
  renderQuiz();
}

init();