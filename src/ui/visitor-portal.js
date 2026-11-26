/**
 * โมดูลระบบสำหรับผู้เข้าชมและนักศึกษา (University Visitor & Examinee Portal)
 * อิงตามแบบเว็บไซต์ทางการ มหาวิทยาลัยราชภัฏบุรีรัมย์ (Buriram Rajabhat University)
 * มีระบบ:
 * 1. University Header & Top Utility Bar (ตรงตามภาพถ่ายหน้าเว็บ BRU)
 * 2. ข่าวประชาสัมพันธ์ศูนย์สอบ CBT อาคาร 17 (ตามเลย์เอาต์ภาพถ่าย)
 * 3. ระบบค้นหาที่นั่งสอบและห้องสอบรายบุคคล (Examinee Seat & Room Finder)
 * 4. บัตรประจำตัวผู้เข้าสอบอิเล็กทรอนิกส์ พร้อมผังที่นั่งจริง & ปุ่มพิมพ์
 * 5. ทำเนียบห้องปฏิบัติการคอมพิวเตอร์ อาคาร 17 (10 ห้อง 520 เครื่อง)
 * 6. ระเบียบข้อปฏิบัติการเข้าสอบมาตรฐาน CBT
 * 7. ตารางกำหนดการสอบสาธารณะ
 */

import { formatThaiDate, formatThaiTimeRange } from '../utils/thai-date.js';
import { BRU_LOGO_DATA_URI } from '../data/branding.js';

// ข้อมูลจำลองผู้เข้าสอบตัวอย่างสำหรับทดสอบค้นหา (ศูนย์สอบ ก.พ. และ คุรุสภา CBT อาคาร 17)
export const SAMPLE_EXAMINEES = [
  {
    id: '69011234001',
    title: 'นาย',
    firstName: 'กิตติศักดิ์',
    lastName: 'เจริญผล',
    faculty: 'สอบ ก.พ. (ระดับปริญญาตรี)',
    major: 'สาขาวิชาวิทยาการคอมพิวเตอร์',
    sessionId: 's1',
    sessionName: 'รอบที่ 1: เสาร์เช้า (09:00 - 12:00)',
    subjectCode: 'OCSC-CBT',
    subjectName: 'การสอบวัดความรู้ความสามารถทั่วไป (ก.พ. ภาค ก CBT)',
    date: '2026-10-31',
    time: '09:00 - 12:00 น.',
    building: 'อาคาร 17 (ศูนย์สอบ CBT)',
    floor: 1,
    roomCode: '17108',
    roomName: 'ห้อง 17108 (วินิตปัญญา 5)',
    seatNumber: '1',
    seatBlock: 'บล็อกซ้าย แถวที่ 1',
    seatIndex: 1,
    status: 'ยืนยันสิทธิ์สอบแล้ว'
  },
  {
    id: '69011234002',
    title: 'นางสาว',
    firstName: 'ชุติมา',
    lastName: 'สายชล',
    faculty: 'สอบคุรุสภา (วิชาชีพครู)',
    major: 'กลุ่มวิชาคอมพิวเตอร์ศึกษา',
    sessionId: 's1',
    sessionName: 'รอบที่ 1: เสาร์เช้า (09:00 - 12:00)',
    subjectCode: 'KSP-CBT',
    subjectName: 'การทดสอบและประเมินสมรรถนะทางวิชาชีพครู (คุรุสภา CBT)',
    date: '2026-10-31',
    time: '09:00 - 12:00 น.',
    building: 'อาคาร 17 (ศูนย์สอบ CBT)',
    floor: 2,
    roomCode: '17201',
    roomName: 'ห้อง 17201 (ห้องประชุมหงส์พันธ์)',
    seatNumber: '5',
    seatBlock: 'แถวที่ 1 ที่นั่ง 5',
    seatIndex: 5,
    status: 'ยืนยันสิทธิ์สอบแล้ว'
  },
  {
    id: '69011234003',
    title: 'นาย',
    firstName: 'ณัฐภัทร',
    lastName: 'วัฒนสุนทร',
    faculty: 'สอบ ก.พ. (ระดับปริญญาตรี)',
    major: 'สาขาวิชานิติศาสตร์',
    sessionId: 's1',
    sessionName: 'รอบที่ 1: เสาร์เช้า (09:00 - 12:00)',
    subjectCode: 'OCSC-CBT',
    subjectName: 'การสอบวัดความรู้ความสามารถทั่วไป (ก.พ. ภาค ก CBT)',
    date: '2026-10-31',
    time: '09:00 - 12:00 น.',
    building: 'อาคาร 17 (ศูนย์สอบ CBT)',
    floor: 1,
    roomCode: '17109',
    roomName: 'ห้อง 17109 (วินิตปัญญา 6)',
    seatNumber: '42',
    seatBlock: 'บล็อกกลาง แถวที่ 2',
    seatIndex: 42,
    status: 'ยืนยันสิทธิ์สอบแล้ว'
  },
  {
    id: '69011234004',
    title: 'นางสาว',
    firstName: 'ลลิตา',
    lastName: 'ศิริโภคิน',
    faculty: 'สอบคุรุสภา (วิชาชีพครู)',
    major: 'กลุ่มวิชาภาษาอังกฤษ',
    sessionId: 's2',
    sessionName: 'รอบที่ 2: เสาร์บ่าย (13:00 - 16:30)',
    subjectCode: 'KSP-CBT',
    subjectName: 'การทดสอบและประเมินสมรรถนะทางวิชาชีพครู (คุรุสภา CBT)',
    date: '2026-10-31',
    time: '13:00 - 16:30 น.',
    building: 'อาคาร 17 (ศูนย์สอบ CBT)',
    floor: 2,
    roomCode: '17205',
    roomName: 'ห้อง 17205',
    seatNumber: '11',
    seatBlock: 'บล็อกซ้าย แถวที่ 2',
    seatIndex: 11,
    status: 'ยืนยันสิทธิ์สอบแล้ว'
  },
  {
    id: '69011234005',
    title: 'นาย',
    firstName: 'พงศกร',
    lastName: 'ประเสริฐผล',
    faculty: 'สอบ ก.พ. (ระดับปริญญาโท)',
    major: 'สาขาวิชารัฐประศาสนศาสตร์',
    sessionId: 's2',
    sessionName: 'รอบที่ 2: เสาร์บ่าย (13:00 - 16:30)',
    subjectCode: 'OCSC-CBT',
    subjectName: 'การสอบวัดความรู้ความสามารถทั่วไป (ก.พ. ภาค ก CBT)',
    date: '2026-10-31',
    time: '13:00 - 16:30 น.',
    building: 'อาคาร 17 (ศูนย์สอบ CBT)',
    floor: 2,
    roomCode: '17211',
    roomName: 'ห้อง 17211',
    seatNumber: '25',
    seatBlock: 'บล็อกขวา แถวที่ 3',
    seatIndex: 25,
    status: 'ยืนยันสิทธิ์สอบแล้ว'
  },
  {
    id: '69011234006',
    title: 'นางสาว',
    firstName: 'นภัสสร',
    lastName: 'รุ่งเรืองกิจ',
    faculty: 'สอบคุรุสภา (วิชาชีพครู)',
    major: 'กลุ่มวิชาการศึกษาปฐมวัย',
    sessionId: 's1',
    sessionName: 'รอบที่ 1: เสาร์เช้า (09:00 - 12:00)',
    subjectCode: 'KSP-CBT',
    subjectName: 'การทดสอบและประเมินสมรรถนะทางวิชาชีพครู (คุรุสภา CBT)',
    date: '2026-11-01',
    time: '09:00 - 12:00 น.',
    building: 'อาคาร 17 (ศูนย์สอบ CBT)',
    floor: 1,
    roomCode: '17108',
    roomName: 'ห้อง 17108 (วินิตปัญญา 5)',
    seatNumber: '2',
    seatBlock: 'บล็อกซ้าย แถวที่ 1',
    seatIndex: 2,
    status: 'ยืนยันสิทธิ์สอบแล้ว'
  }
];

