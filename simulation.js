/*
=========================================================
한국의집 홀 인력 시뮬레이션
simulation.js
Version 1.0
=========================================================

기능
- 선택한 월요일 기준으로 직원 조건을 별도 저장
- 목표/최대 근무일수 1~7일
- 주 7일 근무 허용
- 40시간/50시간 기준으로 자동 제외하지 않음
- D/O, 근무불가, 퇴직, 가능요일, 가능 포지션 반영
- 우선순위와 목표 근무일수를 반영한 홀 자동배치
- 관리자가 기존 근무표에서 직접 수정 가능
- 조건 재검사 및 부족 인원 표시
- 브라우저 localStorage에 주차별 임시 저장

주의
- 기존 script.js 뒤에 불러오세요.
  <script src="script.js?v=4"></script>
  <script src="simulation.js?v=1"></script>
*/

(() => {
  "use strict";

  const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"];
  const STORAGE_PREFIX = "KOREAHOUSE_HALL_SIMULATION_V2_";

  const HALL_ROWS = [
    { key: "총괄", label: "총괄" },
    { key: "티카(M1)", label: "티카(M1)" },
    { key: "티카(S1)", label: "티카(S1)" },
    { key: "티카(M2)", label: "티카(M2)" },
    { key: "티카(S2)", label: "티카(S2)" },
    { key: "티카(H)", label: "티카(H)" },
    { key: "serving", label: "serving" },
    { key: "serving", label: "serving" },
    { key: "serving", label: "serving" },
    { key: "serving", label: "serving" },
    { key: "serving", label: "serving" },
    { key: "serving", label: "serving" },
    { key: "serving", label: "serving" }
  ];

  const POSITION_KEYS = [
  "총괄",
  "티카(M)",
  "티카(S)",
  "serving"
];

function getPositionGroup(slotPosition) {

  if (slotPosition === "총괄") {
    return "총괄";
  }

  if (
    slotPosition === "티카(M1)" ||
    slotPosition === "티카(M2)"
  ) {
    return "티카(M)";
  }

  if (
    slotPosition === "티카(S1)" ||
    slotPosition === "티카(S2)"
  ) {
    return "티카(S)";
  }

  if (slotPosition === "serving") {
    return "serving";
  }

  return "";
}

  let state = {
  monday: "",
  requiredStaff: [8, 8, 8, 8, 8, 8, 8],
  employees: [],
  timeOptions: [],
  generated: null,
  loaded: false
};

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getMondayValue() {
    const input = document.getElementById("mondayInput");
    if (input && input.value) return input.value;

    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    now.setDate(now.getDate() + diff);

    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
  }

  function parseLocalDate(dateText) {
    const [year, month, day] = String(dateText).split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  function addDays(dateText, days) {
    const date = parseLocalDate(dateText);
    date.setDate(date.getDate() + days);

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function formatShortDate(dateText) {
    const date = parseLocalDate(dateText);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function storageKey() {
    return STORAGE_PREFIX + state.monday;
  }

  function defaultEmployee(name) {

  return {
    name: name,
    status: "근무가능",
    priority: 50,

    /*
     * 목표일수가 자동배치 최대일수 역할도 합니다.
     * 1일부터 7일까지 선택할 수 있습니다.
     */
    targetDays: 5,

    defaultTime: "",

    availableDays: [
      true,
      true,
      true,
      true,
      true,
      true,
      true
    ],

    positions: {
      "총괄": true,
      "티카(M)": true,
      "티카(S)": true,
      "serving": true
    },

    memo: ""
  };

}

  function normalizeEmployee(raw) {

  const base =
    defaultEmployee(
      String(raw?.name || "").trim()
    );

  const oldPositions =
    raw?.positions || {};

  return {
    ...base,
    ...raw,

    priority:
      clampNumber(
        raw?.priority,
        1,
        100,
        50
      ),

    targetDays:
      clampNumber(
        raw?.targetDays,
        1,
        7,
        5
      ),

    availableDays:
      Array.from(
        { length: 7 },
        function(_, index) {

          return (
            raw?.availableDays?.[index] !== false
          );

        }
      ),

    /*
     * 기존에 저장된 M1/M2/S1/S2/H 자료도
     * 새 포지션 구조로 자동 변환합니다.
     */
    positions: {

      "총괄":
        oldPositions["총괄"] !== false,

      "티카(M)":
        oldPositions["티카(M)"] !== undefined
          ? oldPositions["티카(M)"]
          : (
              oldPositions["티카(M1)"] !== false ||
              oldPositions["티카(M2)"] !== false ||
              oldPositions["티카(H)"] !== false
            ),

      "티카(S)":
        oldPositions["티카(S)"] !== undefined
          ? oldPositions["티카(S)"]
          : (
              oldPositions["티카(S1)"] !== false ||
              oldPositions["티카(S2)"] !== false ||
              oldPositions["티카(H)"] !== false
            ),

      "serving":
        oldPositions["serving"] !== false
    }
  };

}

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function getExistingLocalData() {
    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.warn("시뮬레이션 저장자료 읽기 실패", error);
      return null;
    }
  }

  function saveLocalData(showMessage = true) {

  collectUiState();

  const payload = {
    monday: state.monday,
    requiredStaff: state.requiredStaff,
    employees: state.employees,
    generated: state.generated,
    savedAt: new Date().toISOString()
  };

  localStorage.setItem(
    storageKey(),
    JSON.stringify(payload)
  );

  if (showMessage) {

    setSummary(
      "success",
      "✅ 조건이 저장되었습니다."
    );

  }

}

  function getGlobalStaffDays() {
    try {
      if (typeof staffOptions !== "undefined" && Array.isArray(staffOptions)) {
        return staffOptions;
      }
    } catch (_) {
      // 전역 변수 접근 실패 시 API 직접 호출
    }
    return [];
  }

  async function fetchStaffDays() {
    let days = getGlobalStaffDays();
    if (days.length) return days;

    try {
      if (typeof loadStaffOptions === "function") {
        await loadStaffOptions();
        days = getGlobalStaffDays();
        if (days.length) return days;
      }
    } catch (error) {
      console.warn("기존 직원목록 함수 실행 실패", error);
    }

    try {
      if (typeof API_URL === "undefined") return [];

      const url =
        `${API_URL}?action=getStaffOptions&monday=${encodeURIComponent(state.monday)}`;

      const response = await fetch(url);
      const result = await response.json();

      if (!result?.ok || !Array.isArray(result.data)) return [];
      return result.data;
    } catch (error) {
      console.error("직원목록 API 호출 실패", error);
      return [];
    }
  }

  function extractHallNames(days) {
    const names = new Set();

    days.forEach(day => {
      (day?.hall || []).forEach(name => {
        const text = String(name || "").trim();
        if (text) names.add(text);
      });

      (day?.dayOffNames || []).forEach(name => {
        const text = String(name || "").trim();
        if (text) names.add(text);
      });
    });

    return [...names].sort((a, b) => a.localeCompare(b, "ko"));
  }

  function extractTimeOptions(days) {

  const result =
    new Set();

  days.forEach(function(day) {

    const list =
      day?.time || [];

    list.forEach(function(time) {

      const text =
        String(time || "").trim();

      if (text) {
        result.add(text);
      }

    });

  });

  return Array.from(result);

}

  function ensureStyles() {
    if (document.getElementById("simulationRuntimeStyles")) return;

    const style = document.createElement("style");
    style.id = "simulationRuntimeStyles";
    style.textContent = `
      .simulation-panel{
        margin:18px 12px;
        padding:22px;
        border:1px solid #e3d4bf;
        border-radius:22px;
        background:#fffaf3;
        box-shadow:0 10px 30px rgba(65,38,18,.06);
      }
      .simulation-panel.hidden{display:none!important}
      .simulation-panel-head,.simulation-block-head,.simulation-actions{
        display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap
      }
      .simulation-week-selector{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:14px;
  flex-wrap:wrap;
  margin-top:16px;
  padding:14px 16px;
  border:1px solid #eadcca;
  border-radius:15px;
  background:#ffffff;
}

.simulation-week-field{
  display:flex;
  flex-direction:column;
  gap:7px;
  min-width:220px;
}

.simulation-week-field label{
  font-weight:900;
  color:#4a2e1a;
}

.simulation-week-field input{
  min-height:42px;
  padding:9px 12px;
  border:1px solid #d9c6af;
  border-radius:10px;
  background:#ffffff;
  font:inherit;
  font-weight:800;
}

.simulation-week-actions{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}  
      .simulation-kicker{margin:0 0 6px;color:#8a5a2b;font-size:12px;font-weight:900;letter-spacing:.12em}
      .simulation-panel h2,.simulation-panel h3{margin:0}
      .simulation-description{margin:8px 0 0;color:#6f6257}
      .simulation-block{
        margin-top:18px;padding:17px;border:1px solid #eadcca;border-radius:17px;background:#fff
      }
      .required-staff-grid{
        display:grid;grid-template-columns:repeat(7,minmax(100px,1fr));gap:10px;margin-top:14px
      }
      .required-day-card{
        display:flex;flex-direction:column;gap:7px;padding:12px;border:1px solid #eadcca;
        border-radius:13px;background:#fffaf4;text-align:center;font-weight:800
      }
      .required-day-card input{width:100%;padding:9px;border:1px solid #d8c3a9;border-radius:9px;text-align:center;font-weight:800}
      .simulation-table-scroll{overflow:auto;margin-top:14px;border:1px solid #e5d8c8;border-radius:13px}
      .simulation-staff-table{width:100%;min-width:1250px;border-collapse:collapse;background:#fff}
      .simulation-staff-table th,.simulation-staff-table td{
        padding:8px;border:1px solid #eadfD2;text-align:center;vertical-align:middle
      }
      .simulation-staff-table th{position:sticky;top:0;z-index:2;background:#f0dfc8}
      .simulation-staff-table .simulation-name-column{position:sticky;left:0;z-index:3;background:#fff7ec;min-width:100px;font-weight:900}
      .simulation-staff-table th.simulation-name-column{z-index:4;background:#ead3b4}
      .simulation-staff-table select,.simulation-staff-table input[type="text"],.simulation-staff-table input[type="number"]{
        width:100%;min-width:65px;padding:7px;border:1px solid #d9c6af;border-radius:8px;background:#fff
      }
      .simulation-position-box{display:grid;grid-template-columns:repeat(2,minmax(90px,1fr));gap:5px;text-align:left;min-width:230px}
      .simulation-position-box label,.simulation-day-check{display:flex;align-items:center;gap:4px;white-space:nowrap}
      .simulation-actions{margin-top:18px;justify-content:flex-end}
      .simulation-panel button{
        border:0;border-radius:11px;padding:10px 14px;background:#efe1cf;color:#392516;font-weight:900;cursor:pointer
      }
      .simulation-panel button.primary{background:#7b461f;color:#fff}
      .simulation-panel button.success{background:#1d743b;color:#fff}
      .simulation-result-summary{margin-top:16px;padding:14px;border-radius:13px;line-height:1.6}
      .simulation-result-summary.success{background:#e9f6ec;color:#175c2d}
      .simulation-result-summary.warning{background:#fff3d8;color:#785109}
      .simulation-result-summary.error{background:#fde9e6;color:#8f271b}
      .simulation-result-summary.info{background:#edf3fa;color:#244d75}
      .simulation-result-summary.hidden{display:none!important}
      .simulation-workday-summary{
  margin-top:16px;
  padding:16px;
  border:1px solid #eadcca;
  border-radius:14px;
  background:#ffffff;
}

.simulation-workday-summary.hidden{
  display:none !important;
}

.simulation-workday-summary h3{
  margin:0 0 12px;
}

.simulation-workday-table{
  width:100%;
  border-collapse:collapse;
}

.simulation-workday-table th,
.simulation-workday-table td{
  padding:9px 10px;
  border:1px solid #eadfd2;
  text-align:center;
}

.simulation-workday-table th{
  background:#f0dfc8;
  font-weight:900;
}

.simulation-workday-table td:first-child{
  font-weight:900;
}

.simulation-workday-short{
  background:#fff3d8;
  color:#785109;
}

.simulation-workday-complete{
  background:#e9f6ec;
  color:#175c2d;
}
      .simulation-help{font-size:13px;color:#75685d;margin-top:6px}
      @media(max-width:900px){
        .required-staff-grid{grid-template-columns:repeat(2,minmax(110px,1fr))}
        .simulation-panel{margin:12px 6px;padding:14px}
      }
    `;
    document.head.appendChild(style);
    
  }

  function ensureLayout() {
    const panel = document.getElementById("simulationPanel");
    if (!panel) {
      throw new Error("index.html에서 simulationPanel을 찾을 수 없습니다.");
    }

    panel.innerHTML = `
      <div class="simulation-panel-head">
        <div>
          <p class="simulation-kicker">HALL STAFF SIMULATION</p>
          <h2>홀 인력 시뮬레이션</h2>
          <p id="simulationWeekText" class="simulation-description"></p>
        </div>
        <button type="button" data-sim-action="close">닫기</button>
      </div>

      <div class="simulation-week-selector">

  <div class="simulation-week-field">

    <label for="simulationMondayInput">
      주간 선택
    </label>

    <input
      type="date"
      id="simulationMondayInput">

  </div>

  <div class="simulation-week-actions">

    <button
      type="button"
      data-sim-action="prev-week">
      ◀ 이전주
    </button>

    <button
      type="button"
      data-sim-action="this-week">
      이번주
    </button>

    <button
      type="button"
      data-sim-action="next-week">
      다음주 ▶
    </button>

  </div>

</div>

      <div class="simulation-block">
        <div class="simulation-block-head">
          <div>
            <h3>날짜별 필요 홀 인원</h3>
            <div class="simulation-help">
              현재 홀 근무표에는 하루 최대 ${HALL_ROWS.length}개 자리가 있습니다.
            </div>
          </div>
        </div>
        <div id="requiredStaffGrid" class="required-staff-grid"></div>
      </div>

      <div class="simulation-block">
        <div class="simulation-block-head">
          <div>
            <h3>직원별 주간 근무조건</h3>
            <div class="simulation-help">
              목표일수는 1일부터 7일까지 설정하며, 40시간·50시간 기준으로 자동 제외하지 않습니다.
            </div>
          </div>
          <button type="button" data-sim-action="all-days">전체 요일 가능</button>
        </div>

        <div class="simulation-table-scroll">
          <table class="simulation-staff-table">
            <thead>

  <tr>

    <th
      class="simulation-name-column"
      rowspan="2">
      직원명
    </th>

    <th rowspan="2">
      상태
    </th>

    <th rowspan="2">
      우선순위
    </th>

    <th rowspan="2">
      목표일수
    </th>

    <th rowspan="2">
      기본시간
    </th>

    <th colspan="7">
      근무가능 요일
    </th>

    <th rowspan="2">
      가능 포지션
    </th>

    
  </tr>

  <tr>

    <th>월</th>
    <th>화</th>
    <th>수</th>
    <th>목</th>
    <th>금</th>
    <th>토</th>
    <th>일</th>

  </tr>

</thead>
            <tbody id="simulationStaffBody"></tbody>
          </table>
        </div>
      </div>

      <div class="simulation-actions">
        <button type="button" data-sim-action="reload">직원 다시 불러오기</button>
        <button type="button" data-sim-action="save">조건 저장</button>
        <button type="button" class="primary" data-sim-action="generate">예상 근무표 생성</button>
        <button type="button" data-sim-action="validate">조건 다시 검사</button>
        <button type="button" class="success" data-sim-action="apply">실제 근무표에 적용</button>
      </div>

      <div id="simulationResultSummary" class="simulation-result-summary hidden"></div>
      <div id="simulationWorkdaySummary" class="simulation-workday-summary hidden"></div>
    `;

    bindPanelEvents(panel);
  }

  function bindPanelEvents(panel) {
    panel.addEventListener("click", async event => {
      const button = event.target.closest("[data-sim-action]");
      if (!button) return;

      const action = button.dataset.simAction;

      try {
        if (action === "close") {

  panel.classList.add("hidden");

} else if (action === "prev-week") {

  await changeSimulationWeek(
    addDays(state.monday, -7)
  );

} else if (action === "this-week") {

  await changeSimulationWeek(
    getThisMondayText()
  );

} else if (action === "next-week") {

  await changeSimulationWeek(
    addDays(state.monday, 7)
  );

} else if (action === "all-days") {
          state.employees.forEach(employee => {
            employee.availableDays = [true, true, true, true, true, true, true];
          });
          renderEmployees();
        } else if (action === "reload") {
          await reloadEmployees();
        } else if (action === "save") {
          saveLocalData(true);
        } else if (action === "generate") {
          collectUiState();
          state.generated = generateSchedule();
          applyGeneratedToExistingTable(state.generated);
          saveLocalData(false);
          validateCurrentTable();
        } else if (action === "validate") {
          collectUiState();
          validateCurrentTable();
        } else if (action === "apply") {
          collectUiState();
          if (!state.generated) state.generated = generateSchedule();
          applyGeneratedToExistingTable(state.generated);
          saveLocalData(false);
          validateCurrentTable();
          setSummary("success", "예상 근무표를 현재 홀 근무표에 적용했습니다. 확인 후 기존 저장 버튼을 누르세요.");
        }
      } catch (error) {
        console.error(error);
        setSummary("error", error.message || "처리 중 오류가 발생했습니다.");
      }
    });

    const simulationMondayInput =
  panel.querySelector(
    "#simulationMondayInput"
  );

if (simulationMondayInput) {

  simulationMondayInput.addEventListener(
    "change",
    async function() {

      if (!simulationMondayInput.value) {
        return;
      }

      await changeSimulationWeek(
        simulationMondayInput.value
      );

    }
  );

}

    panel.addEventListener("input", event => {
      const target = event.target;
      const type = target.dataset.simType;
      if (!type) return;

      if (type === "required") {
        const day = Number(target.dataset.day);
        state.requiredStaff[day] = clampNumber(target.value, 0, 99, 0);
      }
    });

    panel.addEventListener("change", event => {
      const target = event.target;
      const index = Number(target.dataset.employeeIndex);
      if (!Number.isInteger(index) || !state.employees[index]) return;

      const employee = state.employees[index];
      const field = target.dataset.field;

      if (field === "status") employee.status = target.value;
      if (field === "priority") employee.priority = clampNumber(target.value, 1, 100, 50);
      if (field === "targetDays") {

  employee.targetDays =
    clampNumber(
      target.value,
      1,
      7,
      5
    );

}
      if (field === "defaultTime") employee.defaultTime = target.value;
      if (field === "memo") employee.memo = target.value;

      if (field === "availableDay") {
        employee.availableDays[Number(target.dataset.day)] = target.checked;
      }

      if (field === "position") {
        employee.positions[target.dataset.position] = target.checked;
      }

      saveLocalData(false);
    });
  }

  function renderWeekText() {

  const element =
    document.getElementById(
      "simulationWeekText"
    );

  const input =
    document.getElementById(
      "simulationMondayInput"
    );

  if (input) {
    input.value = state.monday;
  }

  if (!element) return;

  const sunday =
    addDays(state.monday, 6);

  element.textContent =
    `${formatShortDate(state.monday)}~${formatShortDate(sunday)} 주간 조건을 기준으로 예상 근무표를 생성합니다.`;

}

function getThisMondayText() {

  const today =
    new Date();

  const day =
    today.getDay();

  const diff =
    day === 0
      ? -6
      : 1 - day;

  today.setDate(
    today.getDate() + diff
  );

  return [
    today.getFullYear(),
    String(
      today.getMonth() + 1
    ).padStart(2, "0"),
    String(
      today.getDate()
    ).padStart(2, "0")
  ].join("-");

}

async function changeSimulationWeek(
  nextMonday
) {

  if (!nextMonday) return;

  /*
   * 현재 작성한 조건을 현재 주차에
   * 임시 저장합니다.
   */
  collectUiState();

  if (state.monday) {
    saveLocalData(false);
  }

  /*
   * 메인 근무표 날짜와
   * 시뮬레이션 날짜를 동기화합니다.
   */
  const mainMondayInput =
    document.getElementById(
      "mondayInput"
    );

  if (mainMondayInput) {

    mainMondayInput.value =
      nextMonday;

    mainMondayInput.dispatchEvent(
      new Event(
        "change",
        {
          bubbles: true
        }
      )
    );

  }

  state.loaded = false;
  state.monday = nextMonday;

  /*
   * 선택한 주차의 직원·D/O·저장 조건을
   * 다시 불러옵니다.
   */
  await initializeSimulation();

  const panel =
    document.getElementById(
      "simulationPanel"
    );

  if (panel) {
    panel.classList.remove(
      "hidden"
    );
  }

}

  function renderRequiredStaff() {
    const grid = document.getElementById("requiredStaffGrid");
    if (!grid) return;

    grid.innerHTML = DAY_NAMES.map((day, index) => {
      const date = addDays(state.monday, index);
      return `
        <label class="required-day-card">
          <span>${day} ${formatShortDate(date)}</span>
          <input
            type="number"
            min="0"
            max="99"
            value="${state.requiredStaff[index]}"
            data-sim-type="required"
            data-day="${index}"
          >
          <small>명</small>
        </label>
      `;
    }).join("");
  }

  function makeDayOptions(selected) {
    return Array.from({ length: 7 }, (_, index) => {
      const day = index + 1;
      return `<option value="${day}" ${day === selected ? "selected" : ""}>${day}일</option>`;
    }).join("");
  }

  function makeTimeOptions(selectedTime) {

  const selected =
    String(selectedTime || "").trim();

  const options =
    [...state.timeOptions];

  /*
   * 과거 저장값이 현재 구글시트 목록에 없어도
   * 기존 선택값은 유지합니다.
   */
  if (
    selected &&
    !options.includes(selected)
  ) {
    options.unshift(selected);
  }

  let html =
    `<option value="">시간 선택</option>`;

  options.forEach(function(time) {

    html += `
      <option
        value="${escapeHtml(time)}"
        ${time === selected ? "selected" : ""}>
        ${escapeHtml(time)}
      </option>
    `;

  });

  return html;

}

  function renderEmployees() {

  const tbody =
    document.getElementById(
      "simulationStaffBody"
    );

  if (!tbody) return;

  if (!state.employees.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="14">
          홀 직원목록을 불러오지 못했습니다.
          직원목록 새로고침 후 다시 시도하세요.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    state.employees
      .map(function(employee, index) {

        return `

<tr>

  <td class="simulation-name-column">
    ${escapeHtml(employee.name)}
  </td>

  <td>

    <select
      data-employee-index="${index}"
      data-field="status">

      <option
        value="근무가능"
        ${employee.status === "근무가능" ? "selected" : ""}>
        근무가능
      </option>

      <option
        value="근무불가"
        ${employee.status === "근무불가" ? "selected" : ""}>
        근무불가
      </option>

      <option
        value="퇴직"
        ${employee.status === "퇴직" ? "selected" : ""}>
        퇴직
      </option>

    </select>

  </td>

  <td>

    <input
      type="number"
      min="1"
      max="100"
      value="${employee.priority}"
      data-employee-index="${index}"
      data-field="priority">

  </td>

  <td>

    <select
      data-employee-index="${index}"
      data-field="targetDays">

      ${makeDayOptions(employee.targetDays)}

    </select>

  </td>

  <td>

    <select
      data-employee-index="${index}"
      data-field="defaultTime">

      ${makeTimeOptions(employee.defaultTime)}

    </select>

  </td>

  ${employee.availableDays
    .map(function(checked, dayIndex) {

      return `

<td>

  <label class="simulation-day-check">

    <input
      type="checkbox"
      ${checked ? "checked" : ""}
      data-employee-index="${index}"
      data-field="availableDay"
      data-day="${dayIndex}">

  </label>

</td>

`;

    })
    .join("")}

  <td>

    <div class="simulation-position-box">

      ${POSITION_KEYS
        .map(function(position) {

          const displayName =
            position === "serving"
              ? "Serving"
              : position;

          return `

<label>

  <input
    type="checkbox"
    ${employee.positions[position] ? "checked" : ""}
    data-employee-index="${index}"
    data-field="position"
    data-position="${escapeHtml(position)}">

  ${escapeHtml(displayName)}

</label>

`;

        })
        .join("")}

    </div>

  </td>

  
</tr>

`;

      })
      .join("");

}

  function collectUiState() {
    const panel = document.getElementById("simulationPanel");
    if (!panel) return;

    panel.querySelectorAll('[data-sim-type="required"]').forEach(input => {
      const day = Number(input.dataset.day);
      state.requiredStaff[day] = clampNumber(input.value, 0, 99, 0);
    });

    state.employees.forEach((employee, index) => {
      const field = name =>
        panel.querySelector(`[data-employee-index="${index}"][data-field="${name}"]`);

      const status = field("status");
      const priority = field("priority");
      const targetDays =
  field("targetDays");

const defaultTime =
  field("defaultTime");
      
      if (status) employee.status = status.value;
      if (priority) employee.priority = clampNumber(priority.value, 1, 100, 50);
      if (targetDays) employee.targetDays = clampNumber(targetDays.value, 1, 7, 5);
      
      if (defaultTime) employee.defaultTime = defaultTime.value.trim();
     

      employee.availableDays = Array.from({ length: 7 }, (_, day) => {
        const checkbox = panel.querySelector(
          `[data-employee-index="${index}"][data-field="availableDay"][data-day="${day}"]`
        );
        return checkbox ? checkbox.checked : true;
      });

      employee.positions = Object.fromEntries(
        POSITION_KEYS.map(position => {
          const checkbox = [...panel.querySelectorAll(
            `[data-employee-index="${index}"][data-field="position"]`
          )].find(item => item.dataset.position === position);

          return [position, checkbox ? checkbox.checked : true];
        })
      );

      
    });
  }

  function getDayOffNames(dayIndex) {
    const days = getGlobalStaffDays();
    const day = days[dayIndex];
    return new Set((day?.dayOffNames || []).map(name => String(name).trim()));
  }

  function generateSchedule() {
    const assignments = Array.from({ length: 7 }, () => []);
    const assignedDays = Object.fromEntries(
      state.employees.map(employee => [employee.name, 0])
    );

    const warnings = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const required = Math.max(0, state.requiredStaff[dayIndex]);
      const slots = HALL_ROWS.slice(0, Math.min(required, HALL_ROWS.length));
      const usedToday = new Set();
      const dayOffNames = getDayOffNames(dayIndex);

      slots.forEach((slot, rowIndex) => {
        const candidates = state.employees
          .filter(employee =>
            employee.status === "근무가능" &&
            employee.availableDays[dayIndex] &&
            !dayOffNames.has(employee.name) &&
            (
  slot.key === "티카(H)"
    ? (
        employee.positions["티카(M)"] ||
        employee.positions["티카(S)"]
      )
    : employee.positions[
        getPositionGroup(slot.key)
      ]
) &&
            !usedToday.has(employee.name) &&
            assignedDays[employee.name] < employee.targetDays
          )
          .sort((a, b) => {
            const aBelowTarget = assignedDays[a.name] < a.targetDays ? 1 : 0;
            const bBelowTarget = assignedDays[b.name] < b.targetDays ? 1 : 0;

            if (aBelowTarget !== bBelowTarget) return bBelowTarget - aBelowTarget;
            if (a.priority !== b.priority) return b.priority - a.priority;
            if (assignedDays[a.name] !== assignedDays[b.name]) {
              return assignedDays[a.name] - assignedDays[b.name];
            }
            return a.name.localeCompare(b.name, "ko");
          });

        const selected = candidates[0];

        if (selected) {
          assignments[dayIndex].push({
            rowIndex,
            position: slot.key,
            name: selected.name,
            time: selected.defaultTime || "",
            shortage: false
          });

          usedToday.add(selected.name);
          assignedDays[selected.name]++;
        } else {
          assignments[dayIndex].push({
            rowIndex,
            position: slot.key,
            name: "신규채용 필요",
            time: "",
            shortage: true
          });
        }
      });

      if (required > HALL_ROWS.length) {
        warnings.push(
          `${DAY_NAMES[dayIndex]}요일 필요인원 ${required}명 중 현재 근무표에는 ${HALL_ROWS.length}명까지만 표시할 수 있습니다.`
        );
      }
    }

    return {
      assignments,
      assignedDays,
      warnings,
      createdAt: new Date().toISOString()
    };
  }

  function getHallTableRows() {
    const body = document.getElementById("scheduleBody");
    if (!body) return [];

    const allRows = [...body.querySelectorAll("tr")];

    return allRows
      .filter(row => {
        const firstCell = row.querySelector("th,td");
        const label = String(firstCell?.textContent || "").trim().toLowerCase();
        return (
          label === "총괄" ||
          label.startsWith("티카") ||
          label === "serving"
        );
      })
      .slice(0, HALL_ROWS.length);
  }

  function getRowSelectPair(row, dayIndex) {
    const selects = [...row.querySelectorAll("select")];
    if (selects.length >= 14) {
      return {
        nameSelect: selects[dayIndex * 2],
        timeSelect: selects[dayIndex * 2 + 1]
      };
    }

    const nameSelect =
      row.querySelector(`select[data-day="${dayIndex}"][data-type="name"]`) ||
      row.querySelector(`select[data-day-index="${dayIndex}"][data-kind="name"]`);

    const timeSelect =
      row.querySelector(`select[data-day="${dayIndex}"][data-type="time"]`) ||
      row.querySelector(`select[data-day-index="${dayIndex}"][data-kind="time"]`);

    return { nameSelect, timeSelect };
  }

  function ensureOption(select, value) {
    if (!select || !value) return;

    const exists = [...select.options].some(option => option.value === value);
    if (exists) return;

    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }

  function applyGeneratedToExistingTable(generated) {
    const rows = getHallTableRows();

    if (rows.length < HALL_ROWS.length) {
      throw new Error("현재 근무표의 홀 13개 행을 찾지 못했습니다.");
    }

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      for (let rowIndex = 0; rowIndex < HALL_ROWS.length; rowIndex++) {
        const pair = getRowSelectPair(rows[rowIndex], dayIndex);
        if (!pair.nameSelect || !pair.timeSelect) continue;

        const item = generated.assignments[dayIndex]
          .find(assignment => assignment.rowIndex === rowIndex);

        const name = item?.name || "";
        const time = item?.time || "";

        ensureOption(pair.nameSelect, name);
        ensureOption(pair.timeSelect, time);

        pair.nameSelect.value = name;
        pair.timeSelect.value = time;

        pair.nameSelect.dispatchEvent(new Event("change", { bubbles: true }));
        pair.timeSelect.dispatchEvent(new Event("change", { bubbles: true }));

        const cell = pair.nameSelect.closest("td");
        if (cell) {
          cell.style.background = item?.shortage ? "#fde9e6" : "";
          cell.title = item?.shortage ? "배치 가능한 직원이 부족합니다." : "";
        }
      }
    }

    try {
      if (typeof updateTotals === "function") updateTotals();
    } catch (_) {
      // 기존 합계 함수명이 다를 경우 무시
    }
  }

  function readCurrentTableAssignments() {
    const rows = getHallTableRows();
    const result = Array.from({ length: 7 }, () => []);

    rows.forEach((row, rowIndex) => {
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const pair = getRowSelectPair(row, dayIndex);

        result[dayIndex].push({
          rowIndex,
          position: HALL_ROWS[rowIndex]?.key || "",
          name: String(pair.nameSelect?.value || "").trim(),
          time: String(pair.timeSelect?.value || "").trim()
        });
      }
    });

    return result;
  }

  function validateCurrentTable() {
    const current = readCurrentTableAssignments();
    const employeeMap = new Map(
      state.employees.map(employee => [employee.name, employee])
    );

    const workDays = Object.fromEntries(
      state.employees.map(employee => [employee.name, new Set()])
    );

    const messages = [];
    let shortageCount = 0;
    let errorCount = 0;

    current.forEach((dayAssignments, dayIndex) => {
      const used = new Set();
      const dayOffNames = getDayOffNames(dayIndex);
      const required = state.requiredStaff[dayIndex];

      const filled = dayAssignments
        .slice(0, Math.min(required, HALL_ROWS.length))
        .filter(item => item.name && item.name !== "신규채용 필요");

      shortageCount += Math.max(0, required - filled.length);

      dayAssignments.forEach(item => {
        if (!item.name || item.name === "신규채용 필요") return;

        if (used.has(item.name)) {
          messages.push(`${DAY_NAMES[dayIndex]}요일 ${item.name}: 같은 날 중복 배치`);
          errorCount++;
        }
        used.add(item.name);

        const employee = employeeMap.get(item.name);
        if (!employee) return;

        workDays[item.name].add(dayIndex);

        if (employee.status !== "근무가능") {
          messages.push(`${DAY_NAMES[dayIndex]}요일 ${item.name}: ${employee.status} 상태`);
          errorCount++;
        }

        if (!employee.availableDays[dayIndex]) {
          messages.push(`${DAY_NAMES[dayIndex]}요일 ${item.name}: 근무 불가능 요일`);
          errorCount++;
        }

        if (dayOffNames.has(item.name)) {
          messages.push(`${DAY_NAMES[dayIndex]}요일 ${item.name}: D/O 직원 배치`);
          errorCount++;
        }

        let positionAvailable;

if (item.position === "티카(H)") {

  positionAvailable =
    employee.positions["티카(M)"] ||
    employee.positions["티카(S)"];

} else {

  const positionGroup =
    getPositionGroup(
      item.position
    );

  positionAvailable =
    employee.positions[
      positionGroup
    ];

}

if (!positionAvailable) {

  messages.push(
    `${DAY_NAMES[dayIndex]}요일 ${item.name}: ${item.position} 포지션 불가`
  );

  errorCount++;

}
      });
    });

    state.employees.forEach(employee => {
      const count = workDays[employee.name]?.size || 0;

      if (
  employee.status === "근무가능" &&
  count < employee.targetDays
) {

  messages.push(
    `${employee.name}: 목표 ${employee.targetDays}일 중 ${count}일 배치`
  );

}
    });

    renderEmployeeWorkdaySummary(
  workDays
);

    if (shortageCount > 0) {
      messages.unshift(`전체 부족 인원: ${shortageCount}명`);
    }

    const generatedWarnings = state.generated?.warnings || [];
    messages.unshift(...generatedWarnings);

    if (!messages.length) {
      setSummary("success", "조건 검사가 완료되었습니다. 현재 홀 근무표에서 위반사항이나 부족 인원이 없습니다.");
      return;
    }

    const type = errorCount || shortageCount ? "warning" : "info";
    const visibleMessages = messages.slice(0, 20);

    setSummary(
      type,
      `<strong>검사 결과</strong><br>${visibleMessages.map(message => `• ${escapeHtml(message)}`).join("<br>")}` +
      (messages.length > 20 ? `<br>• 그 외 ${messages.length - 20}건` : "")
    );
  }

  function renderEmployeeWorkdaySummary(
  workDays
) {

  const element =
    document.getElementById(
      "simulationWorkdaySummary"
    );

  if (!element) return;

  const rows =
    state.employees
      .filter(function(employee) {

        return (
          employee.status ===
          "근무가능"
        );

      })
      .map(function(employee) {

        const actualDays =
          workDays[employee.name]
            ?.size || 0;

        const difference =
          actualDays -
          employee.targetDays;

        let statusText = "";
        let rowClass = "";

        if (difference < 0) {

          statusText =
            `${Math.abs(difference)}일 부족`;

          rowClass =
            "simulation-workday-short";

        } else if (difference === 0) {

          statusText =
            "목표 달성";

          rowClass =
            "simulation-workday-complete";

        } else {

          statusText =
            `${difference}일 초과`;

          rowClass =
            "simulation-workday-complete";

        }

        return `
          <tr class="${rowClass}">
            <td>
              ${escapeHtml(employee.name)}
            </td>

            <td>
              ${employee.targetDays}일
            </td>

            <td>
              ${actualDays}일
            </td>

            <td>
              ${statusText}
            </td>
          </tr>
        `;

      })
      .join("");

  element.innerHTML = `
    <h3>직원별 주간 근무일수</h3>

    <table class="simulation-workday-table">

      <thead>
        <tr>
          <th>직원명</th>
          <th>목표일수</th>
          <th>배치일수</th>
          <th>결과</th>
        </tr>
      </thead>

      <tbody>
        ${rows}
      </tbody>

    </table>
  `;

  element.classList.remove(
    "hidden"
  );

}

  function setSummary(type, html) {
    const element = document.getElementById("simulationResultSummary");
    if (!element) return;

    element.className = `simulation-result-summary ${type}`;
    element.innerHTML = html;
  }

  async function reloadEmployees() {
    collectUiState();

    const currentMap = new Map(
      state.employees.map(employee => [employee.name, employee])
    );

    const days = await fetchStaffDays();
    const names = extractHallNames(days);
    state.timeOptions =
  extractTimeOptions(days);

    state.employees = names.map(name =>
      normalizeEmployee(currentMap.get(name) || defaultEmployee(name))
    );

    renderEmployees();
    setSummary("success", `홀 직원 ${state.employees.length}명을 다시 불러왔습니다.`);
  }

  async function initializeSimulation(forceReload = false) {
    ensureStyles();
    ensureLayout();

    state.monday = getMondayValue();
    renderWeekText();

    const saved = !forceReload ? getExistingLocalData() : null;
    const days = await fetchStaffDays();
    const names = extractHallNames(days);
    state.timeOptions =
  extractTimeOptions(days);

    if (saved) {
      state.requiredStaff = Array.from({ length: 7 }, (_, index) =>
        clampNumber(saved.requiredStaff?.[index], 0, 99, 7)
      );

      const savedMap = new Map(
        (saved.employees || []).map(employee => [employee.name, employee])
      );

      state.employees = names.map(name =>
        normalizeEmployee(savedMap.get(name) || defaultEmployee(name))
      );

      // 직원목록에 없는 저장 직원은 퇴직 이력 보존을 위해 함께 표시
      (saved.employees || []).forEach(employee => {
        if (!names.includes(employee.name)) {
          state.employees.push(normalizeEmployee(employee));
        }
      });

      state.generated = saved.generated || null;
    } else {
      state.requiredStaff = [7, 7, 7, 7, 7, 7, 7];
      state.employees = names.map(defaultEmployee);
      state.generated = null;
    }

    state.employees.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    state.loaded = true;

    renderRequiredStaff();
    renderEmployees();

    if (!state.employees.length) {
      setSummary(
        "warning",
        "홀 직원목록을 불러오지 못했습니다. 상단의 직원목록 새로고침을 누른 뒤 ‘직원 다시 불러오기’를 눌러주세요."
      );
    } else {
      setSummary(
        "info",
        `홀 직원 ${state.employees.length}명을 불러왔습니다. 조건을 수정한 뒤 조건 저장 또는 예상 근무표 생성을 누르세요.`
      );
    }
  }

  async function togglePanel() {
    const panel = document.getElementById("simulationPanel");
    if (!panel) {
      alert("index.html에서 simulationPanel을 찾을 수 없습니다.");
      return;
    }

    const willOpen = panel.classList.contains("hidden");
    panel.classList.toggle("hidden");

    if (!willOpen) return;

    const selectedMonday = getMondayValue();

    if (!state.loaded || state.monday !== selectedMonday) {
      try {
        await initializeSimulation();
      } catch (error) {
        console.error(error);
        ensureStyles();
        setSummary("error", error.message || "시뮬레이션을 열지 못했습니다.");
      }
    }
  }

  // 기존 script.js의 같은 이름 함수보다 나중에 로드되어 이 함수가 사용됩니다.
  window.toggleSimulationPanel = togglePanel;
  window.loadSimulationData = initializeSimulation;
  window.saveSimulationConditions = () => saveLocalData(true);
  window.generateSimulationSchedule = () => {
    collectUiState();
    state.generated = generateSchedule();
    applyGeneratedToExistingTable(state.generated);
    saveLocalData(false);
    validateCurrentTable();
  };
  window.validateSimulationSchedule = validateCurrentTable;
  window.applySimulationToRealSchedule = () => {
    collectUiState();
    if (!state.generated) state.generated = generateSchedule();
    applyGeneratedToExistingTable(state.generated);
    validateCurrentTable();
  };
  window.setAllSimulationDaysAvailable = () => {
    state.employees.forEach(employee => {
      employee.availableDays = [true, true, true, true, true, true, true];
    });
    renderEmployees();
  };

  document.addEventListener("DOMContentLoaded", () => {
    ensureStyles();

    const mondayInput = document.getElementById("mondayInput");
    if (mondayInput) {
      mondayInput.addEventListener("change", () => {
        state.loaded = false;
        state.monday = mondayInput.value;
      });
    }
  });
})();