const API_URL =
  "https://script.google.com/macros/s/AKfycbyGjDH-JH_XWPggnOJEY74CplkiIJxpl6MD_1xJX6fhS_o5KagI4H2ozSEbXleBDoPTOw/exec";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

const ROWS = [
  { label:"총괄", role:"hall", type:"hall" },
  { label:"티카(M1)", role:"hall", type:"hall" },
  { label:"티카(S1)", role:"hall", type:"hall" },
  { label:"티카(M2)", role:"hall", type:"hall" },
  { label:"티카(S2)", role:"hall", type:"hall" },
  { label:"티카(H)", role:"hall", type:"hall" },
  { label:"serving", role:"hall", type:"hall" },
  { label:"serving", role:"hall", type:"hall" },
  { label:"serving", role:"hall", type:"hall" },
  { label:"serving", role:"hall", type:"hall" },
  { label:"serving", role:"hall", type:"hall" },
  { label:"serving", role:"hall", type:"hall" },
  { label:"serving", role:"hall", type:"hall" },

  { label:"홀 총원", type:"hallTotal", summary:true },

  { label:"주방", type:"kitchenHead", section:true },

  { label:"메인쉐프", role:"kitchen", type:"kitchen" },
  { label:"팀원", role:"kitchen", type:"kitchen" },
  { label:"팀원", role:"kitchen", type:"kitchen" },
  { label:"팀원", role:"kitchen", type:"kitchen" },
  { label:"팀원", role:"kitchen", type:"kitchen" },
  { label:"팀원", role:"kitchen", type:"kitchen" },
  { label:"팀원", role:"kitchen", type:"kitchen" },
  { label:"팀원", role:"kitchen", type:"kitchen" },
  { label:"전처리", role:"prep", type:"kitchen" },

  { label:"주방 총원", type:"kitchenTotal", summary:true },

  { label:"퇴식", role:"exit", type:"exit" },
  { label:"퇴식", role:"exit", type:"exit" },
  { label:"설거지", role:"wash", type:"wash" },
  { label:"설거지", role:"wash", type:"wash" },
  { label:"설거지", role:"wash", type:"wash" }
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

function showLoading(show){
  document.getElementById("loadingBox").classList.toggle("hidden", !show);
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
    renderTable();
  }catch(err){
    console.error(err);
    alert("직원 목록을 불러오지 못했습니다. Apps Script 배포와 권한을 확인하세요.");
  }finally{
    showLoading(false);
  }
}

function renderTable(){
  renderTitle();
  renderHeader();
  renderBody();
  updateTotals();
  renderDayOffSummary();
}

function renderTitle(){
  if(!weeklyOptions.length) return;

  const first = new Date(weeklyOptions[0].date);
  const last = new Date(weeklyOptions[6].date);

  document.getElementById("scheduleTitle").textContent =
    `한국의집 주간 근무표(${first.getMonth()+1}/${first.getDate()}~${last.getMonth()+1}/${last.getDate()})`;
}

function renderHeader(){
  const head = document.getElementById("scheduleHead");

  let html = "<tr>";
  html += `<th class="label-col">구분</th>`;

  weeklyOptions.forEach(function(day, index){
    const d = new Date(day.date);
    html += `<th class="name-col">${DAYS[index]}(${d.getMonth()+1}/${d.getDate()})</th>`;
    html += `<th class="time-col">시간</th>`;
  });

  html += "</tr>";
  head.innerHTML = html;
}

function renderBody(){
  const body = document.getElementById("scheduleBody");
  body.innerHTML = "";

  ROWS.forEach(function(row, rowIndex){
    const tr = document.createElement("tr");

    if(row.summary){
      tr.className = "summary-row";
    }

    if(row.section){
      tr.className = "kitchen-head";
    }

    const labelTd = document.createElement("td");
    labelTd.className = `label-col ${labelClass(row)}`;
    labelTd.textContent = row.label;
    tr.appendChild(labelTd);

    for(let dayIndex = 0; dayIndex < 7; dayIndex++){
      const nameTd = document.createElement("td");
      const timeTd = document.createElement("td");

      if(row.summary){
        nameTd.dataset.total = row.type;
        nameTd.dataset.dayIndex = dayIndex;
        nameTd.textContent = "0";
        timeTd.className = "empty-cell";
      }else if(row.section){
        nameTd.className = "empty-cell";
        timeTd.className = "empty-cell";
      }else{
        nameTd.appendChild(createNameSelect(dayIndex, row.role, rowIndex));
        timeTd.appendChild(createTimeSelect(dayIndex, row.role, rowIndex));
      }

      tr.appendChild(nameTd);
      tr.appendChild(timeTd);
    }

    body.appendChild(tr);
  });
}