/**
 * แสดงตราสัญลักษณ์ทางการ มหาวิทยาลัยราชภัฏบุรีรัมย์ (จากไฟล์ภาพที่ได้รับ)
 */
export function getUniversityEmblem(height = 50, className = 'uni-seal-img') {
  return `<img src="${BRU_LOGO_DATA_URI}" alt="ตราประจำมหาวิทยาลัยราชภัฏบุรีรัมย์" class="${className}" style="height: ${height}px; width: auto; object-fit: contain; vertical-align: middle; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.18));" />`;
}

export function getUniversityEmblemSvg(size = 50) {
  return getUniversityEmblem(size);
}

/**
 * เรนเดอร์ Header ประจำมหาวิทยาลัยราชภัฏบุรีรัมย์ (University Header)
 * มีทั้ง Top Utility Bar สีขาว และ Primary Navbar สีม่วงราชภัฏ
 */
export function renderUniversityHeader({ currentTab, onVisitorMode = false }) {
  return `
    <header class="uni-header-container" id="uni-main-header">
      <!-- 1. Top Utility Bar (สีขาว มีตรามหาลัย + ลิงก์ด่วนบุคลากร/นักศึกษา) -->
      <div class="uni-top-utility-bar">
        <div class="uni-utility-inner">
          <!-- Logo & University Title (มุมซ้ายบน) -->
          <div class="uni-brand-wrapper" id="btn-uni-home" style="cursor: pointer;" title="คลิกเพื่อกลับหน้าหลักมหาวิทยาลัย / ศูนย์สอบ">
            ${getUniversityEmblem(52, 'uni-seal-img-left')}
            <div class="uni-title-box">
              <span class="uni-title-th">มหาวิทยาลัยราชภัฏบุรีรัมย์</span>
              <span class="uni-title-en">BURIRAM RAJABHAT UNIVERSITY</span>
            </div>
            <div class="uni-cbt-tag">
              <span class="cbt-badge">ระบบจัดห้องคุมสอบ กพ. และคุรุสภา</span>
            </div>
          </div>

          <!-- Quick Utility Links + ตราประจำมหาวิทยาลัยมุมขวาบน -->
          <div class="uni-utility-right">
            <nav class="uni-quick-links" aria-label="ลิงก์ด่วนมหาวิทยาลัย">
              <a href="#visitor-search" class="uni-quick-link" id="link-student-view">ผู้เข้าสอบ ก.พ. / คุรุสภา</a>
              <span class="uni-pipe">|</span>
              <a href="#quick-staff" class="uni-quick-link" id="link-staff-view">บุคลากร</a>
              <span class="uni-pipe">|</span>
              <a href="#quick-alumni" class="uni-quick-link">ศิษย์เก่า</a>
              <span class="uni-pipe">|</span>
              <a href="#quick-reg" class="uni-quick-link">ระบบบริการการศึกษา</a>
              <span class="uni-pipe">|</span>
              <a href="#quick-edoc" class="uni-quick-link">E-DOC</a>
            </nav>

            <!-- Social Media Icons (ตามภาพเว็บมหาวิทยาลัย) -->
            <div class="uni-social-group">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" class="uni-social-btn" title="Facebook มหาวิทยาลัย">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H7v-3h3V9.5C10 6.46 11.82 5 14.5 5c1.28 0 2.62.23 2.62.23v2.89h-1.48c-1.5 0-1.97.93-1.97 1.88V12h3.25l-.52 3h-2.73v6.8c4.56-.93 8-4.96 8-9.8z"/></svg>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" class="uni-social-btn" title="Twitter / X">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" class="uni-social-btn" title="YouTube BRU Channel">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.016 3.016 0 0 0-2.122 2.136C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.55 9.376.55 9.376.55s7.505 0 9.377-.55a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
            </div>

            <!-- ตราประจำมหาวิทยาลัยมุมขวาบน (Official BRU Crest) -->
            <div class="uni-top-right-crest" title="ตราประจำมหาวิทยาลัยราชภัฏบุรีรัมย์">
              ${getUniversityEmblem(46, 'uni-seal-img-right')}
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Main University Navigation Bar (แถบสีม่วงราชภัฏบุรีรัมย์ #3B1F54 พร้อมปุ่มสีเหลืองทอง) -->
      <div class="uni-primary-navbar ${!onVisitorMode ? 'staff-mode-mobile-hide' : ''}">
        <div class="uni-navbar-inner">
          <ul class="uni-nav-links">
            <li class="uni-nav-item">
              <a href="#visitor-news" class="uni-nav-link active" data-scroll="visitor-news">หน้าแรกศูนย์สอบ CBT</a>
            </li>
            <li class="uni-nav-divider">|</li>
            <li class="uni-nav-item">
              <a href="#visitor-search" class="uni-nav-link" data-scroll="visitor-search">🔍 ค้นหาที่นั่งสอบ</a>
            </li>
            <li class="uni-nav-divider">|</li>
            <li class="uni-nav-item">
              <a href="#visitor-rooms" class="uni-nav-link" data-scroll="visitor-rooms">🏢 อาคาร 17 & ห้องสอบ (10 ห้อง)</a>
            </li>
            <li class="uni-nav-divider">|</li>
            <li class="uni-nav-item">
              <a href="#visitor-rules" class="uni-nav-link" data-scroll="visitor-rules">📜 ระเบียบการเข้าสอบ</a>
            </li>
            <li class="uni-nav-divider">|</li>
            <li class="uni-nav-item">
              <a href="#visitor-schedule" class="uni-nav-link" data-scroll="visitor-schedule">📅 ตารางสอบ</a>
            </li>
            <li class="uni-nav-divider">|</li>
            <li class="uni-nav-item">
              <a href="#visitor-contact" class="uni-nav-link" data-scroll="visitor-contact">ติดต่อศูนย์สอบ</a>
            </li>
          </ul>

          <!-- Action Switcher CTA Button (ปุ่มสีเหลืองทองแบบแคปซูล ตามภาพต้นแบบเว็บมหาลัย) -->
          <div class="uni-navbar-right">
            ${currentTab === 'visitor' ? `
              <button class="uni-cta-pill" id="btn-enter-staff-system" title="เข้าสู่ระบบจัดการและจัดตารางคุมสอบสำหรับเจ้าหน้าที่ / อาจารย์">
                <span class="icon">🛡️</span>
                <span>เข้าสู่ระบบจัดตาราง (Staff)</span>
                <span class="arrow">➔</span>
              </button>
            ` : `
              <button class="uni-cta-pill btn-switch-to-visitor" id="btn-back-to-visitor" title="กลับสู่หน้าหลักสำหรับผู้เข้าชมและผู้เข้าสอบ">
                <span class="icon">🌐</span>
                <span>หน้าหลักผู้เข้าชม / ผู้เข้าสอบ</span>
                <span class="arrow">➔</span>
              </button>
            `}

          </div>
        </div>
      </div>
    </header>
  `;
}

