# Implementation Plan: ระบบจัดตารางคุมสอบและจัดห้องสอบ (ELMS Proctor Scheduling & CBT Center Management System)

**หน่วยงาน:** ศูนย์สอบมหาวิทยาลัยราชภัฏบุรีรัมย์ อาคารนวัตปัญญา (อาคาร 17)  
**ผู้ออกแบบ:** Senior Software Engineer (Scheduling / Constraint Optimization & Security)  
**วันที่จัดทำ:** 27 ตุลาคม 2569  
**สถานะ:** รอการอนุมัติสถาปัตยกรรมและแผนดำเนินงาน (Pending User Approval)

---

## 1. รายงานผลการสำรวจและตรวจสอบไฟล์แนบ (File & Reference Audit)

### 1.1 ไฟล์ที่ตรวจพบในระบบ
เราได้ทำการตรวจสอบไฟล์ในสภาพแวดล้อมของผู้ใช้ (`Downloads`, โฟลเดอร์ `ข้อมูล`, และโฟลเดอร์ภาพหน้าจอ/โครงการเดิม) และจัดระเบียบสำเนาไว้ใน `reference_docs/` ดังนี้:
1. **เอกสารกติกาหลัก:**
   - `reference_docs/กฎการจัดสรรผู้คุมสอบและข้อกำหนดโควต้า-ELMS.md` และ `.docx` (เอกสารหลัก เวอร์ชัน 1.0 สมบูรณ์ ลงวันที่ 26 ต.ค. 2569)
   - `reference_docs/PROJECT_BRIEF.md` (ข้อกำหนดภาพรวมระบบ)
2. **ตราสัญลักษณ์มหาวิทยาลัยราชภัฏบุรีรัมย์ (BRU Logo):**
   - `reference_docs/ตราสัญลักษณ์ประจำมหาวิทยาลัยราชภัฏบุรีรัมย์.svg` (เวกเตอร์ต้นฉบับคมชัด)
   - `reference_docs/LOGO-bru-776x1024.png` (PNG พื้นหลังโปร่งใส ถูกสัดส่วน)
3. **ผังอาคาร 17 และสารบบห้อง (Floor Plans & Directory):**
   - `reference_docs/FloorPlan_Building17_Floor1.svg` & `.drawio` (ผังชั้น 1 สีขาวล้วน มีกรอบสี่เหลี่ยมล้อมรอบ)
   - `reference_docs/IMG20261022100642.jpg` และ `IMG20261022100726.jpg` (ภาพถ่ายป้ายผังอาคารจริง ชั้น 1 และชั้น 2)
   - `reference_docs/IMG20261022100647.jpg` และ `IMG20261022100729.jpg` (ภาพถ่าย Directory บอร์ดสารบบห้องจริง ชั้น 1 และชั้น 2)
4. **ข้อมูลห้องสอบจริง 10 ห้อง (ความจุ 520 ที่นั่ง) และระเบียบ ก.พ.:**
   - `reference_docs/IMG20261022084349.jpg` ถึง `IMG20261022084752.jpg` (ภาพถ่ายป้ายหน้าห้องสอบจริง แผนผังแถวที่นั่ง จอโปรเจกต์เตอร์ ประตูทางเข้าออก ของห้องที่ 1 - 10)
   - ภาพระเบียบและข้อปฏิบัติผู้เข้าสอบ CBT จากสำนักงาน ก.พ. (สิ่งของที่อนุญาตและไม่อนุญาต)
5. **ภาพต้นแบบเว็บมหาวิทยาลัย (UI Design Prototypes):**
   - `reference_docs/screenshots/Screenshot 2026-10-26 085233.png` (หน้าเว็บทางการของมหาวิทยาลัยราชภัฏบุรีรัมย์ โทนสีม่วงเข้ม `#3a2250` แถบเมนู และสไตล์ตัวอักษร)
   - `reference_docs/screenshots/Screenshot 2026-10-26 091922.png` (หน้าพอร์ทัลศูนย์สอบ CBT อาคาร 17: Hero Card สีม่วงเข้ม, 4 KPI Stat, การ์ดค้นหาที่นั่งสอบสีทอง)
   - `reference_docs/screenshots/Screenshot 2026-10-22 110942.png` (หน้าแดชบอร์ดเจ้าหน้าที่: การ์ด KPI 4 ใบ, ปุ่มผู้ช่วย AI, ปุ่มส่งออก Excel/PDF)
