/* ==========================================================================
   09-hard-constraints.js — Hard Constraints Checker (Rules H1 - H9)
   Source: src/rules/hard-constraints.js (lines 6075 to 7036)
   Order: 09 of 26 (Must be loaded in this exact sequence)
   ========================================================================== */

// === Module: src/rules/hard-constraints.js ===
/**
 * ตัวตรวจกฎข้อบังคับเด็ดขาด (Hard Constraints H1 - H8)
 * ตามข้อกำหนด 5: "ห้ามละเมิดเด็ดขาด"
 * ข้อความ error ทุกจุดเป็นภาษาไทยที่เข้าใจง่ายและแนะนำวิธีแก้ไข
 */




/**
 * ตัวตรวจกฎข้อบังคับเด็ดขาด (Hard Constraints H1 - H8)
 * ตามข้อกำหนด 5: "ห้ามละเมิดเด็ดขาด"
 * ข้อความ error ทุกจุดเป็นภาษาไทยที่เข้าใจง่ายและแนะนำวิธีแก้ไข
 */




/**
 * @typedef {Object} RuleViolation
 * @property {string} ruleCode - รหัสกฎ เช่น 'H1', 'H2', ...
 * @property {string} ruleName - ชื่อกฎ
 * @property {string} severity - 'error' | 'warning'
 * @property {string} message - ข้อความอธิบายภาษาไทย
 * @property {string} suggestion - คำแนะนำวิธีแก้ไข
 * @property {Object} details - ข้อมูลที่เกี่ยวข้อง
 */

/**
 * ตรวจสอบกฎ H1: ผู้คุมหนึ่งคนอยู่ได้หนึ่งห้องในช่วงเวลาที่ทับซ้อนกัน โดยนับรวมเวลา prep และ wrap
 * @param {import('../data/models.js').ProctorAssignment[]} assignments
 * @param {Map<string, import('../data/models.js').ExamSession>} sessionMap
 * @param {Map<string, import('../data/models.js').Proctor>} proctorMap
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} settings
 * @returns {RuleViolation[]}
 */
function checkH1_ProctorTimeOverlap(assignments, sessionMap, proctorMap, settings) {
  const violations = [];
  if (!settings.hardConstraints.h1_enforce_no_time_overlap) return violations;

  // จัดกลุ่ม assignment ตาม proctorId
  const byProctor = new Map();
  for (const a of assignments) {
    if (!byProctor.has(a.proctorId)) byProctor.set(a.proctorId, []);
    byProctor.get(a.proctorId).push(a);
  }

  for (const [proctorId, proctorAssigns] of byProctor.entries()) {
    if (proctorAssigns.length <= 1) continue;

    for (let i = 0; i < proctorAssigns.length; i++) {
      for (let j = i + 1; j < proctorAssigns.length; j++) {
        const a1 = proctorAssigns[i];
        const a2 = proctorAssigns[j];

        const s1 = sessionMap.get(a1.sessionId);
        const s2 = sessionMap.get(a2.sessionId);
        if (!s1 || !s2) continue;

        const duty1 = getSessionDutyTime(s1);
        const duty2 = getSessionDutyTime(s2);

        // ตรวจสอบการทับซ้อนของเวลาปฏิบัติงานจริง (รวม prep/wrap)
        if (isOverlapping(duty1.dutyStart, duty1.dutyEnd, duty2.dutyStart, duty2.dutyEnd)) {
          const proctor = proctorMap.get(proctorId);
          const pName = proctor ? `${proctor.firstName} ${proctor.lastName}` : proctorId;

          violations.push({
            ruleCode: 'H1',
            ruleName: 'เวลาปฏิบัติงานทับซ้อนกัน',
            severity: 'error',
            message: `ผู้คุม ${pName} ถูกจัดในรอบ "${s1.name}" (${formatThaiTimeRange(duty1.dutyStart, duty1.dutyEnd)}) และรอบ "${s2.name}" (${formatThaiTimeRange(duty2.dutyStart, duty2.dutyEnd)}) ซึ่งมีเวลาปฏิบัติงานทับซ้อนกัน`,
            suggestion: `กรุณาเปลี่ยนตัวผู้คุมคนใดคนหนึ่งออกจากรอบ "${s1.name}" หรือ "${s2.name}" โดยเลือกผู้คุมคนอื่นที่ว่างในช่วงเวลาดังกล่าว`,
            details: { proctorId, assignmentId1: a1.id, assignmentId2: a2.id, session1: s1.id, session2: s2.id }
          });
        }
      }
    }
  }

  return violations;
}

/**

/**
 * ตรวจสอบกฎ H2: ห้องหนึ่งห้องใช้ได้หนึ่งรอบในช่วงเวลาที่ทับซ้อนกัน และจำนวนผู้เข้าสอบต้องไม่เกินความจุ
 * @param {import('../data/models.js').RoomAllocation[]} allocations
 * @param {Map<string, import('../data/models.js').ExamSession>} sessionMap
 * @param {Map<string, import('../data/models.js').Room>} roomMap
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} settings
 * @returns {RuleViolation[]}
 */