/**
 * เรนเดอร์หน้าหลักสำหรับผู้เข้าชม (Visitor & Examinee Portal)
 */
export function renderVisitorPortal(appState) {
  const activeRooms = appState.rooms || [];
  const sessions = appState.sessions || [];
  const allocations = appState.allocations || [];
  const assignments = appState.assignments || [];

  const allExaminees = [
    ...(appState.examinees || []),
    ...SAMPLE_EXAMINEES.filter(s => !(appState.examinees || []).some(e => String(e.id) === String(s.id)))
  ];
  const initialExaminee = null; // เริ่มต้นปิดบัตรไว้ เพื่อไม่ให้เปิดค้างตลอดเวลา
  const demoExaminees = allExaminees.slice(0, 5);

  return `
    <div class="visitor-portal-view" id="visitor-portal-root">
      
      <!-- Section 1: ข่าวประชาสัมพันธ์ทางการ (Announcement Banner ตามแบบภาพถ่าย BRU) -->
      <section class="visitor-news-section" id="visitor-news">
        <div class="visitor-container">
          <div class="uni-news-card">
            <!-- Orange Tag -->
            <div class="uni-news-tag">
              <span class="tag-bar"></span>
              <span class="tag-label">ข่าวประชาสัมพันธ์</span>
            </div>

            <!-- Headline -->
            <h1 class="uni-news-title">
              ประกาศศูนย์สอบคอมพิวเตอร์ (CBT) อาคาร 17 มหาวิทยาลัยราชภัฏบุรีรัมย์: 
              กำหนดการทดสอบและช่องทางตรวจสอบผังที่นั่งสอบรายบุคคล ประจำปีการศึกษา 2569
            </h1>

            <!-- Meta line (ตามภาพ: ผู้ดูแลระบบ, วันที่, จำนวนคนดู, ปุ่มแชร์) -->
            <div class="uni-news-meta">
              <div class="meta-left">
                <span class="meta-author">โดย <strong>ผู้ดูแลระบบศูนย์สอบ CBT</strong></span>
                <span class="meta-dot">,</span>
                <span class="meta-date">4 พฤศจิกายน 2569</span>

              </div>
              <div class="meta-shares">
                <button class="share-icon" title="แชร์ลง Facebook">f</button>
                <button class="share-icon" title="แชร์ลง Twitter">t</button>
                <button class="share-icon" title="แชร์ลง Google+">G+</button>
                <button class="share-icon" id="btn-copy-portal-link" title="คัดลอกลิงก์ประกาศ">🔗</button>
              </div>
            </div>

            <!-- News Visual Poster & Quick Highlights -->
            <div class="uni-news-banner-visual">
              <div class="banner-badge-box">
                <span class="banner-tag-red">แจ้งเตือนสำคัญ</span>
                <h2 class="banner-headline">ศูนย์ทดสอบด้วยระบบคอมพิวเตอร์ (CBT) อาคาร 17</h2>
                <p class="banner-subtext">มหาวิทยาลัยราชภัฏบุรีรัมย์ เปิดให้ผู้เข้าสอบ ก.พ. และคุรุสภา ตรวจสอบห้องสอบ เลขที่นั่งสอบ และระเบียบการสอบล่วงหน้า</p>
                <div class="banner-stats-row">
                  <div class="stat-pill">
                    <span class="stat-num">10</span>
                    <span class="stat-desc">ห้องปฏิบัติการ</span>
                  </div>
                  <div class="stat-pill">
                    <span class="stat-num">520</span>
                    <span class="stat-desc">เครื่องสอบ CBT</span>
                  </div>
                  <div class="stat-pill">
                    <span class="stat-num">2</span>
                    <span class="stat-desc">ชั้น (มีลิฟต์ & ทางลาด)</span>
                  </div>
                  <div class="stat-pill">
                    <span class="stat-num">100%</span>
                    <span class="stat-desc">แอร์ & วงจรปิด CCTV</span>
                  </div>
                </div>
              </div>

              <!-- Action Prompt inside Banner (ตามภาพต้นแบบศูนย์สอบ) -->
              <div class="banner-action-card">
                <div class="card-title">🔍 ตรวจสอบสิทธิ์และที่นั่งสอบ</div>
                <p class="card-desc">กรอกเลขประจำตัวสอบ หรือเลือกรายชื่อตัวอย่างเพื่อดูผังที่นั่งจริงในอาคาร 17</p>
                <a href="#visitor-search" class="btn btn-accent btn-block" style="text-align: center; font-weight: 700; padding: 10px 16px; border-radius: 9999px; text-decoration: none; display: block;">
                  ไปที่ระบบค้นหาที่นั่งสอบ ⬇
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 2: ค้นหาข้อมูลผังที่นั่งสอบและห้องสอบรายบุคคล (Examinee Search - กะทัดรัด) -->
      <section class="visitor-search-section" id="visitor-search">
        <div class="visitor-container">
          <div class="search-box-wrapper">
            <div class="section-badge">🔍 บริการผู้เข้าสอบ ก.พ. & คุรุสภา</div>
            <h2 class="section-title">ตรวจสอบข้อมูลผังที่นั่งสอบและห้องสอบรายบุคคล (CBT Exam Seat Finder)</h2>
            <p class="section-subtitle">ค้นหาด้วย <strong>ชื่อ-สกุล</strong>, <strong>เลขประจำตัวผู้เข้าสอบ</strong>, <strong>เลขประจำตัวประชาชน (13 หลัก)</strong>, หรือ <strong>เลขที่นั่งสอบ</strong></p>

            <!-- Search input bar -->
            <div class="examinee-search-bar">
              <div class="input-with-icon">
                <span class="search-icon">🔍</span>
                <input type="text" class="examinee-input" id="input-examinee-search" placeholder="พิมพ์เลขประจำตัวผู้เข้าสอบ, เลขบัตรประชาชน, ชื่อ-สกุล หรือเลขที่นั่งสอบ..." autocomplete="off">
                <button type="button" class="clear-search-btn" id="btn-clear-examinee-search" style="display: none;" title="ล้างคำค้นหา">✕</button>
              </div>
              <button type="button" class="btn btn-primary btn-search-go" id="btn-submit-examinee-search">
                🔍 ค้นหาข้อมูล
              </button>
            </div>

            <!-- Quick Demo Chips -->
            <div class="quick-demo-chips">
              <span class="chip-label">⚡ ตัวอย่างค้นหาด่วน (คลิกเลือกรายชื่อเพื่อทดสอบค้นหาทันที):</span>
              <div class="chip-list">
                ${demoExaminees.map(ex => `
                  <button type="button" class="demo-chip" data-search-id="${ex.id || ex.firstName}">
                    👤 ${ex.title || ''}${ex.firstName} ${ex.lastName} (${ex.id}) • ที่นั่ง #${ex.seatNumber || '-'}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Result Area -->
            <div id="examinee-search-result-area">
              ${renderExamineePassCard(initialExaminee, appState)}
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: ทำเนียบห้องปฏิบัติการคอมพิวเตอร์ อาคาร 17 (10 Rooms Directory) -->
      <section class="visitor-rooms-section" id="visitor-rooms">
        <div class="visitor-container">
          <div class="section-header-centered">
            <div class="section-badge">🏢 ข้อมูลอาคารสอบ</div>
            <h2 class="section-title">ทำเนียบห้องปฏิบัติการคอมพิวเตอร์ อาคาร 17 (CBT Center)</h2>
            <p class="section-subtitle">ศูนย์สอบคอมพิวเตอร์มาตรฐาน 10 ห้องสอบ รวม 520 ที่นั่ง พร้อมระบบปรับอากาศและบันทึกภาพ CCTV ทุกห้อง</p>
          </div>

          <!-- Floor Filter Buttons -->
          <div class="floor-filter-pills" id="visitor-floor-filters">
            <button class="floor-pill active" data-floor="all">ทั้งหมด (10 ห้อง)</button>
            <button class="floor-pill" data-floor="1">ชั้น 1 (4 ห้อง - 210 ที่นั่ง)</button>
            <button class="floor-pill" data-floor="2">ชั้น 2 (6 ห้อง - 310 ที่นั่ง)</button>
          </div>

          <!-- Room Cards Grid -->
          <div class="visitor-rooms-grid">
            ${activeRooms.map(room => {
              const rCode = room.roomCode || room.code || room.id;
              const floorNum = room.floor || (rCode.startsWith('172') ? 2 : 1);
              return `
                <div class="visitor-room-card" data-room-floor="${floorNum}" data-room-id="${room.id}">
                  <div class="room-card-top">
                    <div class="room-card-code">
                      <span class="room-badge-floor">ชั้น ${floorNum}</span>
                      <h3>ห้อง ${rCode}</h3>
                    </div>
                    <span class="room-badge-cap">${room.capacity} เครื่อง</span>
                  </div>

                  <div class="room-official-name">
                    ${room.officialName || room.name}
                  </div>

                  <p class="room-desc-short">
                    ${room.description || `ห้องปฏิบัติการคอมพิวเตอร์ อาคาร 17 ชั้น ${floorNum} รองรับการสอบ CBT`}
                  </p>

                  <div class="room-amenities">
                    <span class="amenity-item" title="เครื่องปรับอากาศ">❄️ แอร์ ${room.airConditioners || 4} ตัว</span>
                    <span class="amenity-item" title="กล้องวงจรปิด CCTV">📹 CCTV ${room.cctvCount || 2} ตัว</span>
                    ${room.accessibleForDisabled ? `
                      <span class="amenity-item tag-access" title="รองรับผู้พิการ">♿ มีทางลาด</span>
                    ` : ''}
                  </div>

                  <div class="room-card-actions">
                    <button class="btn btn-secondary btn-sm btn-view-room-plan" data-room-id="${room.id}" style="width: 100%; justify-content: center; font-weight: 600;">
                      🗺️ เปิดดูผังที่นั่ง & ตำแหน่งเครื่อง
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </section>

      <!-- Section 4: ระเบียบและข้อปฏิบัติการเข้าสอบ CBT (Code of Conduct) -->
      <section class="visitor-rules-section" id="visitor-rules">
        <div class="visitor-container">
          <div class="section-header-centered">
            <div class="section-badge">📜 ข้อบังคับศูนย์สอบ</div>
            <h2 class="section-title">ระเบียบและแนวทางปฏิบัติสำหรับผู้เข้าสอบ CBT</h2>
            <p class="section-subtitle">เพื่อความโปร่งใส ยุติธรรม และความปลอดภัย ขอความร่วมมือผู้เข้าสอบปฏิบัติตามระเบียบอย่างเคร่งครัด</p>
          </div>

          <div class="rules-card-grid">
            <!-- Card 1 -->
            <div class="rule-box">
              <div class="rule-icon-box" style="background: rgba(37,99,235,0.1); color: #2563EB;">🪪</div>
              <h3 class="rule-title">1. หลักฐานแสดงตนเข้าห้องสอบ</h3>
              <p class="rule-desc">
                ต้องนำ<strong>บัตรประจำตัวประชาชนฉบับจริง</strong> หรือ<strong>บัตรประจำตัวเจ้าหน้าที่ของรัฐ/ใบอนุญาตขับรถที่มีรูปถ่าย</strong> (ที่ยังไม่หมดอายุ) มาแสดงต่อกรรมการคุมสอบหน้าห้องสอบ หากไม่มีหลักฐานจะไม่ได้รับอนุญาตให้เข้าสอบ
              </p>
            </div>

            <!-- Card 2 -->
            <div class="rule-box">
              <div class="rule-icon-box" style="background: rgba(220,38,38,0.1); color: #DC2626;">⏰</div>
              <h3 class="rule-title">2. กำหนดเวลาเข้าห้องสอบ</h3>
              <p class="rule-desc">
                ผู้เข้าสอบต้องมาถึงหน้าห้องสอบก่อนเวลาสอบ<strong>อย่างน้อย 15 นาที</strong> เพื่อฟังคำชี้แจง และไม่อนุญาตให้เข้าห้องสอบหลังจากเริ่มสอบไปแล้วเกิน <strong>15 นาที</strong> โดยเด็ดขาด
              </p>
            </div>

            <!-- Card 3 -->
            <div class="rule-box">
              <div class="rule-icon-box" style="background: rgba(217,119,6,0.1); color: #D97706;">📵</div>
              <h3 class="rule-title">3. สิ่งของต้องห้ามนำเข้าห้องสอบ</h3>
              <p class="rule-desc">
                ห้ามนำ<strong>โทรศัพท์มือถือ สมาร์ตวอทช์ เครื่องคำนวณ หูฟัง เอกสาร หรือสัมภาระทุกชนิด</strong>เข้าห้องสอบ ต้องปิดเครื่องและฝากไว้ในจุดที่ศูนย์สอบจัดไว้หน้าห้องสอบ
              </p>
            </div>

            <!-- Card 4 -->
            <div class="rule-box">
              <div class="rule-icon-box" style="background: rgba(16,185,129,0.1); color: #10B981;">💻</div>
              <h3 class="rule-title">4. การใช้งานเครื่องคอมพิวเตอร์ CBT</h3>
              <p class="rule-desc">
                นั่งสอบตรงตาม<strong>หมายเลขเครื่อง (CBT Number)</strong> ที่กำหนด ห้ามสลับเครื่อง ห้ามเปิดเว็บเบราว์เซอร์อื่น หรือโปรแกรมภายนอก หากเครื่องมีปัญหาให้ยกมือแจ้งกรรมการคุมสอบทันที
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 5: ตารางกำหนดการสอบสาธารณะ (Public Exam Timetable) -->
      <section class="visitor-schedule-section" id="visitor-schedule">
        <div class="visitor-container">
          <div class="section-header-centered">
            <div class="section-badge">📅 กำหนดการจัดสอบ</div>
            <h2 class="section-title">ตารางรอบการทดสอบ ณ อาคาร 17 ศูนย์สอบ CBT</h2>
            <p class="section-subtitle">ข้อมูลรอบการจัดสอบ ห้องสอบ และจำนวนผู้เข้าสอบที่ลงทะเบียนในระบบ</p>
          </div>

          <div class="visitor-table-card">
            <table class="visitor-schedule-table">
              <thead>
                <tr>
                  <th>รอบสอบ</th>
                  <th>วันที่สอบ</th>
                  <th>เวลาสอบ</th>
                  <th>รายวิชา / การทดสอบ</th>
                  <th>ห้องสอบที่เปิด</th>
                  <th>จำนวนผู้เข้าสอบ</th>
                  <th>สถานะรอบ</th>
                </tr>
              </thead>
              <tbody>
                ${sessions.map((sess, idx) => {
                  const sAllocs = allocations.filter(a => a.sessionId === sess.id);
                  const roomCodes = sAllocs.map(a => {
                    const r = activeRooms.find(rm => rm.id === a.roomId);
                    return r ? r.code : a.roomId;
                  }).join(', ');
                  return `
                    <tr>
                      <td><span class="badge badge-normal">รอบที่ ${idx + 1}</span></td>
                      <td><strong>${formatThaiDate(sess.date)}</strong></td>
                      <td><span class="badge badge-primary">${formatThaiTimeRange(sess.startTime, sess.endTime)}</span></td>
                      <td><strong>${sess.name}</strong></td>
                      <td><span class="badge badge-secondary">${roomCodes || 'ทุกห้องในอาคาร 17'}</span></td>
                      <td><strong>${sess.totalExaminees || 350} คน</strong></td>
                      <td><span class="badge badge-success">พร้อมดำเนินการ</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Section 6: ติดต่อศูนย์สอบและข้อมูลมหาวิทยาลัย (Footer) -->
      <footer class="visitor-footer" id="visitor-contact">
        <div class="visitor-container">
          <div class="footer-grid">
            <div class="footer-col brand-col">
              <div class="footer-brand">
                ${getUniversityEmblemSvg(42)}
                <div>
                  <h4 class="footer-uni-title">มหาวิทยาลัยราชภัฏบุรีรัมย์</h4>
                  <p class="footer-sub">Buriram Rajabhat University</p>
                </div>
              </div>
              <p class="footer-desc">
                ศูนย์ทดสอบด้วยระบบคอมพิวเตอร์ (CBT Exam Center) อาคาร 17<br>
                บริการจัดสอบมาตรฐานสำหรับการสอบ ก.พ., คุรุสภา และหน่วยงานภาครัฐ
              </p>
            </div>

            <div class="footer-col">
              <h4 class="footer-heading">สถานที่ตั้ง & ติดต่อ</h4>
              <p class="footer-text">
                📍 เลขที่ 439 ถนนจิระ ตำบลในเมือง อำเภอเมืองบุรีรัมย์ จังหวัดบุรีรัมย์ 31000<br>
                📞 โทรศัพท์: 0-4461-1221 ต่อ 1700 (งานศูนย์สอบ CBT)<br>
                ✉️ อีเมล: cbt-center@bru.ac.th<br>
                🌐 เว็บไซต์: www.bru.ac.th
              </p>
            </div>

            <div class="footer-col">
              <h4 class="footer-heading">ระบบสำหรับเจ้าหน้าที่</h4>
              <p class="footer-text">
                สำหรับอาจารย์ผู้คุมสอบและคณะกรรมการคุมสอบ กรุณาเข้าสู่ระบบเพื่อตรวจสอบคำสั่งและจัดตารางปฏิบัติหน้าที่
              </p>
              <button class="btn btn-accent btn-sm" id="btn-footer-staff-login" style="margin-top: 8px; font-weight: 700;">
                🛡️ เข้าสู่ระบบจัดตารางสอบ (Staff / Admin)
              </button>
            </div>
          </div>

          <div class="footer-bottom">
            <span>© 2026 มหาวิทยาลัยราชภัฏบุรีรัมย์ (Buriram Rajabhat University) - สงวนลิขสิทธิ์</span>
            <span>ระบบจัดห้องคุมสอบ กพ. และคุรุสภา</span>
          </div>
        </div>
      </footer>
    </div>
  `;
}

/**
 * เรนเดอร์การ์ดบัตรประจำตัวผู้เข้าสอบ (Electronic Exam Pass Ticket)
 */
export function renderExamineePassCard(examinee, appState, isNotFound = false) {
  if (!examinee && !isNotFound) {
    return `
      <div class="pass-prompt-card" style="text-align: center; padding: 48px 24px; background: #FFFFFF; border-radius: 12px; border: 2px dashed #CBD5E1; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
        <div style="font-size: 48px; margin-bottom: 12px;">🪪</div>
        <h3 style="font-size: 17px; font-weight: 700; color: #1E293B; margin-bottom: 8px;">ค้นหาผังที่นั่งสอบและข้อมูลผู้เข้าสอบรายบุคคล</h3>
        <p style="font-size: 14px; color: #64748B; max-width: 520px; margin: 0 auto 16px; line-height: 1.6;">
          กรุณากรอก<strong>รหัสประจำตัวผู้เข้าสอบ</strong>, <strong>เลขบัตรประชาชน</strong> หรือ<strong>ชื่อ-นามสกุล</strong> ในช่องค้นหาด้านบน หรือคลิกเลือกรายชื่อตัวอย่างเพื่อเปิดแสดงบัตรและตำแหน่งที่นั่งสอบ
        </p>
        <div style="display: inline-flex; align-items: center; gap: 8px; background: #F1F5F9; padding: 8px 16px; border-radius: 20px; font-size: 12px; color: #475569; font-weight: 600;">
          <span>💡 แตะปุ่มรายชื่อตัวอย่างด้านบนเพื่อดูตัวอย่างทันที</span>
        </div>
      </div>
    `;
  }

  if (!examinee && isNotFound) {
    return `
      <div class="no-result-box" style="text-align: center; padding: 40px 20px; background: #FFFBEB; border-radius: 12px; border: 1.5px dashed #F59E0B;">
        <div style="font-size: 40px; margin-bottom: 10px;">🔍</div>
        <h3 style="font-size: 16px; font-weight: 700; color: #92400E; margin-bottom: 6px;">ไม่พบข้อมูลผู้เข้าสอบตามคำค้นหา</h3>
        <p style="font-size: 13px; color: #B45309; margin-bottom: 16px;">กรุณาตรวจสอบชื่อ-นามสกุล, รหัสประจำตัว, เลขบัตรประชาชน หรือเลขที่นั่งสอบอีกครั้ง หรือคลิกเลือกตัวอย่างรายชื่อด้านบน</p>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-no-result" style="font-size: 12px; font-weight: 600;">
          ✕ ปิดข้อความ
        </button>
      </div>
    `;
  }

  const maskCitizenId = (cid) => {
    if (!cid) return null;
    const clean = String(cid).replace(/[^0-9]/g, '');
    if (clean.length === 13) {
      return `${clean.slice(0, 1)}-${clean.slice(1, 5)}-XXXXX-${clean.slice(10, 12)}-${clean.slice(12)}`;
    }
    return cid;
  };

  // หาข้อมูลรอบการสอบ
  const session = (appState.sessions || []).find(s => s.id === examinee.sessionId) || {};
  const subjectName = examinee.subjectName || session.name || 'การทดสอบความรู้ความสามารถทั่วไปด้วยระบบอิเล็กทรอนิกส์ (CBT Exam)';
  const subjectCode = examinee.subjectCode || 'CBT-101';
  const examDate = examinee.date || session.date || '2026-10-31';
  const examTime = examinee.time || (session.startTime && session.endTime ? formatThaiTimeRange(session.startTime, session.endTime) : '09:00 - 12:00 น.');

  // หาข้อมูลห้องสอบจริง
  const rCode = examinee.roomCode || '17108';
  const room = (appState.rooms || []).find(r => (r.roomCode || r.code || r.id) === rCode) || {
    code: rCode,
    roomCode: rCode,
    name: examinee.roomName || `ห้อง ${rCode}`,
    officialName: examinee.roomName || `ห้อง ${rCode}`,
    floor: examinee.floor || (String(rCode).startsWith('172') ? 2 : 1),
    capacity: 40
  };
  const rName = examinee.roomName || room.officialName || room.name || `ห้อง ${rCode}`;
  const floorNum = examinee.floor || room.floor || (String(rCode).startsWith('172') ? 2 : 1);
  const seatDisplay = examinee.seatNumber != null ? `#${examinee.seatNumber}` : 'ยังไม่ระบุ';
  const seatBlock = examinee.seatBlock || (examinee.seatNumber ? `ที่นั่งสอบลำดับที่ ${examinee.seatNumber}` : 'จัดที่นั่งอัตโนมัติ');

  // หาผู้คุมสอบประจำห้องในรอบนั้น (ถ้ามี)
  const alloc = (appState.allocations || []).find(a => a.sessionId === examinee.sessionId && (a.roomId === room.id || a.roomId === (room.roomCode || room.code)));
  let chiefProctorName = 'อาจารย์ประจำศูนย์สอบ CBT อาคาร 17';
  if (alloc) {
    const assignedChief = (appState.assignments || []).find(as => as.allocationId === alloc.id && as.role === 'chief');
    if (assignedChief) {
      const p = (appState.proctors || []).find(pr => pr.id === assignedChief.proctorId);
      if (p) chiefProctorName = `${p.title || ''}${p.firstName} ${p.lastName}`;
    }
  }

  return `
    <div class="examinee-pass-card" id="printable-examinee-pass">
      <div class="pass-header">
        <div class="pass-header-left">
          <span class="pass-tag">บัตรประจำตัวผู้เข้าสอบอิเล็กทรอนิกส์ (E-Exam Pass)</span>
          <h3 class="pass-university">มหาวิทยาลัยราชภัฏบุรีรัมย์ • ระบบจัดห้องคุมสอบ กพ. และคุรุสภา</h3>
          <div class="pass-subject">${subjectName} (${subjectCode})</div>
        </div>
        <div class="pass-header-right">
          <div class="pass-qr-stub">
            <div class="qr-mock">
              <svg width="50" height="50" viewBox="0 0 100 100" fill="none">
                <rect width="100" height="100" fill="#FFFFFF"/>
                <!-- Mock QR Code Corners -->
                <rect x="10" y="10" width="26" height="26" fill="#000000"/>
                <rect x="14" y="14" width="18" height="18" fill="#FFFFFF"/>
                <rect x="18" y="18" width="10" height="10" fill="#000000"/>

                <rect x="64" y="10" width="26" height="26" fill="#000000"/>
                <rect x="68" y="14" width="18" height="18" fill="#FFFFFF"/>
                <rect x="72" y="18" width="10" height="10" fill="#000000"/>

                <rect x="10" y="64" width="26" height="26" fill="#000000"/>
                <rect x="14" y="68" width="18" height="18" fill="#FFFFFF"/>
                <rect x="18" y="72" width="10" height="10" fill="#000000"/>

                <!-- Dots -->
                <rect x="42" y="15" width="6" height="12" fill="#000000"/>
                <rect x="52" y="25" width="6" height="6" fill="#000000"/>
                <rect x="42" y="42" width="16" height="16" fill="#000000"/>
                <rect x="64" y="45" width="12" height="6" fill="#000000"/>
                <rect x="42" y="65" width="6" height="15" fill="#000000"/>
                <rect x="55" y="75" width="15" height="6" fill="#000000"/>
                <rect x="75" y="65" width="15" height="15" fill="#000000"/>
              </svg>
            </div>
            <span class="qr-label">สแกนตรวจสอบสิทธิ์</span>
          </div>
          <button type="button" class="btn-close-pass" id="btn-close-exam-pass" title="ปิดบัตรประจำตัวสอบ">✕ ปิดบัตร</button>
        </div>
      </div>

      <!-- Main Pass Info Body -->
      <div class="pass-body">
        <div class="pass-student-info">
          <div class="info-row">
            <span class="lbl">ชื่อ - สกุล:</span>
            <span class="val strong">${examinee.title || ''}${examinee.firstName} ${examinee.lastName}</span>
          </div>
          <div class="info-row">
            <span class="lbl">เลขประจำตัวผู้เข้าสอบ:</span>
            <span class="val highlight">${examinee.id}</span>
          </div>
          ${examinee.citizenId ? `
            <div class="info-row">
              <span class="lbl">เลขประจำตัว ปชช:</span>
              <span class="val" style="letter-spacing: 0.5px;">${maskCitizenId(examinee.citizenId)}</span>
            </div>
          ` : ''}
          <div class="info-row">
            <span class="lbl">ประเภทการสอบ / กลุ่มวิชา:</span>
            <span class="val">${(() => {
              let t = examinee.faculty || '-';
              let m = examinee.major ? `(${examinee.major})` : '';
              if (!examinee.faculty || examinee.faculty.includes('คณะ')) {
                const isTeacher = (examinee.faculty && examinee.faculty.includes('ครุศาสตร์')) || (examinee.major && examinee.major.includes('ศึกษา'));
                t = isTeacher ? 'สอบคุรุสภา (วิชาชีพครู)' : 'สอบ ก.พ. (ระดับปริญญาตรี)';
                if (!examinee.major || examinee.major.includes('วิทยาการ') || examinee.major.includes('คอม')) {
                  m = isTeacher ? '(กลุ่มวิชาคอมพิวเตอร์ศึกษา)' : '(สาขาวิชาวิทยาการคอมพิวเตอร์)';
                } else if (examinee.major.includes('คณิต')) {
                  m = isTeacher ? '(กลุ่มวิชาคณิตศาสตร์)' : '(สาขาวิชาคณิตศาสตร์และสถิติ)';
                } else if (examinee.major.includes('ภาษาไทย')) {
                  m = isTeacher ? '(กลุ่มวิชาภาษาไทย)' : '(สาขาวิชาภาษาไทย)';
                } else if (examinee.major.includes('ภาษาอังกฤษ')) {
                  m = isTeacher ? '(กลุ่มวิชาภาษาอังกฤษ)' : '(สาขาวิชาภาษาอังกฤษ)';
                }
              }
              return `${t} ${m}`.trim();
            })()}</span>
          </div>
          ${examinee.specialNeeds ? `
            <div class="info-row">
              <span class="lbl">ความต้องการพิเศษ:</span>
              <span class="val" style="color: #B45309; font-weight: 700;">♿ ${examinee.specialNeeds}</span>
            </div>
          ` : ''}
          <div class="info-row">
            <span class="lbl">วันและเวลาสอบ:</span>
            <span class="val"><strong>${formatThaiDate(examDate)}</strong> เวลา ${examTime}</span>
          </div>
          <div class="info-row">
            <span class="lbl">หัวหน้าผู้คุมห้อง:</span>
            <span class="val">${chiefProctorName}</span>
          </div>
        </div>

        <!-- Seat & Room Spotlight Badge (เน้นชัดเจนตามความต้องการผู้เข้าสอบ) -->
        <div class="pass-seat-spotlight">
          <div class="spotlight-header">📍 ตำแหน่งที่นั่งสอบของท่าน</div>
          
          <div class="spotlight-room">
            <span class="label-tiny">ห้องสอบ</span>
            <span class="room-big">${rCode}</span>
            <span class="room-sub">${rName}</span>
          </div>

          <div class="spotlight-terminal">
            <span class="label-tiny">หมายเลขเครื่องสอบ CBT</span>
            <span class="seat-big">${seatDisplay}</span>
            <span class="seat-sub">${seatBlock}</span>
          </div>

          <div class="spotlight-floor">
            <span>อาคาร 17 (ชั้น ${floorNum})</span>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="pass-actions">
        <button class="btn btn-primary btn-sm btn-view-examinee-blueprint" data-room-code="${rCode}" data-seat-number="${examinee.seatNumber || ''}">
          🗺️ เปิดดูผังที่นั่งห้อง ${rCode} (แสดงตำแหน่งเครื่อง ${seatDisplay})
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-exam-pass-action">
          ✕ ปิดการแสดงบัตร
        </button>
      </div>
    </div>
  `;
}