6. **ข้อมูลอ้างอิงชุดเก่า:**
   - โฟลเดอร์ `C:\Users\Asus\.gemini\antigravity-ide\scratch\exam-proctor-scheduler` ใช้เป็น **แหล่งอ้างอิงเพื่อดึงข้อมูลเท่านั้น** จะไม่มีการแก้ไขหรือคัดลอกโครงสร้างเดิมมาใช้ตรงๆ

---

## 2. ตรวจสอบจุดขัดแย้งของกติกา (Discrepancy Analysis: Prompt vs ELMS)

จากการอ่านเอกสาร `ELMS-RULES-SPECIFICATION` โดยละเอียด พบจุดที่ข้อมูลเดิมในระบบเก่าหรือความเข้าใจทั่วไปขัดกับเอกสารทางการ ซึ่ง **ระบบใหม่จะยึดตาม ELMS 100%** ดังนี้:

| ประเด็น | ข้อมูลเดิม / กฎล้าสมัย | กติกา ELMS ที่ถูกต้อง (ยึดหลักนี้) | การดำเนินการในระบบใหม่ |
| :--- | :--- | :--- | :--- |
| **เกณฑ์จำนวนผู้คุมต่อห้อง** | "ไม่เกิน 30 คน ใช้ 1 คน, 31-60 คน ใช้ 2 คน, >60 คน ใช้ 3 คน" | **ความจุ 40 - 60 ที่นั่ง ใช้ 2 คน** (หัวหน้าห้อง 1, กรรมการร่วม 1) <br>**ความจุ 80 ที่นั่ง (ห้อง 17201) ใช้ 3 คน** (หัวหน้าห้อง 1, กรรมการร่วม 2) | รวม 10 ห้องสอบ ต้องใช้อัตรากำลัง **21 คนต่อ 1 รอบสอบ** เสมอ |
| **ลำดับความอาวุโส (Seniority)** | แบ่งแค่ อาจารย์ vs เจ้าหน้าที่ | กำหนดเป็น Rank 10 ถึง 3 ชัดเจน:<br>• Rank 10: ศ./ศ.ดร.<br>• Rank 9: รศ./รศ.ดร.<br>• Rank 8: ผศ./ผศ.ดร.<br>• Rank 7: อาจารย์/อ.ดร.<br>• Rank 5: สายสนับสนุนชำนาญการพิเศษ<br>• Rank 4: สายสนับสนุนชำนาญการ<br>• Rank 3: สายสนับสนุนปฏิบัติการ/ทั่วไป | อาจารย์ (Rank 10-7) เป็นหัวหน้าห้อง (Order 1) ก่อนเสมอ หากอาจารย์ไม่พอจึง Fallback ใช้สายสนับสนุนอาวุโส (Rank 5, 4) และจัดเรียงความอาวุโสในห้องเดียวกัน |
| **Pool บุคลากร** | มีรายชื่อรวมกลุ่มเดียว | แบ่งเป็น **Core Pool** (กลุ่มหลัก) และ **Reserve Pool** (กลุ่มสำรอง) | จัด Core Pool ใน Phase 1-2 ให้เต็มโควต้าก่อน Reserve Pool จะถูกใช้ใน Phase 3 เฉพาะเมื่อ Core ไม่พอ หรือมีกรณีลาฉุกเฉิน/สลับตัว |
| **การตรึงห้อง (Room Stickiness)** | สลับห้องไปมาได้ | ผู้ที่มีเงื่อนไข `FULL_DAY_PAIRED` (เช้า+บ่าย) ต้องจัดให้อยู่ห้องสอบเดิมตลอดวัน (`keepSameRoom = true`) | ล็อกห้องรอบเช้าและบ่ายให้ตรงกันเพื่อลดการเคลื่อนย้ายอุปกรณ์ |

