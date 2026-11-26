/**
 * ข้อมูลห้องสอบจริง 10 ห้อง อาคารนวัตปัญญา (อาคาร 17) ศูนย์สอบ มรภ.บุรีรัมย์
 * 
 * ความจุรวม 520 ที่นั่ง อัตรากำลังผู้คุมสอบ 21 ตำแหน่งต่อรอบ
 * อ้างอิงจากตารางมาตรฐาน 2.1 ใน ELMS-RULES-SPECIFICATION และภาพถ่ายป้ายหน้าห้องสอบจริง
 */

import { createRoom } from './schema.js';

export const REAL_EXAM_ROOMS = [
  createRoom({
    id: 'R01',
    roomCode: '17108',
    name: 'วินิตปัญญา 5',
    building: 'อาคารนวัตปัญญา (อาคาร 17)',
    floor: 1,
    capacity: 40,
    seatStart: 1,
    seatEnd: 40,
    registrationDesk: 'โต๊ะที่ 1',
    requiredProctors: 2,
    hasProjector: true,
    hasAirCondition: true,
    hasCCTV: true,
    isAccessible: true,
    rowsLayout: [
      { row: 1, seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      { row: 2, seats: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
      { row: 3, seats: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30] },
      { row: 4, seats: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40] }
    ]
  }),
  createRoom({
    id: 'R02',
    roomCode: '17109',
    name: 'วินิตปัญญา 6',
    building: 'อาคารนวัตปัญญา (อาคาร 17)',
    floor: 1,
    capacity: 60,
    seatStart: 41,
    seatEnd: 100,
    registrationDesk: 'โต๊ะที่ 2',
    requiredProctors: 2,
    hasProjector: true,
    hasAirCondition: true,
    hasCCTV: true,
    isAccessible: true,
    rowsLayout: [
      { row: 1, seats: [41, 42, 43, 44, 45, 46, 47, 48, 49, 50] },
      { row: 2, seats: [51, 52, 53, 54, 55, 56, 57, 58, 59, 60] },
      { row: 3, seats: [61, 62, 63, 64, 65, 66, 67, 68, 69, 70] },
      { row: 4, seats: [71, 72, 73, 74, 75, 76, 77, 78, 79, 80] },
      { row: 5, seats: [81, 82, 83, 84, 85, 86, 87, 88, 89, 90] },
      { row: 6, seats: [91, 92, 93, 94, 95, 96, 97, 98, 99, 100] }
    ]
  }),
  createRoom({
    id: 'R03',
    roomCode: '17110',
    name: 'วินิตปัญญา 7',
    building: 'อาคารนวัตปัญญา (อาคาร 17)',
    floor: 1,
    capacity: 60,
    seatStart: 101,
    seatEnd: 160,
    registrationDesk: 'โต๊ะที่ 3',
    requiredProctors: 2,
    hasProjector: true,
    hasAirCondition: true,
    hasCCTV: true,
    isAccessible: true,
    rowsLayout: [
      { row: 1, seats: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110] },
      { row: 2, seats: [111, 112, 113, 114, 115, 116, 117, 118, 119, 120] },
      { row: 3, seats: [121, 122, 123, 124, 125, 126, 127, 128, 129, 130] },
      { row: 4, seats: [131, 132, 133, 134, 135, 136, 137, 138, 139, 140] },
      { row: 5, seats: [141, 142, 143, 144, 145, 146, 147, 148, 149, 150] },
      { row: 6, seats: [151, 152, 153, 154, 155, 156, 157, 158, 159, 160] }
    ]
  }),
  createRoom({
    id: 'R04',
    roomCode: '17111',
    name: 'วินิตปัญญา 8',
    building: 'อาคารนวัตปัญญา (อาคาร 17)',
    floor: 1,
    capacity: 50,
    seatStart: 161,
    seatEnd: 210,
    registrationDesk: 'โต๊ะที่ 4',
    requiredProctors: 2,
    hasProjector: true,
    hasAirCondition: true,
    hasCCTV: true,
    isAccessible: true,
    rowsLayout: [
      { row: 1, seats: [161, 162, 163, 164, 165, 166, 167, 168, 169, 170] },
      { row: 2, seats: [171, 172, 173, 174, 175, 176, 177, 178, 179, 180] },
      { row: 3, seats: [181, 182, 183, 184, 185, 186, 187, 188, 189, 190] },
      { row: 4, seats: [191, 192, 193, 194, 195, 196, 197, 198, 199, 200] },
      { row: 5, seats: [201, 202, 203, 204, 205, 206, 207, 208, 209, 210] }
    ]
  }),
  createRoom({
    id: 'R05',
    roomCode: '17201',
    name: 'ห้องประชุมหงส์พันธ์',
    building: 'อาคารนวัตปัญญา (อาคาร 17)',
    floor: 2,
    capacity: 80, // ห้องขนาดใหญ่ >= 70 ที่นั่ง ต้องใช้ผู้คุม 3 คน
    seatStart: 211,
    seatEnd: 290,
    registrationDesk: 'โต๊ะที่ 5',
    requiredProctors: 3,
    hasProjector: true,
    hasAirCondition: true,
    hasCCTV: true,
    isAccessible: true,
    rowsLayout: [
      { row: 1, seats: [211, 212, 213, 214, 215, 216, 217, 218, 219, 220] },
      { row: 2, seats: [221, 222, 223, 224, 225, 226, 227, 228, 229, 230] },
      { row: 3, seats: [231, 232, 233, 234, 235, 236, 237, 238, 239, 240] },
      { row: 4, seats: [241, 242, 243, 244, 245, 246, 247, 248, 249, 250] },
      { row: 5, seats: [251, 252, 253, 254, 255, 256, 257, 258, 259, 260] },
      { row: 6, seats: [261, 262, 263, 264, 265, 266, 267, 268, 269, 270] },
      { row: 7, seats: [271, 272, 273, 274, 275, 276, 277, 278, 279, 280] },
      { row: 8, seats: [281, 282, 283, 284, 285, 286, 287, 288, 289, 290] }
    ]
  }),
  createRoom({
    id: 'R06',
    roomCode: '17205',
    name: 'สุตปัญญา',
    building: 'อาคารนวัตปัญญา (อาคาร 17)',
    floor: 2,
    capacity: 40,
    seatStart: 291,
    seatEnd: 330,
    registrationDesk: 'โต๊ะที่ 6',
    requiredProctors: 2,
    hasProjector: true,
    hasAirCondition: true,
    hasCCTV: true,
    isAccessible: true,
    rowsLayout: [
      { row: 1, seats: [291, 292, 293, 294, 295, 296, 297, 298, 299, 300] },
      { row: 2, seats: [301, 302, 303, 304, 305, 306, 307, 308, 309, 310] },
      { row: 3, seats: [311, 312, 313, 314, 315, 316, 317, 318, 319, 320] },
      { row: 4, seats: [321, 322, 323, 324, 325, 326, 327, 328, 329, 330] }
    ]
  }),
  createRoom({
    id: 'R07',
    roomCode: '17206',
    name: 'ห้องประชุมวงษ์แก้ว',
    building: 'อาคารนวัตปัญญา (อาคาร 17)',
    floor: 2,
    capacity: 40,
    seatStart: 331,
    seatEnd: 370,
    registrationDesk: 'โต๊ะที่ 7',
    requiredProctors: 2,
    hasProjector: true,
    hasAirCondition: true,
    hasCCTV: true,
    isAccessible: true,
    rowsLayout: [
      { row: 1, seats: [331, 332, 333, 334, 335, 336, 337, 338, 339, 340] },
      { row: 2, seats: [341, 342, 343, 344, 345, 346, 347, 348, 349, 350] },
      { row: 3, seats: [351, 352, 353, 354, 355, 356, 357, 358, 359, 360] },
      { row: 4, seats: [361, 362, 363, 364, 365, 366, 367, 368, 369, 370] }
    ]
  }),
  createRoom({
    id: 'R08',
    roomCode: '17211',
    name: 'จิตตปัญญา 1',
    building: 'อาคารนวัตปัญญา (อาคาร 17)',
    floor: 2,
    capacity: 50,
    seatStart: 371,
    seatEnd: 420,
    registrationDesk: 'โต๊ะที่ 8',
    requiredProctors: 2,
    hasProjector: true,
    hasAirCondition: true,
    hasCCTV: true,
    isAccessible: true,
    rowsLayout: [
      { row: 1, seats: [371, 372, 373, 374, 375, 376, 377, 378, 379, 380] },
      { row: 2, seats: [381, 382, 383, 384, 385, 386, 387, 388, 389, 390] },
      { row: 3, seats: [391, 392, 393, 394, 395, 396, 397, 398, 399, 400] },
      { row: 4, seats: [401, 402, 403, 404, 405, 406, 407, 408, 409, 410] },
      { row: 5, seats: [411, 412, 413, 414, 415, 416, 417, 418, 419, 420] }
    ]
  }),
  createRoom({
    id: 'R09',
    roomCode: '17212',
    name: 'จิตตปัญญา 2',
    building: 'อาคารนวัตปัญญา (อาคาร 17)',
    floor: 2,
    capacity: 52,
    seatStart: 421,
    seatEnd: 472,
    registrationDesk: 'โต๊ะที่ 9',
    requiredProctors: 2,
    hasProjector: true,
    hasAirCondition: true,
    hasCCTV: true,
    isAccessible: true,
    rowsLayout: [
      { row: 1, seats: [421, 422, 423, 424, 425, 426, 427, 428, 429] },
      { row: 2, seats: [430, 431, 432, 433, 434, 435, 436, 437, 438] },
      { row: 3, seats: [439, 440, 441, 442, 443, 444, 445, 446] },
      { row: 4, seats: [447, 448, 449, 450, 451, 452, 453, 454] },
      { row: 5, seats: [455, 456, 457, 458, 459, 460, 461, 462, 463] },
      { row: 6, seats: [464, 465, 466, 467, 468, 469, 470, 471, 472] }
    ]
  }),
  createRoom({
    id: 'R10',
    roomCode: '17213',
    name: 'จิตตปัญญา 3',
    building: 'อาคารนวัตปัญญา (อาคาร 17)',
    floor: 2,
    capacity: 48,
    seatStart: 473,
    seatEnd: 520,
    registrationDesk: 'โต๊ะที่ 10',
    requiredProctors: 2,
    hasProjector: true,
    hasAirCondition: true,
    hasCCTV: true,
    isAccessible: true,
    rowsLayout: [
      { row: 1, seats: [473, 474, 475, 476, 477, 478, 479, 480] },
      { row: 2, seats: [481, 482, 483, 484, 485, 486, 487, 488] },
      { row: 3, seats: [489, 490, 491, 492, 493, 494, 495, 496] },
      { row: 4, seats: [497, 498, 499, 500, 501, 502, 503, 504] },
      { row: 5, seats: [505, 506, 507, 508, 509, 510, 511, 512] },
      { row: 6, seats: [513, 514, 515, 516, 517, 518, 519, 520] }
    ]
  })
];

/**
 * ดึงห้องสอบตามรหัสห้อง (เช่น '17108' หรือ 'R01')
 * @param {string} codeOrId 
 * @returns {Object|undefined}
 */
export function getExamRoom(codeOrId) {
  return REAL_EXAM_ROOMS.find(r => r.roomCode === codeOrId || r.id === codeOrId);
}

/**
 * คำนวณความจุรวมและผู้คุมที่ต้องมีทั้งหมด
 */
export const ROOM_SUMMARY = {
  totalRooms: REAL_EXAM_ROOMS.length,
  totalCapacity: REAL_EXAM_ROOMS.reduce((sum, r) => sum + r.capacity, 0),
  totalRequiredProctors: REAL_EXAM_ROOMS.reduce((sum, r) => sum + r.requiredProctors, 0)
};
