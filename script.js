const API_URL =
  "https://script.google.com/macros/s/AKfycbyxNHxdt7xwXXp1OKib0PHHNc9qS1vXOlzaUCVsUJgqMmdpIcvVQsa2vY0hQgoSE-ab9Q/exec";

function waitForApi_(milliseconds) {
  return new Promise(function(resolve) {
    setTimeout(resolve, milliseconds);
  });
}

async function fetchJsonWithRetry_(url, options = {}) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        cache:"no-store"
      });

      if (!response.ok) {
        throw new Error(
          `API 응답 오류: ${response.status}`
        );
      }

      const text = await response.text();
      return JSON.parse(text);

    } catch (error) {
      lastError = error;
      console.warn(
        `API 호출 ${attempt}차 실패`,
        error
      );

      if (attempt < 3) {
        await waitForApi_(attempt * 1000);
      }
    }
  }

  throw lastError;
}

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

function closeStaffManager(){
  const box = document.getElementById("staffManager");
  if(box){
    box.classList.add("hidden");
  }
}

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
  closeStaffManager();

  const monday = getMonday(new Date());
  document.getElementById("mondayInput").value = formatDateInput(monday);
  loadStaffOptions();
}

async function loadThisWeekSchedule() {
  closeStaffManager();

  const monday =
    getMonday(new Date());

  document.getElementById(
    "mondayInput"
  ).value =
    formatDateInput(monday);

  await loadCurrentWeeklySchedule(true);

  const tableCard =
    document.querySelector(
      ".table-card"
    );

  if (tableCard) {
    tableCard.scrollIntoView({
      behavior:"smooth",
      block:"start"
    });
  }
}

