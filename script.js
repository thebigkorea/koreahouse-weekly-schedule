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
  const mondayInput = document.getElementById("mondayInput");

  mondayInput.addEventListener("change", function(){
    loadStaffOptions();
  });

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

    // 저장된 근무표 자동 불러오기
    loadCurrentWeeklySchedule(false);
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

  select.addEventListener("change", function(){
    updateTotals();
  });

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

    const hallNames = Array.from(
      document.querySelectorAll(
        `.name-select[data-day-index="${dayIndex}"][data-role="hall"]`
      )
    )
    .map(select => select.value.trim())
    .filter(Boolean);

    const kitchenNames = [
      ...Array.from(
        document.querySelectorAll(
          `.name-select[data-day-index="${dayIndex}"][data-role="kitchen"]`
        )
      ),
      ...Array.from(
        document.querySelectorAll(
          `.name-select[data-day-index="${dayIndex}"][data-role="prep"]`
        )
      )
    ]
    .map(select => select.value.trim())
    .filter(Boolean);

    const hallUniqueCount = new Set(hallNames).size;
    const kitchenUniqueCount = new Set(kitchenNames).size;

    const hallCell = document.querySelector(
      `[data-total="hallTotal"][data-day-index="${dayIndex}"]`
    );

    const kitchenCell = document.querySelector(
      `[data-total="kitchenTotal"][data-day-index="${dayIndex}"]`
    );

    if(hallCell) hallCell.textContent = hallUniqueCount;
    if(kitchenCell) kitchenCell.textContent = kitchenUniqueCount;
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

async function loadPreviousWeekPattern() {
  const monday = document.getElementById("mondayInput").value;

  if (!monday) {
    alert("주간 시작일을 선택하세요.");
    return;
  }

  const ok = confirm("전주 근무 패턴을 불러올까요? 현재 입력한 내용은 덮어씌워집니다.");
  if (!ok) return;

  showLoading(true);

  try {
    // 1. 선택한 주간 기준 직원목록/D/O/헤더 먼저 갱신
    const optionUrl =
      `${API_URL}?action=getStaffOptions&monday=${encodeURIComponent(monday)}&t=${Date.now()}`;

    const optionRes = await fetch(optionUrl);
    const optionData = await optionRes.json();

    if (!optionData.ok) {
      throw new Error(optionData.message || "직원목록 조회 실패");
    }

    weeklyOptions = optionData.data || [];
    renderTable();

    // 2. 전주 패턴 불러오기
    const patternUrl =
      `${API_URL}?action=getPreviousWeekSchedule&monday=${encodeURIComponent(monday)}&t=${Date.now()}`;

    const patternRes = await fetch(patternUrl);
    const patternData = await patternRes.json();

    if (!patternData.ok) {
      throw new Error(patternData.message || "전주 패턴 조회 실패");
    }

    if (!patternData.data.found) {
      alert(patternData.data.message || "전주 근무표가 없습니다.");
      return;
    }

    applyWeeklyScheduleToTable(patternData.data.schedule);

    alert("전주 패턴을 불러왔습니다. 현재 주간 D/O 직원은 자동 제외되었습니다.");

  } catch (err) {
    console.error(err);
    alert("전주 패턴을 불러오지 못했습니다.");
  } finally {
    showLoading(false);
  }
}

async function loadCurrentWeeklySchedule(showMessage = true) {
  const monday = document.getElementById("mondayInput").value;

  if (!monday) {
    alert("주간 시작일을 선택하세요.");
    return;
  }

  showLoading(true);

  try {
    // 1. 선택한 주간 기준으로 직원목록과 D/O 먼저 다시 불러오기
    const optionUrl =
      `${API_URL}?action=getStaffOptions&monday=${encodeURIComponent(monday)}&t=${Date.now()}`;

    const optionRes = await fetch(optionUrl);
    const optionData = await optionRes.json();

    if (!optionData.ok) {
      throw new Error(optionData.message || "직원목록 조회 실패");
    }

    weeklyOptions = optionData.data || [];
    renderTable();

    // 2. 그 다음 선택한 주간의 기존 근무표 불러오기
    const scheduleUrl =
      `${API_URL}?action=getWeeklySchedule&monday=${encodeURIComponent(monday)}&t=${Date.now()}`;

    const scheduleRes = await fetch(scheduleUrl);
    const scheduleData = await scheduleRes.json();

    if (!scheduleData.ok) {
      throw new Error(scheduleData.message || "기존 근무표 조회 실패");
    }

    if (!scheduleData.data.found) {
  if (showMessage) {
    alert(scheduleData.data.message || "해당 주간 근무표가 없습니다.");
  }
  return;
}

    applyWeeklyScheduleToTable(scheduleData.data.schedule);

    if (showMessage) {
    alert("기존 근무표를 불러왔습니다.");
}

  } catch (err) {
    console.error(err);
    alert("기존 근무표를 불러오지 못했습니다.");
  } finally {
    showLoading(false);
  }
}