function checkH2_RoomOverlapAndCapacity(allocations, sessionMap, roomMap, settings) {
  const violations = [];
  if (!settings.hardConstraints.h2_enforce_room_capacity_and_overlap) return violations;

  // ตรวจสอบความจุของแต่ละ allocation
  for (const alloc of allocations) {
    const room = roomMap.get(alloc.roomId);
    if (!room) continue;

    if (alloc.examineesInRoom > room.capacity) {
      violations.push({
        ruleCode: 'H2',
        ruleName: 'จำนวนผู้เข้าสอบเกินความจุห้อง',
        severity: 'error',
        message: `ห้อง ${room.name} (${room.building}) มีผู้เข้าสอบ ${alloc.examineesInRoom} คน เกินความจุสูงสุดที่รับได้ (${room.capacity} ที่นั่ง)`,
        suggestion: `กรุณาย้ายผู้เข้าสอบบางส่วนไปห้องอื่น หรือเปลี่ยนไปใช้ห้องที่มีขนาดความจุใหญ่กว่านี้`,
        details: { allocationId: alloc.id, roomId: room.id, examinees: alloc.examineesInRoom, capacity: room.capacity }
      });
    }
  }

  // ตรวจสอบการใช้ห้องซ้อนเวลา
  const byRoom = new Map();
  for (const alloc of allocations) {
    if (!byRoom.has(alloc.roomId)) byRoom.set(alloc.roomId, []);
    byRoom.get(alloc.roomId).push(alloc);
  }

  for (const [roomId, roomAllocs] of byRoom.entries()) {
    if (roomAllocs.length <= 1) continue;

    for (let i = 0; i < roomAllocs.length; i++) {
      for (let j = i + 1; j < roomAllocs.length; j++) {
        const al1 = roomAllocs[i];
        const al2 = roomAllocs[j];
        const s1 = sessionMap.get(al1.sessionId);
        const s2 = sessionMap.get(al2.sessionId);
        if (!s1 || !s2) continue;

        if (isOverlapping(s1.startTime, s1.endTime, s2.startTime, s2.endTime)) {
          const room = roomMap.get(roomId);
          const rName = room ? room.name : roomId;

          violations.push({
            ruleCode: 'H2',
            ruleName: 'ห้องสอบถูกใช้งานซ้อนเวลา',
            severity: 'error',
            message: `ห้อง ${rName} ถูกจัดใช้งานพร้อมกันในรอบ "${s1.name}" และรอบ "${s2.name}"`,
            suggestion: `กรุณาเปลี่ยนห้องสอบของหนึ่งในรอบดังกล่าวเป็นห้องอื่นที่ยังว่าง`,
            details: { roomId, allocation1: al1.id, allocation2: al2.id }
          });
        }
      }
    }
  }

  return violations;
}


/**
 * ตรวจสอบกฎ H3: ไม่เกินโควต้าทุกระดับ (ต่อวัน / ต่อโครงการ / ชั่วโมงสะสม)
 * @param {import('../data/models.js').ProctorAssignment[]} assignments
 * @param {Map<string, import('../data/models.js').ExamSession>} sessionMap
 * @param {Map<string, import('../data/models.js').Proctor>} proctorMap
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} settings
 * @returns {RuleViolation[]}
 */