function labelClass(row){
  if(row.type === "kitchen") return "kitchen-label";
  if(row.type === "exit") return "exit-label";
  if(row.type === "wash") return "wash-label";
  if(row.type === "kitchenHead") return "";
  return "";
}

function createNameSelect(dayIndex, role, rowIndex){
  const select = document.createElement("select");
  select.className = "name-select";
  select.dataset.dayIndex = dayIndex;
  select.dataset.role = role;
  select.dataset.rowIndex = rowIndex;

  const day = weeklyOptions[dayIndex] || {};
  const names = day[role] || [];

  select.innerHTML = `<option value=""></option>` +
    names.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");

  select.addEventListener("change", updateTotals);

  return select;
}

function createTimeSelect(dayIndex, role, rowIndex){
  const select = document.createElement("select");
  select.className = "time-select";
  select.dataset.dayIndex = dayIndex;
  select.dataset.role = role;
  select.dataset.rowIndex = rowIndex;

  const day = weeklyOptions[dayIndex] || {};
  const times = day.time || [];

  select.innerHTML = `<option value=""></option>` +
    times.map(time => `<option value="${escapeHtml(time)}">${escapeHtml(time)}</option>`).join("");

  return select;
}

function updateTotals(){
  for(let dayIndex = 0; dayIndex < 7; dayIndex++){
    const hallCount = document.querySelectorAll(`.name-select[data-day-index="${dayIndex}"][data-role="hall"]`)
      ? Array.from(document.querySelectorAll(`.name-select[data-day-index="${dayIndex}"][data-role="hall"]`)).filter(s => s.value).length
      : 0;

    const kitchenCount =
      Array.from(document.querySelectorAll(`.name-select[data-day-index="${dayIndex}"][data-role="kitchen"]`)).filter(s => s.value).length +
      Array.from(document.querySelectorAll(`.name-select[data-day-index="${dayIndex}"][data-role="prep"]`)).filter(s => s.value).length;

    const hallCell = document.querySelector(`[data-total="hallTotal"][data-day-index="${dayIndex}"]`);
    const kitchenCell = document.querySelector(`[data-total="kitchenTotal"][data-day-index="${dayIndex}"]`);

    if(hallCell) hallCell.textContent = hallCount;
    if(kitchenCell) kitchenCell.textContent = kitchenCount;
  }
}

function renderDayOffSummary(){
  const summary = document.getElementById("dayOffSummary");

  const lines = weeklyOptions.map(function(day, index){
    const names = day.dayOffNames || [];
    return `${DAYS[index]} ${day.label}: ${names.length ? names.join(", ") : "없음"}`;
  });

  summary.textContent = "D/O 제외 · " + lines.join(" / ");
}

function collectScheduleData(){
  const schedule = {};

  for(let dayIndex = 0; dayIndex < 7; dayIndex++){
    schedule[dayIndex] = {
      hall:[],
      kitchen:[],
      prep:[],
      exit:[],
      wash:[]
    };
  }

  ROWS.forEach(function(row, rowIndex){
    if(!row.role) return;

    for(let dayIndex = 0; dayIndex < 7; dayIndex++){
      const nameSelect = document.querySelector(`.name-select[data-day-index="${dayIndex}"][data-row-index="${rowIndex}"]`);
      const timeSelect = document.querySelector(`.time-select[data-day-index="${dayIndex}"][data-row-index="${rowIndex}"]`);

      const name = nameSelect ? nameSelect.value : "";
      const time = timeSelect ? timeSelect.value : "";

      if(name || time){
        schedule[dayIndex][row.role].push({ name, time });
      }
    }
  });

  return schedule;
}

async function saveWeeklySchedule(){
  const monday = document.getElementById("mondayInput").value;

  if(!monday){
    alert("주간 시작일을 선택하세요.");
    return;
  }

  const ok = confirm("작성한 주간 스케줄을 구글시트에 저장할까요?");
  if(!ok) return;

  showLoading(true);

  try{
    const res = await fetch(API_URL, {
      method:"POST",
      body:JSON.stringify({
        action:"saveWeeklySchedule",
        monday,
        schedule:collectScheduleData()
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