function setNextWeek(){
  closeStaffManager();

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
    const data =
  await fetchJsonWithRetry_(url);

    if(!data.ok){
      throw new Error(data.message || "직원목록 조회 실패");
    }

    weeklyOptions = data.data || [];
renderTable();

/*
 * 직원목록으로 표를 만들었으므로
 * 로딩 표시는 즉시 종료합니다.
 */
showLoading(false);

/*
 * 저장 근무표는 화면 뒤에서 조용히 조회합니다.
 */
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
  closeStaffManager();

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

async function loadPreviousWeekPattern(options = {}) {
  closeStaffManager();

  const monday =
    document.getElementById("mondayInput").value;

  if (!monday) {
    alert("주간 시작일을 선택하세요.");
    return false;
  }

  if (options.skipConfirm !== true) {
    const ok = confirm(
      "전주 근무표를 불러올까요?\n현재 입력한 내용은 전주 근무표로 변경됩니다."
    );

    if (!ok) return false;
  }

  showLoading(true);

  try {
    const optionUrl =
      `${API_URL}?action=getStaffOptions&monday=${encodeURIComponent(monday)}&t=${Date.now()}`;

    const optionData =
  await fetchJsonWithRetry_(optionUrl);

    if (!optionData.ok) {
      throw new Error(
        optionData.message || "직원목록 조회 실패"
      );
    }

    weeklyOptions = optionData.data || [];
    renderTable();

    const patternUrl =
      `${API_URL}?action=getPreviousWeekSchedule&monday=${encodeURIComponent(monday)}&t=${Date.now()}`;

    const patternData =
  await fetchJsonWithRetry_(patternUrl);

    if (!patternData.ok) {
      throw new Error(
        patternData.message || "전주 근무표 조회 실패"
      );
    }

    if (!patternData.data.found) {
      alert(
        patternData.data.message ||
        "복사할 전주 근무표가 없습니다."
      );

      return false;
    }

    applyWeeklyScheduleToTable(
      patternData.data.schedule
    );

    if (options.silent !== true) {
      alert(
        "전주 근무표를 불러왔습니다.\nD/O 직원은 자동 제외되었습니다."
      );
    }

    return true;

  } catch (err) {
    console.error(err);
    alert("전주 근무표를 불러오지 못했습니다.");
    return false;

  } finally {
    showLoading(false);
  }
}

async function loadCurrentWeeklySchedule(showMessage = true) {
  closeStaffManager();

  const monday = document.getElementById("mondayInput").value;

  if (!monday) {
    alert("주간 시작일을 선택하세요.");
    return;
  }

  if (showMessage) {
  showLoading(true);
}

  try {
    const optionUrl =
      `${API_URL}?action=getStaffOptions&monday=${encodeURIComponent(monday)}&t=${Date.now()}`;

    const optionData =
  await fetchJsonWithRetry_(optionUrl);

    if (!optionData.ok) {
      throw new Error(optionData.message || "직원목록 조회 실패");
    }

    weeklyOptions = optionData.data || [];
    renderTable();

    const scheduleUrl =
      `${API_URL}?action=getWeeklySchedule&monday=${encodeURIComponent(monday)}&t=${Date.now()}`;

    const scheduleData =
  await fetchJsonWithRetry_(scheduleUrl);

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

  if (showMessage) {
    alert("기존 근무표를 불러오지 못했습니다.");
  }
  } finally {
  if (showMessage) {
    showLoading(false);
  }
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

  select.value = exists ? value : "";
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
  closeStaffManager();

  const ok = confirm(
    "전주 근무표를 복사하여 다음주 근무표를 만들까요?"
  );

  if (!ok) return;

  /*
   * 현재 화면의 선택 날짜와 관계없이
   * 오늘을 기준으로 정확한 다음주 월요일을 선택합니다.
   */
  const nextMonday = getMonday(new Date());

  nextMonday.setDate(
    nextMonday.getDate() + 7
  );

  document.getElementById("mondayInput").value =
    formatDateInput(nextMonday);

  const loaded =
    await loadPreviousWeekPattern({
      skipConfirm:true,
      silent:true
    });

  if (!loaded) return;

  const tableCard =
    document.querySelector(".table-card");

  if (tableCard) {
    tableCard.scrollIntoView({
      behavior:"smooth",
      block:"start"
    });
  }

  alert(
    "다음주 근무표 초안을 만들었습니다.\n내용을 확인하고 수정한 후 ‘근무표 저장’을 눌러주세요."
  );
}

function toggleStaffManager() {
  const box = document.getElementById("staffManager");
  if(!box) return;

  box.classList.toggle("hidden");

  if(!box.classList.contains("hidden")){
    loadWeeklyStaffList();
  }
}

async function loadWeeklyStaffList(){
  const res = await fetch(API_URL+"?action=getWeeklyStaffList&t="+Date.now());
  const data = await res.json();

  renderWeeklyStaffList(data.data || {});
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
          <b>${escapeHtml(name)}</b><br>
          ${roleLabels[role]}

          <div class="staff-buttons">
            <button
              type="button"
              onclick="deleteWeeklyStaff('${escapeHtml(name)}','${role}')"
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
  const name = document.getElementById("newStaffName").value.trim();
  const role = document.getElementById("newStaffRole").value;

  if(!name){
    alert("직원명을 입력하세요.");
    return;
  }

  const res = await fetch(API_URL,{
    method:"POST",
    body:JSON.stringify({
      action:"addWeeklyStaff",
      name,
      role
    })
  });

  const data = await res.json();

  alert(data.message || "직원이 등록되었습니다.");

  document.getElementById("newStaffName").value = "";

  await loadWeeklyStaffList();
  await loadStaffOptions();
}

async function deleteWeeklyStaff(name, role){
  if(!confirm(`${name} 직원을 퇴사 처리하시겠습니까?`)){
    return;
  }

  const res = await fetch(API_URL,{
    method:"POST",
    body:JSON.stringify({
      action:"deleteWeeklyStaff",
      name,
      role
    })
  });

  const data = await res.json();

  alert(data.message || "퇴사 처리되었습니다.");

  await loadWeeklyStaffList();
  await loadStaffOptions();
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
// ===========================
// 알림 셀 노란색 표시
// 클릭하면 ON / OFF
// ===========================
document.addEventListener("click", function(e){
  const td = e.target.closest("td");

  if(!td) return;

  if(
    td.querySelector(".name-select") ||
    td.querySelector(".time-select")
  ){
    td.classList.toggle("alert-cell");
  }
});
/* ==========================================================
   주간 근무표 이미지 복사
========================================================== */

async function copyScheduleImage(){
  const tableCard =
    document.querySelector(".table-card");

  const tableScroll =
    document.querySelector(".table-scroll");

  const scheduleTable =
    document.getElementById("scheduleTable");

  const copyButton =
    document.getElementById("copyImageButton");

  if(!tableCard || !tableScroll || !scheduleTable){
    alert("복사할 주간 근무표를 찾을 수 없습니다.");
    return;
  }

  if(typeof html2canvas !== "function"){
    alert(
      "이미지 기능을 불러오지 못했습니다.\n" +
      "페이지를 새로고침한 후 다시 시도하세요."
    );
    return;
  }

  const originalButtonText =
    copyButton ? copyButton.innerHTML : "";

  try{
    if(copyButton){
      copyButton.disabled = true;
      copyButton.innerHTML =
        "이미지 만드는 중...";
    }

    tableCard.classList.add(
      "image-capture-mode"
    );

    /*
     * 현재 화면에서 좌우로 가려진 부분까지
     * 표 전체 너비를 이미지에 포함합니다.
     */
    const captureWidth =
      Math.max(
        scheduleTable.scrollWidth + 32,
        1400
      );

    const canvas =
      await html2canvas(
        tableCard,
        {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
          width: captureWidth,
          windowWidth: captureWidth,
          scrollX: 0,
          scrollY: 0,

          onclone: function(clonedDocument){
            const clonedCard =
              clonedDocument.querySelector(
                ".table-card"
              );

            const clonedScroll =
              clonedDocument.querySelector(
                ".table-scroll"
              );

            const clonedTable =
              clonedDocument.getElementById(
                "scheduleTable"
              );

            if(clonedCard){
              clonedCard.style.width =
                captureWidth + "px";

              clonedCard.style.maxWidth =
                "none";

              clonedCard.style.overflow =
                "visible";
            }

            if(clonedScroll){
              clonedScroll.style.width =
                "100%";

              clonedScroll.style.maxHeight =
                "none";

              clonedScroll.style.overflow =
                "visible";
            }

            if(clonedTable){
  clonedTable.style.width =
    "100%";

  clonedTable.style.minWidth =
    "0";

  clonedTable.style.tableLayout =
    "fixed";

  /*
   * 이미지에서 select 선택상자를 일반 글자로 변경해
   * 시간의 끝부분까지 모두 표시합니다.
   */
  clonedTable
    .querySelectorAll("select")
    .forEach(function(select){
      const selectedOption =
        select.options[
          select.selectedIndex
        ];

      const value =
        selectedOption
          ? selectedOption.textContent
          : select.value;

      const text =
        clonedDocument.createElement("span");

      text.className =
        "capture-select-text";

      text.textContent =
        value || "";

      select.replaceWith(text);
    });
}
          }
        }
      );

    const blob =
      await new Promise(function(resolve){
        canvas.toBlob(
          resolve,
          "image/png"
        );
      });

    if(!blob){
      throw new Error(
        "이미지를 만들지 못했습니다."
      );
    }

    if(
      navigator.clipboard &&
      typeof ClipboardItem !== "undefined"
    ){
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob
        })
      ]);

      alert(
        "주간 근무표 이미지가 복사되었습니다.\n\n" +
        "카카오톡 대화창에서 Ctrl+V를 누르세요."
      );

    }else{
      downloadScheduleImage(blob);

      alert(
        "이 브라우저에서는 이미지 직접 복사를 지원하지 않아\n" +
        "PNG 이미지 파일로 저장했습니다."
      );
    }

  }catch(err){
    console.error(err);

    alert(
      "브라우저가 이미지 복사를 차단했습니다.\n" +
      "이미지 파일로 저장하겠습니다."
    );

    try{
      const fallbackCanvas =
        await html2canvas(
          tableCard,
          {
            backgroundColor:"#ffffff",
            scale:2,
            useCORS:true,
            logging:false
          }
        );

      fallbackCanvas.toBlob(
        function(blob){
          if(blob){
            downloadScheduleImage(blob);
          }
        },
        "image/png"
      );

    }catch(downloadError){
      console.error(downloadError);

      alert(
        "이미지 생성에 실패했습니다.\n" +
        "페이지를 새로고침한 후 다시 시도하세요."
      );
    }

  }finally{
    tableCard.classList.remove(
      "image-capture-mode"
    );

    if(copyButton){
      copyButton.disabled = false;
      copyButton.innerHTML =
        originalButtonText;
    }
  }
}


