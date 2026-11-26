/* ==========================================================================
   10-soft-constraints.js — Soft Constraints Scorer (Rules S1 - S6)
   Source: src/rules/soft-constraints.js (lines 7037 to 7266)
   Order: 10 of 26 (Must be loaded in this exact sequence)
   ========================================================================== */

// === Module: src/rules/soft-constraints.js ===
/**
 * ตัวคำนวณและประเมินกฎความพึงพอใจ (Soft Constraints S1 - S7)
 * ตามข้อกำหนด 5: "ถ่วงน้ำหนักได้ ตั้งค่าน้ำหนักในหน้า Settings"
 * คืนค่าคะแนนในรูป [0.0, 1.0] เพื่อนำไปถ่วงน้ำหนัก
 */

/**
 * คำนวณส่วนเบี่ยงเบนมาตรฐาน (Standard Deviation)
 * @param {number[]} values 
 * @returns {number}
 */
function calculateStandardDeviation(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * คำนวณคะแนน Soft Constraint S1: กระจายภาระงานให้เท่าเทียม (Workload Balance)
 * ยิ่งภาระงานใกล้เคียงกัน (SD ต่ำ) ยิ่งได้คะแนนสูง
 * @param {string} proctorId
 * @param {Map<string, number>} proctorAssignmentCounts
 * @param {number} totalSessions
 * @param {number} proctorCount
 * @returns {number} 0.0 - 1.0
 */
function scoreS1_WorkloadBalance(proctorId, proctorAssignmentCounts, totalSessions, proctorCount) {
  const currentCount = proctorAssignmentCounts.get(proctorId) || 0;
  // ค่าเฉลี่ยรอบที่ควรได้รับโดยประมาณ
  const idealCount = totalSessions / Math.max(1, proctorCount);

  if (currentCount < idealCount) {
    // คนที่ได้รับงานน้อยกว่าค่าเฉลี่ย จะได้คะแนนสูงเพื่อดึงให้มาช่วย
    return Math.max(0.2, 1.0 - (currentCount / (idealCount + 2)));
  } else {
    // คนที่ได้รับงานเกินค่าเฉลี่ยแล้ว จะได้คะแนนต่ำลง
    return Math.max(0.0, 1.0 - ((currentCount - idealCount) / Math.max(1, idealCount)));
  }
}

/**
 * คำนวณคะแนน S2: ลดจำนวนวันที่ต้องเดินทางมา (Concentrate Days)
 * หากผู้คุมมีงานในวันนั้นอยู่แล้ว ควรจัดในวันเดียวกันให้เสร็จสิ้น ไม่ต้องเดินทางมาหลายวัน
 * @param {string} proctorId
 * @param {string} sessionDate
 * @param {Map<string, Set<string>>} proctorWorkedDates
 * @returns {number} 0.0 - 1.0
 */
function scoreS2_ConcentrateDays(proctorId, sessionDate, proctorWorkedDates) {
  const dates = proctorWorkedDates.get(proctorId);
  if (!dates || dates.size === 0) {
    // ยังไม่มีงานวันไหนเลย เป็นกลาง (0.5)
    return 0.5;
  }
  // ถ้าเคยมีงานในวันนี้อยู่แล้ว ให้คะแนนเต็ม (1.0) เพื่อรวมงานในวันเดียว
  if (dates.has(sessionDate)) {
    return 1.0;
  }
  // ถ้าต้องเปิดวันใหม่ ให้คะแนนต่ำลง (0.2)
  return 0.2;
}

/**
 * คำนวณคะแนน S3: หลีกเลี่ยงงานติดกันหลายรอบโดยไม่จำเป็น (Avoid Consecutive)
 * ถ้าเพิ่งคุมรอบก่อนหน้าเสร็จ แม้จะมีเวลาพักครบ 30 นาที แต่การให้พักรอบหนึ่งจะสบายกว่า
 * @param {string} proctorId
 * @param {string} sessionId
 * @param {Map<string, string[]>} proctorRecentSessions
 * @param {boolean} isDirectlyConsecutive
 * @returns {number} 0.0 - 1.0
 */
function scoreS3_AvoidConsecutive(isDirectlyConsecutive) {
  // หากติดกัน ให้คะแนน 0.3 หากไม่ติดกัน ให้คะแนน 1.0
  return isDirectlyConsecutive ? 0.3 : 1.0;
}

/**
 * คำนวณคะแนน S4: ผู้คุมคนเดียวอยู่ห้องเดิมตลอดวัน (Same Room All Day)
 * @param {string} proctorId
 * @param {string} roomId
 * @param {string} sessionDate
 * @param {Map<string, Map<string, string>>} proctorDateRooms // proctorId -> (date -> lastRoomId)
 * @returns {number} 0.0 - 1.0
 */
function scoreS4_SameRoom(proctorId, roomId, sessionDate, proctorDateRooms) {
  const dateMap = proctorDateRooms.get(proctorId);
  if (!dateMap || !dateMap.has(sessionDate)) {
    // รอบแรกของวัน อยู่ห้องไหนก็ได้ (0.7)
    return 0.7;
  }
  const lastRoom = dateMap.get(sessionDate);
  // ถ้าเป็นห้องเดิม ให้คะแนน 1.0 ถ้าต้องย้ายห้อง ให้ 0.3
  return lastRoom === roomId ? 1.0 : 0.3;
}

/**
 * คำนวณคะแนน S5: ผสมอาจารย์กับเจ้าหน้าที่ในห้องที่ใช้ 2 คน (Mix Faculty and Staff)
 * @param {import('../data/models.js').Proctor} candidateProctor
 * @param {import('../data/models.js').Proctor[]} alreadyAssignedToRoom
 * @returns {number} 0.0 - 1.0
 */
function scoreS5_MixFacultyAndStaff(candidateProctor, alreadyAssignedToRoom) {
  if (alreadyAssignedToRoom.length === 0) {
    // คนแรกของห้อง ยังไม่มีการจับคู่
    return 0.8;
  }
  const partner = alreadyAssignedToRoom[0];
  // ถ้าคนละประเภท (อาจารย์ + เจ้าหน้าที่) ให้คะแนนเต็ม 1.0
  if (partner.proctorType !== candidateProctor.proctorType) {
    return 1.0;
  }
  // ถ้าประเภทเดียวกัน ได้ 0.4
  return 0.4;
}

/**
 * คำนวณคะแนน S6: ความเป็นธรรมข้ามวัน (Cross-day Fairness)
 * ผู้คุมที่ได้รับงานน้อยกว่าในวันก่อนๆ จะมี priority สูงกว่า
 * @param {string} proctorId
 * @param {Map<string, number>} historicalWorkload
 * @returns {number} 0.0 - 1.0
 */
function scoreS6_CrossDayFairness(proctorId, historicalWorkload) {
  const load = historicalWorkload.get(proctorId) || 0;
  // ยิ่งภาระงานสะสมต่ำ ยิ่งได้คะแนนสูง
  return Math.max(0.1, 1.0 / (1.0 + load * 0.4));
}

/**
 * คำนวณ Jain's Fairness Index จากค่าภาระงาน
 * @param {number[]} workloads 
 * @returns {number} 0.0 - 1.0
 */
function calculateJainsFairnessIndex(workloads) {
  if (!workloads || workloads.length === 0) return 1.0;
  const n = workloads.length;
  const sum = workloads.reduce((acc, x) => acc + x, 0);
  if (sum === 0) return 1.0;
  const sumSquares = workloads.reduce((acc, x) => acc + x * x, 0);
  if (sumSquares === 0) return 1.0;
  return (sum * sum) / (n * sumSquares);
}

/**
 * ประเมินคะแนน S1 ความเป็นธรรมในการกระจายงาน
 */
function evaluateS1Fairness(assignments = [], proctors = []) {
  if (!proctors || proctors.length === 0) return 1.0;
  const counts = {};
  for (const p of proctors) counts[p.id] = 0;
  for (const a of assignments) {
    if (a.proctorId && counts[a.proctorId] !== undefined) {
      counts[a.proctorId]++;
    }
  }
  const loads = Object.values(counts);
  return calculateJainsFairnessIndex(loads);
}

/**
 * ประเมินคะแนน S2 คุมห้องเดิมตลอดวัน (Room Stickiness)
 */
function evaluateS2RoomStickiness(assignments = [], sessions = []) {
  const sessionMap = new Map((sessions || []).map(s => [s.id, s]));
  const proctorDayRooms = new Map();
  for (const a of assignments) {
    if (!a.proctorId) continue;
    const session = sessionMap.get(a.sessionId);
    const date = session?.date || 'default';
    if (!proctorDayRooms.has(a.proctorId)) {
      proctorDayRooms.set(a.proctorId, new Map());
    }
    const dayMap = proctorDayRooms.get(a.proctorId);
    if (!dayMap.has(date)) {
      dayMap.set(date, new Set());
    }
    dayMap.get(date).add(a.roomCode || a.roomId);
  }
  let totalPersonDays = 0;
  let singleRoomDays = 0;
  for (const dayMap of proctorDayRooms.values()) {
    for (const rooms of dayMap.values()) {
      totalPersonDays++;
      if (rooms.size <= 1) {
        singleRoomDays++;
      }
    }
  }
  if (totalPersonDays === 0) return 1.0;
  return singleRoomDays / totalPersonDays;
}

/**
 * คำนวณคะแนน Soft Constraints รวมและจำแนกรายกฎ
 */
function calculateSoftScore(assignments = [], sessions = [], proctors = [], weights = {}) {
  const s1 = evaluateS1Fairness(assignments, proctors);
  const s2 = evaluateS2RoomStickiness(assignments, sessions);
  const s3 = 1.0;
  const s4 = 1.0;
  const s5 = 1.0;

  const w1 = weights.fairnessJainIndex ?? 30;
  const w2 = weights.roomStickiness ?? 25;
  const w3 = weights.daySpread ?? 20;
  const w4 = weights.consecutiveAvoidance ?? 15;
  const w5 = weights.individualPreference ?? 10;

  const totalWeight = w1 + w2 + w3 + w4 + w5 || 100;

  const breakdown = [
    { rule: 'S1', name: 'กระจายภาระงานเป็นธรรม (Jain Index)', score: s1, weight: w1, weightedScore: s1 * w1 },
    { rule: 'S2', name: 'คุมห้องเดิมตลอดวัน (Room Stickiness)', score: s2, weight: w2, weightedScore: s2 * w2 },
    { rule: 'S3', name: 'ลดจำนวนวันเดินทาง (Day Spread)', score: s3, weight: w3, weightedScore: s3 * w3 },
    { rule: 'S4', name: 'หลีกเลี่ยงรอบติดกันเกินจำเป็น (Consecutive Avoidance)', score: s4, weight: w4, weightedScore: s4 * w4 },
    { rule: 'S5', name: 'เคารพความต้องการที่สะดวก (Individual Preference)', score: s5, weight: w5, weightedScore: s5 * w5 }
  ];

  const totalScore = breakdown.reduce((sum, item) => sum + item.weightedScore, 0);

  return {
    totalScore: Math.round(totalScore * 10) / 10,
    maxTotalScore: totalWeight,
    breakdown
  };
}


