const fs = require('fs');
const bundle = fs.readFileSync('bundle.js', 'utf8');

const mockStorage = {
  EXAM_PROCTOR_SCHEDULER_V1: JSON.stringify({
    rooms: [{ roomCode: '17108', officialName: 'วินิตปัญญา 5', capacity: 40 }],
    proctors: [{ id: 'P001', firstName: 'เลอสันต์', lastName: 'ฤทธิขันธ์', proctorType: 'faculty' }],
    sessions: [
      { id: 's1', name: 'รอบ 1', date: '2026-03-27' },
      { id: 's2', name: 'รอบ 2', date: '2026-03-27' },
      { id: 's3', name: 'รอบ 3', date: '2026-03-28' },
      { id: 's4', name: 'รอบ 4', date: '2026-03-28' },
      { id: 's5', name: 'รอบ 5', date: '2026-03-29' },
      { id: 's6', name: 'รอบ 6', date: '2026-03-29' }
    ],
    examinees: [
      { id: '69011234001', firstName: 'สมชาย', lastName: 'ใจดี', faculty: 'คณะวิทยาศาสตร์', major: 'วิทยาการคอม' },
      { id: '69011234002', firstName: 'สมหญิง', lastName: 'รักเรียน', faculty: 'คณะครุศาสตร์', major: 'คณิตศาสตร์' }
    ]
  })
};

global.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = v; }
};

global.document = {
  getElementById: () => null,
  addEventListener: () => {}
};
global.window = global;

eval(bundle);
console.log('appState examinees after load:');
console.log(appState.examinees.map(e => ({ id: e.id, faculty: e.faculty, major: e.major })));