function downloadScheduleImage(blob){
  const monday =
    document.getElementById("mondayInput").value ||
    "주간근무표";

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download =
    `한국의집_주간근무표_${monday}.png`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(function(){
    URL.revokeObjectURL(url);
  }, 1000);
}

let simulationConditions = [];

function toggleSimulationPanel() {

  const panel =
    document.getElementById("simulationPanel");

  if (!panel) return;

  panel.classList.toggle("hidden");

  if (!panel.classList.contains("hidden")) {
    loadSimulationData();
  }

}

async function loadSimulationData() {

  if (!staffOptions.length) {
    await loadStaffOptions();
  }

  const map = {};

  [
    "hall",
    "kitchen",
    "prep",
    "exit",
    "wash"
  ].forEach(role => {

    staffOptions[0][role].forEach(name => {

      if (!name) return;

      if (!map[name]) {

        map[name] = {

          name,

          status: "근무가능",

          targetDays: 5,

          maxDays: 7,

          defaultTime: "",

          days: [
            true,
            true,
            true,
            true,
            true,
            true,
            true
          ],

          memo: ""

        };

      }

    });

  });

  simulationConditions =
    Object.values(map)
      .sort((a, b) =>
        a.name.localeCompare(
          b.name,
          "ko"
        )
      );

  renderSimulationStaffTable();

}