---

## 3. สถาปัตยกรรมและเทคโนโลยี (ข้อเสนอ 2 ทางเลือก)

ตามข้อกำหนดหัวข้อ 11 ขอเสนอ 2 สถาปัตยกรรมให้ผู้ใช้อนุมัติ:

### ทางเลือกที่ (ก): Client-Side Single Page Application (Modular Vanilla JS / Vite)
- **โครงสร้าง:** ทำงานบนเบราว์เซอร์ล้วน จัดเก็บสถานะใน LocalStorage / IndexedDB รันง่ายมาก ไม่ต้องติดตั้ง Database Server
- **ข้อดี:** ติดตั้งรวดเร็ว, Portable สูง (เปิด index.html หรือ `npm run dev` รันได้ทันที), เหมาะกับการ Demo และทดสอบ Solver ให้เห็นผลทันที
- **ข้อจำกัดเรื่อง PDPA:** หากพอร์ทัล Guest และ Admin อยู่ใน Bundle เดียวกัน บุคคลภายนอกอาจแกะข้อมูลรายชื่อผู้คุมและผู้เข้าสอบจาก Source Code ได้ จึงเหมาะกับกรณีที่ใช้ข้อมูลสมมุติ (Mock Data) สำหรับ Demo เท่านั้น

### ทางเลือกที่ (ข): Full-Stack Web App (Lightweight Node.js/Express + SQLite Database) *(แนะนำสำหรับการใช้งานจริง)*
- **โครงสร้าง:** Frontend แยกจาก Backend, ฐานข้อมูล SQLite เบาๆ เก็บในไฟล์เดียว, มี Authentication Middleware ตรวจสอบ JWT Token และ Password Hashing (bcrypt)
- **ข้อดี:** ปลอดภัยตามมาตรฐาน PDPA 100%, ซ่อนข้อมูลผู้คุมสอบและผู้เข้าสอบจาก Guest อย่างแท้จริง, Guest ค้นหาผ่าน API ที่มี Rate Limiter และไม่สามารถ Dump ข้อมูลทั้งหมดได้, รองรับ Audit Log ที่น่าเชื่อถือ
- **ข้อจำกัด:** ต้องรันฝั่ง Server ควบคู่กับ Client (อย่างไรก็ตามสามารถรวมสคริปต์ให้รันคำสั่งเดียวได้ เช่น `npm run start`)

> **คำแนะนำ (Recommended Approach):**  
> เราจะออกแบบสถาปัตยกรรมแบบ **Clean Decoupled Architecture**:  
> แยก Logic ของ `data/`, `rules/`, `solver/`, `explain/` ออกมาเป็น Pure JavaScript Modules 100% ที่ทดสอบได้ด้วย Unit Test โดยตรง และสร้าง Express + SQLite API เบาๆ สำหรับ Auth, Master Data, Audit Log และ Guest Seat Query ทำให้ระบบมีความปลอดภัยจริงตามเกณฑ์ PDPA และสามารถรันได้ด้วยคำสั่งเดียว (`npm start`)

---

## 4. โครงสร้างไฟล์ของระบบ (Modular Folder Structure)