function checkH3_QuotaLimits(assignments, sessionMap, proctorMap, settings) {
  const violations = [];

  const byProctor = new Map();
  for (const a of assignments) {
    if (!byProctor.has(a.proctorId)) byProctor.set(a.proctorId, []);
    byProctor.get(a.proctorId).push(a);
  }

  for (const [proctorId, proctorAssigns] of byProctor.entries()) {
    const proctor = proctorMap.get(proctorId);
    if (!proctor) continue;

    const dailyLimit = proctor.dailyQuota || settings.hardConstraints.h3_daily_quota_default;
    const projectLimit = proctor.projectQuota !== undefined ? proctor.projectQuota : settings.hardConstraints.h3_project_quota_default;
    const maxHours = proctor.maxHours || settings.hardConstraints.h3_max_hours_default;

    // กฎข้อกำหนด ELMS: กรณีโควต้า <= 0 หรือ null ห้ามจัดลงรอบสอบเด็ดขาด
    if (projectLimit <= 0) {
      violations.push({
        ruleCode: 'H3',
        ruleName: 'ไม่มีโควต้าปฏิบัติงาน',
        severity: 'error',
        message: `ผู้คุม ${proctor.firstName} ${proctor.lastName} มีโควต้า = 0 หรือไม่ประสงค์ปฏิบัติหน้าที่ แต่ถูกจัดลงรอบสอบ`,
        suggestion: `กรุณานำผู้คุมท่านนี้ออกจากตารางสอบเนื่องจากไม่มีโควต้า`,
        details: { proctorId, projectLimit }
      });
    }

    // 1. ตรวจโควต้ารวมทั้งโครงการ
    if (proctorAssigns.length > projectLimit) {
      violations.push({
        ruleCode: 'H3',
        ruleName: 'เกินโควต้าต่อโครงการ',
        severity: 'error',
        message: `ผู้คุม ${proctor.firstName} ${proctor.lastName} ถูกจัดไปแล้ว ${proctorAssigns.length} รอบ ซึ่งเกินโควต้าสูงสุดของโครงการ (${projectLimit} รอบ)`,
        suggestion: `กรุณาลดจำนวนรอบของผู้คุมท่านนี้ลง หรือปรับเพิ่มโควต้าโครงการในหน้าตั้งค่าหากจำเป็น`,
        details: { proctorId, assignedCount: proctorAssigns.length, projectLimit }
      });
    }

    // 2. ตรวจโควต้ารายวันและชั่วโมงรวม
    const byDate = new Map();
    let totalDutyMinutes = 0;

    for (const a of proctorAssigns) {
      const s = sessionMap.get(a.sessionId);
      if (!s) continue;

      // กฎข้อกำหนด ELMS ข้อ 2: เคารพวันที่ระบุสะดวกเฉพาะเจาะจง (Explicit Dates Availability)
      if (settings.hardConstraints.h4_enforce_explicit_dates && proctor.availableDates && proctor.availableDates.length > 0) {
        if (!proctor.availableDates.includes(s.date)) {
          violations.push({
            ruleCode: 'H3',
            ruleName: 'จัดงานในวันที่ไม่ระบุสะดวก',
            severity: 'error',
            message: `ผู้คุม ${proctor.firstName} ${proctor.lastName} ระบุวันสะดวกเฉพาะวันที่ ${proctor.availableDates.join(', ')} แต่ถูกจัดในวันที่ ${formatThaiDate(s.date)}`,
            suggestion: `กรุณาย้ายงานให้ตรงกับวันที่ผู้คุมระบุความพร้อมไว้`,
            details: { proctorId, date: s.date, availableDates: proctor.availableDates }
          });
        }
      }

      const dateStr = s.date;
      if (!byDate.has(dateStr)) byDate.set(dateStr, []);
      byDate.get(dateStr).push(a);

      const duty = getSessionDutyTime(s);
      totalDutyMinutes += duty.durationMinutes;
    }

    // ตรวจแต่ละวัน
    for (const [dateStr, dayAssigns] of byDate.entries()) {
      // กฎข้อกำหนด ELMS ข้อ 3: SINGLE_PER_DAY ห้ามจัดเกิน 1 รอบในวันเดียวกัน
      if (settings.hardConstraints.h4_enforce_session_patterns && proctor.sessionPattern === 'SINGLE_PER_DAY' && dayAssigns.length > 1) {
        violations.push({
          ruleCode: 'H3',
          ruleName: 'ละเมิดเงื่อนไขวันละหนึ่งรอบ (SINGLE_PER_DAY)',
          severity: 'error',
          message: `ผู้คุม ${proctor.firstName} ${proctor.lastName} มีเงื่อนไขปฏิบัติหน้าที่วันละ 1 รอบเท่านั้น แต่ถูกจัด ${dayAssigns.length} รอบในวันที่ ${formatThaiDate(dateStr)}`,
          suggestion: `กรุณาลดภาระงานในวันนี้ให้เหลือ 1 รอบตามความประสงค์`,
          details: { proctorId, date: dateStr, dayCount: dayAssigns.length }
        });
      }

      if (dayAssigns.length > dailyLimit) {
        violations.push({
          ruleCode: 'H3',
          ruleName: 'เกินโควต้าต่อวัน',
          severity: 'error',
          message: `ผู้คุม ${proctor.firstName} ${proctor.lastName} ถูกจัดในวันที่ ${formatThaiDate(dateStr)} จำนวน ${dayAssigns.length} รอบ ซึ่งเกินโควต้าต่อวัน (${dailyLimit} รอบ)`,
          suggestion: `กรุณาย้ายงานในวันที่ ${formatThaiDate(dateStr)} ไปให้ผู้คุมท่านอื่นที่ยังมีโควต้าว่างในวันดังกล่าว`,
          details: { proctorId, date: dateStr, dayCount: dayAssigns.length, dailyLimit }
        });
      }
    }

    // ตรวจชั่วโมงสะสม
    const totalDutyHours = totalDutyMinutes / 60;
    if (totalDutyHours > maxHours) {
      violations.push({
        ruleCode: 'H3',
        ruleName: 'เกินชั่วโมงปฏิบัติงานสูงสุด',
        severity: 'error',
        message: `ผู้คุม ${proctor.firstName} ${proctor.lastName} มีชั่วโมงคุมสอบสะสม ${totalDutyHours.toFixed(1)} ชม. ซึ่งเกินเพดานที่กำหนด (${maxHours} ชม.)`,
        suggestion: `กรุณาสลับรอบสอบบางรอบให้ผู้คุมท่านอื่น เพื่อรักษาสมดุลภาระงานตามเพดานชั่วโมง`,
        details: { proctorId, totalDutyHours, maxHours }
      });
    }
  }

  return violations;
}

/**
 * ตรวจสอบกฎ H4: ไม่จัดคนในช่วง Unavailability
 * @param {import('../data/models.js').ProctorAssignment[]} assignments
 * @param {Map<string, import('../data/models.js').ExamSession>} sessionMap
 * @param {Map<string, import('../data/models.js').Proctor>} proctorMap
 * @param {import('../data/models.js').Unavailability[]} unavailabilities
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} settings
 * @returns {RuleViolation[]}
 */
function checkH4_Unavailability(assignments, sessionMap, proctorMap, unavailabilities, settings) {
  const violations = [];
  if (!settings.hardConstraints.h4_enforce_unavailability) return violations;

  const unavailMap = new Map();
  for (const u of unavailabilities) {
    if (!unavailMap.has(u.proctorId)) unavailMap.set(u.proctorId, []);
    unavailMap.get(u.proctorId).push(u);
  }

  for (const a of assignments) {
    const unavails = unavailMap.get(a.proctorId);
    if (!unavails || unavails.length === 0) continue;

    const session = sessionMap.get(a.sessionId);
    if (!session) continue;
    const duty = getSessionDutyTime(session);

    for (const u of unavails) {
      if (isOverlapping(duty.dutyStart, duty.dutyEnd, u.startTime, u.endTime)) {
        const proctor = proctorMap.get(a.proctorId);
        const pName = proctor ? `${proctor.firstName} ${proctor.lastName}` : a.proctorId;
        const reasonText = u.reason ? ` (เหตุผล: ${u.reason})` : '';

        violations.push({
          ruleCode: 'H4',
          ruleName: 'จัดงานในช่วงที่ผู้คุมแจ้งไม่ว่าง',
          severity: 'error',
          message: `ผู้คุม ${pName} ถูกจัดในรอบ "${session.name}" ซึ่งตรงกับช่วงเวลาที่แจ้งไม่ว่างไว้${reasonText}`,
          suggestion: `กรุณาเปลี่ยนตัวผู้คุมในรอบนี้ เนื่องจากผู้คุมได้แจ้งติดภารกิจล่วงหน้าไว้แล้ว`,
          details: { proctorId: a.proctorId, assignmentId: a.id, unavailabilityId: u.id, sessionId: session.id }
        });
      }
    }
  }

  return violations;
}