function renderSimulationStaffTable() {

  const tbody =
    document.getElementById(
      "simulationStaffBody"
    );

  if (!tbody) return;

  tbody.innerHTML = "";

  simulationConditions.forEach((staff, index) => {

    const tr =
      document.createElement("tr");

    tr.innerHTML = `

<td class="simulation-name-column">

${staff.name}

</td>

<td>

<select onchange="simulationConditions[${index}].status=this.value">

<option ${staff.status==="근무가능"?"selected":""}>근무가능</option>

<option ${staff.status==="근무불가"?"selected":""}>근무불가</option>

<option ${staff.status==="퇴직"?"selected":""}>퇴직</option>

</select>

</td>

<td>

<select onchange="simulationConditions[${index}].targetDays=Number(this.value)">

${makeDayOptions_(staff.targetDays)}

</select>

</td>

<td>

<select onchange="simulationConditions[${index}].maxDays=Number(this.value)">

${makeDayOptions_(staff.maxDays)}

</select>

</td>

<td>

<input
type="text"
value="${staff.defaultTime}"
oninput="simulationConditions[${index}].defaultTime=this.value">

</td>

${staff.days.map((v,d)=>`

<td>

<input
type="checkbox"

${v?"checked":""}

onchange="
simulationConditions[${index}].days[${d}]=this.checked;
">

</td>

`).join("")}

<td>

<input
type="text"
value="${staff.memo}"
oninput="
simulationConditions[${index}].memo=this.value;
">

</td>

`;

    tbody.appendChild(tr);

  });

}

function makeDayOptions_(selected) {

  let html = "";

  for (let i = 1; i <= 7; i++) {

    html +=

`<option value="${i}"

${selected===i?"selected":""}

>

${i}일

</option>`;

  }

  return html;

}

function setAllSimulationDaysAvailable(){

  simulationConditions.forEach(staff=>{

    staff.days=[
      true,
      true,
      true,
      true,
      true,
      true,
      true
    ];

  });

  renderSimulationStaffTable();

}