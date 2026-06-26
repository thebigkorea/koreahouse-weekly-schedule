const API_URL =
  "https://script.google.com/macros/s/AKfycbyGjDH-JH_XWPggnOJEY74CplkiIJxpl6MD_1xJX6fhS_o5KagI4H2ozSEbXleBDoPTOw/exec";

const ROLE_CONFIG = [
  { key:"hall", label:"홀", maxRows:13 },
  { key:"kitchen", label:"주방", maxRows:8 },
  { key:"prep", label:"전처리", maxRows:1 },
  { key:"exit", label:"퇴식", maxRows:2 },
  { key:"wash", label:"설거지", maxRows:3 }
];

let weeklyOptions = [];

document.addEventListener("DOMContentLoaded", function(){
  setThisWeek();
});

function getMonday(date){
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

function formatDateInput(date){
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function setThisWeek(){
  const monday = getMonday(new Date());
  document.getElementById("mondayInput").value = formatDateInput(monday);
  loadStaffOptions();
}

function setNextWeek(){
  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + 7);
  document.getElementById("mondayInput").value = formatDateInput(monday);
  loadStaffOptions();
}

async function loadStaffOptions(){
  const monday = document.getElementById("mondayInput").value;

  if(!monday){
    alert("주간 시작일을 선택하세요.");
    return;
  }

  showLoading(true);

  try{
    const url = `${API_URL}?action=getStaffOptions&monday=${encodeURIComponent(monday)}&t=${Date.now()}`;
    const res = await fetch(url);
    const data = await res.json();

    if(!data.ok){
      throw new Error(data.message || "직원목록 조회 실패");
    }

    weeklyOptions = data.data || [];
    renderScheduleCards();

  }catch(err){
    console.error(err);
    alert("직원 목록을 불러오지 못했습니다. Apps Script 배포와 권한을 확인하세요.");
  }finally{
    showLoading(false);
  }
}

function showLoading(show){
  document.getElementById("loadingBox").classList.toggle("hidden", !show);
}

function renderScheduleCards(){
  const area = document.getElementById("scheduleArea");
  area.innerHTML = "";

  if(!weeklyOptions.length){
    area.innerHTML = `<div class="empty-text">불러온 주간 데이터가 없습니다.</div>`;
    return;
  }

  weeklyOptions.forEach(function(day, dayIndex){
    const card = document.createElement("article");
    card.className = "day-card";
    card.dataset.dayIndex = dayIndex;

    const dayName = ["월","화","수","목","금","토","일"][dayIndex];
    const offNames = day.dayOffNames || [];

    card.innerHTML = `
      <div class="day-head">
        <div>
          <h2>${dayName}요일 ${day.label}</h2>
          <p>${day.date}</p>
        </div>
        <div class="off-list">
          D/O 제외: ${offNames.length ? offNames.join(", ") : "없음"}
        </div>
      </div>
      <div class="role-area"></div>
    `;

    const roleArea = card.querySelector(".role-area");

    ROLE_CONFIG.forEach(function(role){
      roleArea.appendChild(createRoleBlock(role, day[role.key] || [], day.time || []));
    });

    area.appendChild(card);
  });
}

function createRoleBlock(role, names, times){
  const block = document.createElement("div");
  block.className = "role-block";
  block.dataset.role = role.key;

  block.innerHTML = `
    <div class="role-title">
      <strong>${role.label}</strong>
      <button type="button">+ 추가</button>
    </div>
    <div class="rows"></div>
  `;

  const rows = block.querySelector(".rows");
  const addBtn = block.querySelector("button");

  addBtn.addEventListener("click", function(){
    const currentCount = rows.querySelectorAll(".schedule-row").length;
    if(currentCount >= role.maxRows){
      alert(`${role.label}은 최대 ${role.maxRows}명까지 입력할 수 있습니다.`);
      return;
    }
    rows.appendChild(createScheduleRow(names, times));
  });

  rows.appendChild(createScheduleRow(names, times));

  return block;
}

function createScheduleRow(names, times){
  const row = document.createElement("div");
  row.className = "schedule-row";

  const nameOptions = [`<option value="">직원 선택</option>`]
    .concat(names.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`))
    .join("");

  const timeOptions = [`<option value="">시간 선택</option>`]
    .concat(times.map(time => `<option value="${escapeHtml(time)}">${escapeHtml(time)}</option>`))
    .join("");

  row.innerHTML = `
    <select class="name-select">${nameOptions}</select>
    <select class="time-select">${timeOptions}</select>
    <button type="button" title="삭제">×</button>
  `;

  row.querySelector("button").addEventListener("click", function(){
    row.remove();
  });

  return row;
}

function collectScheduleData(){
  const result = {};

  document.querySelectorAll(".day-card").forEach(function(card){
    const dayIndex = card.dataset.dayIndex;
    result[dayIndex] = {};

    ROLE_CONFIG.forEach(function(role){
      const block = card.querySelector(`.role-block[data-role="${role.key}"]`);
      const rows = [];

      block.querySelectorAll(".schedule-row").forEach(function(row){
        const name = row.querySelector(".name-select").value;
        const time = row.querySelector(".time-select").value;

        if(name || time){
          rows.push({ name, time });
        }
      });

      result[dayIndex][role.key] = rows;
    });
  });

  return result;
}

async function saveWeeklySchedule(){
  const monday = document.getElementById("mondayInput").value;

  if(!monday){
    alert("주간 시작일을 선택하세요.");
    return;
  }

  const schedule = collectScheduleData();

  const ok = confirm("작성한 주간 스케줄을 구글시트에 저장할까요?");
  if(!ok) return;

  showLoading(true);

  try{
    const res = await fetch(API_URL, {
      method:"POST",
      body:JSON.stringify({
        action:"saveWeeklySchedule",
        monday,
        schedule
      })
    });

    const data = await res.json();

    if(!data.ok){
      throw new Error(data.message || "저장 실패");
    }

    alert("주간 스케줄이 구글시트에 저장되었습니다.");

  }catch(err){
    console.error(err);
    alert("저장 중 오류가 발생했습니다. Apps Script 배포 권한을 확인하세요.");
  }finally{
    showLoading(false);
  }
}

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