/**
 * ตรวจสอบกฎ H9: ผลประโยชน์ทับซ้อนและเครือญาติผู้เข้าสอบ (PDPA / Conflict of Interest)
 * สำหรับ run-tests.js
 */

/**
 * ตรวจสอบกฎ H5: ทุกห้องมีผู้คุมครบตามเกณฑ์ และต้องมีหัวหน้าห้อง 1 คนที่มีระดับ 'chief'
 * @param {import('../data/models.js').RoomAllocation[]} allocations
 * @param {import('../data/models.js').ProctorAssignment[]} assignments
 * @param {Map<string, import('../data/models.js').Proctor>} proctorMap
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} settings
 * @returns {RuleViolation[]}
 */
function checkH5_RequiredProctorsAndChief(allocations, assignments, proctorMap, settings) {
  const violations = [];

  const byAlloc = new Map();
  for (const a of assignments) {
    if (a.role === 'reserve') continue; // ข้ามผู้คุมสำรอง
    if (!byAlloc.has(a.allocationId)) byAlloc.set(a.allocationId, []);
    byAlloc.get(a.allocationId).push(a);
  }

  const threshold3 = settings.hardConstraints.h5_examinee_threshold_for_three_proctors ?? 70;
  const threshold2 = settings.hardConstraints.h5_examinee_threshold_for_two_proctors ?? 30;

  for (const alloc of allocations) {
    const assigned = byAlloc.get(alloc.id) || [];
    const examinees = alloc.examineesInRoom || 0;
    const requiredCount = examinees >= threshold3 ? 3 : (examinees > threshold2 ? 2 : 1);

    // 1. ตรวจจำนวนผู้คุมตามเกณฑ์ความจุห้อง (40-60 ที่นั่ง = 2 คน, 80 ที่นั่ง = 3 คน)
    if (assigned.length < requiredCount) {
      violations.push({
        ruleCode: 'H5',
        ruleName: 'จำนวนผู้คุมไม่ครบตามเกณฑ์',
        severity: 'error',
        message: `ห้องสอบ (รหัส ${alloc.roomId}) มีผู้เข้าสอบ ${examinees} คน ต้องการผู้คุม ${requiredCount} คน (ตามระเบียบศูนย์สอบ 520 ที่นั่ง) แต่ปัจจุบันจัดไว้เพียง ${assigned.length} คน (ขาด ${requiredCount - assigned.length} คน)`,
        suggestion: `กรุณาเพิ่มผู้คุมสอบให้ครบ ${requiredCount} คน โดยเลือกจากผู้คุมที่มีเวลาว่างในรอบนี้`,
        details: { allocationId: alloc.id, roomId: alloc.roomId, required: requiredCount, actual: assigned.length }
      });
    }

    // 2. ตรวจว่าต้องมีหัวหน้าห้อง (chief / academic lead) 1 คน
    if (settings.hardConstraints.h5_require_chief_proctor && assigned.length > 0) {
      const chiefAssignments = assigned.filter(a => {
        const p = proctorMap.get(a.proctorId);
        return p && (p.level === 'chief' || p.proctorType === 'faculty');
      });

      if (chiefAssignments.length === 0) {
        violations.push({
          ruleCode: 'H5',
          ruleName: 'ไม่มีหัวหน้าห้องสอบที่มีคุณสมบัติ',
          severity: 'error',
          message: `ห้องสอบ (รหัส ${alloc.roomId}) ยังไม่มีหัวหน้าห้องสอบที่มีคุณสมบัติ (ต้องเป็นอาจารย์หรือระดับ Chief อย่างน้อย 1 คน)`,
          suggestion: `กรุณากำหนดให้อาจารย์หรือผู้คุมระดับ chief ปฏิบัติหน้าที่หัวหน้าห้อง 1 ท่าน`,
          details: { allocationId: alloc.id, roomId: alloc.roomId }
        });
      }
    }
  }

  return violations;
}

/**
 * ตรวจสอบกฎ H9: ผลประโยชน์ทับซ้อนและเครือญาติผู้เข้าสอบ (PDPA / Conflict of Interest)
 * สำหรับ run-tests.js
 */

/**
 * ตรวจสอบกฎ H6: ผู้คุมที่ทำงานสองรอบติดกันต้องมีเวลาพักอย่างน้อย 30 นาที
 * @param {import('../data/models.js').ProctorAssignment[]} assignments
 * @param {Map<string, import('../data/models.js').ExamSession>} sessionMap
 * @param {Map<string, import('../data/models.js').Proctor>} proctorMap
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} settings
 * @returns {RuleViolation[]}
 */
function checkH6_RestPeriodBetweenSessions(assignments, sessionMap, proctorMap, settings) {
  const violations = [];
  const minRest = settings.hardConstraints.h6_min_rest_minutes_between_sessions;

  const byProctor = new Map();
  for (const a of assignments) {
    if (!byProctor.has(a.proctorId)) byProctor.set(a.proctorId, []);
    byProctor.get(a.proctorId).push(a);
  }

  for (const [proctorId, proctorAssigns] of byProctor.entries()) {
    if (proctorAssigns.length <= 1) continue;

    // ดึงเวลาหน้าที่ของแต่ละ assignment แล้วเรียงตามเวลาเริ่ม
    const duties = proctorAssigns.map(a => {
      const s = sessionMap.get(a.sessionId);
      if (!s) return null;
      return { assign: a, session: s, duty: getSessionDutyTime(s) };
    }).filter(Boolean).sort((x, y) => new Date(x.duty.dutyStart).getTime() - new Date(y.duty.dutyStart).getTime());

    for (let i = 0; i < duties.length - 1; i++) {
      const current = duties[i];
      const next = duties[i + 1];

      // ตรวจสอบเฉพาะในวันเดียวกัน
      if (current.session.date === next.session.date) {
        const restMinutes = diffMinutes(current.duty.dutyEnd, next.duty.dutyStart);

        if (restMinutes >= 0 && restMinutes < minRest) {
          const proctor = proctorMap.get(proctorId);
          const pName = proctor ? `${proctor.firstName} ${proctor.lastName}` : proctorId;

          violations.push({
            ruleCode: 'H6',
            ruleName: 'เวลาพักระหว่างรอบสอบไม่เพียงพอ',
            severity: 'error',
            message: `ผู้คุม ${pName} มีเวลาพักระหว่างรอบ "${current.session.name}" และ "${next.session.name}" เพียง ${restMinutes} นาที (กำหนดขั้นต่ำ ${minRest} นาที)`,
            suggestion: `กรุณาสลับรอบของผู้คุมท่านนี้เพื่อให้มีเวลาพักอย่างน้อย ${minRest} นาที หรือจัดผู้คุมคนอื่นมาแทนในรอบใดรอบหนึ่ง`,
            details: { proctorId, restMinutes, requiredRest: minRest, session1: current.session.id, session2: next.session.id }
          });
        }
      }
    }
  }

  return violations;
}