```text
├── reference_docs/               # เอกสารอ้างอิง, ผังอาคาร, ภาพห้อง, โลโก้, ภาพหน้าจอต้นแบบ
├── src/
│   ├── config/
│   │   ├── elms-rules.js         # ค่าคงที่และกติกาตาม ELMS (ห้าม Hardcode ในส่วนอื่น)
│   │   └── design-tokens.js      # Design Tokens (Academic Violet/Emerald/Gold, Spacing, Radius)
│   ├── data/
│   │   ├── schema.js             # Data Models & Types (Room, Proctor, Session, Examinee)
│   │   ├── rooms-data.js         # ข้อมูลจริง 10 ห้องสอบ อาคาร 17 (ความจุ 520 ที่นั่ง)
│   │   ├── building-directory.js # สารบบห้อง ชั้น 1 (17101-17113) และ ชั้น 2 (17201-17214)
│   │   └── seed-generator.js     # ตัวสร้างข้อมูลจำลองผู้คุมสอบ (20 / 40 / 80 / กำหนดเอง)
│   ├── rules/
│   │   ├── hard-constraints.js   # ตัวตรวจกฎ H1 - H9 (ห้ามละเมิดเด็ดขาด)
│   │   ├── soft-constraints.js   # ตัวตรวจและถ่วงน้ำหนักความพึงพอใจ (Fairness, Stickiness, Day spread)
│   │   └── rule-checker.js       # โมดูลรวมการตรวจกฎทั้งตารางและตรวจเฉพาะจุด (Manual Edit)
│   ├── solver/
│   │   ├── feasibility.js        # ตรวจสอบความเป็นไปได้เบื้องต้น (Supply vs Demand)
│   │   ├── min-staff-calc.js     # เครื่องคำนวณจำนวนผู้คุมขั้นต่ำ พร้อมทางเลือกแก้ปัญหา
│   │   ├── priority-engine.js    # 5-Priority Scheduler Engine (Core/Reserve, Lower Quota, Stickiness)
│   │   ├── backtracking.js       # Backtracking Solver พร้อม Deterministic Seed และ Timeout
│   │   └── jain-index.js         # ตัวคำนวณ Jain's Fairness Index & Workload Standard Deviation
│   ├── explain/
│   │   ├── explanation-engine.js # ตัวสร้างคำอธิบายภาษาไทย "ทำไมจัดคนนี้ห้องนี้"
│   │   └── failure-advisor.js    # วิเคราะห์สาเหตุเมื่อจัดไม่สำเร็จและเสนอแนะทางแก้ไข
│   ├── auth/
│   │   ├── permissions.js        # กำหนดสิทธิ์ Admin, อาจารย์, ผู้คุมสอบ, Viewer, Guest
│   │   ├── auth-service.js       # ตรวจสอบการล็อกอิน, Password Hash, Session Management
│   │   └── attendance-sheet.js   # ใบลงนามปฏิบัติหน้าที่ผู้คุมสอบ (ดึงชื่อตามบัญชีที่ล็อกอินจริง)
│   ├── io/
│   │   ├── excel-exporter.js     # ส่งออก Excel/CSV (UTF-8 with BOM แสดงผลภาษาไทยถูกต้อง)
│   │   ├── pdf-exporter.js       # ส่งออก PDF เอกสารทางการ (ฟอนต์ Sarabun)
│   │   └── csv-importer.js       # ตัวนำเข้าข้อมูลพร้อม Template ดาวน์โหลด
│   ├── ui/
│   │   ├── components/           # UI Components (Navbar, KPI Cards, Modal, Toast, Table)
│   │   ├── floorplan/            # ผังอาคาร 17 Interactive 2 ชั้น (White Diagram + Zoom/Click)
│   │   ├── dashboard/            # Admin Dashboard (4 KPI Modal, Action Buttons, Manual Grid)
│   │   ├── guest-portal/         # พอร์ทัลผู้เข้าชม (Seat Finder, Rate Limit, Regulations, Schedule)
│   │   └── ai-assistant/         # AI Assistant Chatbot (เชื่อมโยง Rule Checker และข้อมูลจริง)
│   └── server/
│       ├── app.js                # Express Server เบาๆ ให้บริการ API และ Static Assets
│       ├── routes/               # API Routes (Auth, Schedule, Guest Seat Search, Audit)
│       └── db.js                 # SQLite Database Management
├── tests/
│   ├── unit/                     # Unit Tests สำหรับ Rules H1-H9 และ Priority Engine
│   ├── boundary/                 # Boundary Tests (Quota พอดี, ผู้คุมไม่พอ, ห้อง 80 ที่นั่ง)
│   ├── regression/               # Regression Tests (สลับบัญชี, Guest ไม่ตกขอบ, Undo/Redo)
│   └── solver-benchmark.js       # ทดสอบ Solver ที่ 20, 40, 80 คน และ Seed ต่างๆ
├── package.json
├── README.md
├── PLAN.md                       # บันทึกแผนงานหลัก
└── PROGRESS.md                   # บันทึกความคืบหน้าทีละขั้นตอน
```