function applyWeeklyScheduleToTable(schedule) {
  Object.keys(schedule || {}).forEach(function(dayIndex) {
    const dayData = schedule[dayIndex] || {};

    ["hall", "kitchen", "prep", "exit", "wash"].forEach(function(role) {
      const items = dayData[role] || [];

      const nameSelects = Array.from(
        document.querySelectorAll(
          `.name-select[data-day-index="${dayIndex}"][data-role="${role}"]`
        )
      );

      const timeSelects = Array.from(
        document.querySelectorAll(
          `.time-select[data-day-index="${dayIndex}"][data-role="${role}"]`
        )
      );

      nameSelects.forEach(function(select, index) {
        const item = items[index] || {};
        setSelectValue_(select, item.name || "");
      });

      timeSelects.forEach(function(select, index) {
        const item = items[index] || {};
        setSelectValue_(select, item.time || "");
      });
    });
  });

  updateTotals();
}

function setSelectValue_(select, value) {
  if (!select) return;

  const exists = Array.from(select.options).some(function(opt) {
    return opt.value === value;
  });

  if (exists) {
    select.value = value;
  } else {
    select.value = "";
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
async function generateNextWeekSchedule() {

    if (!confirm("다음주 근무표를 자동 생성하시겠습니까?")) {
        return;
    }

    // 다음주로 이동
    const mondayInput = document.getElementById("mondayInput");

    const d = new Date(mondayInput.value);
    d.setDate(d.getDate() + 7);

    mondayInput.value = formatDateInput(d);

    // 직원목록 새로 불러오기
    await loadStaffOptions();

    // 전주 패턴 자동 복사
    await loadPreviousWeekPattern();

    alert("다음주 근무표가 생성되었습니다.\nD/O 직원은 자동 제외되었습니다.");
}
function toggleStaffManager() {
  document
    .getElementById("staffManager")
    .classList.toggle("hidden");

  loadWeeklyStaffList();
}
async function loadWeeklyStaffList(){

  const res = await fetch(API_URL+"?action=getWeeklyStaffList&t="+Date.now());
  const data = await res.json();

  console.log("직원관리 데이터:", data);

  renderWeeklyStaffList(data.data || []);

}
function renderWeeklyStaffList(data){

  const box = document.getElementById("weeklyStaffList");

  const roleLabels = {
    hall: "홀직원",
    kitchen: "주방직원",
    prep: "전처리",
    exit: "퇴식",
    wash: "설거지"
  };

  let html = "";

  Object.keys(roleLabels).forEach(role => {
    const names = data[role] || [];

    names.forEach(name => {
      html += `
        <div class="staff-card">
          <b>${name}</b><br>
          ${roleLabels[role]}

          <div class="staff-buttons">
            <button
              type="button"
              onclick="deleteWeeklyStaff('${name}','${role}')"
              class="danger">
              퇴사 처리
            </button>
          </div>
        </div>
      `;
    });
  });

  box.innerHTML = html || "등록된 직원이 없습니다.";
}
async function addWeeklyStaff(){

  const name=document.getElementById("newStaffName").value.trim();

  const role=document.getElementById("newStaffRole").value;

  if(!name){
    alert("직원명을 입력하세요.");
    return;
  }

  const res=await fetch(API_URL,{
    method:"POST",
    body:JSON.stringify({
      action:"addWeeklyStaff",
      name,
      role
    })
  });

  const data=await res.json();

  alert(data.message);

  document.getElementById("newStaffName").value="";

  loadWeeklyStaffList();
  loadStaffOptions();

}
async function deleteWeeklyStaff(name,role){

  if(!confirm(`${name} 직원을 퇴사 처리하시겠습니까?`))
    return;

  const res=await fetch(API_URL,{
    method:"POST",
    body:JSON.stringify({
      action:"deleteWeeklyStaff",
      name,
      role
    })
  });

  const data=await res.json();

  alert(data.message);

  loadWeeklyStaffList();
  loadStaffOptions();

}
async function deleteWeeklyStaffFromForm(){

  const name = document.getElementById("newStaffName").value.trim();
  const role = document.getElementById("newStaffRole").value;

  if(!name){
    alert("퇴사 처리할 직원명을 입력하세요.");
    return;
  }

  await deleteWeeklyStaff(name, role);
}