/**
 * ตรวจสอบกฎ H9: ผลประโยชน์ทับซ้อนและเครือญาติผู้เข้าสอบ (PDPA / Conflict of Interest)
 * สำหรับ run-tests.js
 */


/**
 * ตรวจสอบกฎ H7: ห้องที่มีความต้องการพิเศษ (ผู้พิการ/คอมพิวเตอร์) ต้องจัดห้องที่รองรับ
 * @param {import('../data/models.js').RoomAllocation[]} allocations
 * @param {Map<string, import('../data/models.js').Room>} roomMap
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} settings
 * @returns {RuleViolation[]}
 */
function checkH7_SpecialRoomNeeds(allocations, roomMap, settings) {
  const violations = [];
  if (!settings.hardConstraints.h7_enforce_special_room_needs) return violations;

  const requireAllComputer = settings.hardConstraints.h7_require_all_computer_rooms ?? true;

  for (const alloc of allocations) {
    const room = roomMap.get(alloc.roomId);
    if (!room) continue;

    const needsComputer = requireAllComputer || alloc.specialNeeds === 'computer' || alloc.specialNeeds === 'both';
    if (needsComputer && room.roomType !== 'computer') {
      violations.push({
        ruleCode: 'H7',
        ruleName: 'ห้องสอบไม่ตรงกับความต้องการพิเศษ (คอมพิวเตอร์)',
        severity: 'error',
        message: `การจัดสอบบนระบบคอมพิวเตอร์ (CBT) รอบ ${alloc.sessionId} ต้องการห้องปฏิบัติการคอมพิวเตอร์ แต่ห้อง ${room.name} เป็นห้องเรียนปกติ`,
        suggestion: `กรุณาเปลี่ยนไปจัดในห้องปฏิบัติการคอมพิวเตอร์ที่มีเครื่องพร้อมใช้งาน`,
        details: { allocationId: alloc.id, roomId: room.id, required: 'computer', actual: room.roomType }
      });
    }

    const needsDisabled = alloc.specialNeeds === 'disabled' || alloc.specialNeeds === 'both';
    if (needsDisabled && !room.accessibleForDisabled) {
      violations.push({
        ruleCode: 'H7',
        ruleName: 'ห้องสอบไม่รองรับผู้พิการ',
        severity: 'error',
        message: `การจัดสรรรอบ ${alloc.sessionId} มีผู้สอบที่ต้องการสิ่งอำนวยความสะดวกสำหรับผู้พิการ แต่ห้อง ${room.name} (ชั้น ${room.floor}) ไม่รองรับ`,
        suggestion: `กรุณาเปลี่ยนไปใช้ห้องชั้นล่างหรือห้องที่รองรับทางลาด/ลิฟต์สำหรับคนพิการ`,
        details: { allocationId: alloc.id, roomId: room.id, required: 'disabled_accessible' }
      });
    }
  }

  return violations;
}

/**
 * ตรวจสอบกฎ H9: ผลประโยชน์ทับซ้อนและเครือญาติผู้เข้าสอบ (PDPA / Conflict of Interest)
 * สำหรับ run-tests.js
 */

/**
 * ตรวจสอบกฎ H8: ผู้คุมสำรอง (reserve) ต่อรอบ ต้องไม่ถูกใช้เป็นผู้คุมหลักในรอบเดียวกัน
 * @param {import('../data/models.js').ProctorAssignment[]} assignments
 * @param {Map<string, import('../data/models.js').ExamSession>} sessionMap
 * @param {Map<string, import('../data/models.js').Proctor>} proctorMap
 * @param {typeof import('../data/settings.js').DEFAULT_SETTINGS} settings
 * @returns {RuleViolation[]}
 */
function checkH8_ReserveProctors(assignments, sessionMap, proctorMap, settings) {
  const violations = [];

  const bySession = new Map();
  for (const a of assignments) {
    if (!bySession.has(a.sessionId)) bySession.set(a.sessionId, []);
    bySession.get(a.sessionId).push(a);
  }

  for (const [sessionId, sessionAssigns] of bySession.entries()) {
    const session = sessionMap.get(sessionId);
    const sessionName = session ? session.name : sessionId;

    const mainProctors = new Set();
    const reserveProctors = new Set();

    for (const a of sessionAssigns) {
      if (a.role === 'reserve') {
        reserveProctors.add(a.proctorId);
      } else {
        mainProctors.add(a.proctorId);
      }
    }

    // ตรวจว่ามีคนซ้ำระหว่าง main และ reserve หรือไม่
    for (const rId of reserveProctors) {
      if (mainProctors.has(rId)) {
        const proctor = proctorMap.get(rId);
        const pName = proctor ? `${proctor.firstName} ${proctor.lastName}` : rId;

        violations.push({
          ruleCode: 'H8',
          ruleName: 'ผู้คุมสำรองถูกจัดเป็นผู้คุมหลักในรอบเดียวกัน',
          severity: 'error',
          message: `ผู้คุม ${pName} ถูกจัดเป็นทั้ง "ผู้คุมหลัก" และ "ผู้คุมสำรอง" ในรอบ "${sessionName}"`,
          suggestion: `กรุณาเลือกผู้คุมสำรองคนอื่นที่ไม่ได้คุมห้องใดๆ ในรอบนี้`,
          details: { proctorId: rId, sessionId }
        });
      }
    }
  }

  return violations;
}

