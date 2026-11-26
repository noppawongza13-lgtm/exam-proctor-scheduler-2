/**
 * โมดูลวิเคราะห์ดัชนีความเป็นธรรมและสถิติการกระจายภาระงาน (Jain's Fairness & Workload Distribution Stats)
 */

import { calculateJainsFairnessIndex } from '../rules/soft-constraints.js';

/**
 * คำนวณสถิติภาพรวมของการกระจายภาระงาน
 * @param {Array<number>} loads จำนวนรอบสอบที่แต่ละคนได้รับมอบหมาย
 * @returns {Object} สถิติค่าเฉลี่ย ความแปรปรวน ส่วนเบี่ยงเบนมาตรฐาน และดัชนีความเป็นธรรม
 */
export function calculateWorkloadStatistics(loads = []) {
  if (!loads || loads.length === 0) {
    return {
      count: 0,
      mean: 0,
      variance: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      range: 0,
      jainIndex: 1.0,
      rating: 'EXCELLENT',
      ratingThai: 'ยอดเยี่ยม (กระจายภาระงานเท่าเทียมสมบูรณ์)'
    };
  }

  const n = loads.length;
  const sum = loads.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;

  const sqDiffs = loads.map(v => Math.pow(v - mean, 2));
  const variance = sqDiffs.reduce((acc, v) => acc + v, 0) / n;
  const stdDev = Math.sqrt(variance);

  const min = Math.min(...loads);
  const max = Math.max(...loads);
  const range = max - min;

  const jainIndex = calculateJainsFairnessIndex(loads);

  let rating = 'EXCELLENT';
  let ratingThai = 'ยอดเยี่ยม (กระจายภาระงานเท่าเทียมสมบูรณ์)';

  if (jainIndex < 0.70) {
    rating = 'UNEVEN';
    ratingThai = 'ต้องปรับปรุง (ภาระงานกระจุกตัวอย่างเห็นได้ชัด)';
  } else if (jainIndex < 0.85) {
    rating = 'FAIR';
    ratingThai = 'พอใช้ (มีผู้รับภาระงานมากกว่าเกณฑ์เล็กน้อย)';
  } else if (jainIndex < 0.95) {
    rating = 'GOOD';
    ratingThai = 'ดีมาก (ภาระงานเกือบเท่าเทียมกัน)';
  }

  return {
    count: n,
    totalSessionsAssigned: sum,
    mean: Math.round(mean * 100) / 100,
    variance: Math.round(variance * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    min,
    max,
    range,
    jainIndex: Math.round(jainIndex * 1000) / 1000,
    rating,
    ratingThai
  };
}