---

## 5. แผนการจัดสรรข้อมูล (Data Models & Configuration)

- **ไฟล์ตั้งค่าเดียว (`elms-rules.js`):** เก็บค่าตัวเลขทั้งหมด เช่น จำนวนผู้คุมต่อขนาดห้อง (40-60 -> 2, >=70 -> 3), โควตาสูงสุด, เวลาพักขั้นต่ำ, น้ำหนักคะแนน Soft Constraints
- **10 ห้องสอบจริง:**
  - `17108` (40 ที่นั่ง, ที่นั่ง 001-040, ผู้คุม 2 คน)
  - `17109` (60 ที่นั่ง, ที่นั่ง 041-100, ผู้คุม 2 คน)
  - `17110` (60 ที่นั่ง, ที่นั่ง 101-160, ผู้คุม 2 คน)
  - `17111` (50 ที่นั่ง, ที่นั่ง 161-210, ผู้คุม 2 คน)
  - `17201` (80 ที่นั่ง, ที่นั่ง 211-290, ผู้คุม 3 คน)
  - `17205` (40 ที่นั่ง, ที่นั่ง 291-330, ผู้คุม 2 คน)
  - `17206` (40 ที่นั่ง, ที่นั่ง 331-370, ผู้คุม 2 คน)
  - `17211` (50 ที่นั่ง, ที่นั่ง 371-420, ผู้คุม 2 คน)
  - `17212` (52 ที่นั่ง, ที่นั่ง 421-472, ผู้คุม 2 คน)
  - `17213` (48 ที่นั่ง, ที่นั่ง 473-520, ผู้คุม 2 คน)
  *รวม 520 ที่นั่ง อัตรากำลัง 21 ตำแหน่งต่อรอบ*

---

## 6. ลำดับการสร้างและขั้นตอนการดำเนินงาน (10 Milestones)

เราจะปฏิบัติตามกฎ: **สร้างทีละขั้น รันเทสต์ให้ผ่าน และหยุดขออนุมัติก่อนไปขั้นต่อไป**

- **M1: โครงโปรเจกต์และการจัดการข้อมูล (Project Skeleton & Master Data)**
  - Initialise โปรเจกต์ใหม่, Git init
  - สกัดและจัดทำ `elms-rules.js`, `rooms-data.js`, `building-directory.js`
  - ทำ Mock Seed Data Generator (20/40/80 คน)
- **M2: ตัวตรวจกฎ (Rule Checker Engine: H1 - H9)**
  - พัฒนาโมดูลตรวจ Hard Constraints H1-H9 ครบถ้วน
  - เขียน Unit Test ครอบคลุมทั้งกรณีผ่านและไม่ผ่าน
- **M3: Solver และการคำนวณโควต้า (Intelligent 5-Priority Solver & Feasibility)**
  - พัฒนาระบบ Feasibility Check & Minimum Proctor Calculator
  - พัฒนา 5-Priority Engine + Backtracking (Core/Reserve, Seniority Sorting, Room Stickiness)
  - คำนวณ Jain's Fairness Index และจัดทำ Explanation Engine
  - รัน Benchmark Test ที่ 20, 40, 80 คน
- **M4: ระบบผู้ใช้และความปลอดภัย (Multi-Role Authentication & Security)**
  - ระบบล็อกอิน 4 บทบาท (Admin, อาจารย์, ผู้คุมสอบ, Viewer) และ Guest
  - Password Hashing + Authorization Check
  - ใบลงนามปฏิบัติหน้าที่ผู้คุมสอบที่ดึงชื่อตามบัญชีจริง
