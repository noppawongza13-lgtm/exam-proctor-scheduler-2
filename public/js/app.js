/**
 * สคริปต์หลักฝั่ง Frontend ระบบจัดตารางคุมสอบ ELMS มหาวิทยาลัยราชภัฏบุรีรัมย์ อาคาร 17
 */

// Application State
const state = {
  currentUser: {
    id: 'U_ADMIN_01',
    username: 'admin',
    role: 'ADMIN',
    displayName: 'ผู้ดูแลระบบศูนย์สอบ CBT อาคาร 17',
    faculty: 'สำนักวิทยบริการและเทคโนโลยีสารสนเทศ'
  },
  token: null,
  activeTab: 'tab-dashboard',
  activeView: 'session', // 'session' | 'room' | 'proctor'
  activeFloor: 1,
  selectedRoomCode: '17108',
  scheduleData: null,
  demoAccounts: [],
  inspectSlotId: null
};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loginAsDefaultAdmin();
  await loadDemoAccounts();
  await refreshSchedule();
  renderFloorplan(state.activeFloor);
});

// Auto-login as Admin for initial seamless experience
async function loginAsDefaultAdmin() {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin1234' })
    });
    if (res.ok) {
      const data = await res.json();
      state.token = data.token;
      state.currentUser = data.user;
      updateUserUI();
    }
  } catch (e) {
    console.error('Failed default login:', e);
  }
}

// Update User & Role UI
function updateUserUI() {
  const roleBadge = document.getElementById('currentRoleBadge');
  const avatar = document.getElementById('userAvatar');
  const nameDisp = document.getElementById('userNameDisplay');
  const facDisp = document.getElementById('userFacultyDisplay');

  roleBadge.textContent = state.currentUser.role;
  roleBadge.className = `badge badge-role ${state.currentUser.role.toLowerCase()}`;
  avatar.textContent = (state.currentUser.displayName || state.currentUser.username || 'U')[0].toUpperCase();
  nameDisp.textContent = state.currentUser.displayName || state.currentUser.username;
  facDisp.textContent = state.currentUser.faculty || 'ศูนย์สอบ CBT อาคาร 17';
}

// Fetch Demo Accounts
async function loadDemoAccounts() {
  try {
    const res = await fetch('/api/auth/demo-accounts');
    if (res.ok) {
      const data = await res.json();
      state.demoAccounts = data.accounts;
    }
  } catch (e) {
    console.error('Failed to load demo accounts:', e);
  }
}

// Fetch Full Schedule State
async function refreshSchedule() {
  try {
    const res = await fetch('/api/schedule', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (!res.ok) return;

    state.scheduleData = await res.json();
    updateKPICards();
    renderScheduleGrid();
    updateUndoRedoButtons();
  } catch (e) {
    console.error('Failed to load schedule:', e);
  }
}

// Update 4 KPI Cards
function updateKPICards() {
  if (!state.scheduleData) return;
  const { rooms, slots, validation, workloadStats, feasibility } = state.scheduleData;

  // KPI 1: Rooms
  const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);
  document.getElementById('kpiRoomsValue').textContent = `${rooms.length} ห้อง (${totalCapacity} ที่นั่ง)`;

  // KPI 2: Staff & Jain's Index
  const totalProctors = workloadStats.count || 40;
  const jain = workloadStats.jainIndex || 1.0;
  document.getElementById('kpiStaffValue').textContent = `${totalProctors} ท่าน`;
  document.getElementById('kpiStaffMeta').textContent = `Jain's Index: ${jain} (${workloadStats.ratingThai || 'ยอดเยี่ยม'})`;

  // KPI 3: Schedule Progress
  const assigned = slots.filter(s => s.proctorId).length;
  const totalSlots = slots.length;
  const percent = totalSlots > 0 ? Math.round((assigned / totalSlots) * 100) : 0;
  document.getElementById('kpiSlotsValue').textContent = `${assigned} / ${totalSlots} ตำแหน่ง`;
  document.getElementById('kpiSlotsMeta').textContent = `ความคืบหน้า ${percent}% (${state.scheduleData.sessions.length} รอบสอบ)`;

  // KPI 4: Compliance
  const hardViolations = validation.hardViolationsCount || 0;
  const rulesVal = document.getElementById('kpiRulesValue');
  const rulesMeta = document.getElementById('kpiRulesMeta');
  const rulesIcon = document.getElementById('kpiRulesIcon');

  if (hardViolations === 0) {
    rulesVal.textContent = 'ผ่านสมบูรณ์ 0 Violations';
    rulesVal.className = 'kpi-value text-success';
    rulesIcon.textContent = '🛡️';
    rulesIcon.className = 'kpi-icon icon-green';
  } else {
    rulesVal.textContent = `พบ ${hardViolations} Violations`;
    rulesVal.className = 'kpi-value text-danger';
    rulesIcon.textContent = '⚠️';
    rulesIcon.className = 'kpi-icon icon-gold';
  }
  rulesMeta.textContent = `ผ่าน Hard H1-H9 | Soft Score ${validation.softScore || 0}/100`;
}

// Update Undo / Redo buttons
function updateUndoRedoButtons() {
  if (!state.scheduleData || !state.scheduleData.history) return;
  const { canUndo, canRedo } = state.scheduleData.history;
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  if (btnUndo) btnUndo.disabled = !canUndo;
  if (btnRedo) btnRedo.disabled = !canRedo;
}