/**
 * ตรวจสอบกฎ H9: ผลประโยชน์ทับซ้อนและเครือญาติผู้เข้าสอบ (PDPA / Conflict of Interest)
 * สำหรับ run-tests.js
 */
function checkH9_ConflictOfInterest(assignments, allocations, proctorMap, settings) {
  const violations = [];
  const enforce = settings?.h9_enforce_no_conflict_of_interest || settings?.hardConstraints?.h9_enforce_no_conflict_of_interest;
  if (!enforce) return violations;

  const allocMap = new Map((allocations || []).map(al => [al.id, al]));
  for (const a of assignments) {
    const proctor = proctorMap?.get(a.proctorId);
    if (!proctor || !proctor.conflictExamineeIds || proctor.conflictExamineeIds.length === 0) continue;
    const alloc = allocMap.get(a.allocationId);
    if (!alloc || !alloc.examineeIds) continue;

    for (const cExId of proctor.conflictExamineeIds) {
      if (alloc.examineeIds.includes(cExId)) {
        violations.push({
          ruleCode: 'H9',
          ruleName: 'ผลประโยชน์ทับซ้อน/เครือญาติผู้เข้าสอบ',
          severity: 'error',
          message: `ผู้คุม ${proctor.firstName || a.proctorId} มีความเกี่ยวข้องกับผู้เข้าสอบในห้องเดียวกัน`,
          suggestion: 'ย้ายผู้คุมไปคุมห้องอื่นที่ไม่มีความเกี่ยวข้อง',
          details: { proctorId: a.proctorId, examineeId: cExId }
        });
      }
    }
  }
  return violations;
}

/** แปลงเวลา HH:mm เป็นนาที */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** ตรวจสอบว่าสองรอบสอบมีช่วงเวลาทับซ้อนกันหรือไม่ */
function isSessionOverlapping(s1, s2) {
  if (!s1 || !s2 || s1.date !== s2.date) return false;
  const start1 = timeToMinutes(s1.startTime) - (s1.prepMinutes || 0);
  const end1 = timeToMinutes(s1.endTime) + (s1.wrapMinutes || 0);
  const start2 = timeToMinutes(s2.startTime) - (s2.prepMinutes || 0);
  const end2 = timeToMinutes(s2.endTime) + (s2.wrapMinutes || 0);
  return start1 < end2 && start2 < end1;
}

/** H1: No Overlap สำหรับ rule-checker และ m2 test */
function checkH1NoOverlap(assignments = [], sessions = []) {
  const violations = [];
  const sessionMap = new Map((sessions || []).map(s => [s.id, s]));
  const byProctor = new Map();
  for (const a of assignments) {
    if (!a.proctorId) continue;
    if (!byProctor.has(a.proctorId)) byProctor.set(a.proctorId, []);
    byProctor.get(a.proctorId).push(a);
  }
  for (const [proctorId, pAssigns] of byProctor.entries()) {
    if (pAssigns.length <= 1) continue;
    for (let i = 0; i < pAssigns.length; i++) {
      for (let j = i + 1; j < pAssigns.length; j++) {
        const a1 = pAssigns[i];
        const a2 = pAssigns[j];
        const s1 = sessionMap.get(a1.sessionId);
        const s2 = sessionMap.get(a2.sessionId);
        if (!s1 || !s2) continue;
        if (isSessionOverlapping(s1, s2) || s1.id === s2.id) {
          violations.push({
            rule: 'H1',
            ruleName: 'ห้ามปฏิบัติหน้าที่ในเวลาทับซ้อนกัน',
            proctorId,
            proctorName: a1.proctorName || a2.proctorName || proctorId,
            session1: s1.id,
            session2: s2.id,
            message: `ผู้คุมสอบ ${proctorId} ถูกจัดในรอบสอบที่เวลาทับซ้อนกัน`
          });
        }
      }
    }
  }
  return violations;
}

/** H2: Room Capacity & Overlap */
function checkH2RoomCapacityAndOverlap(assignments = [], sessions = [], rooms = []) {
  const violations = [];
  const sessionMap = new Map((sessions || []).map(s => [s.id, s]));
  const roomSessions = new Map();
  for (const a of assignments) {
    const rId = a.roomCode || a.roomId;
    if (!rId) continue;
    if (!roomSessions.has(rId)) roomSessions.set(rId, new Set());
    roomSessions.get(rId).add(a.sessionId);
  }
  for (const [rId, sessSet] of roomSessions.entries()) {
    const sList = Array.from(sessSet).map(id => sessionMap.get(id)).filter(Boolean);
    for (let i = 0; i < sList.length; i++) {
      for (let j = i + 1; j < sList.length; j++) {
        const s1 = sList[i];
        const s2 = sList[j];
        if (isSessionOverlapping(s1, s2) || s1.id === s2.id) {
          violations.push({
            rule: 'H2',
            ruleName: 'ห้องสอบถูกจัดซ้ำซ้อนในเวลาเดียวกัน',
            roomId: rId,
            roomCode: rId,
            session1: s1.id,
            session2: s2.id,
            message: `ห้องสอบ ${rId} ถูกใช้งานในรอบสอบที่เวลาทับซ้อนกัน`
          });
        }
      }
    }
  }
  return violations;
}