- **M5: หน้าแดชบอร์ดเจ้าหน้าที่ (Staff Management & Interactive Scheduling)**
  - Dashboard 4 KPI Cards + เจาะลึกรายใบผ่าน Modal
  - ตารางจัดสอบ 3 มุมมอง (รายวัน, รายห้อง, รายบุคคล)
  - ฟังก์ชัน Auto-Schedule, Manual Drag & Drop, Lock Slots, Reset, และ Undo/Redo 20 ขั้น
  - Room Modal แสดงสเปก อุปกรณ์ และผังที่นั่ง
- **M6: ธีมมหาวิทยาลัยและผังอาคาร 17 (University Academic Theme & Interactive Floorplan)**
  - นำ Design Tokens (Violet `#3a2250`, Gold `#eab308`, Emerald `#059669`) มาจัดวางตามภาพต้นแบบ
  - ตราสัญลักษณ์มหาวิทยาลัยมุมขวาบนถูกสัดส่วน
  - ผังอาคาร 17 แบบ Interactive 2 ชั้น (White diagram, มีกรอบ, สลับชั้นได้, คลิกดูห้องได้)
- **M7: พอร์ทัลผู้เข้าชม (Guest Portal & PDPA Compliance)**
  - ค้นหาที่นั่งสอบ (กรอกรหัสผู้สอบ + ข้อมูลยืนยัน), ไฮไลต์ห้องบนผังอาคาร
  - ตารางสอบสาธารณะ (ซ่อนชื่อผู้สอบและผู้คุมสอบ)
  - ข้อปฏิบัติการสอบ CBT (ตามระเบียบ ก.พ.), FAQ, ข่าวประกาศ
  - ระบบ Rate Limiting ป้องกันการ Brute-force
- **M8: ระบบรายงานและการส่งออก (Reporting & Exporting)**
  - ส่งออก Excel/CSV (UTF-8 with BOM)
  - ส่งออก PDF ภาษาไทย (ฟอนต์ Sarabun) พร้อมใบลงนามและผังที่นั่ง
  - แม่แบบนำเข้า CSV สำหรับเพิ่มข้อมูล
- **M9: ผู้ช่วยอัจฉริยะ (AI Assistant / Rules Advisor)**
  - UI แชตการ์ดคำถามด่วน เชื่อมโยง Rule Checker และข้อมูลจริง
- **M10: ฟังก์ชันเสริมขั้นสูง (Advanced Features)**
  - ระบบจำลองผู้คุมลากะทันหันและเสนอตัวแทนจาก Reserve Pool
  - What-if Analysis จำลองสถานการณ์
  - Schedule Versioning & Diff Viewer, Audit Log บันทึกทุกความเปลี่ยนแปลง

---

## 7. แผนการทดสอบคุณภาพ (Quality Assurance & Test Plan)

1. **Unit Tests:** ทดสอบ H1 - H9 ทุกเงื่อนไข (Positive & Negative Test Cases)
2. **Boundary Tests:** ทดสอบโควต้าเต็มพอดี, ผู้คุมไม่พอดีกับ 21 ตำแหน่ง, การเรียกใช้ Reserve Pool
3. **Property-Based Verification:** ตารางใดก็ตามที่ Solver ตอบว่าจัดสำเร็จ เมื่อส่งเข้า Rule Checker ต้องมี Violation = 0 รายการ
4. **Solver Benchmark:** รายงานผลลัพธ์จัดตาราง 20, 40, 80 คน (เวลาประมวลผล < 2 นาที, ค่า Jain's Index > 0.85)
5. **Security & Privacy Audit:** ทดสอบว่า Guest ไม่สามารถเปิดดูหรือแกะข้อมูลส่วนบุคคลของผู้คุมและผู้เข้าสอบท่านอื่นได้
6. **Responsive Design Verification:** ทดสอบการแสดงผลหน้าจอบนความกว้าง 360px, 390px, 768px, 1024px, 1440px ไม่ตกขอบ