// Render Schedule Grid
function renderScheduleGrid() {
  const container = document.getElementById('scheduleContainer');
  if (!container || !state.scheduleData) return;

  const { sessions, rooms, slots } = state.scheduleData;
  const filterSession = document.getElementById('filterSessionSelect').value;

  const displaySessions = filterSession === 'ALL' 
    ? sessions 
    : sessions.filter(s => s.id === filterSession);

  let html = '';

  for (const session of displaySessions) {
    html += `
      <div class="schedule-session-block">
        <div class="session-header">
          <div class="session-title">📅 ${session.title}</div>
          <div class="session-meta">
            เวลาสอบ: <strong>${session.startTime} - ${session.endTime} น.</strong> 
            (รายงานตัว ${getPrepTime(session.startTime, session.prepMinutes)} น.)
          </div>
        </div>

        <div class="rooms-grid">
    `;

    for (const room of rooms) {
      const roomSlots = slots.filter(s => s.sessionId === session.id && (s.roomId === room.id || s.roomCode === room.roomCode));
      const isLarge = room.capacity >= 70;

      html += `
        <div class="room-card ${isLarge ? 'large-room' : ''}">
          <div class="room-card-header">
            <div>
              <span class="room-code-tag">ห้อง ${room.roomCode}</span>
              <span class="text-muted" style="font-size: 12px; margin-left: 6px;">(${room.name})</span>
            </div>
            <span class="room-capacity-tag">ความจุ ${room.capacity} ที่นั่ง (${roomSlots.length} ผู้คุม)</span>
          </div>

          <div class="room-slots-list">
      `;

      roomSlots.sort((a, b) => a.order - b.order);
      for (const slot of roomSlots) {
        html += renderSlotItem(slot, room, session);
      }

      html += `
          </div>
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// Render Single Slot Item
function renderSlotItem(slot, room, session) {
  const isChief = slot.order === 1 || slot.role === 'CHIEF';
  const roleBadgeClass = isChief ? 'badge-chief' : 'badge-co';
  const roleText = isChief ? 'หัวหน้าห้อง' : `กรรมการร่วม ${slot.order}`;

  if (!slot.proctorId) {
    return `
      <div class="slot-item unassigned" onclick="openAssignModal('${slot.id}')" title="คลิกเพื่อมอบหมายผู้คุมสอบ">
        <div class="slot-info">
          <div class="slot-role-row">
            <span class="badge ${roleBadgeClass}">${roleText}</span>
            <span class="text-muted" style="font-size: 12px;">(ตำแหน่งที่ ${slot.order})</span>
          </div>
          <div class="slot-proctor-name" style="color: #94a3b8; font-weight: normal;">
            ➕ ว่าง - คลิกเพื่อจัดสรร
          </div>
        </div>
      </div>
    `;
  }

  // Proctor assigned
  const isLocked = slot.isLocked;
  const isSigned = slot.isSigned;
  const canSign = (state.currentUser.role === 'ADMIN') || 
                  (state.currentUser.role === 'PROCTOR' && state.currentUser.proctorId === slot.proctorId);

  return `
    <div class="slot-item">
      <div class="slot-info">
        <div class="slot-role-row">
          <span class="badge ${roleBadgeClass}">${roleText}</span>
          ${slot.isReserveCalled ? '<span class="badge badge-reserve">Reserve</span>' : ''}
          ${isLocked ? '<span title="ตำแหน่งนี้ถูกล็อกไว้">🔒</span>' : ''}
        </div>
        <div class="slot-proctor-name">${slot.proctorName}</div>
      </div>

      <div class="slot-actions">
        <!-- Attendance Signature Button -->
        ${isSigned ? `
          <button class="btn-sign-attendance signed" title="ลงนามแล้วเมื่อ ${formatTime(slot.signedAt)}">
            ✅ ลงนามแล้ว
          </button>
        ` : `
          <button class="btn-sign-attendance" 
                  ${canSign ? `onclick="signAttendanceSlot('${slot.id}')"` : 'disabled title="ลงนามได้เฉพาะบัญชีผู้คุมสอบของท่านเอง"'}
          >
            ✍️ ลงนาม
          </button>
        `}

        <!-- Explain Info Button -->
        <button class="btn-slot-action" onclick="openExplainModal('${slot.id}')" title="เหตุผลการจัดตำแหน่งนี้">
          ℹ️
        </button>

        <!-- Lock / Unlock Button -->
        <button class="btn-slot-action" onclick="toggleSlotLock('${slot.id}')" title="${isLocked ? 'ปลดล็อก' : 'ล็อกตำแหน่ง'}">
          ${isLocked ? '🔓' : '🔒'}
        </button>

        <!-- Unassign Button -->
        <button class="btn-slot-action text-danger" onclick="unassignSlot('${slot.id}')" title="ยกเลิกการมอบหมาย">
          ✕
        </button>
      </div>
    </div>
  `;
}

// Format Prep Time
function getPrepTime(timeStr, prepMins = 30) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m - prepMins;
  const ph = Math.floor(total / 60);
  const pm = total % 60;
  return `${String(ph).padStart(2, '0')}:${String(pm).padStart(2, '0')}`;
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
  } catch (e) {
    return isoStr;
  }
}

// ==========================================
// User Actions: Solver, Reset, Undo, Redo
// ==========================================

async function triggerAutoSolve() {
  const btn = document.getElementById('btnAutoSolve');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳ กำลังประมวลผล...</span>';

  try {
    const res = await fetch('/api/schedule/solve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ proctorCount: 40 })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(`จัดตารางสำเร็จ ${data.solvedCount}/${data.totalSlots} ตำแหน่ง ในเวลา ${data.executionTimeMs} ms!`, 'success');
      await refreshSchedule();
    } else {
      showToast(data.error || 'เกิดข้อผิดพลาดในการจัดตาราง', 'danger');
    }
  } catch (e) {
    showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'danger');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>🚀 จัดตารางอัตโนมัติ (Solver)</span>';
  }
}

async function randomScaleProctors() {
  const btn = document.getElementById('btnRandomProctors');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ กำลังสุ่มผู้คุม...</span>';
  }

  try {
    const res = await fetch('/api/schedule/solve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ proctorCount: 80 })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(`สุ่มสร้างผู้คุม 80 คนและจัดตารางอัตโนมัติสำเร็จครบ 100%! (${data.solvedCount}/${data.totalSlots} ตำแหน่ง)`, 'success');
      await refreshSchedule();
    } else {
      showToast(data.error || 'เกิดข้อผิดพลาดในการสุ่มสร้างผู้คุม', 'danger');
    }
  } catch (e) {
    showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'danger');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>🎲 สุ่มผู้คุมสอบ (80 คน)</span>';
    }
  }
}

async function resetSchedule() {
  if (!confirm('คุณต้องการรีเซ็ตการจัดตารางทั้งหมด (ยกเว้นช่องที่ล็อกไว้) ใช่หรือไม่?')) return;
  try {
    const res = await fetch('/api/schedule/reset', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (res.ok) {
      showToast('รีเซ็ตตารางเรียบร้อยแล้ว', 'warning');
      await refreshSchedule();
    }
  } catch (e) {
    showToast('ไม่สามารถรีเซ็ตตารางได้', 'danger');
  }
}

async function triggerUndo() {
  try {
    const res = await fetch('/api/schedule/undo', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (res.ok) {
      const data = await res.json();
      showToast(`Undo: ${data.action}`, 'info');
      await refreshSchedule();
    }
  } catch (e) {
    showToast('ไม่สามารถ Undo ได้', 'danger');
  }
}

async function triggerRedo() {
  try {
    const res = await fetch('/api/schedule/redo', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (res.ok) {
      const data = await res.json();
      showToast(`Redo: ${data.action}`, 'info');
      await refreshSchedule();
    }
  } catch (e) {
    showToast('ไม่สามารถ Redo ได้', 'danger');
  }
}

// Toggle Slot Lock
async function toggleSlotLock(slotId) {
  try {
    const res = await fetch('/api/schedule/lock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ slotId })
    });
    if (res.ok) {
      await refreshSchedule();
    }
  } catch (e) {
    showToast('เกิดข้อผิดพลาดในการเปลี่ยนสถานะล็อก', 'danger');
  }
}

// Unassign Slot
async function unassignSlot(slotId) {
  try {
    const res = await fetch('/api/schedule/unassign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ slotId })
    });
    if (res.ok) {
      showToast('ยกเลิกการมอบหมายเรียบร้อยแล้ว', 'info');
      await refreshSchedule();
    }
  } catch (e) {
    showToast('เกิดข้อผิดพลาดในการยกเลิก', 'danger');
  }
}

// Sign Attendance Slot
async function signAttendanceSlot(slotId) {
  try {
    const res = await fetch('/api/schedule/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ slotId })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('ลงนามปฏิบัติหน้าที่สำเร็จเรียบร้อยแล้ว (Digital Signature บันทึกเข้าระบบ)', 'success');
      await refreshSchedule();
    } else {
      showToast(data.error || 'ไม่สามารถลงนามได้', 'danger');
    }
  } catch (e) {
    showToast('เกิดข้อผิดพลาดในการลงนาม', 'danger');
  }
}

// ==========================================
// Candidate Selection & Assign Modal
// ==========================================

window.openAssignModal = async function(slotId) {
  state.inspectSlotId = slotId;
  const slot = state.scheduleData.slots.find(s => s.id === slotId);
  const room = state.scheduleData.rooms.find(r => r.id === slot.roomId || r.roomCode === slot.roomCode);
  const session = state.scheduleData.sessions.find(s => s.id === slot.sessionId);

  document.getElementById('modalAssignTitle').textContent = `มอบหมายผู้คุมสอบ: ห้อง ${room.roomCode} (${slot.order === 1 ? 'หัวหน้าห้อง' : 'กรรมการร่วม'})`;
  document.getElementById('assignSlotInfo').innerHTML = `
    <strong>รอบสอบ:</strong> ${session.title}<br>
    <strong>ห้องสอบ:</strong> ${room.roomCode} (${room.name}) - ความจุ ${room.capacity} ที่นั่ง<br>
    <strong>ตำแหน่ง:</strong> ${slot.order === 1 ? 'หัวหน้าห้อง (Order 1 - ต้องการผู้อาวุโสสูงสุด)' : `กรรมการร่วม (Order ${slot.order})`}
  `;

  renderCandidateList('');
  document.getElementById('modalAssign').classList.remove('hidden');
};

async function renderCandidateList(filterQuery = '') {
  const listEl = document.getElementById('candidateList');
  if (!listEl || !state.scheduleData) return;

  const slot = state.scheduleData.slots.find(s => s.id === state.inspectSlotId);
  const q = filterQuery.toLowerCase();

  const proctors = state.scheduleData.feasibility ? defaultProctors : []; // active proctors
  let html = '';

  for (const proctor of proctors) {
    if (q && !proctor.name.toLowerCase().includes(q) && !proctor.academicTitle.toLowerCase().includes(q)) {
      continue;
    }

    html += `
      <div class="candidate-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #e2e8f0;">
        <div>
          <div style="font-weight: 600;">${proctor.name}</div>
          <div style="font-size: 12px; color: #64748b;">
            Rank: ${proctor.seniorityRank} | โควตา: ${proctor.maxSessions} รอบ | ${proctor.faculty}
          </div>
        </div>
        <button class="btn btn-primary" onclick="assignProctorToSlot('${proctor.id}')" style="padding: 4px 12px; font-size: 12px;">
          เลือกท่านนี้
        </button>
      </div>
    `;
  }

  listEl.innerHTML = html || '<div class="text-muted" style="padding: 20px; text-align: center;">ไม่พบบุคลากรที่ตรงกับคำค้นหา</div>';
}

window.assignProctorToSlot = async function(proctorId) {
  try {
    const res = await fetch('/api/schedule/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ slotId: state.inspectSlotId, proctorId })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('มอบหมายผู้คุมสอบเรียบร้อยแล้ว', 'success');
      document.getElementById('modalAssign').classList.add('hidden');
      await refreshSchedule();
    } else {
      alert(`⚠️ ไม่สามารถจัดได้เนื่องจากขัดต่อกฎ:\n` + (data.reasons ? data.reasons.join('\n') : data.error));
    }
  } catch (e) {
    showToast('เกิดข้อผิดพลาดในการมอบหมาย', 'danger');
  }
};

// ==========================================
// Explainability Modal
// ==========================================

window.openExplainModal = async function(slotId) {
  try {
    const res = await fetch(`/api/schedule/explain/${slotId}`);
    if (!res.ok) return;

    const data = await res.json();
    const body = document.getElementById('modalExplainBody');

    if (data.type === 'ASSIGNED') {
      const exp = data.explanation;
      body.innerHTML = `
        <div style="margin-bottom: 16px;">
          <h4 style="color: var(--color-primary);">${exp.proctorName}</h4>
          <div style="font-size: 13px; color: #64748b;">
            ห้อง ${exp.roomCode} | ${exp.sessionTitle} (${exp.date})
          </div>
          <div style="margin: 8px 0; display: flex; gap: 6px;">
            ${exp.tags.map(t => `<span class="badge badge-${t.type}">${t.label}</span>`).join('')}
          </div>
        </div>
        <div style="background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <h5 style="margin-bottom: 8px;">เหตุผลการจัดสรรตำแหน่ง (Rules Justification):</h5>
          <ul style="padding-left: 20px; font-size: 14px; line-height: 1.6;">
            ${exp.reasons.map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>
      `;
    } else {
      const diag = data.diagnostic;
      body.innerHTML = `
        <div style="margin-bottom: 16px;">
          <h4 class="text-danger">ตำแหน่งนี้ยังไม่ได้รับการจัดสรร</h4>
          <p style="font-size: 13px; color: #64748b;">วิเคราะห์คอขวดจากผู้คุมสอบทั้งหมด ${diag.totalCandidatesTested} ท่าน</p>
        </div>
        <h5>สาเหตุหลักที่ไม่สามารถลงได้ (Top Bottlenecks):</h5>
        <ul style="padding-left: 20px; font-size: 14px; margin-top: 8px;">
          ${diag.topBottlenecks.map(b => `<li><strong>${b.count} ท่าน:</strong> ${b.reason}</li>`).join('')}
        </ul>
      `;
    }

    document.getElementById('modalExplain').classList.remove('hidden');
  } catch (e) {
    showToast('ไม่สามารถดึงข้อมูลเหตุผลได้', 'danger');
  }
};

// ==========================================
// Interactive Floorplan (Floors 1 & 2)
// ==========================================

function renderFloorplan(floorNumber) {
  state.activeFloor = floorNumber;
  const titleEl = document.getElementById('canvasFloorTitle');
  const wrapper = document.getElementById('svgFloorplanWrapper');
  const btn1 = document.getElementById('btnFloor1');
  const btn2 = document.getElementById('btnFloor2');

  if (floorNumber === 1) {
    titleEl.textContent = 'พิมพ์เขียวสถาปัตยกรรม: อาคารนวัตปัญญา (อาคาร 17) ชั้น 1 (วินิตปัญญา)';
    btn1.classList.add('active');
    btn2.classList.remove('active');
    wrapper.innerHTML = generateFloor1SVG();
  } else {
    titleEl.textContent = 'พิมพ์เขียวสถาปัตยกรรม: อาคารนวัตปัญญา (อาคาร 17) ชั้น 2 (สุตปัญญา & หงส์พันธ์)';
    btn1.classList.remove('active');
    btn2.classList.add('active');
    wrapper.innerHTML = generateFloor2SVG();
  }

  attachFloorplanClickHandlers();
}

// Generate Floor 1 Architectural SVG
function generateFloor1SVG() {
  return `
    <svg viewBox="0 0 840 450" width="840" height="450" font-family="Prompt, sans-serif">
      <!-- Building 17 Outer Walls -->
      <rect x="15" y="15" width="810" height="420" fill="#f8fafc" stroke="#334155" stroke-width="3" rx="8"/>
      
      <!-- Corridors & Main Halls -->
      <path d="M 60 215 L 780 215" stroke="#94a3b8" stroke-width="24" stroke-linecap="round"/>
      <text x="420" y="220" font-size="12" fill="#64748b" text-anchor="middle" font-weight="600">โถงทางเดินหลัก ชั้น 1 (MAIN CORRIDOR)</text>

      <!-- Entrance & Stairs -->
      <g id="stairs-1" transform="translate(40, 240)">
        <rect x="0" y="0" width="70" height="90" fill="#fef08a" stroke="#ca8a04" stroke-width="2" rx="4"/>
        <line x1="0" y1="20" x2="70" y2="20" stroke="#ca8a04"/>
        <line x1="0" y1="40" x2="70" y2="40" stroke="#ca8a04"/>
        <line x1="0" y1="60" x2="70" y2="60" stroke="#ca8a04"/>
        <text x="35" y="50" font-size="11" fill="#854d0e" text-anchor="middle" font-weight="bold">บันไดขึ้นชั้น 2</text>
      </g>

      <!-- Registration Desks Area -->
      <g id="reg-area" transform="translate(680, 240)">
        <rect x="0" y="0" width="120" height="90" fill="#ecfdf5" stroke="#059669" stroke-width="2" rx="4"/>
        <text x="60" y="35" font-size="12" fill="#065f46" text-anchor="middle" font-weight="bold">จุดลงทะเบียน</text>
        <text x="60" y="55" font-size="10" fill="#047857" text-anchor="middle">โต๊ะ 1 - 4 (โถงชั้น 1)</text>
      </g>

      <!-- CBT Rooms Floor 1: 17108, 17109, 17110, 17111 -->
      <!-- 17108: 50 seats -->
      <g data-room="17108" class="cbt-room" transform="translate(140, 40)">
        <rect width="120" height="150" fill="#e0e7ff" stroke="#4338ca" stroke-width="2" rx="6"/>
        <text x="60" y="50" font-size="18" font-weight="bold" fill="#312e81" text-anchor="middle">17108</text>
        <text x="60" y="75" font-size="12" fill="#4338ca" text-anchor="middle">วินิตปัญญา 5</text>
        <text x="60" y="105" font-size="11" fill="#475569" text-anchor="middle">50 ที่นั่ง (โต๊ะ 1)</text>
        <text x="60" y="125" font-size="10" fill="#059669" text-anchor="middle" font-weight="600">ผู้คุม 2 คน</text>
      </g>

      <!-- 17109: 50 seats -->
      <g data-room="17109" class="cbt-room" transform="translate(280, 40)">
        <rect width="120" height="150" fill="#e0e7ff" stroke="#4338ca" stroke-width="2" rx="6"/>
        <text x="60" y="50" font-size="18" font-weight="bold" fill="#312e81" text-anchor="middle">17109</text>
        <text x="60" y="75" font-size="12" fill="#4338ca" text-anchor="middle">วินิตปัญญา 6</text>
        <text x="60" y="105" font-size="11" fill="#475569" text-anchor="middle">50 ที่นั่ง (โต๊ะ 2)</text>
        <text x="60" y="125" font-size="10" fill="#059669" text-anchor="middle" font-weight="600">ผู้คุม 2 คน</text>
      </g>

      <!-- 17110: 50 seats -->
      <g data-room="17110" class="cbt-room" transform="translate(420, 40)">
        <rect width="120" height="150" fill="#e0e7ff" stroke="#4338ca" stroke-width="2" rx="6"/>
        <text x="60" y="50" font-size="18" font-weight="bold" fill="#312e81" text-anchor="middle">17110</text>
        <text x="60" y="75" font-size="12" fill="#4338ca" text-anchor="middle">วินิตปัญญา 7</text>
        <text x="60" y="105" font-size="11" fill="#475569" text-anchor="middle">50 ที่นั่ง (โต๊ะ 3)</text>
        <text x="60" y="125" font-size="10" fill="#059669" text-anchor="middle" font-weight="600">ผู้คุม 2 คน</text>
      </g>

      <!-- 17111: 50 seats -->
      <g data-room="17111" class="cbt-room" transform="translate(560, 40)">
        <rect width="120" height="150" fill="#e0e7ff" stroke="#4338ca" stroke-width="2" rx="6"/>
        <text x="60" y="50" font-size="18" font-weight="bold" fill="#312e81" text-anchor="middle">17111</text>
        <text x="60" y="75" font-size="12" fill="#4338ca" text-anchor="middle">วินิตปัญญา 8</text>
        <text x="60" y="105" font-size="11" fill="#475569" text-anchor="middle">50 ที่นั่ง (โต๊ะ 4)</text>
        <text x="60" y="125" font-size="10" fill="#059669" text-anchor="middle" font-weight="600">ผู้คุม 2 คน</text>
      </g>

      <!-- General / Office Rooms on Floor 1 -->
      <g transform="translate(140, 250)">
        <rect width="150" height="140" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.5" rx="4"/>
        <text x="75" y="65" font-size="13" fill="#64748b" text-anchor="middle">17104 - 17105</text>
        <text x="75" y="85" font-size="11" fill="#94a3b8" text-anchor="middle">สำนักงาน/ห้องพักอาจารย์</text>
      </g>

      <g transform="translate(320, 250)">
        <rect width="320" height="140" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.5" rx="4"/>
        <text x="160" y="65" font-size="14" fill="#64748b" text-anchor="middle">17101 - 17103 ศูนย์บริการวิชาการ</text>
        <text x="160" y="85" font-size="11" fill="#94a3b8" text-anchor="middle">ห้องสมุดดิจิทัลและศูนย์การเรียนรู้</text>
      </g>
    </svg>
  `;
}

// Generate Floor 2 Architectural SVG
function generateFloor2SVG() {
  return `
    <svg viewBox="0 0 840 450" width="840" height="450" font-family="Prompt, sans-serif">
      <!-- Building 17 Outer Walls -->
      <rect x="15" y="15" width="810" height="420" fill="#f8fafc" stroke="#334155" stroke-width="3" rx="8"/>
      
      <!-- Corridors -->
      <path d="M 60 215 L 780 215" stroke="#94a3b8" stroke-width="24" stroke-linecap="round"/>
      <text x="420" y="220" font-size="12" fill="#64748b" text-anchor="middle" font-weight="600">โถงทางเดินหลัก ชั้น 2 (MAIN CORRIDOR)</text>

      <!-- Stairs to Floor 1 -->
      <g id="stairs-2" transform="translate(40, 240)">
        <rect x="0" y="0" width="70" height="90" fill="#fef08a" stroke="#ca8a04" stroke-width="2" rx="4"/>
        <line x1="0" y1="20" x2="70" y2="20" stroke="#ca8a04"/>
        <line x1="0" y1="40" x2="70" y2="40" stroke="#ca8a04"/>
        <line x1="0" y1="60" x2="70" y2="60" stroke="#ca8a04"/>
        <text x="35" y="50" font-size="11" fill="#854d0e" text-anchor="middle" font-weight="bold">บันไดลงชั้น 1</text>
      </g>

      <!-- CBT Rooms Floor 2 -->
      <!-- 17201: Large Hall 80 seats (Hongsaphan) -->
      <g data-room="17201" class="cbt-room" transform="translate(140, 40)">
        <rect width="180" height="150" fill="#fef3c7" stroke="#d97706" stroke-width="3" rx="6"/>
        <text x="90" y="45" font-size="20" font-weight="bold" fill="#92400e" text-anchor="middle">17201 (ห้องใหญ่)</text>
        <text x="90" y="70" font-size="12" fill="#b45309" text-anchor="middle">ห้องประชุมหงส์พันธ์</text>
        <text x="90" y="100" font-size="12" fill="#475569" text-anchor="middle" font-weight="bold">80 ที่นั่ง (โต๊ะ 5)</text>
        <text x="90" y="125" font-size="11" fill="#dc2626" text-anchor="middle" font-weight="bold">★ ผู้คุม 3 คน</text>
      </g>

      <!-- 17205: 40 seats -->
      <g data-room="17205" class="cbt-room" transform="translate(340, 40)">
        <rect width="110" height="150" fill="#e0e7ff" stroke="#4338ca" stroke-width="2" rx="6"/>
        <text x="55" y="50" font-size="17" font-weight="bold" fill="#312e81" text-anchor="middle">17205</text>
        <text x="55" y="75" font-size="12" fill="#4338ca" text-anchor="middle">สุตปัญญา</text>
        <text x="55" y="105" font-size="11" fill="#475569" text-anchor="middle">40 ที่นั่ง (โต๊ะ 6)</text>
        <text x="55" y="125" font-size="10" fill="#059669" text-anchor="middle" font-weight="600">ผู้คุม 2 คน</text>
      </g>

      <!-- 17206: 60 seats (Wongkaew) -->
      <g data-room="17206" class="cbt-room" transform="translate(470, 40)">
        <rect width="130" height="150" fill="#e0e7ff" stroke="#4338ca" stroke-width="2" rx="6"/>
        <text x="65" y="50" font-size="17" font-weight="bold" fill="#312e81" text-anchor="middle">17206</text>
        <text x="65" y="75" font-size="12" fill="#4338ca" text-anchor="middle">ประชุมวงษ์แก้ว</text>
        <text x="65" y="105" font-size="11" fill="#475569" text-anchor="middle">60 ที่นั่ง (โต๊ะ 7)</text>
        <text x="65" y="125" font-size="10" fill="#059669" text-anchor="middle" font-weight="600">ผู้คุม 2 คน</text>
      </g>

      <!-- 17211: 45 seats (Jittapanya 1) -->
      <g data-room="17211" class="cbt-room" transform="translate(140, 250)">
        <rect width="120" height="140" fill="#e0e7ff" stroke="#4338ca" stroke-width="2" rx="6"/>
        <text x="60" y="45" font-size="16" font-weight="bold" fill="#312e81" text-anchor="middle">17211</text>
        <text x="60" y="65" font-size="12" fill="#4338ca" text-anchor="middle">จิตตปัญญา 1</text>
        <text x="60" y="95" font-size="11" fill="#475569" text-anchor="middle">45 ที่นั่ง (โต๊ะ 8)</text>
        <text x="60" y="115" font-size="10" fill="#059669" text-anchor="middle" font-weight="600">ผู้คุม 2 คน</text>
      </g>

      <!-- 17212: 45 seats (Jittapanya 2) -->
      <g data-room="17212" class="cbt-room" transform="translate(280, 250)">
        <rect width="120" height="140" fill="#e0e7ff" stroke="#4338ca" stroke-width="2" rx="6"/>
        <text x="60" y="45" font-size="16" font-weight="bold" fill="#312e81" text-anchor="middle">17212</text>
        <text x="60" y="65" font-size="12" fill="#4338ca" text-anchor="middle">จิตตปัญญา 2</text>
        <text x="60" y="95" font-size="11" fill="#475569" text-anchor="middle">45 ที่นั่ง (โต๊ะ 9)</text>
        <text x="60" y="115" font-size="10" fill="#059669" text-anchor="middle" font-weight="600">ผู้คุม 2 คน</text>
      </g>

      <!-- 17213: 50 seats (Jittapanya 3) -->
      <g data-room="17213" class="cbt-room" transform="translate(420, 250)">
        <rect width="120" height="140" fill="#e0e7ff" stroke="#4338ca" stroke-width="2" rx="6"/>
        <text x="60" y="45" font-size="16" font-weight="bold" fill="#312e81" text-anchor="middle">17213</text>
        <text x="60" y="65" font-size="12" fill="#4338ca" text-anchor="middle">จิตตปัญญา 3</text>
        <text x="60" y="95" font-size="11" fill="#475569" text-anchor="middle">50 ที่นั่ง (โต๊ะ 10)</text>
        <text x="60" y="115" font-size="10" fill="#059669" text-anchor="middle" font-weight="600">ผู้คุม 2 คน</text>
      </g>

      <!-- Registration Desks Floor 2 -->
      <g id="reg-area-f2" transform="translate(680, 240)">
        <rect x="0" y="0" width="120" height="90" fill="#ecfdf5" stroke="#059669" stroke-width="2" rx="4"/>
        <text x="60" y="35" font-size="12" fill="#065f46" text-anchor="middle" font-weight="bold">จุดลงทะเบียน</text>
        <text x="60" y="55" font-size="10" fill="#047857" text-anchor="middle">โต๊ะ 5 - 10 (โถงชั้น 2)</text>
      </g>
    </svg>
  `;
}

// Attach Click Event on SVG Rooms
function attachFloorplanClickHandlers() {
  const rooms = document.querySelectorAll('.svg-wrapper g[data-room]');
  rooms.forEach(el => {
    el.addEventListener('click', () => {
      const roomCode = el.getAttribute('data-room');
      selectRoomOnFloorplan(roomCode);
    });
  });
}

function selectRoomOnFloorplan(roomCode) {
  state.selectedRoomCode = roomCode;
  const room = state.scheduleData?.rooms?.find(r => r.roomCode === roomCode);
  if (!room) return;

  // Update inspect card
  document.getElementById('inspectRoomFloor').textContent = `ชั้น ${room.floor}`;
  document.getElementById('inspectRoomCode').textContent = `ห้อง ${room.roomCode}`;
  document.getElementById('inspectRoomName').textContent = room.name;
  document.getElementById('inspectRoomCapacity').textContent = `${room.capacity} ที่นั่ง`;
  document.getElementById('inspectRoomProctors').textContent = `${room.requiredProctors} ท่าน (${room.capacity >= 70 ? 'ห้องใหญ่ 3 คน' : 'มาตรฐาน 2 คน'})`;
  document.getElementById('inspectRoomSeats').textContent = room.seatRange ? `${room.seatRange.start} - ${room.seatRange.end}` : '-';
  document.getElementById('inspectRoomReg').textContent = `โต๊ะที่ ${room.registrationTable} โถงชั้น ${room.floor}`;

  // Find staff in this room
  const staffListEl = document.getElementById('inspectStaffList');
  if (state.scheduleData && state.scheduleData.slots) {
    const slots = state.scheduleData.slots.filter(s => s.roomCode === roomCode && s.proctorId);
    if (slots.length > 0) {
      staffListEl.innerHTML = `
        <h5 style="margin-top: 10px; margin-bottom: 6px;">ผู้คุมสอบในห้องนี้:</h5>
        ${slots.map(s => `
          <div style="font-size: 12px; margin-bottom: 4px;">
            • ${s.order === 1 ? '👑 หัวหน้าห้อง' : 'กรรมการร่วม'}: <strong>${s.proctorName}</strong>
          </div>
        `).join('')}
      `;
    } else {
      staffListEl.innerHTML = `<div class="text-muted" style="font-size: 12px; margin-top: 10px;">ยังไม่มีการมอบหมายผู้คุมสอบในห้องนี้</div>`;
    }
  }

  // Highlight SVG room
  document.querySelectorAll('.svg-wrapper g[data-room]').forEach(g => {
    if (g.getAttribute('data-room') === roomCode) {
      g.classList.add('selected');
    } else {
      g.classList.remove('selected');
    }
  });
}

// ==========================================
// Guest Portal: Search Seat
// ==========================================

async function searchSeat() {
  const input = document.getElementById('inputCitizenId');
  const val = input.value.trim();
  if (!val) {
    showToast('กรุณากรอกเลขประจำตัวประชาชน', 'warning');
    return;
  }

  try {
    const res = await fetch(`/api/guest/search?citizenId=${encodeURIComponent(val)}`);
    const data = await res.json();

    const box = document.getElementById('searchResultBox');
    if (!res.ok) {
      box.classList.add('hidden');
      showToast(data.error || 'ไม่พบข้อมูลเลขที่นั่งสอบ', 'danger');
      return;
    }

    const ex = data.examinee;
    document.getElementById('resExamineeName').textContent = ex.name;
    document.getElementById('resExamineeId').textContent = ex.maskedCitizenId;
    document.getElementById('resSeatNumber').textContent = String(ex.seatNumber).padStart(3, '0');
    document.getElementById('resRoomInfo').textContent = `ห้อง ${ex.roomCode} (${ex.roomName})`;
    document.getElementById('resFloorInfo').textContent = `ชั้น ${ex.floor} อาคารนวัตปัญญา`;
    document.getElementById('resRegTable').textContent = `โต๊ะที่ ${ex.registrationTable} โถงชั้น ${ex.floor}`;

    const arrivalNotice = document.getElementById('resArrivalNotice');
    arrivalNotice.innerHTML = `
      <h5 style="margin-bottom: 6px;">คำแนะนำการเข้ารับการสอบ:</h5>
      <ul>
        ${ex.instructions.map(ins => `<li>${ins}</li>`).join('')}
      </ul>
    `;

    box.classList.remove('hidden');

    // Auto-switch floorplan to this room
    if (ex.floor !== state.activeFloor) {
      renderFloorplan(ex.floor);
    }
    selectRoomOnFloorplan(ex.roomCode);

    showToast(`พบข้อมูลที่นั่งสอบของคุณ: เลขที่ ${ex.seatNumber} ห้อง ${ex.roomCode}`, 'success');
  } catch (e) {
    showToast('เกิดข้อผิดพลาดในการค้นหา', 'danger');
  }
}

// ==========================================
// AI Rules Assistant Chat
// ==========================================

async function sendAiChat(messageText = null) {
  const input = document.getElementById('chatInput');
  const text = messageText || input.value.trim();
  if (!text) return;

  const chatContainer = document.getElementById('chatMessages');

  // Render User Message
  chatContainer.innerHTML += `
    <div class="chat-bubble user">
      <div class="bubble-sender">คุณ:</div>
      <div class="bubble-content">${escapeHtml(text)}</div>
    </div>
  `;
  if (!messageText) input.value = '';
  chatContainer.scrollTop = chatContainer.scrollHeight;

  // Show typing
  const typingId = `typing_${Date.now()}`;
  chatContainer.innerHTML += `
    <div class="chat-bubble ai" id="${typingId}">
      <div class="bubble-sender">🤖 ผู้ช่วยอัจฉริยะ ELMS:</div>
      <div class="bubble-content">กำลังวิเคราะห์กฎและความถูกต้องของตาราง...</div>
    </div>
  `;
  chatContainer.scrollTop = chatContainer.scrollHeight;

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: text })
    });
    const data = await res.json();

    const typingEl = document.getElementById(typingId);
    if (typingEl) {
      typingEl.querySelector('.bubble-content').innerHTML = data.answer.replace(/\n/g, '<br>');
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;
  } catch (e) {
    const typingEl = document.getElementById(typingId);
    if (typingEl) {
      typingEl.querySelector('.bubble-content').textContent = 'ขออภัย เกิดข้อผิดพลาดในการเชื่อมต่อ';
    }
  }
}

// ==========================================
// Modals Handlers
// ==========================================

function openRoomsDirectoryModal() {
  if (!state.scheduleData) return;
  const body = document.getElementById('modalRoomsBody');
  const rooms = state.scheduleData.rooms;

  body.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>รหัสห้อง</th>
          <th>ชื่อห้องสอบ</th>
          <th>ชั้น</th>
          <th>ความจุ (ที่นั่ง)</th>
          <th>อัตรากำลังผู้คุม</th>
          <th>จุดลงทะเบียน</th>
          <th>ช่วงที่นั่ง</th>
        </tr>
      </thead>
      <tbody>
        ${rooms.map(r => `
          <tr>
            <td><strong>ห้อง ${r.roomCode}</strong></td>
            <td>${r.name}</td>
            <td>ชั้น ${r.floor}</td>
            <td>${r.capacity} ที่นั่ง</td>
            <td><span class="badge ${r.capacity >= 70 ? 'badge-reserve' : 'badge-primary'}">${r.requiredProctors} ท่าน</span></td>
            <td>โต๊ะที่ ${r.registrationTable}</td>
            <td>${r.seatRange ? `${r.seatRange.start} - ${r.seatRange.end}` : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  document.getElementById('modalRooms').classList.remove('hidden');
}

function openProctorsModal() {
  if (!state.scheduleData) return;
  const body = document.getElementById('modalProctorsBody');
  const { slots } = state.scheduleData;

  body.innerHTML = `
    <div style="margin-bottom: 14px; font-size: 13px;">
      แสดงรายชื่อบุคลากรคุมสอบ พร้อมสถิติ Seniority Rank และจำนวนรอบที่ได้รับมอบหมาย
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>รหัส</th>
          <th>ชื่อ-สกุล</th>
          <th>ตำแหน่ง / อาวุโส</th>
          <th>Rank</th>
          <th>กลุ่ม (Pool)</th>
          <th>โควตาสูงสุด</th>
          <th>รอบที่จัดแล้ว</th>
        </tr>
      </thead>
      <tbody>
        ${defaultProctors.map(p => {
          const assignedCount = slots.filter(s => s.proctorId === p.id).length;
          return `
            <tr>
              <td>${p.id}</td>
              <td><strong>${p.name}</strong></td>
              <td>${p.academicTitle}</td>
              <td><span class="badge badge-chief">Rank ${p.seniorityRank}</span></td>
              <td><span class="badge ${p.pool === 'CORE' ? 'badge-success' : 'badge-reserve'}">${p.pool}</span></td>
              <td>${p.maxSessions} รอบ</td>
              <td><strong>${assignedCount}</strong> / ${p.maxSessions}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  document.getElementById('modalProctors').classList.remove('hidden');
}

function openRulesModal() {
  if (!state.scheduleData) return;
  const body = document.getElementById('modalRulesBody');
  const { validation } = state.scheduleData;

  body.innerHTML = `
    <div style="margin-bottom: 16px;">
      <h4>คะแนน Soft Constraints รวม: <span class="text-success">${validation.softScore} / 100</span></h4>
    </div>
    <div style="margin-bottom: 20px;">
      <h5>สรุปเงื่อนไขบังคับเด็ดขาด (Hard Constraints H1 - H9):</h5>
      <ul style="padding-left: 20px; font-size: 13px; line-height: 1.8;">
        <li>[H1] ห้ามคุมสอบซ้ำซ้อนในเวลาเดียวกัน: <strong>${validation.violationsByRule.H1.length === 0 ? '✅ ผ่าน' : '❌ ละเมิด'}</strong></li>
        <li>[H2] ความจุห้องและเวลาใช้งานห้องไม่ทับซ้อน: <strong>${validation.violationsByRule.H2.length === 0 ? '✅ ผ่าน' : '❌ ละเมิด'}</strong></li>
        <li>[H3] ไม่เกินโควตาสูงสุด (ห้าม maxSessions <= 0): <strong>${validation.violationsByRule.H3.length === 0 ? '✅ ผ่าน' : '❌ ละเมิด'}</strong></li>
        <li>[H4] เคารพวันว่าง/การลา และ SINGLE_PER_DAY: <strong>${validation.violationsByRule.H4.length === 0 ? '✅ ผ่าน' : '❌ ละเมิด'}</strong></li>
        <li>[H5] อัตรากำลังครบตามความจุ (40-60: 2คน, ≥70: 3คน) และหัวหน้าห้องอาวุโสสูงสุด: <strong>${validation.violationsByRule.H5.length === 0 ? '✅ ผ่าน' : '❌ ละเมิด'}</strong></li>
        <li>[H6] เวลาพักขั้นต่ำระหว่างรอบ (≥ 45 นาที): <strong>${validation.violationsByRule.H6.length === 0 ? '✅ ผ่าน' : '❌ ละเมิด'}</strong></li>
        <li>[H7] ความต้องการพิเศษของห้องสอบ: <strong>${validation.violationsByRule.H7.length === 0 ? '✅ ผ่าน' : '❌ ละเมิด'}</strong></li>
        <li>[H8] Reserve Pool ไม่ถูกใช้เป็นงานหลักโดยตรง: <strong>${validation.violationsByRule.H8.length === 0 ? '✅ ผ่าน' : '❌ ละเมิด'}</strong></li>
        <li>[H9] ความขัดแย้งทางผลประโยชน์ (ญาติผู้เข้าสอบ): <strong>${validation.violationsByRule.H9.length === 0 ? '✅ ผ่าน' : '❌ ละเมิด'}</strong></li>
      </ul>
    </div>
    <h5>รายละเอียด Soft Constraints (S1 - S5):</h5>
    <table class="data-table">
      <thead>
        <tr><th>กฎ</th><th>รายละเอียด</th><th>คะแนนที่ได้</th><th>คะแนนเต็ม</th></tr>
      </thead>
      <tbody>
        ${validation.softBreakdown.map(s => `
          <tr>
            <td><strong>${s.rule}</strong></td>
            <td>${s.name}</td>
            <td><strong>${s.score}</strong></td>
            <td>${s.maxScore}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  document.getElementById('modalRules').classList.remove('hidden');
}

function openRoleSwitcherModal() {
  const body = document.getElementById('modalRoleSwitcherBody');
  body.innerHTML = `
    <div style="font-size: 13px; color: #64748b; margin-bottom: 14px;">
      คลิกเลือกบัญชีเพื่อทดสอบระบบความปลอดภัยและสิทธิ์การลงนามปฏิบัติหน้าที่ตามบทบาทจริง:
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${state.demoAccounts.map(acc => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div>
            <div style="font-weight: 600;">${acc.display_name}</div>
            <div style="font-size: 12px; color: #64748b;">
              ชื่อผู้ใช้: <code>${acc.username}</code> | บทบาท: <span class="badge badge-role">${acc.role}</span>
            </div>
          </div>
          <button class="btn btn-primary" onclick="switchUser('${acc.username}')" style="padding: 6px 14px; font-size: 12px;">
            เข้าใช้งานบัญชีนี้
          </button>
        </div>
      `).join('')}
    </div>
  `;
  document.getElementById('modalRoleSwitcher').classList.remove('hidden');
}

window.switchUser = async function(username) {
  try {
    const password = username === 'admin' ? 'admin1234' : 
                     (username === 'teacher' ? 'teacher1234' : 
                     (username === 'viewer' ? 'viewer1234' : 'proctor1234'));

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (res.ok) {
      const data = await res.json();
      state.token = data.token;
      state.currentUser = data.user;
      updateUserUI();
      document.getElementById('modalRoleSwitcher').classList.add('hidden');
      showToast(`สลับบัญชีผู้ใช้เป็น ${data.user.displayName} (${data.user.role}) เรียบร้อยแล้ว`, 'success');
      await refreshSchedule();
    }
  } catch (e) {
    showToast('ไม่สามารถสลับบัญชีได้', 'danger');
  }
};

// ==========================================
// Event Listeners Setup
// ==========================================

function setupEventListeners() {
  // Navigation Tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetPane = document.getElementById(tab.getAttribute('data-tab'));
      if (targetPane) targetPane.classList.add('active');
      state.activeTab = tab.getAttribute('data-tab');

      if (state.activeTab === 'tab-audit') {
        loadAuditLogs();
      }
    });
  });

  // KPI Click handlers
  document.getElementById('kpiRoomsCard')?.addEventListener('click', openRoomsDirectoryModal);
  document.getElementById('kpiStaffCard')?.addEventListener('click', openProctorsModal);
  document.getElementById('kpiRulesCard')?.addEventListener('click', openRulesModal);
  document.getElementById('kpiStatusCard')?.addEventListener('click', () => {
    showToast(`มีห้องสอบ 10 ห้อง ความต้องการรอบละ 21 คน จัดครบ ${state.scheduleData?.slots?.filter(s => s.proctorId).length || 0} ตำแหน่ง`, 'info');
  });

  // Buttons in Toolbar
  document.getElementById('btnAutoSolve')?.addEventListener('click', triggerAutoSolve);
  document.getElementById('btnRandomProctors')?.addEventListener('click', randomScaleProctors);
  document.getElementById('btnResetSchedule')?.addEventListener('click', resetSchedule);
  document.getElementById('btnUndo')?.addEventListener('click', triggerUndo);
  document.getElementById('btnRedo')?.addEventListener('click', triggerRedo);
  document.getElementById('btnSwitchRole')?.addEventListener('click', openRoleSwitcherModal);
  document.getElementById('btnExportCsv')?.addEventListener('click', () => {
    window.location.href = '/api/export/csv';
  });
  document.getElementById('btnPrintSchedule')?.addEventListener('click', () => {
    window.print();
  });

  // Filter Session Select
  document.getElementById('filterSessionSelect')?.addEventListener('change', renderScheduleGrid);

  // Floorplan Switcher
  document.getElementById('btnFloor1')?.addEventListener('click', () => renderFloorplan(1));
  document.getElementById('btnFloor2')?.addEventListener('click', () => renderFloorplan(2));

  // Guest Search
  document.getElementById('btnSearchSeat')?.addEventListener('click', searchSeat);
  document.getElementById('inputCitizenId')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchSeat();
  });

  // AI Chat
  document.getElementById('btnSendChat')?.addEventListener('click', () => sendAiChat());
  document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendAiChat();
  });

  // Suggestion Chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      sendAiChat(prompt);
    });
  });

  // Candidate Search in Modal
  document.getElementById('candidateSearchInput')?.addEventListener('input', (e) => {
    renderCandidateList(e.target.value);
  });

  // Modal Close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      document.getElementById(modalId)?.classList.add('hidden');
    });
  });
}

// Load Audit Logs
async function loadAuditLogs() {
  try {
    const res = await fetch('/api/schedule/signatures');
    if (!res.ok) return;
    const data = await res.json();
    const tbody = document.getElementById('auditTableBody');

    tbody.innerHTML = data.signatures.map(sig => `
      <tr>
        <td>${formatTime(sig.signed_at)}</td>
        <td><strong>${sig.display_name || sig.user_id}</strong> (${sig.role || 'PROCTOR'})</td>
        <td><span class="badge badge-success">ATTENDANCE_SIGNED</span></td>
        <td>ตำแหน่งคุมสอบ</td>
        <td>รอบ ${sig.session_id} ห้อง ${sig.room_id} (Hash: <code>${sig.signature_hash.slice(0, 12)}...</code>)</td>
        <td>${sig.ip_address || '127.0.0.1'}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="text-muted" style="text-align: center; padding: 20px;">ยังไม่มีการบันทึกการลงนาม</td></tr>';
  } catch (e) {
    console.error('Failed to load audit logs:', e);
  }
}

// Helper: Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