/** H3: Quota Limits */
function checkH3QuotaLimits(assignments = [], proctors = [], sessions = [], quotaSettings = {}) {
  const violations = [];
  const proctorMap = new Map((proctors || []).map(p => [p.id, p]));
  const counts = new Map();
  for (const a of assignments) {
    if (!a.proctorId) continue;
    counts.set(a.proctorId, (counts.get(a.proctorId) || 0) + 1);
  }
  for (const p of proctors || []) {
    if (p.maxSessions <= 0 && counts.has(p.id) && counts.get(p.id) > 0) {
      violations.push({
        rule: 'H3',
        ruleName: 'เกินโควตาสูงสุดที่กำหนด',
        proctorId: p.id,
        message: `ผู้คุม ${p.id} มี maxSessions <= 0 แต่ถูกจัดงาน`
      });
    }
  }
  for (const [pId, count] of counts.entries()) {
    const p = proctorMap.get(pId);
    if (!p) continue;
    const max = p.maxSessions !== undefined ? p.maxSessions : (quotaSettings?.maxSessionsPerExam || 6);
    if (count > max) {
      violations.push({
        rule: 'H3',
        ruleName: 'เกินโควตาสูงสุดที่กำหนด',
        proctorId: pId,
        message: `ผู้คุม ${pId} ถูกจัดเกินโควตาสูงสุด (${count} > ${max})`
      });
    }
  }
  return violations;
}

/** H4: Availability & Pattern */
function checkH4AvailabilityAndPattern(assignments = [], proctors = [], sessions = [], unavailabilities = []) {
  const violations = [];
  const proctorMap = new Map((proctors || []).map(p => [p.id, p]));
  const sessionMap = new Map((sessions || []).map(s => [s.id, s]));
  const unavailSet = new Set((unavailabilities || []).map(u => `${u.proctorId}_${u.date}`));
  const proctorDaySessions = new Map();

  for (const a of assignments) {
    if (!a.proctorId) continue;
    const p = proctorMap.get(a.proctorId);
    const s = sessionMap.get(a.sessionId);
    if (!p || !s) continue;

    if (p.availableDates && p.availableDates.length > 0 && !p.availableDates.includes(s.date)) {
      violations.push({
        rule: 'H4',
        ruleName: 'ผู้คุมไม่สะดวกในวันที่จัดสอบ',
        proctorId: p.id,
        date: s.date,
        message: `ผู้คุม ${p.id} ไม่สะดวกในวันที่ ${s.date}`
      });
    }

    if (unavailSet.has(`${p.id}_${s.date}`)) {
      violations.push({
        rule: 'H4',
        ruleName: 'ผู้คุมติดภารกิจการลา',
        proctorId: p.id,
        date: s.date,
        message: `ผู้คุม ${p.id} มีบันทึกการลาในวันที่ ${s.date}`
      });
    }

    const key = `${p.id}_${s.date}`;
    proctorDaySessions.set(key, (proctorDaySessions.get(key) || 0) + 1);
  }

  for (const [key, count] of proctorDaySessions.entries()) {
    const [pId, date] = key.split('_');
    const p = proctorMap.get(pId);
    if (p && (p.sessionPattern === 'SINGLE_PER_DAY' || p.preferredPattern === 'SINGLE_PER_DAY') && count > 1) {
      violations.push({
        rule: 'H4',
        ruleName: 'ผิดเงื่อนไขความประสงค์รอบสอบต่อวัน (SINGLE_PER_DAY)',
        proctorId: pId,
        date,
        message: `ผู้คุม ${pId} ต้องการคุมวันละ 1 รอบ แต่ถูกจัด ${count} รอบ`
      });
    }
  }

  return violations;
}

