/**
 * สารบบห้องและสถานที่ อาคารนวัตปัญญา (อาคาร 17) มหาวิทยาลัยราชภัฏบุรีรัมย์
 * (Building 17 Official Directory)
 * 
 * คัดลอกจากภาพถ่ายป้าย Directory จริง ชั้น 1 (17101 - 17113) และ ชั้น 2 (17201 - 17214)
 */

export const BUILDING_17_DIRECTORY = {
  floor1: [
    { code: '17101', name: 'นิทัศนปัญญา', type: 'hall', isExamRoom: false, desc: 'ห้องจัดแสดงและนิทรรศการ' },
    { code: '17102', name: 'นันทนปัญญา 1', type: 'service', isExamRoom: false, desc: 'ห้องกิจกรรมและสันทนาการ 1' },
    { code: '17103', name: 'นันทนปัญญา 2', type: 'service', isExamRoom: false, desc: 'ห้องกิจกรรมและสันทนาการ 2' },
    { code: '17104', name: 'วินิตปัญญา 1', type: 'lab', isExamRoom: false, desc: 'ห้องปฏิบัติการคอมพิวเตอร์ 1' },
    { code: '17105', name: 'วินิตปัญญา 2', type: 'lab', isExamRoom: false, desc: 'ห้องปฏิบัติการคอมพิวเตอร์ 2' },
    { code: '17106', name: 'วินิตปัญญา 3', type: 'lab', isExamRoom: false, desc: 'ห้องปฏิบัติการคอมพิวเตอร์ 3' },
    { code: '17107', name: 'วินิตปัญญา 4', type: 'lab', isExamRoom: false, desc: 'ห้องปฏิบัติการคอมพิวเตอร์ 4' },
    { code: '17108', name: 'วินิตปัญญา 5', type: 'exam', isExamRoom: true, examRoomNumber: 1, capacity: 40, desc: 'ห้องสอบ CBT ที่ 1 (40 ที่นั่ง)' },
    { code: '17109', name: 'วินิตปัญญา 6', type: 'exam', isExamRoom: true, examRoomNumber: 2, capacity: 60, desc: 'ห้องสอบ CBT ที่ 2 (60 ที่นั่ง)' },
    { code: '17110', name: 'วินิตปัญญา 7', type: 'exam', isExamRoom: true, examRoomNumber: 3, capacity: 60, desc: 'ห้องสอบ CBT ที่ 3 (60 ที่นั่ง)' },
    { code: '17111', name: 'วินิตปัญญา 8', type: 'exam', isExamRoom: true, examRoomNumber: 4, capacity: 50, desc: 'ห้องสอบ CBT ที่ 4 (50 ที่นั่ง)' },
    { code: '17112', name: 'ห้องน้ำคนพิการ', type: 'facility', isExamRoom: false, desc: 'ห้องสุขาสำหรับผู้พิการและผู้สูงอายุ' },
    { code: '17113', name: 'งานเทคนิคอาคาร', type: 'technical', isExamRoom: false, desc: 'ห้องควบคุมระบบวิศวกรรมและเทคนิคอาคาร' }
  ],
  floor2: [
    { code: '17201', name: 'ห้องประชุมหงส์พันธ์', type: 'exam', isExamRoom: true, examRoomNumber: 5, capacity: 80, desc: 'ห้องสอบ CBT ที่ 5 (80 ที่นั่ง ผู้คุม 3 คน)' },
    { code: '17202', name: 'ห้องประชุมเจริญพันธุวงศ์', type: 'meeting', isExamRoom: false, desc: 'ห้องประชุมวิชาการ' },
    { code: '17203', name: 'ห้องประชุมลักษณะงาม', type: 'meeting', isExamRoom: false, desc: 'ห้องประชุมและสัมมนา' },
    { code: '17204', name: 'ห้องควบคุม', type: 'control', isExamRoom: false, desc: 'ห้องควบคุมระบบโสตทัศนูปกรณ์และเซิร์ฟเวอร์' },
    { code: '17205', name: 'สุตปัญญา', type: 'exam', isExamRoom: true, examRoomNumber: 6, capacity: 40, desc: 'ห้องสอบ CBT ที่ 6 (40 ที่นั่ง)' },
    { code: '17206', name: 'ห้องประชุมวงษ์แก้ว', type: 'exam', isExamRoom: true, examRoomNumber: 7, capacity: 40, desc: 'ห้องสอบ CBT ที่ 7 (40 ที่นั่ง)' },
    { code: '17207', name: 'ห้องประชุมเชื่อมกลาง', type: 'auditorium', isExamRoom: false, desc: 'หอประชุมใหญ่และเวทีกลาง' },
    { code: '17208', name: 'ห้องแต่งตัวหญิง', type: 'facility', isExamRoom: false, desc: 'ห้องพักและแต่งตัวหญิง' },
    { code: '17209', name: 'ห้องแต่งตัวชาย', type: 'facility', isExamRoom: false, desc: 'ห้องพักและแต่งตัวชาย' },
    { code: '17210', name: 'ห้องรับรอง', type: 'vip', isExamRoom: false, desc: 'ห้องรับรองแขกผู้มีเกียรติและกรรมการ' },
    { code: '17211', name: 'จิตตปัญญา 1', type: 'exam', isExamRoom: true, examRoomNumber: 8, capacity: 50, desc: 'ห้องสอบ CBT ที่ 8 (50 ที่นั่ง)' },
    { code: '17212', name: 'จิตตปัญญา 2', type: 'exam', isExamRoom: true, examRoomNumber: 9, capacity: 52, desc: 'ห้องสอบ CBT ที่ 9 (52 ที่นั่ง)' },
    { code: '17213', name: 'จิตตปัญญา 3', type: 'exam', isExamRoom: true, examRoomNumber: 10, capacity: 48, desc: 'ห้องสอบ CBT ที่ 10 (48 ที่นั่ง)' },
    { code: '17214', name: 'ห้องน้ำคนพิการ', type: 'facility', isExamRoom: false, desc: 'ห้องสุขาสำหรับผู้พิการและผู้สูงอายุ ชั้น 2' }
  ]
};

/**
 * ดึงรายการห้องตามชั้น
 * @param {number} floor ชั้น 1 หรือ 2
 * @returns {Array}
 */
export function getDirectoryByFloor(floor) {
  return floor === 1 ? BUILDING_17_DIRECTORY.floor1 : BUILDING_17_DIRECTORY.floor2;
}