/** H5: Room Staffing & Seniority Hierarchy */
function checkH5RoomStaffingAndChiefSeniority(assignments = [], rooms = [], proctors = [], sessions = []) {
  const violations = [];
  const proctorMap = new Map((proctors || []).map(p => [p.id, p]));
  const roomMap = new Map((rooms || []).map(r => [r.id || r.code || r.roomCode, r]));

  const groups = new Map();
  for (const a of assignments) {
    const rKey = a.roomId || a.roomCode;
    const key = `${a.sessionId}_${rKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }

  for (const [key, assigns] of groups.entries()) {
    const [sessId, rKey] = key.split('_');
    const room = roomMap.get(rKey) || rooms.find(r => r.id === rKey || r.roomCode === rKey || r.code === rKey);
    if (!room) continue;

    const capacity = room.capacity || 40;
    const required = capacity >= 70 ? 3 : 2;

    if (assigns.length < required) {
      violations.push({
        rule: 'H5',
        ruleName: 'จำนวนผู้คุมสอบไม่ครบตามเกณฑ์ความจุห้อง',
        roomId: room.id || rKey,
        roomCode: room.roomCode || room.code || rKey,
        sessionId: sessId,
        required,
        assigned: assigns.length,
        message: `ห้อง ${room.roomCode || rKey} ต้องการผู้คุม ${required} คน แต่จัดเพียง ${assigns.length} คน`
      });
    }

    const chiefAssign = assigns.find(a => a.role === 'CHIEF' || a.role === 'chief' || a.order === 1);
    const coAssigns = assigns.filter(a => a !== chiefAssign);

    if (chiefAssign && coAssigns.length > 0) {
      const chiefP = proctorMap.get(chiefAssign.proctorId);
      const chiefRank = chiefP?.seniorityRank ?? chiefP?.seniority ?? 0;

      for (const co of coAssigns) {
        const coP = proctorMap.get(co.proctorId);
        const coRank = coP?.seniorityRank ?? coP?.seniority ?? 0;
        if (chiefRank < coRank) {
          violations.push({
            rule: 'H5',
            ruleName: 'ลำดับอาวุโสหัวหน้าห้องไม่ถูกต้อง',
            roomId: room.id || rKey,
            roomCode: room.roomCode || rKey,
            sessionId: sessId,
            message: `หัวหน้าห้องมีลำดับอาวุโสน้อยกว่ากรรมการร่วม (${chiefRank} < ${coRank})`
          });
        }
      }
    }
  }

  return violations;
}

/** H6: Minimum Rest Break */
function checkH6MinimumRestBreak(assignments = [], sessions = [], quotaSettings = {}) {
  const violations = [];
  const minRest = quotaSettings?.minRestBreakMinutes ?? 45;
  const sessionMap = new Map((sessions || []).map(s => [s.id, s]));

  const byProctor = new Map();
  for (const a of assignments) {
    if (!a.proctorId) continue;
    if (!byProctor.has(a.proctorId)) byProctor.set(a.proctorId, []);
    byProctor.get(a.proctorId).push(a);
  }

  for (const [pId, pAssigns] of byProctor.entries()) {
    if (pAssigns.length <= 1) continue;
    const sessList = pAssigns.map(a => sessionMap.get(a.sessionId)).filter(Boolean);
    sessList.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    for (let i = 0; i < sessList.length - 1; i++) {
      const s1 = sessList[i];
      const s2 = sessList[i + 1];
      if (s1.date !== s2.date) continue;

      const end1 = timeToMinutes(s1.endTime) + (s1.wrapMinutes || 0);
      const start2 = timeToMinutes(s2.startTime) - (s2.prepMinutes || 0);
      const rest = start2 - end1;

      if (rest < minRest) {
        violations.push({
          rule: 'H6',
          ruleName: 'เวลาพักระหว่างรอบสอบน้อยกว่าเกณฑ์ขั้นต่ำ',
          proctorId: pId,
          restMinutes: rest,
          minRequired: minRest,
          message: `ผู้คุม ${pId} มีเวลาพักระหว่างรอบเพียง ${rest} นาที (เกณฑ์ขั้นต่ำ ${minRest} นาที)`
        });
      }
    }
  }

  return violations;
}

/** H7: Special Requirements */
function checkH7SpecialRequirements(assignments = [], sessions = [], rooms = []) {
  const violations = [];
  const sessionMap = new Map((sessions || []).map(s => [s.id, s]));
  const roomMap = new Map((rooms || []).map(r => [r.id || r.code || r.roomCode, r]));

  for (const a of assignments) {
    const s = sessionMap.get(a.sessionId);
    const rKey = a.roomId || a.roomCode;
    const r = roomMap.get(rKey) || rooms.find(x => x.id === rKey || x.roomCode === rKey || x.code === rKey);
    if (!s || !r) continue;

    if (s.requiresAccessibility && !r.isAccessible && !r.hasElevator && !r.specialFeatures?.includes('handicap_accessible')) {
      violations.push({
        rule: 'H7',
        ruleName: 'ห้องสอบไม่รองรับคุณสมบัติพิเศษที่รอบสอบต้องการ',
        sessionId: s.id,
        roomId: r.id || rKey,
        message: `รอบสอบต้องการห้องรองรับผู้พิการ แต่จัดห้อง ${r.roomCode || rKey} ซึ่งไม่รองรับ`
      });
    }
  }

  return violations;
}

/** H8: Reserve Pool Usage Restriction */
function checkH8ReservePoolRestriction(assignments = [], proctors = []) {
  const violations = [];
  const proctorMap = new Map((proctors || []).map(p => [p.id, p]));

  for (const a of assignments) {
    if (!a.proctorId) continue;
    const p = proctorMap.get(a.proctorId);
    if (!p) continue;

    const isReserve = p.poolType === 'RESERVE' || p.isReserve === true || p.pool === 'reserve';
    const isCalled = a.isSubstitute || a.isReserveCalled;

    if (isReserve && !isCalled) {
      violations.push({
        rule: 'H8',
        ruleName: 'ห้ามใช้ผู้คุมสำรองเป็นงานหลักโดยไม่มีการเรียกแทน',
        proctorId: p.id,
        message: `ผู้คุม ${p.id} มาจากกลุ่ม Reserve Pool แต่ถูกจัดเป็นงานหลักโดยไม่มีคำสั่งเรียกแทน`
      });
    }
  }

  return violations;
}

/** H9: Conflict of Interest */
function checkH9ConflictOfInterest(assignments = [], examinees = [], conflicts = [], config = {}) {
  const violations = [];
  if (!config?.enableH9ConflictOfInterest) return violations;

  const conflictSet = new Set((conflicts || []).map(c => `${c.proctorId}_${c.examineeCitizenId || c.examineeId}`));
  const examineeMap = new Map();
  for (const ex of examinees || []) {
    const key = `${ex.sessionId}_${ex.roomCode || ex.roomId}`;
    if (!examineeMap.has(key)) examineeMap.set(key, []);
    examineeMap.get(key).push(ex);
  }

  for (const a of assignments) {
    const key = `${a.sessionId}_${a.roomCode || a.roomId}`;
    const roomExaminees = examineeMap.get(key) || [];
    for (const ex of roomExaminees) {
      const citId = ex.citizenId || ex.id;
      if (conflictSet.has(`${a.proctorId}_${citId}`)) {
        violations.push({
          rule: 'H9',
          ruleName: 'ผลประโยชน์ทับซ้อนและเครือญาติผู้เข้าสอบ',
          proctorId: a.proctorId,
          examineeCitizenId: citId,
          sessionId: a.sessionId,
          message: `ผู้คุม ${a.proctorId} มีความเกี่ยวข้องหรือเป็นเครือญาติกับผู้เข้าสอบในห้องเดียวกัน`
        });
      }
    }
  }

  return violations;
}



