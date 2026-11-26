/**
 * แอปพลิเคชัน UI หลัก (Main Application View Controller)
 * จัดการหน้าจอทั้งหมด (Dashboard, Scheduler, 3 Views, Manual Edit, What-if, Versions, Settings, Audit Log, Test Suite)
 */

import { appState } from '../store/state.js';
import { formatThaiDate, formatThaiTimeRange, formatThaiTime } from '../utils/thai-date.js';
import { validateSchedule, canProctorTakeSlot } from '../rules/validator.js';
import { exportExcelWorkbook } from '../io/excel-export.js';
import { openPrintableSignoffSheets, openPersonalDutySheet, openPrintableDoorSignsAndSeatingPlan, renderSeatingPlanInnerDiagram, renderSwapMemoDocumentHtml, openPrintableSwapMemo, openPrintableAppointmentOrder, openPrintableSeatSlips } from '../io/pdf-export.js';
import { exportToCSV, triggerCSVDownload, parseCSV, CSV_TEMPLATES } from '../data/csv-io.js';
import { SEED_PRESETS, BUILDING_17_DIRECTORY, REAL_EXAM_ROOM_CONFIGS } from '../data/seed.js';
import { runAllTests } from '../../tests/run-tests.js';
import { ProctorAIAgent } from '../agent/proctor-agent.js';
import {
  renderBlueprintRoomCell,
  renderDirectorySidebar,
  renderFloor1Blueprint,
  renderFloor2Blueprint,
  renderBuildingDirectoryTable,
  renderRoomDetailModal
} from './building-floor-plan.js';
import {
  renderKpiRoomsModal,
  renderKpiProctorsModal,
  renderKpiScheduleStatusModal,
  renderKpiRulesAuditModal
} from './kpi-modals.js';
import {
  renderUniversityHeader,
  renderVisitorPortal,
  renderExamineePassCard,
  getUniversityEmblem,
  SAMPLE_EXAMINEES
} from './visitor-portal.js';
import {
  renderExamineesSubTab,
  renderExamineeModal,
  renderCSVPreviewModal,
  parseCSVWithEncoding,
  generateExamineeCSVTemplate,
  exportExamineesToCSV,
  openPrintableExamineeAttendanceSheet
} from '../features/examinees.js';

export class AppView {
  constructor(rootElement) {
    this.root = rootElement;
    this.currentTab = 'visitor'; // visitor | dashboard | scheduler | master-data | what-if | versions | settings | audit | tests | ai-agent
    this.scheduleSubView = 'grid'; // grid | personal | workload
    this.masterDataSubTab = 'sessions'; // sessions | proctors | examinees | rooms | unavail
    this.roomsSubTab = 'seating-grid';
    this.blueprintFloor = 1;
    this.roomsViewMode = 'table'; // table | floor1 | floor2 | directory
    this.roomDetailSubTab = 'seating'; // seating | specs | proctors
    this.maskPDPA = false;
    this.activeModal = null;
    this.activeViewingProctorId = null;
    this.dashboardSessionView = 'table'; // table | cards
    this.selectedSessionFilter = 'all'; // 'all' or sessionId
    this.proctorSearchQuery = '';
    this.proctorFilterLevel = 'all'; // 'all' | 'chief' | 'assistant'
    this.proctorFilterQuota = 'all';
    this.proctorFilterType = 'all';
    this.isTestToolsOpen = false;
    this.examineeSearchQuery = '';
    this.examineeFilterSession = 'all';
    this.examineeFilterRoom = 'all';
    this.examineeFilterUnseatedOnly = false;
    this.examineeFilterSpecialNeedsOnly = false;
    this.examineeCurrentPage = 1;
    this.isExamineeTestToolsOpen = false; // 'all' | '1' | '2' | '3' | '4' | '5' | '6'
    this.minProctorResult = null;
    this.lastSolverResult = null;
    this.whatIfScenario = null;
    this.aiAgent = new ProctorAIAgent(appState);
    this.testResults = null;

    this.roomOverviewFloor = 1;

    // ติดตามการเปลี่ยนแปลง state
    appState.subscribe(() => {
      this.render();
    });

    if (typeof window !== 'undefined') {
      window.appView = this;
      window.appState = appState;
    }

    this.render();
  }

  // เปลี่ยนแท็บหน้าหลัก
  setTab(tab) {
    this.currentTab = tab;
    document.body.style.overflow = '';
    this.render();
  }

  // เปลี่ยนมุมมองย่อยในหน้าตาราง
  setScheduleSubView(view) {
    this.scheduleSubView = view;
    this.render();
  }

  render() {
    const valResult = validateSchedule({
      assignments: appState.assignments,
      allocations: appState.allocations,
      sessions: appState.sessions,
      proctors: appState.proctors,
      rooms: appState.rooms,
      unavailabilities: appState.unavailabilities,
      settings: appState.settings
    });

    // ตรวจสอบสถานะตาราง
    const totalSlots = appState.allocations.reduce((sum, al) => sum + (al.examineesInRoom > appState.settings.hardConstraints.h5_examinee_threshold_for_two_proctors ? 2 : 1), 0)
      + (appState.sessions.length * appState.settings.hardConstraints.h8_reserve_proctors_per_session);
    const assignedSlots = appState.assignments.length;
    const isComplete = assignedSlots >= totalSlots && valResult.isValid;
    // ป้องกันการเข้าถึงเมนูแอดมินเมื่อเข้าสู่ระบบในฐานะอาจารย์หรือผู้คุมสอบ
    if (!appState.isAdmin()) {
      const adminOnlyTabs = ['dashboard', 'scheduler', 'proctors', 'rooms', 'master-data', 'what-if', 'versions', 'audit', 'settings', 'tests'];
      if (adminOnlyTabs.includes(this.currentTab)) {
        this.currentTab = 'my-profile';
      }
    }

    const isVisitor = this.currentTab === 'visitor';

    this.root.innerHTML = `
      ${renderUniversityHeader({ currentTab: this.currentTab, onVisitorMode: isVisitor })}

      ${isVisitor ? `
        <!-- Visitor & Examinee Portal Mode -->
        <main class="visitor-wrapper" style="width: 100%;">
          ${renderVisitorPortal(appState)}
        </main>
      ` : `
        <!-- Staff & Scheduler Workspace Mode -->
        <div class="app-container">
          <!-- Sidebar Navigation -->
          <aside class="sidebar">
            <div class="sidebar-header">
              <div class="brand-icon" style="background: transparent; border: none; padding: 0; box-shadow: none;">
                ${getUniversityEmblem(38, 'sidebar-seal')}
              </div>
              <div style="flex: 1; min-width: 0;">
                <div class="brand-title">ระบบจัดตารางผู้คุมสอบ</div>
                <div class="brand-subtitle">${appState.settings.project.universityName}</div>
              </div>
              <button class="mobile-sidebar-close" id="btn-close-mobile-sidebar" aria-label="ปิดเมนู" title="ปิดเมนู">✕</button>
            </div>

            <ul class="nav-list">
              <div class="nav-section-title">พอร์ทัลมหาวิทยาลัย</div>
              <li class="nav-item nav-item-portal ${this.currentTab === 'visitor' ? 'active' : ''}" data-tab="visitor">
                <span class="icon" aria-hidden="true">${this.svgIcon('globe')}</span>
                <span>หน้าหลักผู้เข้าชม (Visitor)</span>
              </li>

              ${appState.isAdmin() ? `
                <div class="nav-section-title">เมนูหลัก (ผู้ดูแลระบบ)</div>
                <li class="nav-item ${this.currentTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
                  <span class="icon" aria-hidden="true">${this.svgIcon('dashboard')}</span>
                  <span>แดชบอร์ดภาพรวม</span>
                </li>
                <li class="nav-item ${this.currentTab === 'scheduler' ? 'active' : ''}" data-tab="scheduler">
                  <span class="icon" aria-hidden="true">${this.svgIcon('calendar')}</span>
                  <span>ตารางผู้คุมสอบ</span>
                  ${valResult.errorCount > 0 ? `<span class="badge-count">${valResult.errorCount}</span>` : ''}
                </li>
                <li class="nav-item ${this.currentTab === 'proctors' ? 'active' : ''}" data-tab="proctors">
                  <span class="icon" aria-hidden="true">${this.svgIcon('user')}</span>
                  <span>ผู้คุมสอบ</span>
                  <span class="badge-count" style="background: rgba(124, 58, 237, 0.12); color: var(--primary-700); font-weight: 700; margin-left: auto;">${appState.proctors.length}</span>
                </li>
                <li class="nav-item ${this.currentTab === 'rooms' ? 'active' : ''}" data-tab="rooms">
                  <span class="icon" aria-hidden="true">${this.svgIcon('building')}</span>
                  <span>ห้องสอบ</span>
                  <span class="badge-count" style="background: rgba(124, 58, 237, 0.12); color: var(--primary-700); font-weight: 700; margin-left: auto;">${appState.rooms.length}</span>
                </li>
                <li class="nav-item ${this.currentTab === 'master-data' ? 'active' : ''}" data-tab="master-data">
                  <span class="icon" aria-hidden="true">${this.svgIcon('database')}</span>
                  <span>ข้อมูลระบบ</span>
                </li>
                <!-- ซ่อนไว้ ยังไม่ลบ -->
                <li class="nav-item ${this.currentTab === 'what-if' ? 'active' : ''}" data-tab="what-if" style="display: none;" aria-hidden="true">
                  <span class="icon" aria-hidden="true">${this.svgIcon('sliders')}</span>
                  <span>จำลอง What-if</span>
                </li>
                <!-- ซ่อนไว้ ยังไม่ลบ -->
                <li class="nav-item ${this.currentTab === 'versions' ? 'active' : ''}" data-tab="versions" style="display: none;" aria-hidden="true">
                  <span class="icon" aria-hidden="true">${this.svgIcon('clock')}</span>
                  <span>เวอร์ชัน & เปรียบเทียบ</span>
                </li>
                <li class="nav-item ${this.currentTab === 'audit' ? 'active' : ''}" data-tab="audit">
                  <span class="icon" aria-hidden="true">${this.svgIcon('file-text')}</span>
                  <span>ประวัติการแก้ไข (Audit)</span>
                </li>

                <div class="nav-section-title">การตั้งค่าและทดสอบ</div>
                <li class="nav-item ${this.currentTab === 'settings' ? 'active' : ''}" data-tab="settings">
                  <span class="icon" aria-hidden="true">${this.svgIcon('settings')}</span>
                  <span>ตั้งค่ากฎ & โควต้า</span>
                </li>
                <li class="nav-item ${this.currentTab === 'tests' ? 'active' : ''}" data-tab="tests">
                  <span class="icon" aria-hidden="true">${this.svgIcon('check-circle')}</span>
                  <span>ชุดทดสอบระบบ (Test Suite)</span>
                </li>

                <div class="nav-section-title">มุมมองผู้คุมสอบ (จำลอง)</div>
                <li class="nav-item ${this.currentTab === 'my-profile' ? 'active' : ''}" data-tab="my-profile">
                  <span class="icon" aria-hidden="true">${this.svgIcon('user')}</span>
                  <span>ตารางการปฏิบัติงานคุมสอบของฉัน</span>
                </li>
              ` : `
                <!-- เมนูเฉพาะสำหรับ อาจารย์ และ เจ้าหน้าที่คุมสอบ (Proctor / Teacher) -->
                <div class="nav-section-title">เมนูผู้คุมสอบ</div>
                <li class="nav-item ${this.currentTab === 'my-profile' ? 'active' : ''}" data-tab="my-profile">
                  <span class="icon" aria-hidden="true">${this.svgIcon('user')}</span>
                  <span>ตารางการปฏิบัติงานคุมสอบของฉัน</span>
                </li>
                <li class="nav-item ${this.currentTab === 'scheduler' ? 'active' : ''}" data-tab="scheduler">
                  <span class="icon" aria-hidden="true">${this.svgIcon('file-text')}</span>
                  <span>ตารางสอบภาพรวม (อ่านอย่างเดียว)</span>
                </li>
                <li class="nav-item ${this.currentTab === 'rooms-overview' ? 'active' : ''}" data-tab="rooms-overview">
                  <span class="icon" aria-hidden="true">${this.svgIcon('building')}</span>
                  <span>ข้อมูลอาคาร 17 & ห้องสอบ</span>
                </li>

                <div class="nav-section-title">บริการ & ช่วยเหลือ</div>
                <li class="nav-item" id="btn-sidebar-sudden-leave">
                  <span class="icon" aria-hidden="true">${this.svgIcon('alert-circle')}</span>
                  <span>ขอสลับตัว / เปลี่ยนตัว</span>
                </li>
              `}
            </ul>

            <div class="sidebar-footer">
              <div class="sidebar-status-row">
                <span>สถานะตาราง:</span>
                <strong class="sidebar-status-value ${appState.currentStatus === 'published' ? 'is-published' : ''}">
                  ${appState.currentStatus === 'published' ? 'เผยแพร่แล้ว' : (appState.currentStatus === 'review' ? 'รอตรวจสอบ' : 'แบบร่าง')}
                </strong>
              </div>
              <button class="btn btn-secondary btn-sm sidebar-footer-btn" id="btn-toggle-theme" type="button">
                ${this.svgIcon('sun-moon')}
                <span>สลับโหมด สว่าง / มืด</span>
              </button>
              <div class="sidebar-license-row">
                <span>Open Source</span>
                <button class="btn btn-secondary btn-sm sidebar-license-btn" id="btn-show-license" type="button">
                  MIT License
                </button>
              </div>
            </div>
          </aside>

          <!-- Sidebar Backdrop for Mobile -->
          <div class="sidebar-backdrop" id="sidebar-backdrop"></div>

          <!-- Main Wrapper -->
          <div class="main-wrapper">
            <!-- Topbar Header -->
            <header class="topbar">
              <div class="topbar-left">
                <button class="mobile-nav-toggle" id="btn-toggle-mobile-sidebar" aria-label="เปิดเมนูนำทาง" title="เปิดเมนูนำทาง">
                  ${this.svgIcon('menu')}
                </button>
                <h1 class="page-title">${this.getPageTitle()}</h1>
              </div>

              <div class="topbar-right">
                <!-- สลับบทบาทและผู้ใช้งาน (User & Role Switcher) -->
                <div class="user-profile-badge" id="btn-open-user-modal" role="button" tabindex="0" style="cursor: pointer;" title="คลิกเพื่อสลับบทบาทหรือเข้าสู่ระบบในฐานะ Admin / อาจารย์ / ผู้คุมสอบ">
                  <span class="user-avatar-icon" aria-hidden="true">${appState.isAdmin() ? this.svgIcon('shield') : this.svgIcon('user')}</span>
                  <div class="desktop-only" style="display: flex; flex-direction: column; line-height: 1.2;">
                    <span style="font-size: 13px; font-weight: 700; color: var(--text-main);">${appState.currentUser?.name}</span>
                    <span style="font-size: 11px; color: var(--text-muted);">${appState.isAdmin() ? 'ผู้ดูแลระบบ' : (appState.isTeacher() ? 'อาจารย์' : 'เจ้าหน้าที่')}</span>
                  </div>
                  <span class="role-tag ${appState.currentUser?.role}">
                    ${appState.isAdmin() ? 'Admin' : (appState.isTeacher() ? 'อาจารย์' : 'ผู้คุม')}
                  </span>
                  <span class="user-switch-pill">
                    <span class="desktop-only">สลับ</span>▾
                  </span>
                </div>

                <!-- Desktop Only Action Buttons in Topbar (ซ่อนบนมือถือเพื่อไม่ให้ทับซ้อน/ล้นจอ) -->
                <div class="desktop-only" style="display: flex; gap: 6px; align-items: center;">
                  <!-- Quick Undo / Redo (Admin Only) -->
                  ${appState.isAdmin() ? `
                    <div style="display: flex; gap: 4px; border-left: 1px solid var(--border); padding-left: 8px;">
                      <button class="btn btn-secondary btn-sm btn-icon-only" id="btn-undo" type="button" ${!appState.canUndo() ? 'disabled' : ''} title="ย้อนกลับการแก้ไข (Undo)" aria-label="ย้อนกลับการแก้ไข (Undo)">
                        ${this.svgIcon('undo')}
                      </button>
                      <button class="btn btn-secondary btn-sm btn-icon-only" id="btn-redo" type="button" ${!appState.canRedo() ? 'disabled' : ''} title="ทำซ้ำการแก้ไข (Redo)" aria-label="ทำซ้ำการแก้ไข (Redo)">
                        ${this.svgIcon('redo')}
                      </button>
                    </div>
                  ` : ''}

                  <!-- Quick Export Dropdown (Admin vs Proctor) -->
                  ${appState.isAdmin() ? `
                    <div class="custom-dropdown" id="dropdown-topbar-export">
                      <button class="btn btn-secondary btn-sm custom-dropdown-trigger" type="button" aria-haspopup="true" aria-expanded="false" title="ส่งออกไฟล์และเอกสารพิมพ์">
                        ${this.svgIcon('download')}
                        <span>ส่งออก/พิมพ์</span>
                        <span style="font-size: 10px; margin-left: 2px;">▾</span>
                      </button>
                      <div class="custom-dropdown-menu custom-dropdown-menu-right" role="menu">
                        <button class="custom-dropdown-item" id="btn-export-excel" type="button" role="menuitem">
                          <span class="dropdown-item-icon">📗</span>
                          <div>
                            <div class="dropdown-item-title">ส่งออกตาราง Excel (.xlsx)</div>
                            <div class="dropdown-item-desc">ตารางคุมสอบรวมทุกห้องและสถิติโควต้า</div>
                          </div>
                        </button>
                        <button class="custom-dropdown-item" id="btn-export-pdf" type="button" role="menuitem">
                          <span class="dropdown-item-icon">🖨️</span>
                          <div>
                            <div class="dropdown-item-title">ส่งออกรายงานตารางคุมสอบ (PDF)</div>
                            <div class="dropdown-item-desc">ใบเซ็นชื่อปฏิบัติงานและสรุปยอดภาระงาน</div>
                          </div>
                        </button>
                        <div class="custom-dropdown-divider"></div>
                        <button class="custom-dropdown-item" id="btn-print-door-signs" type="button" role="menuitem" title="พิมพ์ชุดป้ายติดบอร์ดหน้าห้องสอบและผังที่นั่งจริง (10 ห้อง 520 ที่นั่ง)">
                          <span class="dropdown-item-icon">🪧</span>
                          <div>
                            <div class="dropdown-item-title">ป้ายหน้าห้อง & ผังที่นั่งจริง</div>
                            <div class="dropdown-item-desc">ชุดป้ายติดบอร์ด 10 ห้องสอบ 520 ที่นั่ง</div>
                          </div>
                        </button>
                        <button class="custom-dropdown-item" id="btn-print-appointment-order" type="button" role="menuitem" title="พิมพ์คำสั่งแต่งตั้งคณะกรรมการกำกับการสอบ (ก.พ.) ฉบับทางการตราครุฑ">
                          <span class="dropdown-item-icon">📜</span>
                          <div>
                            <div class="dropdown-item-title">คำสั่งแต่งตั้งคณะกรรมการคุมสอบ (ก.พ.)</div>
                            <div class="dropdown-item-desc">คำสั่งมหาวิทยาลัยราชภัฏบุรีรัมย์ ฉบับทางการตราครุฑ</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  ` : `
                    <button class="btn btn-primary btn-sm" id="btn-topbar-print-my-schedule" type="button" title="พิมพ์ตารางการปฏิบัติงานคุมสอบส่วนบุคคล (PDF)">
                      ${this.svgIcon('printer')}
                      <span>พิมพ์ตารางคุมสอบของฉัน</span>
                    </button>
                  `}
                </div>
              </div>
            </header>

            <!-- Main Content Body -->
            <main class="content-body">
              ${this.renderActiveTab(valResult, totalSlots, assignedSlots, isComplete)}
            </main>
          </div>

          <!-- Mobile Bottom Navigation Bar (แท็บด่วนบนมือถือ) -->
          <nav class="mobile-bottom-bar" id="mobile-bottom-bar" aria-label="เมนูหลักบนมือถือ">
            <button class="mobile-nav-btn ${this.currentTab === 'my-profile' ? 'active' : ''}" data-tab="my-profile">
              <span class="icon" aria-hidden="true">${this.svgIcon('user')}</span>
              <span>ตารางฉัน</span>
            </button>
            <button class="mobile-nav-btn ${this.currentTab === 'scheduler' ? 'active' : ''}" data-tab="scheduler">
              <span class="icon" aria-hidden="true">${this.svgIcon('file-text')}</span>
              <span>ตารางรวม</span>
            </button>
            <button class="mobile-nav-btn ${this.currentTab === 'my-availability' ? 'active' : ''}" data-tab="my-availability">
              <span class="icon" aria-hidden="true">${this.svgIcon('calendar')}</span>
              <span>วันสะดวก</span>
            </button>
            <button class="mobile-nav-btn ${this.currentTab === 'rooms-overview' ? 'active' : ''}" data-tab="rooms-overview">
              <span class="icon" aria-hidden="true">${this.svgIcon('building')}</span>
              <span>อาคาร 17</span>
            </button>
            <button class="mobile-nav-btn ${this.currentTab === 'dashboard' ? 'active' : ''}" id="btn-bottom-more-menu">
              <span class="icon" aria-hidden="true">${this.svgIcon('menu')}</span>
              <span>${appState.isAdmin() ? 'เมนูระบบ' : 'เมนูอื่น'}</span>
            </button>
          </nav>
        </div>
      `}

      <!-- Modal Container -->
      <div id="modal-root">${this.activeModal ? this.renderModal() : ''}</div>
    `;

    this.attachEvents();
  }

  svgIcon(name) {
    const attrs = 'viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    const icons = {
      globe: `<svg ${attrs}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
      dashboard: `<svg ${attrs}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>`,
      calendar: `<svg ${attrs}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      database: `<svg ${attrs}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
      sliders: `<svg ${attrs}><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
      clock: `<svg ${attrs}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      'file-text': `<svg ${attrs}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
      settings: `<svg ${attrs}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
      'check-circle': `<svg ${attrs}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
      user: `<svg ${attrs}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      shield: `<svg ${attrs}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
      building: `<svg ${attrs}><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="22" x2="9" y2="18"/><line x1="15" y1="22" x2="15" y2="18"/><line x1="8" y1="6" x2="10" y2="6"/><line x1="14" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/></svg>`,
      'alert-circle': `<svg ${attrs}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      undo: `<svg ${attrs}><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`,
      redo: `<svg ${attrs}><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>`,
      download: `<svg ${attrs}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
      printer: `<svg ${attrs}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
      'sun-moon': `<svg ${attrs}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M6.34 17.66l-1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/></svg>`,
      menu: `<svg ${attrs}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`
    };
    return icons[name] || '';
  }

  getPageTitle() {
    switch (this.currentTab) {
      case 'visitor': return '🌐 ระบบจัดห้องคุมสอบ กพ. และคุรุสภา — มหาวิทยาลัยราชภัฏบุรีรัมย์';
      case 'my-profile': return 'ตารางการปฏิบัติงานคุมสอบของฉัน';
      case 'my-availability': return 'เลือกวันเวลาสะดวก & โควต้าในการคุมสอบ';
      case 'rooms-overview': return 'ข้อมูลอาคาร 17 และห้องสอบปฏิบัติการคอมพิวเตอร์ (CBT Center)';
      case 'dashboard': return 'แดชบอร์ดภาพรวมการจัดสอบ';
      case 'scheduler': return 'จัดตารางและตรวจสอบผู้คุมสอบ';
      case 'proctors': {
        if (this.proctorSubTab === 'quota') return 'จัดการกลุ่มบุคลากร & กำหนดโควต้าการคุมสอบ (Core & Reserve Pool)';
        if (this.proctorSubTab === 'info') return 'จัดการข้อมูลผู้คุมสอบ';
        if (this.proctorSubTab === 'personal-summary') return 'สรุปตารางคุมสอบรายบุคคล และภาระงาน';
        if (this.proctorSubTab === 'swaps') return 'คำขอเปลี่ยนตัว & สลับตัวผู้คุมสอบ';
        if (this.proctorSubTab === 'docs') return 'เอกสารและคำสั่งแต่งตั้งกรรมการคุมสอบ';
        return 'จัดการข้อมูลผู้คุมสอบ';
      }
      case 'rooms': {
        if (this.roomsSubTab === 'seating-grid') return 'ห้องสอบและผังที่นั่ง (10 ห้องสอบมาตรฐาน)';
        if (this.roomsSubTab === 'table') return 'จัดการข้อมูลห้องสอบ (10 ห้อง)';
        if (this.roomsSubTab === 'blueprint') return 'ผังอาคาร 17 (ศูนย์สอบ CBT)';
        if (this.roomsSubTab === 'directory') return 'สารบบอาคาร 17 (Building Directory)';
        return 'จัดการข้อมูลห้องสอบและผังอาคาร 17';
      }
      case 'master-data': {
        if (this.masterDataSubTab === 'proctors') return 'ข้อมูลระบบ: ข้อมูลผู้คุมสอบ';
        if (this.masterDataSubTab === 'sessions') return 'ข้อมูลระบบ: รอบการสอบ';
        if (this.masterDataSubTab === 'examinees') return 'ข้อมูลระบบ: ข้อมูลผู้เข้าสอบ (CBT Center อาคาร 17)';
        return 'ข้อมูลระบบ (รอบการสอบ & ช่วงเวลาไม่ว่าง)';
      }
      case 'what-if': return 'เครื่องมือจำลองสถานการณ์ (What-if Simulator)';
      case 'versions': return 'ประวัติเวอร์ชันและเปรียบเทียบการเปลี่ยนแปลง';
      case 'settings': return 'ตั้งค่ากฎเกณฑ์ โควต้า และน้ำหนักคะแนน';
      case 'audit': return 'บันทึกประวัติการเปลี่ยนแปลง (Audit Trail)';
      case 'tests': return 'รันชุดทดสอบอัตโนมัติ (Automated Tests & Benchmarks)';
      default: return 'ระบบจัดตารางผู้คุมสอบ';
    }
  }

  renderActiveTab(valResult, totalSlots, assignedSlots, isComplete) {
    switch (this.currentTab) {
      case 'visitor':
        return renderVisitorPortal(appState);
      case 'my-profile':
        return this.renderMyProfileTab();
      case 'my-availability':
        return this.renderMyAvailabilityTab();
      case 'rooms-overview':
        return this.renderRoomsOverviewTab();
      case 'dashboard':
        return this.renderDashboardTab(valResult, totalSlots, assignedSlots, isComplete);
      case 'scheduler':
        return this.renderSchedulerTab(valResult, totalSlots, assignedSlots);
      case 'proctors':
        return this.renderProctorsPage();
      case 'rooms':
        return this.renderRoomsPage();
      case 'master-data':
        return this.renderMasterDataTab();
      case 'what-if':
        return this.renderWhatIfTab();
      case 'versions':
        return this.renderVersionsTab();
      case 'settings':
        return this.renderSettingsTab();
      case 'audit':
        return this.renderAuditTab();
      case 'tests':
        return this.renderTestsTab();
      default:
        return '<div>ไม่พบหน้าที่ระบุ</div>';
    }
  }

  // --- 7.0 หน้าข้อมูลและตารางส่วนบุคคล (สำหรับอาจารย์ และ ผู้คุมสอบ) ---
  renderMyProfileTab() {
    let proctor = appState.getLoggedInProctor();
    // อำนวยความสะดวกสำหรับอาจารย์/ผู้คุมสอบ และ Admin เมื่อเปิดดูหน้าโปรไฟล์
    if (!proctor && appState.proctors.length > 0) {
      const targetId = this.activeViewingProctorId || (appState.currentUser?.proctorId) || appState.proctors[0].id;
      proctor = appState.proctors.find(p => p.id === targetId) || appState.proctors[0];
    }
    if (!proctor) {
      return `
        <div class="card" style="text-align: center; padding: 40px; border-top: 4px solid var(--accent-500);">
          <div style="font-size: 48px; margin-bottom: 12px;">👤</div>
          <h2 style="margin-bottom: 8px;">ยังไม่พบข้อมูลผู้คุมสอบในระบบ</h2>
          <p style="color: var(--text-muted); font-size: 15px;">กรุณาเพิ่มข้อมูลผู้คุมสอบในระบบก่อน</p>
        </div>
      `;
    }

    // หางานของคนนี้
    const myAssignments = appState.assignments.filter(a => a.proctorId === proctor.id);
    const myUnavails = appState.unavailabilities.filter(u => u.proctorId === proctor.id);

    const sessionMap = new Map(appState.sessions.map(s => [s.id, s]));
    const roomMap = new Map(appState.rooms.map(r => [r.id, r]));

    // คำนวณชั่วโมงปฏิบัติงาน
    let totalMinutes = 0;
    for (const a of myAssignments) {
      const s = sessionMap.get(a.sessionId);
      if (s) {
        const start = new Date(new Date(s.startTime).getTime() - s.prepMinutes * 60000);
        const end = new Date(new Date(s.endTime).getTime() + s.wrapMinutes * 60000);
        totalMinutes += (end - start) / 60000;
      }
    }
    const totalHours = (totalMinutes / 60).toFixed(1);

    return `
      <!-- แถบเลือก/สลับชื่อผู้คุมสอบด่วน (สะดวกมากสำหรับเปิดในโทรศัพท์มือถือ) -->
      <div class="card mobile-proctor-quickbar" style="border-left: 4.5px solid var(--primary-600); margin-bottom: 14px; background: linear-gradient(135deg, var(--bg-surface), var(--primary-50));">
        <div class="card-body" style="padding: 12px 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px;">👤</span>
              <div>
                <strong style="font-size: 15px; color: var(--text-main);">เลือกชื่ออาจารย์ / ผู้คุมสอบ:</strong>
                <div style="font-size: 11.5px; color: var(--text-muted);">แตะเลือกชื่อของท่านเพื่อดูตารางคุมสอบ วัน เวลา ห้องสอบ และเพื่อนร่วมคุมห้องทันที</div>
              </div>
            </div>
            <div style="flex: 1; min-width: 240px; max-width: 100%;">
              <select id="select-active-proctor-mobile" class="form-select mobile-proctor-select" style="width: 100%; font-size: 14px; font-weight: 600; padding: 8px 12px; border: 2px solid var(--primary-500); border-radius: var(--radius-md); background-color: var(--bg-surface-elevated); color: var(--text-main); cursor: pointer;">
                <optgroup label="👑 สิทธิ์ผู้ดูแลระบบ">
                  <option value="admin" ${appState.isAdmin() && !this.activeViewingProctorId ? 'selected' : ''}>👑 ผู้ดูแลระบบ (Admin) - โหมดจัดการเต็มรูปแบบ</option>
                </optgroup>
                <optgroup label="👨‍🏫 อาจารย์ผู้คุมสอบ (Faculty)">
                  ${appState.proctors.filter(p => p.proctorType === 'faculty').map(p => `
                    <option value="${p.id}" ${proctor && proctor.id === p.id ? 'selected' : ''}>
                      ${appState.formatProctorDisplayName(p)} (${p.department || 'อาจารย์'})
                    </option>
                  `).join('')}
                </optgroup>
                <optgroup label="👤 เจ้าหน้าที่ศูนย์คอมพิวเตอร์และอินเทอร์เน็ต (Staff)">
                  ${appState.proctors.filter(p => p.proctorType === 'staff').map(p => `
                    <option value="${p.id}" ${proctor && proctor.id === p.id ? 'selected' : ''}>
                      ${appState.formatProctorDisplayName(p)} (${p.department || 'เจ้าหน้าที่'})
                    </option>
                  `).join('')}
                </optgroup>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- โปรไฟล์ส่วนบุคคล -->
      <div class="card" style="border-top: 4px solid var(--primary-500); background: linear-gradient(135deg, var(--bg-surface), var(--primary-50));">
        <div class="card-body" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 18px;">
            <div style="width: 60px; height: 60px; border-radius: var(--radius-full); background: linear-gradient(135deg, var(--primary-600), var(--accent-500)); color: white; display: flex; align-items: center; justify-content: center; font-size: 28px; box-shadow: var(--shadow-md);">
              ${proctor.proctorType === 'faculty' ? '👨‍🏫' : '👤'}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <h2 style="font-size: 20px; font-weight: 700;">${appState.formatProctorDisplayName(proctor)}</h2>
                <span class="role-tag ${proctor.proctorType === 'faculty' ? 'teacher' : 'proctor'}">
                  ${proctor.proctorType === 'faculty' ? '👨‍🏫 อาจารย์' : '👤 เจ้าหน้าที่'} (${proctor.level === 'chief' ? 'หัวหน้าห้องได้' : 'ผู้ช่วย'})
                </span>
                <span class="badge ${proctor.isActive ? 'badge-normal' : 'badge-danger'}">
                  ${proctor.isActive ? 'พร้อมปฏิบัติงาน' : 'งดรับงาน'}
                </span>
              </div>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                รหัส: <strong>${proctor.id}</strong> | สังกัด: <strong>${proctor.department}</strong> | 📞 ${proctor.phone} | ✉️ ${proctor.email}
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" id="btn-sudden-leave-modal" style="font-weight: 700; box-shadow: 0 2px 8px rgba(59,31,84,0.25); display: flex; align-items: center; gap: 6px;">
              <span>🔄 ขอสลับตัว / เปลี่ยนตัว</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ส่วนที่ 1: ตารางคุมสอบที่ได้รับมอบหมาย -->
      <div class="card" style="margin-top: 6px;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div class="card-title">📅 ตารางการปฏิบัติงานคุมสอบของฉัน (${myAssignments.length} รอบ)</div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-accent btn-sm" id="btn-print-my-schedule">
              🖨️ พิมพ์ตารางคุมสอบของฉัน (PDF)
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-goto-scheduler-from-profile" title="ดูเอกสารคำสั่งแต่งตั้งคณะกรรมการกำกับการสอบภาคความรู้ความสามารถทั่วไป (ก.พ.) ฉบับทางการ">
              ดูตารางภาพรวมทั้งหมด →
            </button>
          </div>
        </div>
        <div class="card-body" style="padding: 0;">
          <!-- Desktop View: ตารางเต็ม 7 คอลัมน์ -->
          <div class="table-wrapper desktop-only" style="border: none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>รอบสอบ</th>
                  <th>วันที่</th>
                  <th>เวลาปฏิบัติงานจริง (รวมเตรียมตัว)</th>
                  <th>ห้องสอบ CBT</th>
                  <th>อาคาร / ชั้น</th>
                  <th>หน้าที่</th>
                  <th>ผู้ร่วมคุมห้อง</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                ${myAssignments.map(a => {
                  const s = sessionMap.get(a.sessionId);
                  const r = roomMap.get(a.roomId);
                  if (!s) return '';
                  const startWithPrep = new Date(new Date(s.startTime).getTime() - s.prepMinutes * 60000);
                  const endWithWrap = new Date(new Date(s.endTime).getTime() + s.wrapMinutes * 60000);

                  const coAssigns = appState.assignments.filter(other => 
                    other.sessionId === a.sessionId && 
                    other.roomId === a.roomId && 
                    other.proctorId !== proctor.id
                  );
                  const coProctorText = coAssigns.map(other => {
                    const cp = appState.proctors.find(x => x.id === other.proctorId);
                    if (!cp) return null;
                    return `${appState.formatProctorDisplayName(cp)} (${other.role === 'chief' ? 'หัวหน้าห้อง' : 'ผู้ช่วย'})${cp.phone ? ` 📞${cp.phone}` : ''}`;
                  }).filter(Boolean).join('<br>') || '-';

                  return `
                    <tr>
                      <td><strong>${s.name}</strong> (${s.id})</td>
                      <td>${formatThaiDate(s.date)}</td>
                      <td>
                        <strong style="color: var(--primary-600);">${formatThaiTimeRange(startWithPrep, endWithWrap)}</strong>
                        <div style="font-size: 11px; color: var(--text-muted);">(เวลาสอบจริง: ${formatThaiTimeRange(s.startTime, s.endTime)})</div>
                      </td>
                      <td>
                        <span class="badge" style="background: var(--accent-50); color: var(--accent-600); border: 1px solid var(--accent-200); font-weight: 700;">
                          💻 ${r ? r.name : (a.role === 'reserve' ? 'กองอำนวยการ' : a.roomId)}
                        </span>
                      </td>
                      <td>${r ? `${r.building} (ชั้น ${r.floor})` : '-'}</td>
                      <td>
                        <span class="badge ${a.role === 'chief' ? 'badge-warning' : 'badge-normal'}">
                          ${a.role === 'chief' ? '⭐ หัวหน้าห้อง' : (a.role === 'reserve' ? '🛡️ ผู้คุมสำรอง' : '👤 ผู้ช่วย')}
                        </span>
                      </td>
                      <td>${coProctorText}</td>
                      <td>
                        <span class="badge ${a.status === 'locked' ? 'badge-locked' : 'badge-normal'}">
                          ${a.status === 'locked' ? '🔒 ยืนยันแล้ว' : '✅ ปกติ'}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
                ${myAssignments.length === 0 ? `
                  <tr>
                    <td colspan="8" style="text-align: center; padding: 24px; color: var(--text-muted);">
                      ยังไม่มีรอบสอบที่ได้รับมอบหมายในขณะนี้
                    </td>
                  </tr>
                ` : ''}
              </tbody>
            </table>
          </div>

          <!-- Mobile View: การ์ดภาระงานสะอาดตา ไร้การเลื่อนล้นจอ เหมาะกับหน้าจอมือถือ -->
          <div class="mobile-schedule-cards mobile-only" style="padding: 10px; display: flex; flex-direction: column; gap: 12px;">
            ${myAssignments.map(a => {
              const s = sessionMap.get(a.sessionId);
              const r = roomMap.get(a.roomId);
              if (!s) return '';
              const startWithPrep = new Date(new Date(s.startTime).getTime() - s.prepMinutes * 60000);
              const endWithWrap = new Date(new Date(s.endTime).getTime() + s.wrapMinutes * 60000);

              const coAssigns = appState.assignments.filter(other => 
                other.sessionId === a.sessionId && 
                other.roomId === a.roomId && 
                other.proctorId !== proctor.id
              );
              const coProctors = coAssigns.map(other => {
                const cp = appState.proctors.find(x => x.id === other.proctorId);
                if (!cp) return null;
                return {
                  name: appState.formatProctorDisplayName(cp),
                  role: other.role === 'chief' ? 'หัวหน้าห้อง' : (other.role === 'reserve' ? 'สำรอง' : 'ผู้ช่วย'),
                  phone: cp.phone || ''
                };
              }).filter(Boolean);

              return `
                <div class="m-card-schedule">
                  <div class="m-card-header">
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                      <span class="badge" style="background: var(--primary-100); color: var(--primary-800); font-weight: 700; font-size: 11px;">${s.id}</span>
                      <strong class="m-card-title">${s.name}</strong>
                    </div>
                    <span class="badge ${a.status === 'locked' ? 'badge-locked' : 'badge-normal'}" style="font-size: 11px;">
                      ${a.status === 'locked' ? '🔒 ยืนยันแล้ว' : '✅ ปกติ'}
                    </span>
                  </div>

                  <div class="m-card-datetime" style="background: rgba(126, 34, 206, 0.05); padding: 8px 10px; border-radius: var(--radius-sm); margin: 4px 0;">
                    <div style="display: flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; color: var(--text-main);">
                      <span>📅 ${formatThaiDate(s.date)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--primary-700); margin-top: 3px;">
                      <span>⏰ เวลาปฏิบัติงาน: <strong>${formatThaiTimeRange(startWithPrep, endWithWrap)}</strong></span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                      (เวลาสอบจริง: ${formatThaiTimeRange(s.startTime, s.endTime)} • เตรียมตัวก่อนสอบ ${s.prepMinutes || 30} นาที)
                    </div>
                  </div>

                  <div class="m-card-body">
                    <div class="m-card-row">
                      <span class="m-card-label" style="font-weight: 600;">ห้องสอบ CBT:</span>
                      <span class="badge" style="background: var(--accent-50); color: var(--accent-700); border: 1px solid var(--accent-200); font-weight: 700; font-size: 12.5px;">
                        💻 ${r ? r.name : (a.role === 'reserve' ? 'กองอำนวยการ' : a.roomId)}
                      </span>
                    </div>
                    <div class="m-card-row">
                      <span class="m-card-label">อาคาร / ชั้น:</span>
                      <span style="font-weight: 600; color: var(--text-main);">${r ? `${r.building} (ชั้น ${r.floor})` : '-'}</span>
                    </div>
                    <div class="m-card-row">
                      <span class="m-card-label">หน้าที่ของท่าน:</span>
                      <span class="badge ${a.role === 'chief' ? 'badge-warning' : 'badge-normal'}" style="font-size: 12.5px; font-weight: 700;">
                        ${a.role === 'chief' ? '⭐ หัวหน้าห้อง' : (a.role === 'reserve' ? '🛡️ ผู้คุมสำรอง' : '👤 ผู้ช่วยคุมสอบ')}
                      </span>
                    </div>

                    ${coProctors.length > 0 ? `
                      <div class="m-card-row" style="align-items: flex-start; padding-top: 6px; border-top: 1px dashed var(--border-subtle); margin-top: 4px;">
                        <span class="m-card-label" style="font-weight: 600; color: var(--text-main);">👥 คุมร่วมกับ:</span>
                        <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
                          ${coProctors.map(cp => `
                            <div style="font-size: 12.5px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px;">
                              <span style="font-weight: 600;">${cp.name} <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">(${cp.role})</span></span>
                              ${cp.phone ? `<a href="tel:${cp.phone}" style="color: var(--primary-600); text-decoration: none; font-size: 11.5px; font-weight: 600; background: var(--primary-50); padding: 2px 6px; border-radius: 4px;">📞 ${cp.phone}</a>` : ''}
                            </div>
                          `).join('')}
                        </div>
                      </div>
                    ` : ''}
                  </div>

                  <div class="m-card-actions" style="display: flex; gap: 8px; margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--border-subtle);">
                    <button class="btn btn-accent btn-sm" data-action="print-my-schedule" style="flex: 1; justify-content: center; font-size: 12.5px; font-weight: 600;">
                      🖨️ พิมพ์ตาราง PDF
                    </button>
                    <button class="btn btn-secondary btn-sm" data-action="sudden-leave" style="flex: 1; justify-content: center; font-size: 12.5px;">
                      🔄 ขอสลับตัว / เปลี่ยนตัว
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
            ${myAssignments.length === 0 ? `
              <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13.5px;">
                ยังไม่มีรอบสอบที่ได้รับมอบหมายในขณะนี้
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // --- 7.0.1 หน้าเลือกวันเวลาสะดวก & โควต้าคุมสอบของฉัน (สำหรับอาจารย์ และ เจ้าหน้าที่) ---
  renderMyAvailabilityTab() {
    let proctor = appState.getLoggedInProctor();
    if (!proctor && appState.proctors.length > 0) {
      const targetId = this.activeViewingProctorId || appState.proctors[0].id;
      proctor = appState.proctors.find(p => p.id === targetId) || appState.proctors[0];
    }
    if (!proctor) {
      return `
        <div class="card" style="text-align: center; padding: 40px; border-top: 4px solid var(--accent-500);">
          <div style="font-size: 48px; margin-bottom: 12px;">👤</div>
          <h2 style="margin-bottom: 8px;">ยังไม่พบข้อมูลผู้คุมสอบในระบบ</h2>
          <p style="color: var(--text-muted); font-size: 15px;">กรุณาเพิ่มข้อมูลผู้คุมสอบในระบบก่อน</p>
        </div>
      `;
    }

    // ดึงวันสอบทั้งหมดที่มีในระบบ
    const allExamDates = Array.from(new Set(appState.sessions.map(s => s.date))).sort();
    const availableDates = proctor.availableDates || [];

    return `
      <div style="max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">
        <!-- แถบเลือกชื่ออาจารย์/ผู้คุมสอบ (สำหรับปรับความพร้อม & โควต้า) -->
        <div class="card mobile-proctor-quickbar" style="border-left: 4.5px solid var(--accent-500); background: linear-gradient(135deg, var(--bg-surface), rgba(245,158,11,0.06));">
          <div class="card-body" style="padding: 12px 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 24px;">📅</span>
                <div>
                  <strong style="font-size: 15px; color: var(--text-main);">เลือกวันสะดวก & โควต้าของ:</strong>
                  <div style="font-size: 11.5px; color: var(--text-muted);">แตะเลือกชื่ออาจารย์เพื่อดูหรือกำหนดวันสะดวกและโควต้า</div>
                </div>
              </div>
              <div style="flex: 1; min-width: 240px; max-width: 100%; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <select id="select-active-proctor-avail" class="form-select mobile-proctor-select" style="flex: 1; min-width: 200px; font-size: 14px; font-weight: 600; padding: 8px 12px; border: 2px solid var(--accent-500); border-radius: var(--radius-md); background-color: var(--bg-surface-elevated); color: var(--text-main); cursor: pointer;">
                  <optgroup label="👑 สิทธิ์ผู้ดูแลระบบ">
                    <option value="admin" ${appState.isAdmin() && !this.activeViewingProctorId ? 'selected' : ''}>👑 ผู้ดูแลระบบ (Admin) - กลับแดชบอร์ดภาพรวม</option>
                  </optgroup>
                  <optgroup label="👨‍🏫 อาจารย์ผู้คุมสอบ (Faculty)">
                    ${appState.proctors.filter(p => p.proctorType === 'faculty').map(p => `
                      <option value="${p.id}" ${proctor && proctor.id === p.id ? 'selected' : ''}>
                        ${appState.formatProctorDisplayName(p)} (${p.department || 'อาจารย์'})
                      </option>
                    `).join('')}
                  </optgroup>
                  <optgroup label="👤 เจ้าหน้าที่ศูนย์คอมพิวเตอร์และอินเทอร์เน็ต (Staff)">
                    ${appState.proctors.filter(p => p.proctorType === 'staff').map(p => `
                      <option value="${p.id}" ${proctor && proctor.id === p.id ? 'selected' : ''}>
                        ${appState.formatProctorDisplayName(p)} (${p.department || 'เจ้าหน้าที่'})
                      </option>
                    `).join('')}
                  </optgroup>
                </select>
                <button class="btn btn-secondary btn-sm" id="btn-open-user-modal-inline" type="button" style="white-space: nowrap; font-size: 12.5px;" title="เปิดหน้าต่างสลับบทบาทหรือเข้าสู่ระบบ">
                  🔑 สลับบัญชี
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Header Card -->
        <div class="card" style="border-top: 4px solid var(--accent-500); background: linear-gradient(135deg, var(--bg-surface), rgba(245,158,11,0.08));">
          <div class="card-body" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-600), var(--accent-500)); color: white; display: flex; align-items: center; justify-content: center; font-size: 26px; box-shadow: var(--shadow-md);">
                📅
              </div>
              <div>
                <h2 style="font-size: 20px; font-weight: 700; margin: 0;">ตั้งค่าวันเวลาสะดวก & โควต้าคุมสอบของฉัน</h2>
                <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
                  ผู้คุมสอบ: <strong>${proctor.academicTitle ? proctor.academicTitle + ' ' : ''}${proctor.firstName} ${proctor.lastName}</strong> (${proctor.id}) | สังกัด: <strong>${proctor.department}</strong>
                </div>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-back-to-my-profile">
              👤 กลับไปยังตารางของฉัน
            </button>
          </div>
        </div>

        <form id="form-my-availability-preferences">
          <input type="hidden" name="proctorId" value="${proctor.id}">

          <!-- ส่วนที่ 1: เลือกวันที่สะดวกปฏิบัติหน้าที่ -->
          <div class="card" style="margin-bottom: 20px;">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div>
                <div class="card-title">📅 1. เลือกวันที่สะดวกปฏิบัติหน้าที่ (Available Exam Dates)</div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                  ระบบจะจัดตารางเฉพาะวันที่ท่านติ๊กเลือกเท่านั้น (Hard Rule H4: ห้ามจัดในวันไม่สะดวกเด็ดขาด)
                </div>
              </div>
              <div style="display: flex; gap: 6px;">
                <button type="button" class="btn btn-secondary btn-sm" data-action="select-all-dates">✓ เลือกทุกวัน</button>
                <button type="button" class="btn btn-secondary btn-sm" data-action="clear-all-dates">✕ ล้างการเลือก</button>
              </div>
            </div>
            <div class="card-body">
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${allExamDates.map(dStr => {
                  const isChecked = availableDates.length === 0 || availableDates.includes(dStr);
                  const sessionsOnDate = appState.sessions.filter(s => s.date === dStr);
                  return `
                    <label style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--bg-surface-elevated, #f8fafc); border: 2px solid ${isChecked ? 'var(--primary-500)' : 'var(--border-subtle)'}; border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;">
                      <div style="display: flex; align-items: center; gap: 12px;">
                        <input type="checkbox" name="availableDates" value="${dStr}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--primary-600);">
                        <div>
                          <div style="font-weight: 700; font-size: 15px; color: var(--text-main);">
                            ${formatThaiDate(dStr)}
                          </div>
                          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                            ${sessionsOnDate.map(s => `• ${s.name} (${s.startTime.includes('T') ? s.startTime.split('T')[1].slice(0,5) : s.startTime} - ${s.endTime.includes('T') ? s.endTime.split('T')[1].slice(0,5) : s.endTime} น.)`).join(' ')}
                          </div>
                        </div>
                      </div>
                      <span class="badge" style="background: ${isChecked ? 'var(--success-50)' : 'var(--bg-surface)'}; color: ${isChecked ? 'var(--success-700)' : 'var(--text-muted)'}; border: 1px solid ${isChecked ? 'var(--success-200)' : 'var(--border-subtle)'}; font-weight: 600;">
                        ${isChecked ? '✓ ยินดีรับงาน' : '✕ ไม่สะดวก'}
                      </span>
                    </label>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

          <!-- ส่วนที่ 2: รูปแบบกะ/ช่วงเวลาที่ต้องการ -->
          <div class="card" style="margin-bottom: 20px;">
            <div class="card-header">
              <div class="card-title">⏰ 2. รูปแบบกะที่ต้องการ (Session Pattern)</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                ระบุลักษณะการจัดรอบสอบต่อวันที่เหมาะสมกับตารางงานของท่าน
              </div>
            </div>
            <div class="card-body">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
                <label style="display: flex; flex-direction: column; gap: 6px; padding: 14px; background: var(--bg-surface-elevated, #f8fafc); border: 2px solid ${proctor.sessionPattern === 'FULL_DAY_PAIRED' ? 'var(--primary-500)' : 'var(--border-subtle)'}; border-radius: var(--radius-md); cursor: pointer;">
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px;">
                      <input type="radio" name="sessionPattern" value="FULL_DAY_PAIRED" ${proctor.sessionPattern === 'FULL_DAY_PAIRED' ? 'checked' : ''} style="accent-color: var(--primary-600);">
                      <span>🌅+🌇 เช้า + บ่าย คู่กัน</span>
                    </div>
                    <span class="badge badge-normal" style="font-size: 10px;">แนะนำ</span>
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4; padding-left: 24px;">
                    คุมทั้งวันจบในวันเดียว ลดจำนวนวันที่ต้องเดินทางมามหาวิทยาลัย
                  </div>
                </label>

                <label style="display: flex; flex-direction: column; gap: 6px; padding: 14px; background: var(--bg-surface-elevated, #f8fafc); border: 2px solid ${proctor.sessionPattern === 'SINGLE_PER_DAY' ? 'var(--primary-500)' : 'var(--border-subtle)'}; border-radius: var(--radius-md); cursor: pointer;">
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px;">
                      <input type="radio" name="sessionPattern" value="SINGLE_PER_DAY" ${proctor.sessionPattern === 'SINGLE_PER_DAY' ? 'checked' : ''} style="accent-color: var(--primary-600);">
                      <span>⏱️ วันละ 1 รอบเท่านั้น</span>
                    </div>
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4; padding-left: 24px;">
                    รับงานวันละ 1 รอบเท่านั้น สำหรับท่านที่ติดภารกิจอื่นในวันเดียวกัน
                  </div>
                </label>

                <label style="display: flex; flex-direction: column; gap: 6px; padding: 14px; background: var(--bg-surface-elevated, #f8fafc); border: 2px solid ${proctor.sessionPattern === 'ANY' ? 'var(--primary-500)' : 'var(--border-subtle)'}; border-radius: var(--radius-md); cursor: pointer;">
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px;">
                      <input type="radio" name="sessionPattern" value="ANY" ${proctor.sessionPattern === 'ANY' ? 'checked' : ''} style="accent-color: var(--primary-600);">
                      <span>🔄 ยืดหยุ่น รอบใดก็ได้</span>
                    </div>
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4; padding-left: 24px;">
                    ยินดีรับงานเช้าหรือบ่าย หรือทั้งวันตามที่ระบบเห็นสมควร
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- ส่วนที่ 3: เลือกโควต้าในการคุมสอบของตัวเอง -->
          <div class="card" style="margin-bottom: 20px;">
            <div class="card-header">
              <div class="card-title">🎯 3. เลือกโควต้าในการคุมสอบของตัวเอง (Personal Quota Limits)</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                ระบบจะคำนวณและล็อกไม่ให้จัดเกินเพดานโควต้าที่ท่านเลือกอย่างเด็ดขาด (Hard Rule H3)
              </div>
            </div>
            <div class="card-body">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">
                    โควต้าสูงสุดต่อวัน (รอบ/วัน) <span style="color:var(--danger-500);">*</span>
                  </label>
                  <select class="form-select" name="dailyQuota" required>
                    <option value="1" ${proctor.dailyQuota === 1 ? 'selected' : ''}>1 รอบ / วัน (คุมไม่เกินวันละ 1 รอบ)</option>
                    <option value="2" ${proctor.dailyQuota !== 1 ? 'selected' : ''}>2 รอบ / วัน (คุมได้ทั้งเช้าและบ่าย)</option>
                  </select>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                    * หากเลือก 1 รอบ ระบบจะไม่จัดให้ท่านคุมสองรอบในวันเดียวกัน
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">
                    โควต้ารวมสูงสุดทั้งโครงการ (รอบ) <span style="color:var(--danger-500);">*</span>
                  </label>
                  <select class="form-select" name="projectQuota" id="select-my-project-quota" style="font-size: 13px; font-weight: 600;" required>
                    ${[1, 2, 3, 4, 5, 6].map(q => `
                      <option value="${q}" ${(proctor.projectQuota === q || (!proctor.projectQuota && q === 6)) ? 'selected' : ''}>
                        โควต้า ${q} รอบ ${q === 6 ? '(เต็มโครงการ 3 วัน)' : ''}
                      </option>
                    `).join('')}
                    <option value="0" ${proctor.projectQuota === 0 ? 'selected' : ''}>0 รอบ (งดรับงาน / พักงาน)</option>
                  </select>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                    * เลือกจำนวนรอบที่ท่านสะดวกคุมสอบตลอดทั้งโครงการ (1 - 6 รอบ)
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">
                    จำนวนชั่วโมงปฏิบัติงานสูงสุด (ชั่วโมง)
                  </label>
                  <input type="number" class="form-input" name="maxHours" min="1" max="50" step="0.5" value="${proctor.maxHours ?? 18}" required>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                    เพดานสะสมชั่วโมงคุมสอบจริง (รวมเวลาเตรียมตัว)
                  </div>
                </div>
              </div>

              <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 10px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px;">
                  <input type="checkbox" name="keepSameRoom" value="1" ${proctor.keepSameRoom !== false ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--primary-600);">
                  <span><strong>ขอคุมห้องเดิมตลอดวัน (Room Stickiness):</strong> หากมีงานทั้งเช้าและบ่าย ขอประจำห้องเดิม ไม่ต้องย้ายห้องสอบ</span>
                </label>

                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px;">
                  <input type="checkbox" name="isActive" value="1" ${proctor.isActive !== false ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--success-600);">
                  <span><strong>สถานะพร้อมปฏิบัติหน้าที่ (Active):</strong> พร้อมรับการจัดสรรงานในโครงการนี้ (หากไม่ติ๊ก = งดรับงานทุกกรณี)</span>
                </label>
              </div>
            </div>
          </div>

          <!-- ปุ่มบันทึก -->
          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 30px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-my-preferences" style="padding: 10px 20px;">
              ยกเลิก
            </button>
            <button type="submit" class="btn btn-primary" style="padding: 10px 28px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(126,34,206,0.3);">
              💾 บันทึกความพร้อม & โควต้าของฉัน
            </button>
          </div>
        </form>
      </div>
    `;
  }

  // --- 7.0.2 หน้าข้อมูลอาคาร 17 และห้องสอบ สำหรับผู้คุมสอบ ---
  renderRoomsOverviewTab() {
    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div class="card" style="border-top: 4px solid var(--primary-500); background: linear-gradient(135deg, var(--bg-surface), rgba(126,34,206,0.06));">
          <div class="card-body" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-600), var(--primary-800)); color: white; display: flex; align-items: center; justify-content: center; font-size: 24px;">
                🏢
              </div>
              <div>
                <h2 style="font-size: 18px; font-weight: 700; margin: 0;">ทำเนียบห้องปฏิบัติการคอมพิวเตอร์และผังอาคาร 17 (CBT Center)</h2>
                <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
                  ศูนย์สอบคอมพิวเตอร์มาตรฐาน 10 ห้องสอบ 520 ที่นั่ง สำหรับผู้คุมสอบตรวจสอบผังโต๊ะสอบ สเปกห้อง และสิ่งอำนวยความสะดวก
                </div>
              </div>
            </div>

            <!-- Floor Switcher Buttons -->
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-sm ${this.roomOverviewFloor === 1 ? 'btn-primary' : 'btn-secondary'}" data-action="switch-room-floor" data-floor="1" style="font-weight: 700;">
                ผังชั้น 1 (ห้อง 1 - 4)
              </button>
              <button class="btn btn-sm ${this.roomOverviewFloor === 2 ? 'btn-primary' : 'btn-secondary'}" data-action="switch-room-floor" data-floor="2" style="font-weight: 700;">
                ผังชั้น 2 (ห้อง 5 - 10)
              </button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-body" style="padding: 16px;">
            ${this.roomOverviewFloor === 2 ? this.renderFloor2Blueprint() : this.renderFloor1Blueprint()}
          </div>
        </div>
      </div>
    `;
  }
  renderDashboardTab(valResult, totalSlots, assignedSlots, isComplete) {
    // แดชบอร์ดแสดงเฉพาะข้อมูลตารางที่กดยืนยันแล้วเท่านั้น (Confirmed Schedule Isolation)
    const confirmedAssigns = appState.confirmedAssignments || [];
    const dashValResult = validateSchedule({
      assignments: confirmedAssigns,
      allocations: appState.allocations,
      sessions: appState.sessions,
      proctors: appState.proctors,
      rooms: appState.rooms,
      unavailabilities: appState.unavailabilities,
      settings: appState.settings
    });
    const dashAssignedSlots = confirmedAssigns.length;
    const dashIsComplete = dashAssignedSlots >= totalSlots && dashValResult.isValid;
    const percentAssigned = totalSlots > 0 ? Math.round((dashAssignedSlots / totalSlots) * 100) : 0;

    const pendingSwapsCount = (appState.pendingSwaps || []).length;
    const needsSwapDoc = pendingSwapsCount > 0 && !appState.swapDocIssued;
    const hasDraftPending = Boolean(appState.hasUnconfirmedChanges) || (dashAssignedSlots === 0 && appState.assignments.length > 0);

    const activeRooms = appState.rooms.filter(r => r.isActive).length;
    const activeProctors = appState.proctors.filter(p => p.isActive).length;
    const chiefCount = appState.proctors.filter(p => p.isActive && p.level === 'chief').length;
    const totalCapacity = appState.rooms.reduce((s, r) => s + r.capacity, 0);

    // จัดกลุ่มรอบสอบตามวันที่
    const sessionsByDate = {};
    appState.sessions.forEach(s => {
      if (!sessionsByDate[s.date]) sessionsByDate[s.date] = [];
      sessionsByDate[s.date].push(s);
    });
    const sortedDates = Object.keys(sessionsByDate).sort();

    return `
      ${hasDraftPending ? `
        <div class="dashboard-draft-notice ${needsSwapDoc ? 'is-swap-locked' : ''}">
          <div class="dashboard-draft-notice-body">
            <span class="dashboard-draft-badge">${needsSwapDoc ? '🔒 รอออกใบเซ็นสลับ' : '📝 ตารางฉบับร่างรอยืนยัน'}</span>
            <div class="dashboard-draft-text">
              <strong>${needsSwapDoc
                ? `มีการสลับ/เปลี่ยนตัวผู้คุมสอบ ${pendingSwapsCount} รายการในฉบับร่าง — ต้องออกใบเซ็นสลับจาก ผศ.ดร.ณัฐพล แสนคำ ส่งตรวจก่อนจึงจะยืนยันได้`
                : `มีตารางฉบับร่างที่จัดไว้แล้ว (${appState.assignments.length}/${totalSlots} ตำแหน่ง) แต่ยังไม่ได้กดยืนยัน`}</strong>
              <span>หน้าแดชบอร์ดนี้แสดงเฉพาะข้อมูลที่ยืนยันแล้ว (${dashAssignedSlots} ตำแหน่ง) เพื่อความเป็นระบบ กรุณาตรวจสอบและกดยืนยันตารางก่อน</span>
            </div>
          </div>
          <button class="btn btn-accent btn-sm" id="btn-goto-confirm-schedule" type="button" style="white-space: nowrap;">
            ${needsSwapDoc ? '📄 ไปออกใบเซ็นและยืนยัน →' : '✅ ไปตรวจสอบและยืนยันตาราง →'}
          </button>
        </div>
      ` : ''}

      <!-- สรุปตัวชี้วัดหลัก 4 การ์ด (Modern KPI Cards v2) -->
      <div class="metrics-grid-modern">
        <!-- การ์ด 1: ห้องสอบ CBT -->
        <div class="kpi-card-v2 accent-primary" data-action="view-kpi-rooms" role="button" tabindex="0" title="คลิกเพื่อดูรายละเอียดห้องปฏิบัติการคอมพิวเตอร์ (CBT) ทั้ง 10 ห้อง">
          <div class="kpi-card-v2-header">
            <div class="kpi-icon-circle cbt">💻</div>
            <span class="kpi-click-badge">ดูห้อง ↗</span>
          </div>
          <div class="kpi-title-text">ห้องปฏิบัติการ CBT (อาคาร 17)</div>
          <div class="kpi-value-row">
            <div class="kpi-huge-number">${activeRooms} <span class="kpi-unit-label">ห้อง</span></div>
            ${(() => {
              const totalDis = (appState.rooms || []).reduce((s, r) => s + ((r.disabledSeats || []).length), 0);
              const totalUsable = Math.max(0, totalCapacity - totalDis);
              return totalDis > 0 
                ? `<div style="font-size: 13px; font-weight: 700; color: #15803D;">${totalUsable} เครื่อง (พร้อมใช้) / รวม ${totalCapacity}</div>`
                : `<div style="font-size: 13px; font-weight: 700; color: var(--primary-600);">${totalCapacity} เครื่อง</div>`;
            })()}
          </div>
          <div class="kpi-sub-detail">
            <span>🏛️ ชั้น 1 (4 ห้อง) &bull; ชั้น 2 (6 ห้อง)</span>
          </div>
        </div>

        <!-- การ์ด 2: ผู้คุมสอบในระบบ -->
        <div class="kpi-card-v2 accent-primary" data-action="view-kpi-proctors" role="button" tabindex="0" title="คลิกเพื่อดูรายชื่อและสถานะผู้คุมสอบทั้งหมด">
          <div class="kpi-card-v2-header">
            <div class="kpi-icon-circle proctors">👥</div>
            <span class="kpi-click-badge">ดูรายชื่อ ↗</span>
          </div>
          <div class="kpi-title-text">ผู้คุมสอบในระบบ</div>
          <div class="kpi-value-row">
            <div class="kpi-huge-number">${activeProctors} <span class="kpi-unit-label">คน</span></div>
            <div style="font-size: 13px; font-weight: 700; color: var(--brand-purple);">หัวหน้า ${chiefCount} คน</div>
          </div>
          <div class="kpi-sub-detail">
            <span>🛡️ หัวหน้าห้อง ${chiefCount} &bull; ผู้ช่วย ${activeProctors - chiefCount} คน</span>
          </div>
        </div>

        <!-- การ์ด 3: สถานะการจัดตาราง (เฉพาะที่ยืนยันแล้ว) -->
        <div class="kpi-card-v2 ${dashIsComplete ? 'accent-success' : 'accent-warning'}" data-action="view-kpi-schedule-status" role="button" tabindex="0" title="คลิกเพื่อดูสถานะความคืบหน้าการจัดตารางรายรอบ (เฉพาะตารางที่ยืนยันแล้ว)">
          <div class="kpi-card-v2-header">
            <div class="kpi-icon-circle schedule">🎯</div>
            <span class="kpi-click-badge">ความคืบหน้า ↗</span>
          </div>
          <div class="kpi-title-text">ความคืบหน้าจัดตาราง (ยืนยันแล้ว)</div>
          <div class="kpi-value-row">
            <div class="kpi-huge-number" style="color: ${dashIsComplete ? 'var(--success-500)' : 'var(--warning-600)'};">
              ${percentAssigned}%
            </div>
            <div style="font-size: 13px; font-weight: 700; color: var(--text-muted);">${dashAssignedSlots} / ${totalSlots} ที่นั่ง</div>
          </div>
          <div class="kpi-sub-detail">
            <div class="session-progress-track" style="flex: 1; height: 5px;">
              <div class="session-progress-fill ${dashIsComplete ? 'complete' : 'incomplete'}" style="width: ${percentAssigned}%;"></div>
            </div>
            <span style="font-weight: 600;">${dashIsComplete ? 'ยืนยันครบสมบูรณ์' : (dashAssignedSlots === 0 ? 'รอยืนยันตาราง' : `ขาด ${totalSlots - dashAssignedSlots}`)}</span>
          </div>
        </div>

        <!-- การ์ด 4: ตรวจสอบกฎเกณฑ์ H1-H8 (เฉพาะที่ยืนยันแล้ว) -->
        <div class="kpi-card-v2 ${dashValResult.errorCount > 0 ? 'accent-danger' : (dashValResult.warningCount > 0 ? 'accent-warning' : 'accent-success')}" data-action="view-kpi-rules-audit" role="button" tabindex="0" title="คลิกเพื่อดูรายงานการตรวจสอบกฎ H1-H8 และ S1-S7">
          <div class="kpi-card-v2-header">
            <div class="kpi-icon-circle rules">🛡️</div>
            <span class="kpi-click-badge">ผลตรวจสอบ ↗</span>
          </div>
          <div class="kpi-title-text">ผลตรวจสอบกฎระเบียบ</div>
          <div class="kpi-value-row">
            <div class="kpi-huge-number" style="color: ${dashValResult.errorCount > 0 ? 'var(--danger-500)' : 'var(--success-500)'};">
              ${dashValResult.errorCount} <span class="kpi-unit-label" style="font-size: 14px;">ข้อผิดพลาด</span>
            </div>
            <div style="font-size: 12px; font-weight: 600; color: var(--text-muted);">${dashValResult.warningCount} คำเตือน (Soft)</div>
          </div>
          <div class="kpi-sub-detail">
            <span>${dashValResult.errorCount > 0 ? '⚠️ ต้องแก้ไขก่อนใช้งานจริง' : (dashAssignedSlots === 0 ? '⏳ ยังไม่มีตารางที่ยืนยัน' : '✅ ผ่านเกณฑ์ Hard Rules H1-H8 ครบถ้วน')}</span>
          </div>
        </div>
      </div>

      <!-- ศูนย์สั่งการจัดตาราง (Hero Action Panel) ปรับปรุง UX ให้ชัดเจน ไม่รกรุงรัง -->
      <div class="hero-action-panel">
        <div class="hero-action-header">
          <div>
            <div class="hero-action-title">
              <span>⚡ ศูนย์สั่งการจัดตาราง (Quick Command Center)</span>
            </div>
            <div class="hero-action-desc">
              ระบบจัดตารางอัจฉริยะแบบ Greedy Constraint Satisfaction ตรวจสอบกฎ H1-H8 ครบทุกมิติ
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            <button class="btn btn-accent" id="btn-run-solver-quick" style="padding: 9px 20px;">
              🚀 เริ่มจัดตารางอัตโนมัติ
            </button>
            <button class="btn btn-secondary" id="btn-calc-min-proctor">
              🔍 คำนวณผู้คุมขั้นต่ำ
            </button>
            <!-- เครื่องมือทดสอบย่อย ยุบรวมใน Dropdown เรียบง่าย ไม่เกะกะสายตา -->
            <div style="position: relative; display: inline-block;">
              <button class="btn btn-secondary btn-sm" id="btn-toggle-dash-tools" type="button" onclick="const m=document.getElementById('dash-tools-menu-content'); if(m) m.style.display=(m.style.display==='none'||!m.style.display)?'block':'none'; event.stopPropagation();" style="padding: 8px 12px;">
                🧪 เครื่องมือทดสอบ ▾
              </button>
              <div id="dash-tools-menu-content" style="display: none; position: absolute; right: 0; top: 100%; margin-top: 6px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); z-index: 100; min-width: 250px; padding: 6px;">
                <button id="btn-quick-gen-proctors-hero" type="button" style="width: 100%; text-align: left; padding: 9px 12px; background: none; border: none; font-size: 13px; cursor: pointer; border-radius: 6px; display: flex; align-items: center; gap: 8px; color: var(--text-main);" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='none'">
                  🎲 สุ่มสร้างผู้คุมให้พอดี (80 คน)
                </button>
                <button id="btn-add-20-proctors-hero" type="button" style="width: 100%; text-align: left; padding: 9px 12px; background: none; border: none; font-size: 13px; cursor: pointer; border-radius: 6px; display: flex; align-items: center; gap: 8px; color: var(--text-main);" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='none'">
                  ➕ สุ่มเพิ่ม 20 คน
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- แถบสรุปสถานะความพร้อมแบบแถวเดียว กะทัดรัด (แทนการ์ดย่อย 4 ใบเดิมที่ซ้ำซ้อน) -->
        <div class="dash-status-strip">
          <span class="dash-status-item" data-quick-action="floor-plan" role="button" tabindex="0" title="คลิกเพื่อดูผังห้องสอบอาคาร 17">
            🏛️ อาคาร 17 (10 ห้อง 520 เครื่อง)
          </span>
          <span class="dash-status-sep">•</span>
          <span class="dash-status-item" data-quick-action="rules-audit" role="button" tabindex="0" title="คลิกเพื่อตรวจสอบรายงานกฎ H1-H8">
            🛡️ กฎ H1-H8 ${dashValResult.errorCount === 0 ? 'ผ่านครบถ้วน' : `พบข้อผิดพลาด ${dashValResult.errorCount} ข้อ`}
          </span>
          <span class="dash-status-sep">•</span>
          <span class="dash-status-item" data-quick-action="run-solver" role="button" tabindex="0" title="คลิกเพื่อเริ่มจัดตาราง">
            👥 ผู้คุมพร้อม ${activeProctors} คน
          </span>
        </div>
      </div>

      ${this.minProctorResult ? `
      <!-- กล่องแสดงผลลัพธ์การคำนวณจำนวนผู้คุมขั้นต่ำ -->
      <div class="card" style="border-left: 4px solid var(--primary-500);">
        <div class="card-header">
          <div class="card-title">💡 ผลการประเมินจำนวนผู้คุมขั้นต่ำ (Minimum Proctor Calculation)</div>
          <button class="btn btn-secondary btn-sm" id="btn-close-min-calc">ปิด</button>
        </div>
        <div class="card-body">
          <p style="font-size: 15px; margin-bottom: 12px; line-height: 1.6;">${this.minProctorResult.explanation}</p>
          <div style="font-weight: 600; margin-bottom: 6px;">คำแนะนำและทางเลือก:</div>
          <ul style="padding-left: 20px; line-height: 1.6;">
            ${this.minProctorResult.recommendations.map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>
      </div>` : ''}

      ${dashValResult.violations.length > 0 ? `
      <!-- กล่องสรุปข้อผิดพลาดและคำเตือนแบบกระชับ -->
      <div class="violations-summary-card ${dashValResult.errorCount > 0 ? 'has-error' : ''}">
        <div class="violations-summary-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 18px;">${dashValResult.errorCount > 0 ? '🚨' : '⚠️'}</span>
            <div>
              <strong style="color: ${dashValResult.errorCount > 0 ? 'var(--danger-600)' : 'var(--warning-600)'};">
                ${dashValResult.errorCount > 0 ? `พบข้อผิดพลาดที่ขัดกฎ Hard Constraints (${dashValResult.errorCount} ข้อ)` : `พบข้อสังเกต Soft Constraints (${dashValResult.warningCount} รายการ)`}
              </strong>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                แสดงตัวอย่าง 3 รายการแรก — คลิกปุ่มขวามือเพื่อดูและแก้ไขแบบเจาะลึก
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="violations-badge-counter">${dashValResult.violations.length} รายการ</span>
            <button class="btn btn-secondary btn-sm" data-action="view-kpi-rules-audit">
              ดูทั้งหมด ↗
            </button>
          </div>
        </div>
        <div style="padding: 14px 18px; display: flex; flex-direction: column; gap: 8px; background: var(--bg-surface);">
          ${dashValResult.violations.slice(0, 3).map(v => `
            <div class="alert ${v.severity === 'error' ? 'alert-danger' : 'alert-warning'}" style="margin: 0; padding: 10px 14px;">
              <div>
                <strong>[${v.ruleCode}] ${v.ruleName}:</strong> ${v.message}<br>
                <span style="font-size: 12px; opacity: 0.9;">💡 แนะนำ: ${v.suggestion}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <!-- รายการรอบการสอบ (Sessions Master Section) จัดกลุ่มตามวันที่ สะอาด สบายตา -->
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 10px;">
          <div>
            <div class="card-title">📋 รายการรอบการทดสอบ (${appState.sessions.length} รอบ)</div>
            <div class="card-subtitle">แสดงเฉพาะข้อมูลตารางผู้คุมสอบที่ผ่านการกดยืนยันแล้ว (${dashAssignedSlots}/${totalSlots} ตำแหน่ง)</div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <!-- สลับมุมมอง: ตารางละเอียด vs การ์ดสรุป -->
            <div class="view-toggle-group">
              <button class="view-toggle-btn ${this.dashboardSessionView === 'table' ? 'active' : ''}" data-session-view="table" title="แสดงตารางข้อมูลแบบละเอียด">
                📑 ตารางละเอียด
              </button>
              <button class="view-toggle-btn ${this.dashboardSessionView === 'cards' ? 'active' : ''}" data-session-view="cards" title="แสดงการ์ดข้อมูลแบบกระชับ">
                🗂️ การ์ดสรุป
              </button>
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-add-session-dash">
              ➕ เพิ่มรอบสอบใหม่
            </button>
            <button class="btn btn-primary btn-sm" id="btn-go-scheduler-full">
              ดูตารางผู้คุมแบบเต็ม →
            </button>
          </div>
        </div>

        <div class="card-body">
          ${this.dashboardSessionView === 'cards' ? `
            <!-- มุมมองการ์ดจัดกลุ่มตามวันที่ (Grouped by Date) -->
            <div class="session-date-groups-wrapper">
              ${sortedDates.map((dateStr, dateIdx) => {
                const daySessions = sessionsByDate[dateStr];
                return `
                  <div class="session-date-group">
                    <div class="session-date-header">
                      <span class="session-date-day-badge">วันที่ ${dateIdx + 1}</span>
                      <strong class="session-date-text">${formatThaiDate(dateStr, true)}</strong>
                      <span class="session-date-count">(${daySessions.length} รอบสอบ)</span>
                    </div>

                    <div class="session-cards-grid">
                      ${daySessions.map(s => {
                        const sAllocs = appState.allocations.filter(a => a.sessionId === s.id);
                        const sAssigns = confirmedAssigns.filter(a => a.sessionId === s.id);
                        const neededInSession = sAllocs.reduce((sum, al) => sum + (al.examineesInRoom > appState.settings.hardConstraints.h5_examinee_threshold_for_two_proctors ? 2 : 1), 0)
                          + appState.settings.hardConstraints.h8_reserve_proctors_per_session;
                        const isFull = sAssigns.length >= neededInSession;
                        const percentFull = neededInSession > 0 ? Math.min(100, Math.round((sAssigns.length / neededInSession) * 100)) : 0;

                        return `
                          <div class="session-card-modern ${isFull ? 'session-full' : 'session-incomplete'}">
                            <div class="session-card-header-clean">
                              <div style="display: flex; align-items: center; gap: 8px;">
                                <span class="session-id-pill ${isFull ? 'pill-success' : 'pill-warning'}">${s.id}</span>
                                <h4 class="session-card-title-clean">${s.name}</h4>
                              </div>
                              <span class="session-time-badge">
                                🕒 ${formatThaiTimeRange(s.startTime, s.endTime)}
                              </span>
                            </div>

                            <div class="session-meta-strip">
                              <span>🏛️ <strong>${sAllocs.length}</strong> ห้อง</span>
                              <span>&bull;</span>
                              <span>👥 <strong>${s.totalExaminees}</strong> คน</span>
                              <span>&bull;</span>
                              <span style="font-size: 11.5px; color: var(--text-muted);">เตรียมตัว ${s.prepMinutes} น. / สรุปงาน ${s.wrapMinutes} น.</span>
                            </div>

                            <!-- แถบสถานะผู้คุมสอบประจำรอบ -->
                            <div class="session-proctor-meter-clean">
                              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 4px;">
                                <span style="color: var(--text-muted);">${s.prepMinutes ? 'ผู้คุมสอบประจำรอบ:' : 'ผู้คุมสอบ:'}</span>
                                <span class="session-status-badge ${isFull ? 'badge-complete' : 'badge-incomplete'}">
                                  ${isFull ? `✓ ยืนยันครบแล้ว (${sAssigns.length}/${neededInSession})` : (sAssigns.length === 0 ? `⏳ รอยืนยันตาราง (0/${neededInSession})` : `🚨 ขาด ${neededInSession - sAssigns.length} คน (${sAssigns.length}/${neededInSession})`)}
                                </span>
                              </div>
                              <div class="session-progress-track" style="height: 6px;">
                                <div class="session-progress-fill ${isFull ? 'complete' : 'incomplete'}" style="width: ${percentFull}%;"></div>
                              </div>
                            </div>

                            <!-- ปุ่มดำเนินการประจำการ์ด -->
                            <div class="session-card-actions-clean">
                              <button class="btn btn-primary btn-sm" data-action="view-session-scheduler" data-session-id="${s.id}" style="flex: 1; font-size: 12px; justify-content: center;">
                                ดูตาราง →
                              </button>
                              <button class="btn btn-ghost btn-sm" data-action="cancel-session" data-session-id="${s.id}" style="font-size: 12px; color: var(--text-muted); padding: 4px 8px;" title="ยกเลิกรอบการสอบนี้">
                                ยกเลิก
                              </button>
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `
            <!-- มุมมองตารางแบบละเอียด (Table View) -->
            <div class="table-wrapper" style="border: none;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>รหัสรอบ</th>
                    <th>ชื่อการสอบ</th>
                    <th>วันที่</th>
                    <th>เวลาสอบจริง</th>
                    <th>เวลาปฏิบัติงาน (รวม prep/wrap)</th>
                    <th>จำนวนห้อง</th>
                    <th>ผู้เข้าสอบรวม</th>
                    <th>สถานะผู้คุม</th>
                    <th style="text-align: center;">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  ${appState.sessions.map(s => {
                    const sAllocs = appState.allocations.filter(a => a.sessionId === s.id);
                    const sAssigns = confirmedAssigns.filter(a => a.sessionId === s.id);
                    const neededInSession = sAllocs.reduce((sum, al) => sum + (al.examineesInRoom > appState.settings.hardConstraints.h5_examinee_threshold_for_two_proctors ? 2 : 1), 0)
                      + appState.settings.hardConstraints.h8_reserve_proctors_per_session;
                    const isFull = sAssigns.length >= neededInSession;

                    return `
                      <tr class="dashboard-session-row-clickable" data-action="view-session-scheduler" data-session-id="${s.id}" title="คลิกเพื่อดูรายละเอียดและตารางผู้คุมสอบของรอบนี้">
                        <td><strong>${s.id}</strong></td>
                        <td><strong style="color: var(--brand-purple);">${s.name}</strong></td>
                        <td>${formatThaiDate(s.date)}</td>
                        <td>${formatThaiTimeRange(s.startTime, s.endTime)}</td>
                        <td>${formatThaiTimeRange(new Date(new Date(s.startTime).getTime() - s.prepMinutes * 60000), new Date(new Date(s.endTime).getTime() + s.wrapMinutes * 60000))}</td>
                        <td>${sAllocs.length} ห้อง</td>
                        <td>${s.totalExaminees} คน</td>
                        <td>
                          <span class="badge ${isFull ? 'badge-normal' : 'badge-warning'}">
                            ${isFull ? 'ยืนยันครบแล้ว' : (sAssigns.length === 0 ? 'รอยืนยันตาราง' : `ขาดอีก ${neededInSession - sAssigns.length} คน`)} (${sAssigns.length}/${neededInSession})
                          </span>
                        </td>
                        <td style="text-align: center; white-space: nowrap;">
                          <div style="display: inline-flex; align-items: center; gap: 6px;">
                            <button class="btn btn-secondary btn-sm" type="button" data-action="view-session-scheduler" data-session-id="${s.id}" style="padding: 3px 10px; font-size: 12px;" title="ดูรายละเอียดและตารางผู้คุมรอบนี้">
                              ดูรายละเอียด →
                            </button>
                            <button class="btn btn-ghost btn-sm" type="button" data-action="cancel-session" data-session-id="${s.id}" style="padding: 3px 8px; font-size: 12px; color: var(--danger-500);" title="ยกเลิกรอบการสอบนี้">
                              ยกเลิก
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;
  }

  // --- 7.3 & 7.4 หน้าจัดตารางและ 3 มุมมอง ---
  renderSchedulerTab(valResult, totalSlots, assignedSlots) {
    const pendingSwaps = appState.pendingSwaps || [];
    const pendingSwapsCount = pendingSwaps.length;
    const swapDocIssued = Boolean(appState.swapDocIssued);
    const needsSwapDoc = pendingSwapsCount > 0 && !swapDocIssued;
    const hasDraftChanges = Boolean(appState.hasUnconfirmedChanges) || ((appState.confirmedAssignments || []).length === 0 && assignedSlots > 0);
    const confirmedCount = (appState.confirmedAssignments || []).length;
    const latestDoc = (appState.swapDocHistory && appState.swapDocHistory.length > 0) ? appState.swapDocHistory[0] : null;

    let confirmBarClass = 'is-synced';
    let confirmBadgeText = '✅ ยืนยันแล้ว';
    let confirmTitle = `ตารางสอบยืนยันใช้งานแล้ว (${confirmedCount}/${totalSlots} ตำแหน่ง)`;
    let confirmDesc = 'ข้อมูลบนหน้าแดชบอร์ดตรงกับตารางฉบับนี้เรียบร้อยแล้ว';

    if (needsSwapDoc) {
      confirmBarClass = 'is-swap-required';
      confirmBadgeText = `🔒 รอออกใบเซ็นสลับ (${pendingSwapsCount})`;
      confirmTitle = `มีการสลับ/เปลี่ยนตัวผู้คุมสอบ ${pendingSwapsCount} รายการ — ต้องออกใบเซ็นสลับส่งตรวจก่อนยืนยัน`;
      confirmDesc = 'กรุณากด "ออกใบเซ็นสลับส่งตรวจ" (เอกสารบันทึกข้อความจาก ผศ.ดร.ณัฐพล แสนคำ) เพื่อปลดล็อกปุ่มยืนยันตาราง';
    } else if (pendingSwapsCount > 0 && swapDocIssued) {
      confirmBarClass = 'is-ready';
      confirmBadgeText = `📄 ออกใบเซ็นแล้ว (${latestDoc?.docNumber || ''})`;
      confirmTitle = `ออกใบเซ็นสลับ ${pendingSwapsCount} รายการส่งตรวจเรียบร้อยแล้ว — พร้อมยืนยันตาราง`;
      confirmDesc = 'กดปุ่ม "ยืนยันตารางสอบ" ด้านขวา เพื่อบันทึกและส่งข้อมูลตารางล่าสุดขึ้นหน้าแดชบอร์ด';
    } else if (hasDraftChanges) {
      confirmBarClass = 'is-draft';
      confirmBadgeText = '📝 ฉบับร่างรอยืนยัน';
      confirmTitle = `ตารางฉบับร่าง (${assignedSlots}/${totalSlots} ตำแหน่ง) — ยังไม่ถูกส่งขึ้นหน้าแดชบอร์ด`;
      confirmDesc = 'เมื่อตรวจสอบความเรียบร้อยแล้ว กรุณากดปุ่ม "ยืนยันตารางสอบ" เพื่อให้ข้อมูลแสดงบนหน้าแดชบอร์ด';
    }

    return `
      <!-- แถบควบคุมบนสุด: สลับมุมมอง 3 แบบ + ปุ่มจัดตาราง -->
      <div class="scheduler-top-controls" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; background-color: var(--bg-surface); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); gap: 4px;">
          <button class="btn btn-sm ${this.scheduleSubView === 'grid' ? 'btn-primary' : 'btn-secondary'}" id="subview-grid">
            ⊞ ตามรอบ x ห้อง (กริด)
          </button>
          <button class="btn btn-sm ${this.scheduleSubView === 'personal' ? 'btn-primary' : 'btn-secondary'}" id="subview-personal">
            👤 รายบุคคล (ปฏิทิน)
          </button>
          <button class="btn btn-sm ${this.scheduleSubView === 'workload' ? 'btn-primary' : 'btn-secondary'}" id="subview-workload">
            📊 สรุปภาระงาน (กราฟ)
          </button>
        </div>

        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          ${appState.isAdmin() ? `
            <button class="btn btn-accent btn-sm" id="btn-run-solver" style="padding: 7px 16px;">
              ⚡ จัดอัตโนมัติ (Auto-Schedule)
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-add-session-quick" style="font-weight: 600;">
              ➕ เพิ่มรอบสอบใหม่
            </button>
            <!-- เมนูคำสั่งเพิ่มเติม (More Options Dropdown) -->
            <div style="position: relative; display: inline-block;">
              <button class="btn btn-secondary btn-sm" id="btn-toggle-sched-more" type="button" onclick="const m=document.getElementById('sched-more-menu-content'); if(m) m.style.display=(m.style.display==='none'||!m.style.display)?'block':'none'; event.stopPropagation();" title="คำสั่งเพิ่มเติม">
                เพิ่มเติม ⋯
              </button>
              <div id="sched-more-menu-content" style="display: none; position: absolute; right: 0; top: 100%; margin-top: 6px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); z-index: 100; min-width: 200px; padding: 6px;">
                <button id="btn-sudden-leave-modal" type="button" style="width: 100%; text-align: left; padding: 8px 12px; background: none; border: none; font-size: 13px; cursor: pointer; border-radius: 6px; display: flex; align-items: center; gap: 8px; color: var(--text-main);" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='none'">
                  🚑 แจ้งผู้คุมลากะทันหัน
                </button>
                <button id="btn-clear-schedule" type="button" style="width: 100%; text-align: left; padding: 8px 12px; background: none; border: none; font-size: 13px; cursor: pointer; border-radius: 6px; display: flex; align-items: center; gap: 8px; color: #DC2626;" onmouseover="this.style.background='rgba(220, 38, 38, 0.08)'" onmouseout="this.style.background='none'" title="ล้างตารางที่จัดไว้เพื่อจัดใหม่หรือแก้ไขอย่างอิสระ">
                  🗑️ ล้างตารางที่จัดไว้
                </button>
              </div>
            </div>
          ` : `
            <button class="btn btn-accent btn-sm" id="btn-goto-my-profile">
              👤 ไปที่ข้อมูลและตารางของฉัน
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-sudden-leave-modal">
              🚑 แจ้งขอสลับเวร / ลา
            </button>
          `}
        </div>
      </div>

      ${appState.isAdmin() ? `
        <!-- แถบขั้นตอนยืนยันตาราง & ออกใบเซ็นสลับตัว (Formal Confirmation Workflow Bar) -->
        <div class="schedule-confirm-bar ${confirmBarClass}">
          <div class="schedule-confirm-info">
            <span class="schedule-confirm-badge">${confirmBadgeText}</span>
            <div class="schedule-confirm-text">
              <div class="schedule-confirm-title">${confirmTitle}</div>
              <div class="schedule-confirm-desc">${confirmDesc}</div>
            </div>
          </div>

          <div class="schedule-confirm-actions">
            ${pendingSwapsCount > 0 ? `
              <button class="btn btn-sm ${needsSwapDoc ? 'btn-accent' : 'btn-secondary'}" id="btn-open-swap-doc-modal" type="button">
                📄 ${needsSwapDoc ? `ออกใบเซ็นสลับส่งตรวจ (${pendingSwapsCount} รายการ)` : `ดู/พิมพ์ใบเซ็นสลับ (${latestDoc?.docNumber || ''})`}
              </button>
              <button class="btn btn-ghost btn-sm swap-clear-btn" id="btn-clear-pending-swaps" type="button" title="เอาใบสลับตัวออกทั้งหมด (กรณีทดสอบหรือสลับผิด)">
                🗑️ เอาใบสลับออก
              </button>
            ` : (latestDoc ? `
              <button class="btn btn-secondary btn-sm" id="btn-view-last-swap-doc" type="button" title="เปิดดูหรือลบประวัติบันทึกข้อความขอสลับตัว">
                📄 ประวัติใบเซ็นสลับ (${appState.swapDocHistory.length})
              </button>
            ` : '')}

            ${hasDraftChanges ? `
              <button
                class="btn btn-sm ${needsSwapDoc ? 'btn-secondary' : 'btn-primary'}"
                id="btn-confirm-publish-schedule"
                type="button"
                ${needsSwapDoc ? 'disabled title="ต้องออกใบเซ็นสลับตัวจาก ผศ.ดร.ณัฐพล แสนคำ ส่งตรวจก่อนจึงจะยืนยันได้"' : 'title="ยืนยันตารางสอบฉบับนี้เพื่อส่งข้อมูลขึ้นหน้าแดชบอร์ด"'}
              >
                ${needsSwapDoc ? '🔒 ยืนยันตาราง (รอออกใบเซ็นสลับ)' : '✅ ยืนยันตารางสอบ (ส่งขึ้นแดชบอร์ด)'}
              </button>
              ${confirmedCount > 0 ? `
                <button class="btn btn-ghost btn-sm" id="btn-discard-draft" type="button" title="ยกเลิกการแก้ไขฉบับร่างและกลับไปใช้ตารางที่ยืนยันล่าสุด">
                  ↩ ยกเลิกฉบับร่าง
                </button>
              ` : ''}
            ` : `
              <button class="btn btn-secondary btn-sm" id="btn-confirm-publish-schedule" type="button" disabled title="ตารางปัจจุบันถูกยืนยันขึ้นแดชบอร์ดเรียบร้อยแล้ว">
                ✓ ยืนยันขึ้นแดชบอร์ดแล้ว
              </button>
            `}
          </div>
        </div>
      ` : ''}

      <!-- แถบแจ้งเตือนสถานะบทบาท (Role Notice) -->
      ${!appState.isAdmin() ? `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: linear-gradient(135deg, var(--primary-50), var(--accent-50)); border: 1px solid var(--accent-500); padding: 10px 16px; border-radius: var(--radius-md); font-size: 13px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">💡</span>
            <span>
              คุณกำลังดูตารางในฐานะ <strong>"${appState.currentUser?.name}"</strong> 
              (ตำแหน่งที่ได้รับมอบหมายของคุณจะถูกเน้น <strong style="color: var(--accent-600);">⭐ สีทอง</strong> อย่างชัดเจนในตาราง)
            </span>
          </div>
          <button class="btn btn-sm btn-secondary" id="btn-open-user-modal-notice">🔑 สลับเป็น Admin เพื่อแก้ไขระบบ</button>
        </div>
      ` : ''}

      <!-- แถวสัญลักษณ์และคำอธิบายสี (ยุบเป็นปุ่มกะทัดรัด ไม่เกะกะสายตา) -->
      <div class="scheduler-legend-strip" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; background: var(--bg-surface); padding: 6px 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); font-size: 12.5px;">
        <div style="position: relative; display: inline-block;">
          <button class="btn btn-ghost btn-sm" id="btn-toggle-legend-pop" type="button" onclick="const p=document.getElementById('legend-popout-content'); if(p) p.style.display=(p.style.display==='none'||!p.style.display)?'block':'none'; event.stopPropagation();" style="font-size: 12px; color: var(--text-muted); padding: 3px 10px; border: 1px solid var(--border-subtle); border-radius: 9999px;">
            ⓘ คำอธิบายสัญลักษณ์และสี ▾
          </button>
          <div id="legend-popout-content" style="display: none; position: absolute; left: 0; top: 100%; margin-top: 6px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); z-index: 100; min-width: 320px; padding: 12px;">
            <div style="font-weight: 700; font-size: 12.5px; margin-bottom: 8px; color: var(--text-main);">คำอธิบายสัญลักษณ์และสี:</div>
            <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px;">
              <div><span class="badge badge-normal">✅ ปกติ / ผ่าน</span> จัดผู้คุมถูกต้องตามกฎ H1-H8 ครบถ้วน</div>
              <div><span class="badge badge-warning">⚠️ ใกล้เต็ม</span> ภาระงานใกล้ถึงโควต้าสะสม</div>
              <div><span class="badge badge-danger">🚨 ผิดกฎ</span> ขัดต่อเงื่อนไข Hard Constraints</div>
              <div><span class="badge badge-locked">🔒 ล็อกไว้</span> ตำแหน่งนี้ถูกตรึงคงที่ไม่ถูกเปลี่ยน</div>
              <div><span class="badge" style="border: 1px solid var(--accent-500); background: var(--accent-50); color: var(--accent-600); font-weight: 700;">⭐ ตำแหน่งของคุณ</span> ตำแหน่งที่ได้รับมอบหมาย</div>
            </div>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-subtle); font-size: 11.5px; color: var(--text-muted);">
              💡 แตะหรือคลิกที่ชื่อผู้คุมเพื่อเปลี่ยนตัว / สลับห้อง / ปลดล็อก ได้ทันที
            </div>
          </div>
        </div>

        <span style="font-size: 12px; color: var(--text-muted); display: inline-flex; align-items: center; gap: 6px;">
          <span>💡</span> <em>คลิกที่ชื่อผู้คุมเพื่อเปลี่ยนตัว หรือลากชิปเพื่อสลับห้อง</em>
        </span>
      </div>

      ${this.scheduleSubView === 'grid' ? `
        <!-- แถบกรองรอบการสอบ (Session Filter) แบบเลื่อนแนวนอนบรรทัดเดียว ไม่ล้นจอ -->
        <div class="scheduler-filter-scroll-wrapper" style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--bg-surface); border: 1px solid var(--border-subtle); padding: 6px 14px; border-radius: var(--radius-md);">
          <div class="scheduler-filter-scroll" style="display: flex; align-items: center; gap: 6px; overflow-x: auto; white-space: nowrap; padding: 2px 0; flex: 1;">
            <span style="font-size: 12.5px; font-weight: 700; color: var(--text-muted); margin-right: 4px; flex-shrink: 0;">กรองรอบ:</span>
            <button class="btn btn-sm ${this.selectedSessionFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" data-filter-session="all">
              🌐 ทุกรอบ (${appState.sessions.length})
            </button>
            ${appState.sessions.map(s => `
              <button class="btn btn-sm ${this.selectedSessionFilter === s.id ? 'btn-primary' : 'btn-secondary'}" data-filter-session="${s.id}" title="${s.name}">
                ${s.id}: ${s.name.length > 18 ? s.name.slice(0, 16) + '...' : s.name}
              </button>
            `).join('')}
          </div>
          ${this.selectedSessionFilter !== 'all' ? `
            <button class="btn btn-ghost btn-sm" data-filter-session="all" style="font-size: 12px; padding: 3px 8px; white-space: nowrap; flex-shrink: 0;">
              ✕ ล้างตัวกรอง
            </button>
          ` : ''}
        </div>
      ` : ''}

      <!-- สลับเนื้อหาตามมุมมองที่เลือก -->
      ${this.scheduleSubView === 'grid' ? this.renderGridView(valResult) : ''}
      ${this.scheduleSubView === 'personal' ? this.renderPersonalView() : ''}
      ${this.scheduleSubView === 'workload' ? this.renderWorkloadView() : ''}
    `;
  }

  // มุมมอง (ก) รอบ x ห้อง (Grid View)
  renderGridView(valResult) {
    const proctorMap = new Map(appState.proctors.map(p => [p.id, p]));
    const sessionsToRender = (this.selectedSessionFilter && this.selectedSessionFilter !== 'all')
      ? appState.sessions.filter(s => s.id === this.selectedSessionFilter)
      : appState.sessions;

    const activeSessions = sessionsToRender.length > 0 ? sessionsToRender : appState.sessions;

    return `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        ${activeSessions.map(session => {
          const sessionAllocs = appState.allocations.filter(al => al.sessionId === session.id);
          const reserves = appState.assignments.filter(a => a.sessionId === session.id && a.role === 'reserve');

          return `
            <div class="card session-grid-card" style="border-top: 3.5px solid var(--primary-500); overflow: visible;">
              <!-- ส่วนหัวรอบสอบ: จัด 2 บรรทัดสะอาดตา + เมนูจัดการรอบ -->
              <div class="card-header session-grid-header" style="background-color: var(--bg-surface-elevated); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding: 12px 18px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <strong style="font-size: 15.5px; color: var(--text-main);">${session.id}: ${session.name}</strong>
                    <span class="badge badge-normal" style="font-size: 11px;">${sessionAllocs.length} ห้อง (${session.totalExaminees || 0} คน)</span>
                  </div>
                  <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 4px;">
                    📅 ${formatThaiDate(session.date)} &bull; ⏰ เวลาสอบ <strong>${formatThaiTimeRange(session.startTime, session.endTime)}</strong>
                    <span style="opacity: 0.8; font-size: 11.5px;">(เตรียมตัว ${session.prepMinutes} น. / สรุป ${session.wrapMinutes} น.)</span>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                  <!-- ผู้คุมสำรองประจำรอบ -->
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 12px; font-weight: 600; color: var(--text-muted);">สำรอง:</span>
                    ${reserves.map(r => {
                      const p = proctorMap.get(r.proctorId);
                      const isCurrentUser = appState.currentUser?.proctorId === r.proctorId;
                      return `
                        <span class="proctor-chip ${r.status === 'locked' ? 'is-locked' : ''} ${isCurrentUser ? 'is-current-user' : ''}" data-assign-id="${r.id}" style="font-size: 12px; padding: 3px 8px;">
                          <span>${isCurrentUser ? '⭐ ' : (r.status === 'locked' ? '🔒 ' : '')}${p ? `${p.firstName} ${p.lastName}` : r.proctorId}</span>
                        </span>
                      `;
                    }).join('')}
                    ${appState.isAdmin() && reserves.length < appState.settings.hardConstraints.h8_reserve_proctors_per_session ? `
                      <button class="btn btn-secondary btn-sm" data-action="add-reserve" data-session-id="${session.id}" style="font-size: 11.5px; padding: 2px 7px;">+ สำรอง</button>
                    ` : ''}
                  </div>

                  <!-- เมนูจัดการรอบ (ย้ายปุ่มแก้เวลา/เพิ่มห้อง/ล้าง/ยกเลิก รวมในเมนูเดียว) -->
                  ${appState.isAdmin() ? `
                    <div style="position: relative; display: inline-block;">
                      <button class="btn btn-secondary btn-sm" type="button" onclick="const m=document.getElementById('sess-menu-${session.id}'); if(m) m.style.display=(m.style.display==='none'||!m.style.display)?'block':'none'; event.stopPropagation();" style="font-size: 12px; padding: 4px 10px;" title="จัดการรอบสอบนี้">
                        จัดการรอบ ⋯
                      </button>
                      <div id="sess-menu-${session.id}" style="display: none; position: absolute; right: 0; top: 100%; margin-top: 6px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); z-index: 100; min-width: 190px; padding: 6px;">
                        <button data-action="edit-session" data-session-id="${session.id}" type="button" style="width: 100%; text-align: left; padding: 8px 10px; background: none; border: none; font-size: 12.5px; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 6px; color: var(--text-main);" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='none'">
                          ✏️ แก้เวลา/ข้อมูลรอบ
                        </button>
                        <button data-action="add-room-to-session" data-session-id="${session.id}" type="button" style="width: 100%; text-align: left; padding: 8px 10px; background: none; border: none; font-size: 12.5px; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 6px; color: var(--text-main);" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='none'">
                          ➕ เพิ่มห้องในรอบนี้
                        </button>
                        <button data-action="clear-session-assigns" data-session-id="${session.id}" type="button" style="width: 100%; text-align: left; padding: 8px 10px; background: none; border: none; font-size: 12.5px; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 6px; color: var(--text-main);" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='none'">
                          🔄 ล้างผู้คุมรอบนี้
                        </button>
                        <div style="border-top: 1px solid var(--border-subtle); margin: 4px 0;"></div>
                        <button data-action="cancel-session" data-session-id="${session.id}" type="button" style="width: 100%; text-align: left; padding: 8px 10px; background: none; border: none; font-size: 12.5px; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 6px; color: #DC2626;" onmouseover="this.style.background='rgba(220, 38, 38, 0.08)'" onmouseout="this.style.background='none'">
                          ❌ ยกเลิกรอบนี้
                        </button>
                      </div>
                    </div>
                  ` : ''}
                </div>
              </div>

              <!-- รายการห้องสอบในการ์ดกริด (Room Grid Cards: 2 คอลัมน์เดสก์ท็อป, 1 คอลัมน์มือถือ, 3 คอลัมน์ >=1600px) -->
              <div class="card-body" style="padding: 16px;">
                <div class="rooms-grid-container">
                  ${sessionAllocs.map(alloc => {
                    const room = appState.rooms.find(r => r.id === alloc.roomId);
                    const roomAssigns = appState.assignments.filter(a => a.allocationId === alloc.id);
                    const chiefAssign = roomAssigns.find(a => a.role === 'chief');
                    const proctorAssigns = roomAssigns.filter(a => a.role === 'proctor');
                    const regularAssign1 = proctorAssigns.find(a => a.orderIndex === 2) || proctorAssigns[0];
                    const regularAssign2 = proctorAssigns.find(a => a.orderIndex === 3) || (proctorAssigns.length > 1 ? proctorAssigns[1] : null);

                    const rawRoomCode = room ? (room.roomCode || room.code || '') : '';
                    const rawRoomName = room ? (room.name || alloc.roomId) : alloc.roomId;
                    const roomDisplayTitle = (rawRoomCode && !rawRoomName.includes(rawRoomCode))
                      ? `${rawRoomCode} · ${rawRoomName}`
                      : rawRoomName;
                    
                    const examinees = alloc.examineesInRoom || 0;
                    const threshold3 = appState.settings.hardConstraints.h5_examinee_threshold_for_three_proctors ?? 61;
                    const needThree = examinees >= threshold3; // เช่น ห้อง 17201 (80 ที่นั่ง) คุม 3 คน
                    const neededCount = needThree ? 3 : 2;
                    const isMissing = roomAssigns.length < neededCount;
                    
                    // ตรวจหาข้อผิดพลาดในห้องนี้
                    const roomViolations = valResult?.violations?.filter(v => v.sessionId === session.id && (v.roomId === alloc.roomId || v.allocationId === alloc.id)) || [];
                    const hasViolation = roomViolations.length > 0;
                    const isWarning = hasViolation || isMissing;

                    return `
                      <div class="grid-cell room-card-modern ${isWarning ? 'room-card-warning' : ''}" style="border: 1px solid ${hasViolation ? 'var(--danger-500)' : (isMissing ? 'var(--warning-500)' : 'var(--border-subtle)')}; ${needThree ? 'border-top: 3px solid var(--brand-gold);' : ''}">
                        <!-- ส่วนหัวการ์ดห้อง: ชื่อห้อง + รหัส + จำนวนคน/ผู้คุม (ไม่เกิน 2 บรรทัด ไม่มี undefined) -->
                        <div class="room-card-header">
                          <div class="room-card-title-wrap">
                            <strong class="room-card-title" title="${roomDisplayTitle}">${roomDisplayTitle}</strong>
                            <div class="room-card-meta">
                              ${examinees} คน &bull; ${needThree ? 'คุม 3 คน (ห้องใหญ่)' : 'คุม 2 คน'}
                              ${isMissing ? `<span style="color: var(--warning-600); font-weight: 700; margin-left: 4px;">(ขาด ${neededCount - roomAssigns.length} คน)</span>` : ''}
                            </div>
                          </div>

                          ${appState.isAdmin() ? `
                            <div style="position: relative; display: inline-block; flex-shrink: 0;">
                              <button class="btn btn-ghost btn-sm" type="button" onclick="const m=document.getElementById('alloc-menu-${alloc.id}'); if(m) m.style.display=(m.style.display==='none'||!m.style.display)?'block':'none'; event.stopPropagation();" style="padding: 2px 7px; font-size: 12px; color: var(--text-muted);" title="จัดการห้องนี้" aria-label="จัดการห้องนี้">
                                ⋯
                              </button>
                              <div id="alloc-menu-${alloc.id}" style="display: none; position: absolute; right: 0; top: 100%; margin-top: 4px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; box-shadow: 0 8px 20px rgba(0,0,0,0.15); z-index: 100; min-width: 140px; padding: 4px;">
                                <button data-action="edit-alloc" data-alloc-id="${alloc.id}" type="button" style="width: 100%; text-align: left; padding: 6px 8px; background: none; border: none; font-size: 12px; cursor: pointer; border-radius: 4px; color: var(--text-main);" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='none'">
                                  ✏️ แก้ไขจำนวนคน
                                </button>
                                <button data-action="remove-alloc" data-alloc-id="${alloc.id}" type="button" style="width: 100%; text-align: left; padding: 6px 8px; background: none; border: none; font-size: 12px; cursor: pointer; border-radius: 4px; color: var(--danger-500);" onmouseover="this.style.background='var(--danger-50)'" onmouseout="this.style.background='none'">
                                  🗑️ ถอดห้องออก
                                </button>
                              </div>
                            </div>
                          ` : ''}
                        </div>

                        <!-- ตำแหน่ง 1: หัวหน้าห้อง (Chief) -->
                        <div class="proctor-slot-wrapper">
                          <div class="proctor-slot-label is-chief-label">
                            <span>👑 หัวหน้าห้อง (Chief):</span>
                          </div>
                          <div class="proctor-slot-container"
                               data-drop-zone="slot"
                               data-session-id="${session.id}"
                               data-alloc-id="${alloc.id}"
                               data-room-id="${alloc.roomId}"
                               data-role="chief"
                               data-order-index="1">
                            ${chiefAssign ? this.renderProctorChip(chiefAssign, proctorMap, valResult) : `
                              <button class="btn btn-secondary btn-sm slot-empty-placeholder"
                                      style="border-style: dashed; padding: 6px 8px; font-size: 12px;"
                                      data-action="assign-slot"
                                      data-session-id="${session.id}"
                                      data-alloc-id="${alloc.id}"
                                      data-room-id="${alloc.roomId}"
                                      data-role="chief"
                                      data-order-index="1">
                                ➕ ระบุหัวหน้าห้อง (แตะเพื่อเลือก)
                              </button>
                            `}
                          </div>
                        </div>

                        <!-- ตำแหน่ง 2: ผู้ช่วยผู้คุมคนที่ 1 (Assistant 1) -->
                        <div class="proctor-slot-wrapper">
                          <div class="proctor-slot-label">
                            <span>👤 ผู้ช่วยคนที่ 1 (Assistant 1):</span>
                          </div>
                          <div class="proctor-slot-container"
                               data-drop-zone="slot"
                               data-session-id="${session.id}"
                               data-alloc-id="${alloc.id}"
                               data-room-id="${alloc.roomId}"
                               data-role="proctor"
                               data-order-index="2">
                            ${regularAssign1 ? this.renderProctorChip(regularAssign1, proctorMap, valResult) : `
                              <button class="btn btn-secondary btn-sm slot-empty-placeholder"
                                      style="border-style: dashed; padding: 6px 8px; font-size: 12px;"
                                      data-action="assign-slot"
                                      data-session-id="${session.id}"
                                      data-alloc-id="${alloc.id}"
                                      data-room-id="${alloc.roomId}"
                                      data-role="proctor"
                                      data-order-index="2">
                                ➕ ระบุผู้ช่วยคนที่ 1 (แตะเพื่อเลือก)
                              </button>
                            `}
                          </div>
                        </div>

                        <!-- ตำแหน่ง 3: ผู้ช่วยผู้คุมคนที่ 2 (Assistant 2 สำหรับห้องใหญ่) -->
                        ${needThree ? `
                          <div class="proctor-slot-wrapper is-large-room-slot">
                            <div class="proctor-slot-label" style="color: var(--warning-600); font-weight: 600;">
                              <span>👤 ผู้ช่วยคนที่ 2 (ห้องใหญ่):</span>
                            </div>
                            <div class="proctor-slot-container"
                                 data-drop-zone="slot"
                                 data-session-id="${session.id}"
                                 data-alloc-id="${alloc.id}"
                                 data-room-id="${alloc.roomId}"
                                 data-role="proctor"
                                 data-order-index="3">
                              ${regularAssign2 ? this.renderProctorChip(regularAssign2, proctorMap, valResult) : `
                                <button class="btn btn-secondary btn-sm slot-empty-placeholder"
                                        style="border-style: dashed; padding: 6px 8px; font-size: 12px; background: rgba(229, 168, 35, 0.08);"
                                        data-action="assign-slot"
                                        data-session-id="${session.id}"
                                        data-alloc-id="${alloc.id}"
                                        data-room-id="${alloc.roomId}"
                                        data-role="proctor"
                                        data-order-index="3">
                                  ➕ ระบุผู้ช่วยคนที่ 2 (แตะเพื่อเลือก)
                                </button>
                              `}
                            </div>
                          </div>
                        ` : ''}
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderProctorChip(assignment, proctorMap, valResult) {
    const p = proctorMap.get(assignment.proctorId);
    const hasViolation = valResult?.assignmentViolations?.has(assignment.id);
    const isCurrentUser = appState.currentUser?.proctorId === assignment.proctorId;

    return `
      <div class="proctor-chip ${assignment.status === 'locked' ? 'is-locked' : ''} ${hasViolation ? 'border-danger' : ''} ${isCurrentUser ? 'is-current-user' : ''}" 
           draggable="false"
           tabindex="0"
           role="button"
           data-draggable-proctor="true"
           data-assign-id="${assignment.id}" 
           data-proctor-id="${assignment.proctorId}"
           data-session-id="${assignment.sessionId}"
           data-alloc-id="${assignment.allocationId}"
           data-room-id="${assignment.roomId || ''}"
           data-role="${assignment.role}"
           data-order-index="${assignment.orderIndex || 1}"
           title="${isCurrentUser ? '⭐ ตำแหน่งคุมสอบของคุณ (คลิกแก้ไข / ลากเพื่อย้ายหรือสลับ)' : (assignment.reason || 'คลิกเพื่อแก้ไข หรือลากเพื่อสลับห้อง/รอบ')}">
        <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;">
          <span class="drag-handle" title="ลากเพื่อย้ายหรือสลับรอบ/ห้อง" aria-hidden="true">⠿</span>
          <span style="flex-shrink: 0;">${isCurrentUser ? '⭐' : (assignment.status === 'locked' ? '🔒' : (assignment.role === 'chief' ? '👑' : '👤'))}</span>
          <span style="font-weight: 600; font-size: 13px; overflow: hidden; text-overflow: ellipsis;">${isCurrentUser ? '<strong>คุณ: </strong>' : ''}${p ? `${p.academicTitle ? `${p.academicTitle} ` : ''}${p.firstName} ${p.lastName}` : assignment.proctorId}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
          <span class="proctor-type-pill ${p?.proctorType === 'faculty' ? 'type-faculty' : 'type-staff'}" style="font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 4px;">
            ${p ? (p.proctorType === 'faculty' ? 'อ.' : 'จนท.') : ''}
          </span>
        </div>
      </div>
    `;
  }

  // มุมมอง (ข) รายบุคคล (Personal Calendar View)
  renderPersonalView() {
    const sessionMap = new Map(appState.sessions.map(s => [s.id, s]));
    const roomMap = new Map(appState.rooms.map(r => [r.id, r]));

    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">ปฏิทินตารางคุมสอบรายบุคคล</div>
          <input type="text" id="input-search-proctor" class="form-input" style="max-width: 250px;" placeholder="🔍 ค้นหาชื่อผู้คุม...">
        </div>
        <div class="card-body" style="padding: 0;">
          <div class="table-wrapper" style="border: none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ผู้คุมสอบ</th>
                  <th>สังกัด</th>
                  <th>ประเภท</th>
                  <th>รอบที่ได้รับมอบหมาย</th>
                  <th>ชั่วโมงสะสม</th>
                  <th>ภาระงานเทียบโควต้า</th>
                </tr>
              </thead>
              <tbody>
                ${appState.proctors.map(p => {
                  const assigns = appState.assignments.filter(a => a.proctorId === p.id);
                  const quota = p.projectQuota || 6;
                  const ratio = assigns.length / quota;

                  return `
                    <tr>
                      <td>
                        <strong>${p.firstName} ${p.lastName}</strong>
                        <div style="font-size: 11px; color: var(--text-muted);">${p.id} • ${p.level === 'chief' ? 'หัวหน้าห้องได้' : 'ผู้ช่วย'}</div>
                      </td>
                      <td>${p.department}</td>
                      <td>${p.proctorType === 'faculty' ? 'อาจารย์' : 'เจ้าหน้าที่'}</td>
                      <td>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                          ${assigns.map(a => {
                            const s = sessionMap.get(a.sessionId);
                            const r = a.roomId ? roomMap.get(a.roomId) : null;
                            return `
                              <span class="badge ${a.status === 'locked' ? 'badge-locked' : 'badge-normal'}" title="${a.reason}">
                                ${s ? s.name.split(' - ')[1] || s.name : a.sessionId} (${r ? r.name : 'สำรอง'})
                              </span>
                            `;
                          }).join('') || '<span style="color: var(--text-muted); font-size: 12px;">(ไม่มีงาน)</span>'}
                        </div>
                      </td>
                      <td>${(assigns.length * 3.5).toFixed(1)} ชม.</td>
                      <td style="min-width: 140px;">
                        <div class="workload-bar-container">
                          <div style="display: flex; justify-content: space-between; font-size: 11px;">
                            <span>${assigns.length} / ${quota} รอบ</span>
                            <span>${Math.round(ratio * 100)}%</span>
                          </div>
                          <div class="workload-bar-track">
                            <div class="workload-bar-fill ${ratio > 1 ? 'workload-fill-danger' : (ratio >= 0.8 ? 'workload-fill-warning' : 'workload-fill-normal')}" 
                                 style="width: ${Math.min(100, Math.round(ratio * 100))}%;"></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // มุมมอง (ค) สรุปภาระงาน (Workload Bar Chart View)
  renderWorkloadView() {
    // คำนวณสถิติภาระงาน
    const counts = appState.proctors.map(p => appState.assignments.filter(a => a.proctorId === p.id).length);
    const mean = counts.reduce((a, b) => a + b, 0) / Math.max(1, counts.length);
    const variance = counts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / Math.max(1, counts.length);
    const sd = Math.sqrt(variance);

    return `
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">📊 ภาระงานเฉลี่ย</div>
          <div class="metric-value">${mean.toFixed(1)} <span style="font-size: 15px; font-weight: normal;">รอบ/คน</span></div>
          <div class="metric-sub">จากจำนวนรอบสอบทั้งหมด</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">⚖️ ส่วนเบี่ยงเบนมาตรฐาน (SD)</div>
          <div class="metric-value" style="color: ${sd < 1.0 ? 'var(--success-500)' : 'var(--warning-500)'}">
            ${sd.toFixed(2)}
          </div>
          <div class="metric-sub">${sd < 1.0 ? 'กระจายงานดีเยี่ยมมาก' : 'กระจายงานอยู่ในเกณฑ์ปกติ'}</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">👥 สัดส่วนอาจารย์ : เจ้าหน้าที่</div>
          <div class="metric-value">50 : 50</div>
          <div class="metric-sub">ผสมผสานตามเกณฑ์ soft constraint S5</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">กราฟแท่งเปรียบเทียบภาระงานรายคนเทียบกับโควต้า</div>
        </div>
        <div class="card-body">
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${appState.proctors.map(p => {
              const count = appState.assignments.filter(a => a.proctorId === p.id).length;
              const quota = p.projectQuota || 6;
              const percent = Math.min(100, Math.round((count / quota) * 100));

              return `
                <div style="display: grid; grid-template-columns: 200px 1fr 60px; gap: 16px; align-items: center;">
                  <div style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    <strong>${p.firstName} ${p.lastName}</strong>
                    <span style="color: var(--text-muted); font-size: 11px;">(${p.proctorType === 'faculty' ? 'อาจารย์' : 'เจ้าหน้าที่'})</span>
                  </div>
                  <div class="workload-bar-track" style="height: 14px;">
                    <div class="workload-bar-fill ${count > quota ? 'workload-fill-danger' : (count >= quota - 1 ? 'workload-fill-warning' : 'workload-fill-normal')}" 
                         style="width: ${percent}%;"></div>
                  </div>
                  <div style="font-size: 12px; font-weight: 600; text-align: right;">${count} / ${quota}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // --- 7.2.1 หน้าจัดการผู้คุมสอบ (แยกเป็นเมนูอิสระ พร้อมระบบ 5 แท็บ: กำหนดกลุ่ม/โควต้า, ข้อมูลผู้คุม, สรุปรายบุคคล, คำขอเปลี่ยนตัว, เอกสารคำสั่ง) ---
  renderProctorsPage() {
    this.proctorSubTab = this.proctorSubTab || 'quota';

    return `
      <!-- แถบสลับหน้าย่อย 5 แท็บ สไตล์เดียวกับหน้าตารางผู้คุมสอบ (ตาม Image 4) -->
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
        <div style="display: inline-flex; flex-wrap: wrap; background-color: var(--bg-surface); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); gap: 6px; width: fit-content;">
          <button type="button" class="btn btn-sm ${this.proctorSubTab === 'quota' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-proctor-quota" style="${this.proctorSubTab === 'quota' ? 'background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700; border: 1px solid var(--brand-purple, #3B1F54) !important; box-shadow: 0 1px 3px rgba(59,31,84,0.25);' : 'background-color: #FFFFFF !important; color: var(--brand-purple, #3B1F54) !important; border: 1px solid var(--border-subtle, #E2E8F0) !important; font-weight: 600;'} padding: 6px 14px; font-size: 13px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">
            👥 จัดการกลุ่ม & เงื่อนไขบุคลากร
          </button>
          <!-- ย้ายไปหน้าข้อมูลระบบแล้ว ซ่อนไว้ ยังไม่ลบ -->
          <!--
          <button type="button" class="btn btn-sm ${this.proctorSubTab === 'info' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-proctor-info" style="${this.proctorSubTab === 'info' ? 'background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700; border: 1px solid var(--brand-purple, #3B1F54) !important; box-shadow: 0 1px 3px rgba(59,31,84,0.25);' : 'background-color: #FFFFFF !important; color: var(--brand-purple, #3B1F54) !important; border: 1px solid var(--border-subtle, #E2E8F0) !important; font-weight: 600;'} padding: 6px 14px; font-size: 13px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">
            👤 ข้อมูลผู้คุมสอบ (${appState.proctors.length})
          </button>
          -->
          <button type="button" class="btn btn-sm ${this.proctorSubTab === 'personal-summary' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-proctor-summary" style="${this.proctorSubTab === 'personal-summary' ? 'background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700; border: 1px solid var(--brand-purple, #3B1F54) !important; box-shadow: 0 1px 3px rgba(59,31,84,0.25);' : 'background-color: #FFFFFF !important; color: var(--brand-purple, #3B1F54) !important; border: 1px solid var(--border-subtle, #E2E8F0) !important; font-weight: 600;'} padding: 6px 14px; font-size: 13px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">
            📊 สรุปคุมสอบรายบุคคล
          </button>
          <button type="button" class="btn btn-sm ${this.proctorSubTab === 'swaps' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-proctor-swaps" style="${this.proctorSubTab === 'swaps' ? 'background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700; border: 1px solid var(--brand-purple, #3B1F54) !important; box-shadow: 0 1px 3px rgba(59,31,84,0.25);' : 'background-color: #FFFFFF !important; color: var(--brand-purple, #3B1F54) !important; border: 1px solid var(--border-subtle, #E2E8F0) !important; font-weight: 600;'} padding: 6px 14px; font-size: 13px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 6px;">
            <span>⇄ คำขอเปลี่ยนตัว</span>
            ${(appState.pendingSwaps?.length || 0) > 0 ? `<span style="background: #ef4444; color: white; border-radius: 10px; padding: 1px 7px; font-size: 11px; font-weight: 800;">${appState.pendingSwaps.length}</span>` : ''}
          </button>
          <button type="button" class="btn btn-sm ${this.proctorSubTab === 'docs' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-proctor-docs" style="${this.proctorSubTab === 'docs' ? 'background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700; border: 1px solid var(--brand-purple, #3B1F54) !important; box-shadow: 0 1px 3px rgba(59,31,84,0.25);' : 'background-color: #FFFFFF !important; color: var(--brand-purple, #3B1F54) !important; border: 1px solid var(--border-subtle, #E2E8F0) !important; font-weight: 600;'} padding: 6px 14px; font-size: 13px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">
            📄 เอกสารและคำสั่งสอบ
          </button>
        </div>
      </div>

      ${this.renderProctorSubTabContent()}
    `;
  }

  renderProctorSubTabContent() {
    switch (this.proctorSubTab) {
      case 'info':
        // ย้ายไปหน้าข้อมูลระบบแล้ว ซ่อนไว้ ยังไม่ลบ
        return this.renderProctorQuotaView();
      case 'personal-summary':
        return this.renderProctorSummaryView();
      case 'swaps':
        return this.renderProctorSwapsView();
      case 'docs':
        return this.renderProctorDocsView();
      case 'quota':
      default:
        return this.renderProctorQuotaView();
    }
  }

  // --- มุมมองที่ 1: กำหนดโควต้า & เงื่อนไขการคุมสอบ (Core & Reserve Pool) ---
  renderProctorQuotaView() {
    const allProctors = appState.proctors || [];
    const coreCount = allProctors.filter(p => p.pool !== 'reserve').length;
    const reserveCount = allProctors.filter(p => p.pool === 'reserve').length;

    const filterPool = this.proctorPoolFilter || 'all';
    let filteredProctors = allProctors.filter(p => {
      if (filterPool === 'core') return p.pool !== 'reserve';
      if (filterPool === 'reserve') return p.pool === 'reserve';
      return true;
    });

    const keyword = (this.proctorQuotaSearchKeyword || '').trim().toLowerCase();
    if (keyword) {
      filteredProctors = filteredProctors.filter(p => {
        const name = `${p.academicTitle || ''} ${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
        const dept = (p.department || '').toLowerCase();
        const subDept = (p.subDepartment || '').toLowerCase();
        const id = (p.id || '').toLowerCase();
        return name.includes(keyword) || dept.includes(keyword) || subDept.includes(keyword) || id.includes(keyword);
      });
    }

    const sessions = appState.sessions || [];
    const datesMap = new Map();
    sessions.forEach(s => {
      const d = s.date;
      if (!datesMap.has(d)) datesMap.set(d, []);
      datesMap.get(d).push(s);
    });
    const examDates = Array.from(datesMap.entries());

    return `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <!-- Header Title (ตามภาพต้นแบบ ไม่รวม breadcrumb) -->
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 2px;">
          <span style="font-size: 24px; color: var(--primary-700);">👥</span>
          <div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: var(--text-main);">
              จัดการกลุ่มบุคลากร & เงื่อนไขการคุมสอบ (Core & Reserve Pool)
            </h2>
            <p style="margin: 3px 0 0; font-size: 13px; color: var(--text-muted);">
              กำหนดกลุ่มหลัก (Core Pool) ที่จะจัดสรรก่อน • กลุ่มสำรอง (Reserve Pool) ที่จะดึงเสริมอัตโนมัติเมื่อตำแหน่งว่าง • โควต้าและเงื่อนไขเฉพาะบุคคล
            </p>
          </div>
        </div>

        <!-- 4 KPI Stat Cards + Action Buttons Group (ตามภาพทางขวา) -->
        <div style="display: flex; justify-content: space-between; align-items: stretch; gap: 14px; flex-wrap: wrap;">
          <!-- 4 Cards -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; flex: 1; min-width: 520px;">
            <div class="card" style="border-left: 4px solid var(--primary-700);">
              <div class="card-body" style="padding: 12px 16px;">
                <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">บุคลากรทั้งหมด</div>
                <div style="font-size: 24px; font-weight: 800; color: var(--text-main); margin-top: 2px;">
                  ${allProctors.length} <span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">ท่าน</span>
                </div>
              </div>
            </div>
            <div class="card" style="border-left: 4px solid #16a34a; background: rgba(22, 163, 74, 0.03);">
              <div class="card-body" style="padding: 12px 16px;">
                <div style="font-size: 12px; color: #16a34a; font-weight: 600;">กลุ่มหลัก (Core)</div>
                <div style="font-size: 24px; font-weight: 800; color: #15803d; margin-top: 2px;">
                  ${coreCount} <span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">ท่าน</span>
                </div>
              </div>
            </div>
            <div class="card" style="border-left: 4px solid #d97706; background: rgba(217, 119, 6, 0.03);">
              <div class="card-body" style="padding: 12px 16px;">
                <div style="font-size: 12px; color: #d97706; font-weight: 600;">กลุ่มสำรอง (Reserve)</div>
                <div style="font-size: 24px; font-weight: 800; color: #b45309; margin-top: 2px;">
                  ${reserveCount} <span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">ท่าน</span>
                </div>
              </div>
            </div>
            <div class="card" style="border-left: 4px solid var(--primary-600); background: rgba(59, 31, 84, 0.03);">
              <div class="card-body" style="padding: 12px 16px;">
                <div style="font-size: 12px; color: var(--primary-700); font-weight: 600;">รายการที่กำลังแสดง</div>
                <div style="font-size: 24px; font-weight: 800; color: var(--primary-800); margin-top: 2px;">
                  ${filteredProctors.length} <span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">ท่าน</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Buttons Group (ตามภาพทางขวา) -->
          <div style="display: flex; flex-direction: column; justify-content: center; gap: 8px; min-width: 280px;">
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-primary btn-sm" id="btn-add-proctor-quota" style="flex: 1; font-weight: 700; box-shadow: 0 2px 8px rgba(59,31,84,0.2);">
                👤+ เพิ่มผู้คุมสอบ
              </button>
              <button class="btn btn-secondary btn-sm" id="btn-preset-quotas" style="flex: 1; font-weight: 600;" title="จำลองข้อมูลโควต้าและเงื่อนไขเริ่มต้น">
                ✨ จำลองข้อมูล (Preset)
              </button>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-sm" id="btn-clear-core-pool" style="flex: 1; font-size: 12px; color: #b91c1c;" title="ย้ายบุคลากรกลุ่มหลักทั้งหมดไปเป็นกลุ่มสำรอง">
                🗑️ ล้างกลุ่มหลัก
              </button>
              <button class="btn btn-secondary btn-sm" id="btn-clear-reserve-pool" style="flex: 1; font-size: 12px; color: #b45309;" title="ย้ายบุคลากรกลุ่มสำรองทั้งหมดไปเป็นกลุ่มหลัก">
                🗑️ ล้างกลุ่มสำรอง
              </button>
              <button class="btn btn-secondary btn-sm" id="btn-reset-proctor-quotas" style="font-size: 12px;" title="รีเซ็ตโควต้าและเงื่อนไขทั้งหมด">
                🔄 รีเซ็ต
              </button>
            </div>
          </div>
        </div>

        <!-- Filter & Search Toolbar (ตามภาพทางขวา) -->
        <div class="card">
          <div class="card-body" style="padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
              <!-- ตัวกรองกลุ่ม -->
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">ตัวกรองกลุ่ม:</span>
                <div style="display: flex; gap: 4px;">
                  <button class="btn btn-sm ${filterPool === 'all' ? 'btn-primary' : 'btn-secondary'} btn-filter-pool" data-pool="all" style="border-radius: var(--radius-sm); font-size: 12.5px; padding: 5px 12px;">
                    ทั้งหมด (${allProctors.length})
                  </button>
                  <button class="btn btn-sm ${filterPool === 'core' ? 'btn-primary' : 'btn-secondary'} btn-filter-pool" data-pool="core" style="border-radius: var(--radius-sm); font-size: 12.5px; padding: 5px 12px;">
                    กลุ่มหลัก (${coreCount})
                  </button>
                  <button class="btn btn-sm ${filterPool === 'reserve' ? 'btn-primary' : 'btn-secondary'} btn-filter-pool" data-pool="reserve" style="border-radius: var(--radius-sm); font-size: 12.5px; padding: 5px 12px;">
                    กลุ่มสำรอง (${reserveCount})
                  </button>
                </div>
              </div>

              <div style="width: 1px; height: 22px; background: var(--border-subtle);"></div>

              <!-- ปรับทั้งชุด -->
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">ปรับทั้งชุด:</span>
                <button class="btn btn-secondary btn-sm" id="btn-set-all-core" style="color: #15803d; border-color: rgba(22, 163, 74, 0.4); font-size: 12.5px; padding: 5px 10px;" title="ตั้งบุคลากรทั้งหมดเป็นกลุ่มหลัก">
                  ✓ ตั้งเป็นกลุ่มหลักทั้งหมด
                </button>
                <button class="btn btn-secondary btn-sm" id="btn-set-all-reserve" style="color: #b45309; border-color: rgba(217, 119, 6, 0.4); font-size: 12.5px; padding: 5px 10px;" title="ตั้งบุคลากรทั้งหมดเป็นกลุ่มสำรอง">
                  👥 ตั้งเป็นกลุ่มสำรองทั้งหมด
                </button>
              </div>
            </div>

            <!-- ค้นหาด้านขวา -->
            <div style="min-width: 260px; max-width: 380px; flex: 1;">
              <input type="text" class="form-input" id="search-proctors-quota-input" placeholder="🔍 ค้นหาชื่อ-สกุล, คณะ/สำนัก, หรือสาขาวิชา..." value="${this.proctorQuotaSearchKeyword || ''}" style="padding: 7px 12px; font-size: 13px; width: 100%;">
            </div>
          </div>
        </div>

        <!-- Priority Logic Box (กดซ่อน/แสดงได้ เพื่อไม่ให้เปลืองพื้นที่) -->
        <div class="proctor-priority-box">
          <div id="btn-toggle-priority-logic" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" title="คลิกเพื่อเปิด/ซ่อนคำอธิบายเงื่อนไข">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 15px;">💡</span>
              <span style="font-weight: 700; color: #92400e; font-size: 13.5px;">ลำดับความสำคัญของเงื่อนไขการจัดคุมสอบ (Priority Logic)</span>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" style="font-size: 11.5px; padding: 2px 8px; border-radius: var(--radius-sm); pointer-events: none;">
              ${this.isPriorityLogicOpen ? '▲ ซ่อนคำอธิบาย' : '▼ เปิดดูคำอธิบาย'}
            </button>
          </div>
          ${this.isPriorityLogicOpen ? `
            <div class="proctor-priority-grid" style="margin-top: 12px;">
              <div class="proctor-priority-item">
                <strong style="color: var(--primary-800);">โควต้ารอบสูงสุด (ข้อกำหนดหลัก):</strong>
                ต้องระบุจำนวนรอบ (> 0) เพื่อให้ระบบจัดคุมสอบ หากไม่ระบุหรือระบุ 0 ระบบจะไม่จัดเข้าคุมสอบทุกรอบ
              </div>
              <div class="proctor-priority-item">
                <strong style="color: var(--primary-800);">รอบและวันที่สะดวก (ข้อกำหนดหลัก):</strong>
                ไม่ระบุ = สะดวกทุกรอบ / เลือกระบุวัน = สะดวกเฉพาะรอบเช้า-บ่ายที่เลือกเปิดไว้เท่านั้น
              </div>
              <div class="proctor-priority-item">
                <strong style="color: var(--primary-800);">รูปแบบการคุมสอบ (Option):</strong>
                นำมาพิจารณาประกอบ (เช่น เช้า-บ่ายห้องเดิม, วันละรอบ) หากไม่ขัดแย้งกับข้อกำหนดหลัก
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Main Quota Table -->
        <div class="card">
          <div class="card-body" style="padding: 0; overflow-x: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background: var(--bg-surface-elevated, #f8fafc); border-bottom: 2px solid var(--border-subtle); text-align: left;">
                  <th style="padding: 10px 14px; width: 50px; text-align: center;">ลำดับ</th>
                  <th style="padding: 10px 14px; min-width: 220px;">ชื่อ-นามสกุล / ตำแหน่ง / สังกัด</th>
                  <th style="padding: 10px 14px; width: 140px; text-align: center; white-space: nowrap;">กลุ่มบุคลากร</th>
                  <th style="padding: 10px 14px; width: 145px; text-align: center; white-space: nowrap;">โควต้ารอบสูงสุด</th>
                  <th style="padding: 10px 14px; min-width: 270px;">รอบและวันที่สะดวกปฏิบัติหน้าที่</th>
                  <th style="padding: 10px 14px; width: 180px;">รูปแบบการคุมสอบ (Option)</th>
                  <th style="padding: 10px 14px; width: 85px; text-align: center;">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${filteredProctors.length === 0 ? `
                  <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
                      ไม่พบข้อมูลผู้คุมสอบที่ตรงกับเงื่อนไขค้นหา
                    </td>
                  </tr>
                ` : filteredProctors.map((p, idx) => {
                  const isCore = p.pool !== 'reserve';
                  return `
                    <tr style="border-bottom: 1px solid var(--border-subtle); transition: background 0.15s ease;">
                      <td style="padding: 12px 14px; text-align: center; color: var(--text-muted); font-weight: 600;">
                        ${idx + 1}
                      </td>
                      <td style="padding: 12px 14px;">
                        <div style="font-weight: 700; color: var(--text-main); font-size: 13.5px;">
                          ${p.academicTitle ? p.academicTitle + ' ' : ''}${p.firstName} ${p.lastName}
                        </div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                          <span class="role-tag ${p.proctorType === 'faculty' ? 'teacher' : 'proctor'}" style="font-size: 10px; padding: 1px 6px;">
                            ${p.proctorType === 'faculty' ? 'อาจารย์' : 'เจ้าหน้าที่'}
                          </span>
                          • ${p.department}${p.subDepartment ? ' (' + p.subDepartment + ')' : ''}
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                          📞 ${p.phone || '-'} | ✉️ ${this.maskPDPA ? '•••••••@••••••' : (p.email || '-')}
                        </div>
                      </td>
                      <td style="padding: 12px 14px; text-align: center; white-space: nowrap;">
                        <button type="button" class="pool-toggle-btn ${isCore ? 'pool-core' : 'pool-reserve'}" data-action="toggle-proctor-pool" data-proctor-id="${p.id}" title="คลิกเพื่อสลับระหว่างกลุ่มหลักและกลุ่มสำรอง" style="display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; ${isCore ? 'background: #ECFDF5; color: #15803D; border: 1px solid #A7F3D0;' : 'background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A;'}">
                          ${isCore ? 'กลุ่มหลัก (Core)' : 'กลุ่มสำรอง (Reserve)'}
                        </button>
                      </td>
                      <td style="padding: 12px 14px; text-align: center; white-space: nowrap;">
                        <select class="form-select select-proctor-quota" data-proctor-id="${p.id}" style="font-weight: 600; text-align: center; padding: 5px 8px; font-size: 13px; width: 130px; min-width: 125px; margin: 0 auto; border-radius: 6px; border: 1px solid var(--border); background-color: var(--bg-surface);">
                          <option value="1" ${p.projectQuota === 1 ? 'selected' : ''}>1 รอบ</option>
                          <option value="2" ${p.projectQuota === 2 ? 'selected' : ''}>2 รอบ</option>
                          <option value="3" ${p.projectQuota === 3 ? 'selected' : ''}>3 รอบ</option>
                          <option value="4" ${p.projectQuota === 4 ? 'selected' : ''}>4 รอบ</option>
                          <option value="5" ${p.projectQuota === 5 ? 'selected' : ''}>5 รอบ</option>
                          <option value="6" ${p.projectQuota >= 6 ? 'selected' : ''}>6 รอบ (สูงสุด)</option>
                          <option value="0" ${p.projectQuota === 0 ? 'selected' : ''}>0 รอบ (งดจัด)</option>
                        </select>
                      </td>
                      <td style="padding: 12px 14px;">
                        <div class="chip-session-group" style="display: flex; flex-direction: column; gap: 6px;">
                          ${examDates.map(([dateStr, dSessions]) => {
                            const thaiDateShort = formatThaiDate(dateStr).replace('2569', '69');
                            const mSession = dSessions.find(s => s.name?.includes('เช้า') || s.startTime?.includes('08:') || s.id === 'S01' || s.id === 'S03' || s.id === 'S05');
                            const aSession = dSessions.find(s => s.name?.includes('บ่าย') || s.startTime?.includes('12:') || s.startTime?.includes('13:') || s.id === 'S02' || s.id === 'S04' || s.id === 'S06');

                            const mUnavail = mSession ? (appState.unavailabilities || []).some(u => u.proctorId === p.id && u.sessionId === mSession.id) : false;
                            const aUnavail = aSession ? (appState.unavailabilities || []).some(u => u.proctorId === p.id && u.sessionId === aSession.id) : false;

                            return `
                              <div class="chip-session-day" style="display: flex; align-items: center; gap: 8px;">
                                <span class="chip-day-label" style="font-size: 12.5px; font-weight: 600; color: var(--text-main); min-width: 70px;">${thaiDateShort}:</span>
                                ${mSession ? `
                                  <button type="button" class="btn-session-chip ${!mUnavail ? 'chip-active-morning' : 'chip-inactive'}" data-action="toggle-session-avail" data-proctor-id="${p.id}" data-session-id="${mSession.id}" title="${!mUnavail ? 'สะดวก (คลิกเพื่อแจ้งไม่สะดวก)' : 'ไม่สะดวก (คลิกเพื่อเปิดรับงาน)'}" style="display: inline-flex; align-items: center; justify-content: center; padding: 3px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.12s ease; ${!mUnavail ? 'background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D;' : 'background: #F1F5F9; color: #94A3B8; border: 1px solid #CBD5E1; text-decoration: line-through;'}">
                                    เช้า
                                  </button>
                                ` : ''}
                                ${aSession ? `
                                  <button type="button" class="btn-session-chip ${!aUnavail ? 'chip-active-afternoon' : 'chip-inactive'}" data-action="toggle-session-avail" data-proctor-id="${p.id}" data-session-id="${aSession.id}" title="${!aUnavail ? 'สะดวก (คลิกเพื่อแจ้งไม่สะดวก)' : 'ไม่สะดวก (คลิกเพื่อเปิดรับงาน)'}" style="display: inline-flex; align-items: center; justify-content: center; padding: 3px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.12s ease; ${!aUnavail ? 'background: #EDE9FE; color: #5B21B6; border: 1px solid #C4B5FD;' : 'background: #F1F5F9; color: #94A3B8; border: 1px solid #CBD5E1; text-decoration: line-through;'}">
                                    บ่าย
                                  </button>
                                ` : ''}
                              </div>
                            `;
                          }).join('')}
                        </div>
                      </td>
                      <td style="padding: 12px 14px;">
                        <select class="form-select select-proctor-pattern" data-proctor-id="${p.id}" style="font-size: 12px; padding: 4px 6px; width: 100%;">
                          <option value="FULL_DAY_PAIRED" ${p.sessionPattern === 'FULL_DAY_PAIRED' ? 'selected' : ''}>เช้า-บ่ายห้องเดิม (FULL_DAY_PAIRED)</option>
                          <option value="SINGLE_PER_DAY" ${p.sessionPattern === 'SINGLE_PER_DAY' ? 'selected' : ''}>ขอคุมวันละรอบ (SINGLE_PER_DAY)</option>
                          <option value="ANY" ${p.sessionPattern === 'ANY' ? 'selected' : ''}>สลับคุมรอบใดก็ได้ (ANY)</option>
                          <option value="EVERY_SESSION" ${p.sessionPattern === 'EVERY_SESSION' ? 'selected' : ''}>คุมทุกรอบตลอดโครงการ (EVERY_SESSION)</option>
                        </select>
                      </td>
                      <td style="padding: 12px 14px; text-align: center;">
                        <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                          <button class="btn btn-sm btn-save-quota-row" data-action="save-proctor-quota-row" data-proctor-id="${p.id}" title="บันทึกโควต้า & เงื่อนไข" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); color: #16a34a; font-weight: 800; font-size: 14px; padding: 4px 9px; border-radius: var(--radius-sm); cursor: pointer;">
                            ✓
                          </button>
                          <button class="btn btn-sm" data-action="delete-proctor" data-proctor-id="${p.id}" title="ลบผู้คุมสอบ" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); color: #b91c1c; font-size: 13px; padding: 4px 8px; border-radius: var(--radius-sm); cursor: pointer;">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // --- มุมมองที่ 2: ข้อมูลผู้คุมสอบ (หน้าเดิมตาม Image 2) ---
  renderProctorInfoView() {
    this.masterDataSubTab = 'proctors';
    return `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <!-- แถบเครื่องมือจัดการผู้คุมสอบ (เดิม) -->
        <div class="master-header-controls">
          <div class="master-subtabs-row">
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 20px;">👥</span>
                <div>
                  <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main);">จัดการข้อมูลผู้คุมสอบ (${appState.proctors.length} ท่าน)</h3>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                    อาจารย์ ${appState.proctors.filter(p => p.proctorType === 'faculty').length} ท่าน • เจ้าหน้าที่ ${appState.proctors.filter(p => p.proctorType !== 'faculty').length} ท่าน
                  </div>
                </div>
              </div>
            </div>
            <div class="master-action-buttons">
              <button class="btn btn-primary btn-sm" id="btn-add-master-item" style="font-weight: 700; box-shadow: 0 2px 8px rgba(124,58,237,0.25);">
                ➕ เพิ่มผู้คุมสอบ
              </button>
              <div class="custom-dropdown" id="dropdown-master-csv">
                <button class="btn btn-secondary btn-sm custom-dropdown-trigger" type="button" aria-haspopup="true" aria-expanded="false" title="จัดการไฟล์ CSV">
                  <span>📁 นำเข้า/ส่งออก CSV</span>
                  <span style="font-size: 10px; margin-left: 2px;">▾</span>
                </button>
                <div class="custom-dropdown-menu custom-dropdown-menu-right" role="menu">
                  <button class="custom-dropdown-item" id="btn-download-template" type="button" role="menuitem">
                    <span class="dropdown-item-icon">📥</span>
                    <div>
                      <div class="dropdown-item-title">ดาวน์โหลดแม่แบบ CSV</div>
                      <div class="dropdown-item-desc">ไฟล์ตัวอย่างพร้อมคอลัมน์มาตรฐาน</div>
                    </div>
                  </button>
                  <label class="custom-dropdown-item" style="cursor: pointer; margin: 0;" role="menuitem">
                    <span class="dropdown-item-icon">📤</span>
                    <div>
                      <div class="dropdown-item-title">นำเข้าไฟล์ CSV</div>
                      <div class="dropdown-item-desc">อัปโหลดไฟล์ข้อมูลเข้าระบบ</div>
                    </div>
                    <input type="file" id="file-import-csv" accept=".csv" style="display: none;">
                  </label>
                  <div class="custom-dropdown-divider"></div>
                  <button class="custom-dropdown-item" id="btn-export-current-csv" type="button" role="menuitem">
                    <span class="dropdown-item-icon">💾</span>
                    <div>
                      <div class="dropdown-item-title">ส่งออกข้อมูลเป็น CSV</div>
                      <div class="dropdown-item-desc">ดาวน์โหลดข้อมูลทั้งหมดในแท็บนี้</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- เครื่องมือทดสอบระบบ & Presets -->
          <div class="test-tools-collapsible ${this.isTestToolsOpen ? 'is-open' : ''}" id="test-tools-accordion">
            <button class="test-tools-header" type="button" id="btn-toggle-test-tools" aria-expanded="${this.isTestToolsOpen ? 'true' : 'false'}">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge badge-warning" style="font-size: 10px; padding: 2px 6px;">ทดสอบระบบ</span>
                <span style="font-size: 13px; font-weight: 600; color: var(--text-main);">🧪 เครื่องมือทดสอบระบบ & ชุดข้อมูลจำลอง</span>
              </div>
              <span class="accordion-arrow" style="font-size: 12px; color: var(--text-muted); font-weight: 600;">
                ${this.isTestToolsOpen ? '▲ ซ่อน' : '▼ เปิดดู'}
              </span>
            </button>
            <div class="test-tools-body" style="${this.isTestToolsOpen ? 'display: block;' : 'display: none;'}">
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 10px 14px; background: rgba(245, 158, 11, 0.05); border: 1px dashed rgba(245, 158, 11, 0.35); border-radius: var(--radius-md);">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span style="font-size: 12px; font-weight: 600; color: #92400e;">สุ่มเพิ่มบุคลากร:</span>
                  <button class="btn btn-secondary btn-sm" id="btn-add-random-20-master" title="สุ่มเพิ่มอาจารย์และบุคลากรอีก 20 ท่าน" style="background: var(--bg-surface); font-size: 12px;">
                    ➕ สุ่มเพิ่ม 20 คน
                  </button>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span style="font-size: 12px; font-weight: 600; color: #92400e;">ชุดข้อมูลจำลอง:</span>
                  <div class="master-presets-pills">
                    ${Object.entries(SEED_PRESETS).map(([key, p]) => `
                      <button class="btn btn-secondary btn-sm" data-action="load-preset" data-preset="${key}" style="background: var(--bg-surface); font-size: 11.5px; padding: 4px 8px;">
                        ${p.label}
                      </button>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ตารางข้อมูลผู้คุมสอบ (เดิม 100%) -->
        <div class="card">
          <div class="card-body" style="padding: 0;">
            <div class="table-wrapper" style="border: none;">
              ${this.renderMasterDataTable()}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- มุมมองที่ 3: สรุปคุมสอบรายบุคคล ---
  renderProctorSummaryView() {
    const sessionMap = new Map(appState.sessions.map(s => [s.id, s]));
    const roomMap = new Map(appState.rooms.map(r => [r.id, r]));
    const proctors = appState.proctors || [];
    const assignments = appState.assignments || [];

    const assignedProctorIds = new Set(assignments.map(a => a.proctorId));
    const assignedCount = assignedProctorIds.size;
    const avgWorkload = proctors.length > 0 ? (assignments.length / proctors.length).toFixed(1) : 0;

    return `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: var(--text-main);">
              📊 สรุปตารางคุมสอบรายบุคคล และภาระงาน (Workload Summary)
            </h2>
            <p style="margin: 3px 0 0; font-size: 13px; color: var(--text-muted);">
              ตรวจสอบการกระจายงาน รายการรอบสอบที่ได้รับมอบหมาย และชั่วโมงปฏิบัติงานของกรรมการแต่ละท่าน
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" id="btn-export-workload-csv" data-action="export-csv-proctors" style="font-size: 12.5px;">
              📥 ส่งออกรายงาน CSV
            </button>
          </div>
        </div>

        <!-- 3 KPI Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
          <div class="card" style="border-left: 4px solid var(--primary-700);">
            <div class="card-body" style="padding: 12px 16px;">
              <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">บุคลากรทั้งหมด</div>
              <div style="font-size: 22px; font-weight: 800; color: var(--text-main); margin-top: 2px;">
                ${proctors.length} <span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">ท่าน</span>
              </div>
            </div>
          </div>
          <div class="card" style="border-left: 4px solid #16a34a;">
            <div class="card-body" style="padding: 12px 16px;">
              <div style="font-size: 12px; color: #16a34a; font-weight: 600;">ได้รับมอบหมายแล้ว</div>
              <div style="font-size: 22px; font-weight: 800; color: #15803d; margin-top: 2px;">
                ${assignedCount} <span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">ท่าน (${Math.round((assignedCount / (proctors.length || 1)) * 100)}%)</span>
              </div>
            </div>
          </div>
          <div class="card" style="border-left: 4px solid var(--accent-600);">
            <div class="card-body" style="padding: 12px 16px;">
              <div style="font-size: 12px; color: var(--accent-700); font-weight: 600;">ภาระงานเฉลี่ย</div>
              <div style="font-size: 22px; font-weight: 800; color: var(--accent-800); margin-top: 2px;">
                ${avgWorkload} <span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">รอบ/ท่าน (รวม ${assignments.length} ตำแหน่ง)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- รายการตารางรายบุคคล -->
        <div class="card">
          <div class="card-body" style="padding: 0; overflow-x: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background: var(--bg-surface-elevated, #f8fafc); border-bottom: 2px solid var(--border-subtle); text-align: left;">
                  <th style="padding: 10px 14px; width: 50px; text-align: center;">ลำดับ</th>
                  <th style="padding: 10px 14px; min-width: 200px;">ผู้คุมสอบ (ชื่อ-สกุล)</th>
                  <th style="padding: 10px 14px; width: 130px;">ประเภท/สังกัด</th>
                  <th style="padding: 10px 14px; min-width: 280px;">รอบการสอบที่ได้รับมอบหมาย</th>
                  <th style="padding: 10px 14px; width: 110px; text-align: center;">ชั่วโมงรวม</th>
                  <th style="padding: 10px 14px; width: 160px;">ภาระงานเทียบโควต้า</th>
                </tr>
              </thead>
              <tbody>
                ${proctors.map((p, idx) => {
                  const assigns = assignments.filter(a => a.proctorId === p.id);
                  const quota = p.projectQuota || 6;
                  const ratio = assigns.length / quota;
                  const totalHrs = (assigns.length * 3.5).toFixed(1);

                  return `
                    <tr style="border-bottom: 1px solid var(--border-subtle);">
                      <td style="padding: 10px 14px; text-align: center; color: var(--text-muted); font-weight: 600;">${idx + 1}</td>
                      <td style="padding: 10px 14px;">
                        <div style="font-weight: 700; color: var(--text-main);">${p.academicTitle ? p.academicTitle + ' ' : ''}${p.firstName} ${p.lastName}</div>
                        <div style="font-size: 11px; color: var(--text-muted);">${p.id} • ${p.level === 'chief' ? 'หัวหน้าห้องได้' : 'ผู้ช่วย'}</div>
                      </td>
                      <td style="padding: 10px 14px;">
                        <span class="role-tag ${p.proctorType === 'faculty' ? 'teacher' : 'proctor'}" style="font-size: 10px; padding: 1px 6px;">
                          ${p.proctorType === 'faculty' ? 'อาจารย์' : 'เจ้าหน้าที่'}
                        </span>
                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${p.department}</div>
                      </td>
                      <td style="padding: 10px 14px;">
                        <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                          ${assigns.map(a => {
                            const s = sessionMap.get(a.sessionId);
                            const r = a.roomId ? roomMap.get(a.roomId) : null;
                            const dStr = s ? formatThaiDate(s.date).replace('2569', '69') : '';
                            return `
                              <span class="badge ${a.status === 'locked' ? 'badge-locked' : 'badge-normal'}" style="font-size: 11px; padding: 2px 7px;" title="${s?.name || a.sessionId} ห้อง ${r?.name || '-'}">
                                ${dStr} ${s?.name?.includes('เช้า') ? 'เช้า' : 'บ่าย'} (${r ? r.name : 'สำรอง'})
                              </span>
                            `;
                          }).join('') || '<span style="color: var(--text-muted); font-size: 12px;">(ยังไม่มีรอบมอบหมาย)</span>'}
                        </div>
                      </td>
                      <td style="padding: 10px 14px; text-align: center; font-weight: 700; color: var(--text-main);">${totalHrs} ชม.</td>
                      <td style="padding: 10px 14px;">
                        <div class="workload-bar-container">
                          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
                            <span>${assigns.length} / ${quota} รอบ</span>
                            <span style="font-weight: 700;">${Math.round(ratio * 100)}%</span>
                          </div>
                          <div class="workload-bar-track" style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                            <div class="workload-bar-fill ${ratio > 1 ? 'workload-fill-danger' : (ratio >= 0.8 ? 'workload-fill-warning' : 'workload-fill-normal')}" 
                                 style="width: ${Math.min(100, Math.round(ratio * 100))}%; height: 100%; border-radius: 3px;"></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // --- มุมมองที่ 4: คำขอเปลี่ยนตัว ---
  renderProctorSwapsView() {
    const pendingSwaps = appState.pendingSwaps || [];
    const swapDocIssued = Boolean(appState.swapDocIssued);
    const sessionMap = new Map(appState.sessions.map(s => [s.id, s]));
    const roomMap = new Map(appState.rooms.map(r => [r.id, r]));
    const proctorMap = new Map(appState.proctors.map(p => [p.id, p]));

    return `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: var(--text-main);">
              ⇄ คำขอสลับตัว / เปลี่ยนตัวผู้คุมสอบ (Swap Requests)
            </h2>
            <p style="margin: 3px 0 0; font-size: 13px; color: var(--text-muted);">
              จัดการคำขอสลับเวรคุมสอบ แจ้งลากะทันหัน พร้อมเสนอตัวแทนและออกใบเซ็นสลับราชการ
            </p>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" id="btn-open-sudden-leave-swaps" style="font-weight: 700; box-shadow: 0 2px 8px rgba(59,31,84,0.2);">
              ➕ แจ้งขอสลับตัว / เปลี่ยนตัว
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-open-swap-memo-swaps" style="font-weight: 600;">
              📄 ดู/พิมพ์ใบเซ็นสลับราชการ
            </button>
          </div>
        </div>

        ${pendingSwaps.length === 0 ? `
          <div class="card" style="text-align: center; padding: 48px 20px; border-top: 4px solid var(--primary-600);">
            <div style="font-size: 40px; margin-bottom: 10px;">✅</div>
            <h3 style="margin: 0 0 6px; font-size: 17px; font-weight: 700; color: var(--text-main);">ไม่มีคำขอสลับตัวค้างอยู่ในระบบ</h3>
            <p style="margin: 0; font-size: 13.5px; color: var(--text-muted);">กรรมการทุกท่านมีตารางปฏิบัติหน้าที่ครบถ้วนและพร้อมคุมสอบตามกำหนดการ</p>
            <div style="margin-top: 16px;">
              <button class="btn btn-primary btn-sm" id="btn-create-first-swap">
                ➕ ยื่นคำขอสลับตัว / เปลี่ยนตัว
              </button>
            </div>
          </div>
        ` : `
          <div class="card" style="border-top: 4px solid #f59e0b;">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #b45309; font-size: 14.5px;">รายการคำขอที่รอจัดการ (${pendingSwaps.length} รายการ)</strong>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                  ${swapDocIssued ? '✅ ออกใบเซ็นสลับส่งตรวจเรียบร้อยแล้ว' : '🔒 ต้องออกใบเซ็นสลับราชการก่อนยืนยันตาราง'}
                </div>
              </div>
              <button class="btn btn-accent btn-sm" id="btn-issue-swap-doc-swaps">
                📄 ${swapDocIssued ? 'ดูใบเซ็นสลับ' : 'ออกใบเซ็นสลับส่งตรวจ'}
              </button>
            </div>
            <div class="card-body" style="padding: 0; overflow-x: auto;">
              <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: var(--bg-surface-elevated, #f8fafc); border-bottom: 2px solid var(--border-subtle); text-align: left;">
                    <th style="padding: 10px 14px; width: 50px; text-align: center;">#</th>
                    <th style="padding: 10px 14px; min-width: 180px;">ผู้คุมเดิม</th>
                    <th style="padding: 10px 14px; min-width: 180px;">ผู้คุมแทน</th>
                    <th style="padding: 10px 14px; min-width: 200px;">รอบสอบ & ห้องสอบ</th>
                    <th style="padding: 10px 14px; min-width: 180px;">เหตุผลการขอเปลี่ยนตัว</th>
                    <th style="padding: 10px 14px; width: 110px; text-align: center;">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  ${pendingSwaps.map((sw, idx) => {
                    const orig = proctorMap.get(sw.originalProctorId);
                    const sub = proctorMap.get(sw.newProctorId);
                    const s = sessionMap.get(sw.sessionId);
                    const r = roomMap.get(sw.roomId);
                    const origName = orig ? `${orig.academicTitle ? orig.academicTitle + ' ' : ''}${orig.firstName} ${orig.lastName}` : sw.originalProctorId;
                    const subName = sub ? `${sub.academicTitle ? sub.academicTitle + ' ' : ''}${sub.firstName} ${sub.lastName}` : sw.newProctorId;

                    return `
                      <tr style="border-bottom: 1px solid var(--border-subtle);">
                        <td style="padding: 12px 14px; text-align: center; color: var(--text-muted); font-weight: 600;">${idx + 1}</td>
                        <td style="padding: 12px 14px;">
                          <div style="font-weight: 700; color: #b91c1c;">${origName}</div>
                          <div style="font-size: 11px; color: var(--text-muted);">${orig?.department || '-'}</div>
                        </td>
                        <td style="padding: 12px 14px;">
                          <div style="font-weight: 700; color: #15803d;">${subName}</div>
                          <div style="font-size: 11px; color: var(--text-muted);">${sub?.department || '-'}</div>
                        </td>
                        <td style="padding: 12px 14px;">
                          <strong>${s ? formatThaiDate(s.date) : ''}</strong>
                          <div style="font-size: 11.5px; color: var(--text-muted);">${s?.name || sw.sessionId} • ${r?.name || 'ห้องสอบ'}</div>
                        </td>
                        <td style="padding: 12px 14px; color: var(--text-main); font-size: 12.5px;">
                          ${sw.reason || 'ติดภารกิจราชการ'}
                        </td>
                        <td style="padding: 12px 14px; text-align: center;">
                          <span class="badge ${swapDocIssued ? 'badge-normal' : 'badge-danger'}" style="font-size: 11px;">
                            ${swapDocIssued ? 'ออกใบแล้ว' : 'รอออกใบ'}
                          </span>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `}
      </div>
    `;
  }

  // --- มุมมองที่ 5: เอกสารและคำสั่งสอบ ---
  renderProctorDocsView() {
    const swapDocHistory = appState.swapDocHistory || [];

    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: var(--text-main);">
            📄 เอกสารและคำสั่งแต่งตั้งคณะกรรมการกำกับการสอบ
          </h2>
          <p style="margin: 3px 0 0; font-size: 13px; color: var(--text-muted);">
            ออกเอกสารคำสั่งแต่งตั้งทางการของมหาวิทยาลัย และบันทึกข้อความขออนุมัติเปลี่ยนแปลงกรรมการคุมสอบ
          </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
          <!-- Card 1: คำสั่งแต่งตั้งทางการ -->
          <div class="card" style="border-top: 4px solid var(--primary-600); display: flex; flex-direction: column; justify-content: space-between;">
            <div class="card-body" style="padding: 20px;">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div style="font-size: 32px;">📋</div>
                <div>
                  <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main);">
                    คำสั่งแต่งตั้งคณะกรรมการกำกับการสอบ
                  </h3>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                    มหาวิทยาลัยราชภัฏบุรีรัมย์ • ระบบจัดห้องคุมสอบ กพ. และคุรุสภา
                  </div>
                </div>
              </div>
              <p style="font-size: 13px; color: var(--text-muted); line-height: 1.6; margin: 0 0 16px;">
                เอกสารทางการระบุรายชื่อคณะกรรมการกำกับการสอบ หัวหน้าห้อง ผู้ช่วยคุมสอบ และกรรมการกองอำนวยการ ครบทุกห้องและทุกรอบสอบตามระเบียบ
              </p>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-primary btn-sm" id="btn-print-appointment-order-doc" style="flex: 1; font-weight: 700;">
                  🖨️ พิมพ์คำสั่งทางการ (PDF)
                </button>
              </div>
            </div>
          </div>

          <!-- Card 2: บันทึกข้อความขอสลับตัว (ใบเซ็นสลับ) -->
          <div class="card" style="border-top: 4px solid var(--accent-500); display: flex; flex-direction: column; justify-content: space-between;">
            <div class="card-body" style="padding: 20px;">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div style="font-size: 32px;">📝</div>
                <div>
                  <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main);">
                    บันทึกข้อความขอเปลี่ยนแปลงกรรมการ (ใบเซ็นสลับ)
                  </h3>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                    เอกสารราชการเสนอ อธิการบดีมหาวิทยาลัยราชภัฏบุรีรัมย์
                  </div>
                </div>
              </div>
              <p style="font-size: 13px; color: var(--text-muted); line-height: 1.6; margin: 0 0 16px;">
                บันทึกข้อความจากหัวหน้าศูนย์สอบ (ผศ.ดร.ณัฐพล แสนคำ) ขออนุมัติปรับเปลี่ยนกรรมการคุมสอบกรณีลากะทันหันหรือสลับเวร พร้อมเสนอตัวแทน
              </p>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-accent btn-sm" id="btn-print-swap-memo-doc" style="flex: 1; font-weight: 700;">
                  📄 ดู/พิมพ์ใบเซ็นสลับ (PDF)
                </button>
                <button class="btn btn-secondary btn-sm" id="btn-view-swap-history-doc">
                  📜 ประวัติ (${swapDocHistory.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- 7.2.2 หน้าจัดการห้องสอบ (แยกเป็นเมนูอิสระ) ---
  renderRoomsPage() {
    this.roomsSubTab = this.roomsSubTab || 'seating-grid';
    this.blueprintFloor = this.blueprintFloor || 1;

    const totalCapacity = (appState.rooms || []).reduce((s, r) => s + (r.isActive !== false ? (r.capacity || 0) : 0), 0);

    return `
      <!-- แถบสลับหน้าย่อย 4 แท็บ สไตล์เดียวกับหน้าผู้คุมสอบและตารางผู้คุมสอบ -->
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
        <div style="display: inline-flex; flex-wrap: wrap; background-color: var(--bg-surface); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); gap: 6px; width: fit-content;">
          <button type="button" class="btn btn-sm ${this.roomsSubTab === 'seating-grid' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-rooms-seating" style="${this.roomsSubTab === 'seating-grid' ? 'background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700; border: 1px solid var(--brand-purple, #3B1F54) !important; box-shadow: 0 1px 3px rgba(59,31,84,0.25);' : 'background-color: #FFFFFF !important; color: var(--brand-purple, #3B1F54) !important; border: 1px solid var(--border-subtle, #E2E8F0) !important; font-weight: 600;'} padding: 6px 14px; font-size: 13px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">
            🪑 ผังห้องสอบและที่นั่ง
          </button>
          <button type="button" class="btn btn-sm ${this.roomsSubTab === 'table' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-rooms-table" style="${this.roomsSubTab === 'table' ? 'background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700; border: 1px solid var(--brand-purple, #3B1F54) !important; box-shadow: 0 1px 3px rgba(59,31,84,0.25);' : 'background-color: #FFFFFF !important; color: var(--brand-purple, #3B1F54) !important; border: 1px solid var(--border-subtle, #E2E8F0) !important; font-weight: 600;'} padding: 6px 14px; font-size: 13px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">
            📋 ตารางห้องสอบ (${appState.rooms.length} ห้อง)
          </button>
          <button type="button" class="btn btn-sm ${this.roomsSubTab === 'blueprint' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-rooms-blueprint" style="${this.roomsSubTab === 'blueprint' ? 'background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700; border: 1px solid var(--brand-purple, #3B1F54) !important; box-shadow: 0 1px 3px rgba(59,31,84,0.25);' : 'background-color: #FFFFFF !important; color: var(--brand-purple, #3B1F54) !important; border: 1px solid var(--border-subtle, #E2E8F0) !important; font-weight: 600;'} padding: 6px 14px; font-size: 13px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">
            🏢 ผังอาคาร 17
          </button>
          <button type="button" class="btn btn-sm ${this.roomsSubTab === 'directory' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-rooms-directory" style="${this.roomsSubTab === 'directory' ? 'background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700; border: 1px solid var(--brand-purple, #3B1F54) !important; box-shadow: 0 1px 3px rgba(59,31,84,0.25);' : 'background-color: #FFFFFF !important; color: var(--brand-purple, #3B1F54) !important; border: 1px solid var(--border-subtle, #E2E8F0) !important; font-weight: 600;'} padding: 6px 14px; font-size: 13px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">
            📑 สารบบอาคาร 17 (Directory)
          </button>
        </div>
      </div>

      ${this.renderRoomsSubTabContent()}
    `;
  }

  renderRoomsSubTabContent() {
    switch (this.roomsSubTab) {
      case 'seating-grid':
        return this.renderRoomsSeatingGridView();
      case 'table':
        return this.renderRoomsTableView();
      case 'blueprint':
        return this.renderRoomsBlueprintView();
      case 'directory':
        return this.renderBuildingDirectoryTable();
      default:
        return this.renderRoomsSeatingGridView();
    }
  }

    // --- มุมมองที่ 1: ผังห้องสอบและที่นั่ง (10 ห้องมาตรฐาน แถวละ 5 ห้อง พร้อมปุ่มจัดการและพิมพ์บัตร 8 ที่นั่ง/A4) ---
  renderRoomsSeatingGridView() {
    // ปรับปรุงลำดับเลขที่นั่งของทุกห้องที่เปิดสอบให้นับต่อเนื่องกันอัตโนมัติ (ไม่แหว่ง ไม่ทับซ้อน)
    const sortedRooms = [...(appState.rooms || [])].sort((a, b) => {
      const codeA = a.roomCode || a.code || a.id;
      const codeB = b.roomCode || b.code || b.id;
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    });

    let curSeqSeat = sortedRooms.length > 0 && sortedRooms[0].seatStart ? sortedRooms[0].seatStart : 1;
    sortedRooms.forEach(r => {
      if (r.isActive !== false) {
        const rDis = (r.disabledSeats || []).length;
        const effectiveSeats = rDis > 0 ? Math.max(0, (r.capacity || 0) - rDis) : (r.capacity || 0);
        r.seatStart = curSeqSeat;
        r.seatEnd = curSeqSeat + effectiveSeats - 1;
        curSeqSeat = r.seatEnd + 1;
      } else {
        r.seatStart = 0;
        r.seatEnd = 0;
      }
    });

    const activeRooms = (appState.rooms || []).filter(r => r.isActive !== false);
    const totalCapacity = activeRooms.reduce((s, r) => s + (r.capacity || 0), 0);
    const totalUsableCapacity = activeRooms.reduce((s, r) => s + Math.max(0, (r.capacity || 0) - ((r.disabledSeats || []).length)), 0);
    const totalDisabledSeats = activeRooms.reduce((s, r) => s + ((r.disabledSeats || []).length), 0);
    const totalProctorsNeeded = activeRooms.reduce((s, r) => s + ((r.capacity || 0) >= 70 ? 3 : 2), 0);
    const minSeat = activeRooms.length > 0 ? (activeRooms[0].seatStart || 1) : 1;
    const maxSeat = activeRooms.length > 0 ? (activeRooms[activeRooms.length - 1].seatEnd || totalCapacity) : totalCapacity;

    return `
      <!-- หัวข้อและปุ่มคำสั่งหลัก -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="card-body" style="padding: 16px 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 22px;">🪑</span>
                <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: var(--text-main);">
                  ห้องสอบและผังที่นั่ง (10 ห้องสอบมาตรฐาน)
                </h2>
              </div>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                ศูนย์สอบมหาวิทยาลัยราชภัฏบุรีรัมย์ อาคารนวัตปัญญา • รองรับการปรับเพิ่ม/ลดที่นั่งและเลื่อนลำดับเลขที่นั่งสอบอัตโนมัติ
              </div>
            </div>

            <!-- ปุ่มคำสั่ง 3 ปุ่ม -->
            <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-reset-standard-capacity" style="font-weight: 600; padding: 6px 14px; font-size: 12.5px; border-radius: 6px; cursor: pointer;">
                ↺ คืนค่าผังมาตรฐาน (520 ที่นั่ง)
              </button>
              <button type="button" class="btn btn-warning btn-sm" id="btn-open-capacity-modal" style="background-color: var(--brand-gold, #E5A823) !important; color: var(--brand-purple, #3B1F54) !important; font-weight: 700; border: 1px solid #D97706 !important; padding: 6px 14px; font-size: 12.5px; border-radius: 6px; cursor: pointer; box-shadow: 0 1px 3px rgba(217,119,6,0.25);">
                ⚙ ปรับความจุ / เลื่อนเลขที่นั่งสอบ
              </button>
              <button type="button" class="btn btn-primary btn-sm" id="btn-print-seat-slips" style="background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700; border: 1px solid var(--brand-purple, #3B1F54) !important; padding: 6px 14px; font-size: 12.5px; border-radius: 6px; cursor: pointer; box-shadow: 0 1px 3px rgba(59,31,84,0.25);">
                🖨️ พิมพ์บัตรประจำตัวที่นั่งสอบ
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 4 KPI Stat Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 20px;">
        <div class="card" style="border-left: 4px solid var(--primary-700);">
          <div class="card-body" style="padding: 14px 18px;">
            <div style="font-size: 12.5px; color: var(--text-muted); font-weight: 600;">จำนวนห้องสอบที่เปิดใช้</div>
            <div style="font-size: 26px; font-weight: 800; color: var(--text-main); margin-top: 3px;">
              ${activeRooms.length} / ${appState.rooms.length} <span style="font-size: 13.5px; font-weight: 500; color: var(--text-muted);">ห้อง</span>
            </div>
          </div>
        </div>

        <div class="card" style="border-left: 4px solid #16a34a; background: rgba(22, 163, 74, 0.02);">
          <div class="card-body" style="padding: 14px 18px;">
            <div style="font-size: 12.5px; color: #16a34a; font-weight: 600;">ความจุที่นั่งสอบรวม (พร้อมใช้)</div>
            <div style="font-size: 26px; font-weight: 800; color: #15803d; margin-top: 3px;">
              ${totalDisabledSeats > 0 ? `${totalUsableCapacity} <span style="font-size: 14px; font-weight: 600; color: #64748B;">/ ${totalCapacity} ที่</span>` : `${totalCapacity} <span style="font-size: 13.5px; font-weight: 500; color: var(--text-muted);">ที่นั่ง</span>`}
            </div>
            ${totalDisabledSeats > 0 ? `<div style="font-size: 11px; color: #DC2626; font-weight: 600; margin-top: 2px;">(ปิดที่นั่ง/ชำรุด ${totalDisabledSeats} ที่นั่ง)</div>` : ''}
          </div>
        </div>

        <div class="card" style="border-left: 4px solid #2563eb; background: rgba(37, 99, 235, 0.02);">
          <div class="card-body" style="padding: 14px 18px;">
            <div style="font-size: 12.5px; color: #2563eb; font-weight: 600;">ช่วงเลขที่นั่งสอบทั้งหมด</div>
            <div style="font-size: 26px; font-weight: 800; color: #1d4ed8; margin-top: 3px;">
              ${minSeat} - ${maxSeat}
            </div>
          </div>
        </div>

        <div class="card" style="border-left: 4px solid #d97706; background: rgba(217, 119, 6, 0.02);">
          <div class="card-body" style="padding: 14px 18px;">
            <div style="font-size: 12.5px; color: #d97706; font-weight: 600;">กรรมการคุมสอบที่ต้องใช้</div>
            <div style="font-size: 26px; font-weight: 800; color: #b45309; margin-top: 3px;">
              ${totalProctorsNeeded} <span style="font-size: 13.5px; font-weight: 500; color: var(--text-muted);">คน</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ผังการ์ดห้องสอบ จัดแบบ แถวละ 5 ห้อง (2 แถว x 5 คอลัมน์) ตามผังเดิมและสเปกจริง -->
      <div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; margin-bottom: 24px;" class="room-grid-5-col">
        ${sortedRooms.map((r, idx) => {
          const pCount = (r.capacity || 0) >= 70 ? 3 : 2;
          const isLarge = (r.capacity || 0) >= 70;
          const isActive = r.isActive !== false;
          
          let layoutDesc = 'บล็อกคอลัมน์มาตรฐาน';
          if (r.layoutType === 'trapezoid-rows' || (r.capacity || 0) >= 70) {
            layoutDesc = 'สโลปใหญ่ทรงพัด (6 แถว)';
          } else if (r.layoutType === 'staggered-rows') {
            layoutDesc = 'ผังสับหว่างแนวนอน (6 แถว)';
          } else if (r.layoutType === 'grid-rows') {
            layoutDesc = 'ผังแนวนอน (5 แถว)';
          } else if (r.blocks && r.blocks.length > 0) {
            layoutDesc = `${r.blocks.length} บล็อก (${r.blocks.map(b => b.name.replace(/\s*\(แถว.*?\)/, '')).join('-')})`;
          }

          const disabledCount = (r.disabledSeats || []).length;
          const accessibleCount = (r.accessibleSeats || []).length;
          const usableCap = Math.max(0, (r.capacity || 0) - disabledCount);

          return `
            <div class="card room-card-item btn-open-room-floorplan" data-action="open-room-floorplan" data-room-id="${r.id}" style="border: 1px solid var(--border-subtle); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; background: var(--bg-surface); transition: all 0.2s ease; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.04); ${!isActive ? 'opacity: 0.5; filter: grayscale(0.6);' : ''}">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 4px;">
                  <div style="display: flex; gap: 4px; align-items: center;">
                    <span class="badge" style="background: #F1F5F9; color: #475569; font-weight: 700; font-size: 11px; padding: 2px 7px;">ชั้น ${r.floor || 1}</span>
                    <span class="badge" style="${pCount === 3 ? 'background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D;' : 'background: #ECFDF5; color: #15803D; border: 1px solid #A7F3D0;'} font-size: 11px; font-weight: 700; padding: 2px 7px;">กรรมการ ${pCount} คน</span>
                  </div>
                  <div style="display: flex; gap: 4px; align-items: center;">
                    ${disabledCount > 0 ? `<span class="badge" style="background: #FEE2E2; color: #991B1B; font-weight: 700; font-size: 10.5px; padding: 2px 6px;">🚫 ปิด ${disabledCount} ที่</span>` : ''}
                    ${accessibleCount > 0 ? `<span class="badge" style="background: #DBEAFE; color: #1E40AF; font-weight: 700; font-size: 10.5px; padding: 2px 6px;">♿ พิการ ${accessibleCount} ที่</span>` : ''}
                  </div>
                </div>
                <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 4px; margin-bottom: 2px;">
                  <div style="font-size: 16px; font-weight: 800; color: var(--text-main);">
                    ห้อง ${r.roomCode || r.code || r.id}
                  </div>
                  <div style="font-size: 12px; font-weight: 700; color: var(--primary-700); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${r.officialName || ''}
                  </div>
                </div>
                <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
                  ห้องสอบที่ ${r.roomNumber || (idx + 1)} • โต๊ะลงทะเบียนที่ ${r.roomNumber || (idx + 1)}
                </div>
                <div style="border-top: 1px solid var(--border-subtle); padding-top: 8px; display: flex; flex-direction: column; gap: 6px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                    <span style="color: var(--text-muted); white-space: nowrap;">ความจุที่นั่ง:</span>
                    <strong style="color: var(--text-main); font-weight: 700; white-space: nowrap;">
                      ${disabledCount > 0 ? `<span style="color: #15803D;">${usableCap}</span> / ${r.capacity || 0} ที่` : `${r.capacity || 0} ที่นั่ง`}
                    </strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                    <span style="color: var(--text-muted); white-space: nowrap;">ช่วงเลขที่นั่ง:</span>
                    <strong style="color: var(--primary-700); font-weight: 700; white-space: nowrap;">${r.seatStart || 1} - ${r.seatEnd || r.capacity}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                    <span style="color: var(--text-muted); white-space: nowrap;">รูปแบบผัง:</span>
                    <span style="color: #475569; font-size: 11px; text-align: right; max-width: 62%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${layoutDesc}">${layoutDesc}</span>
                  </div>
                </div>
              </div>
              <button type="button" class="btn btn-secondary btn-sm btn-open-room-floorplan" data-action="open-room-floorplan" data-room-id="${r.id}" style="width: 100%; margin-top: 10px; justify-content: center; font-size: 12px; font-weight: 600; border-radius: 6px; padding: 6px 10px; background: #FFFFFF; border: 1px solid var(--border-subtle);">
                ⊞ ดูและปรับแต่งผังที่นั่ง
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // --- มุมมองที่ 2: ผังอาคาร 17 (เวกเตอร์ SVG คมชัด เอาเฉพาะผัง ไม่เอาตัวหนังสือหัวเรื่อง) ---
  renderRoomsBlueprintView() {
    this.blueprintFloor = this.blueprintFloor || 1;
    return `
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-body" style="padding: 16px 20px;">
          <!-- Floor Switcher inside Blueprint tab -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
            <div style="display: inline-flex; background: var(--bg-surface-elevated, #F1F5F9); padding: 4px; border-radius: 8px; border: 1px solid var(--border-subtle); gap: 6px;">
              <button type="button" class="btn btn-sm btn-select-blueprint-floor ${this.blueprintFloor === 1 ? 'btn-primary' : 'btn-secondary'}" data-floor="1" style="${this.blueprintFloor === 1 ? 'background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700;' : 'background-color: transparent !important; color: var(--text-main); font-weight: 600; border: none;'} padding: 6px 14px; font-size: 13px; border-radius: 6px; cursor: pointer;">
                🏢 ผังอาคาร 17 ชั้น 1 (ห้องสอบ 1 - 4)
              </button>
              <button type="button" class="btn btn-sm btn-select-blueprint-floor ${this.blueprintFloor === 2 ? 'btn-primary' : 'btn-secondary'}" data-floor="2" style="${this.blueprintFloor === 2 ? 'background-color: var(--brand-purple, #3B1F54) !important; color: #FFFFFF !important; font-weight: 700;' : 'background-color: transparent !important; color: var(--text-main); font-weight: 600; border: none;'} padding: 6px 14px; font-size: 13px; border-radius: 6px; cursor: pointer;">
                🏢 ผังอาคาร 17 ชั้น 2 (ห้องสอบ 5 - 10)
              </button>
            </div>
            <div style="font-size: 12.5px; color: var(--text-muted); display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
              <span style="display: inline-flex; align-items: center; gap: 6px;">
                <span style="display: inline-block; width: 14px; height: 14px; background: #EDE9FE; border: 1.5px solid #7C3AED; border-radius: 3px;"></span>
                <span style="color: var(--brand-purple, #3B1F54); font-weight: 600;">ห้องสอบ CBT (คลิกดูผังที่นั่ง)</span>
              </span>
              <span style="display: inline-flex; align-items: center; gap: 6px;">
                <span style="display: inline-block; width: 14px; height: 14px; background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 3px;"></span>
                <span>ห้องทั่วไป (คลิกดูชื่อห้อง)</span>
              </span>
            </div>
          </div>

          <!-- Native SVG Blueprint render (เอาแค่ผัง ไม่เอาตัวหนังสือหัวเรื่อง) -->
          ${this.blueprintFloor === 2 ? this.renderFloor2Blueprint() : this.renderFloor1Blueprint()}
        </div>
      </div>
    `;
  }

  // --- มุมมองที่ 3: ตารางข้อมูลห้องสอบ (เครื่องมือเพิ่ม/นำเข้า/ส่งออก และตาราง) ---
  renderRoomsTableView() {
    return `
      <!-- แถบเครื่องมือจัดการห้องสอบ -->
      <div class="master-header-controls">
        <div class="master-subtabs-row">
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">🏢</span>
              <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main);">จัดการข้อมูลห้องสอบ (${appState.rooms.length} ห้อง)</h3>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                  ศูนย์สอบ CBT อาคาร 17 • ความจุรวม ${appState.rooms.reduce((s, r) => s + (r.capacity || 0), 0)} ที่นั่ง • 💡 <span style="color: var(--primary-700); font-weight: 600;">ดับเบิ้ลคลิกที่แถวห้องสอบเพื่อดูรายละเอียดได้ทันที</span>
                </div>
              </div>
            </div>
          </div>
          <div class="master-action-buttons">
            <button class="btn btn-primary btn-sm" id="btn-add-master-item" style="font-weight: 700; box-shadow: 0 2px 8px rgba(124,58,237,0.25);">
              ➕ เพิ่มห้องสอบ
            </button>
            <div class="custom-dropdown" id="dropdown-master-csv">
              <button class="btn btn-secondary btn-sm custom-dropdown-trigger" type="button" aria-haspopup="true" aria-expanded="false" title="จัดการไฟล์ CSV">
                <span>📁 นำเข้า/ส่งออก CSV</span>
                <span style="font-size: 10px; margin-left: 2px;">▾</span>
              </button>
              <div class="custom-dropdown-menu custom-dropdown-menu-right" role="menu">
                <button class="custom-dropdown-item" id="btn-download-template" type="button" role="menuitem">
                  <span class="dropdown-item-icon">📥</span>
                  <div>
                    <div class="dropdown-item-title">ดาวน์โหลดแม่แบบ CSV</div>
                    <div class="dropdown-item-desc">ไฟล์ตัวอย่างพร้อมคอลัมน์มาตรฐาน</div>
                  </div>
                </button>
                <label class="custom-dropdown-item" style="cursor: pointer; margin: 0;" role="menuitem">
                  <span class="dropdown-item-icon">📤</span>
                  <div>
                    <div class="dropdown-item-title">นำเข้าไฟล์ CSV</div>
                    <div class="dropdown-item-desc">อัปโหลดไฟล์ข้อมูลเข้าระบบ</div>
                  </div>
                  <input type="file" id="file-import-csv" accept=".csv" style="display: none;">
                </label>
                <div class="custom-dropdown-divider"></div>
                <button class="custom-dropdown-item" id="btn-export-current-csv" type="button" role="menuitem">
                  <span class="dropdown-item-icon">💾</span>
                  <div>
                    <div class="dropdown-item-title">ส่งออกข้อมูลเป็น CSV</div>
                    <div class="dropdown-item-desc">ดาวน์โหลดข้อมูลทั้งหมดในแท็บนี้</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- เครื่องมือทดสอบระบบ & Presets (แบบพับเก็บได้ ปิดไว้เป็นค่าเริ่มต้น) -->
        <div class="test-tools-collapsible ${this.isTestToolsOpen ? 'is-open' : ''}" id="test-tools-accordion">
          <button class="test-tools-header" type="button" id="btn-toggle-test-tools" aria-expanded="${this.isTestToolsOpen ? 'true' : 'false'}">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge badge-warning" style="font-size: 10px; padding: 2px 6px;">ทดสอบระบบ</span>
              <span style="font-size: 13px; font-weight: 600; color: var(--text-main);">🧪 เครื่องมือทดสอบระบบ & ชุดข้อมูลจำลอง</span>
            </div>
            <span class="accordion-arrow" style="font-size: 12px; color: var(--text-muted); font-weight: 600;">
              ${this.isTestToolsOpen ? '▲ ซ่อน' : '▼ เปิดดู'}
            </span>
          </button>
          <div class="test-tools-body" style="${this.isTestToolsOpen ? 'display: block;' : 'display: none;'}">
            <div style="display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 12px; padding: 10px 14px; background: rgba(245, 158, 11, 0.05); border: 1px dashed rgba(245, 158, 11, 0.35); border-radius: var(--radius-md);">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 12px; font-weight: 600; color: #92400e;">ชุดข้อมูลจำลอง:</span>
                <div class="master-presets-pills">
                  ${Object.entries(SEED_PRESETS).map(([key, p]) => `
                    <button class="btn btn-secondary btn-sm" data-action="load-preset" data-preset="${key}" style="background: var(--bg-surface); font-size: 11.5px; padding: 4px 8px;">
                      ${p.label}
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ตารางข้อมูลห้องสอบ -->
      <div class="card">
        <div class="card-body" style="padding: 0;">
          <div class="table-wrapper" style="border: none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="white-space: nowrap;">รหัสห้อง</th>
                  <th>ชื่อห้องสอบ / ชื่อทางการ</th>
                  <th style="white-space: nowrap;">ชั้น</th>
                  <th style="white-space: nowrap;">ความจุ</th>
                  <th style="white-space: nowrap;">เลขที่นั่งสอบ</th>
                  <th style="white-space: nowrap;">ประเภทห้อง</th>
                  <th style="white-space: nowrap;">คนพิการ</th>
                  <th style="white-space: nowrap;">สถานะ</th>
                  <th style="text-align: center; width: 185px; white-space: nowrap;">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${appState.rooms.map(r => `
                  <tr class="room-table-row" data-id="${r.id}" style="cursor: pointer;" title="ดับเบิ้ลคลิกเพื่อเปิดดูรายละเอียดและผังที่นั่งห้องนี้">
                    <td style="white-space: nowrap;">
                      <button class="btn btn-link btn-sm" data-action="view-room-detail" data-id="${r.id}" style="font-weight: 800; padding: 0; text-decoration: underline;" title="คลิกเพื่อดูรายละเอียดห้องสอบ">
                        ${r.roomCode || r.id}
                      </button>
                    </td>
                    <td>
                      <div style="cursor: pointer;" data-action="view-room-detail" data-id="${r.id}">
                        <strong>${r.name}</strong>
                        ${r.officialName && !r.name.includes(r.officialName) ? `<div style="font-size: 11px; color: var(--text-muted);">${r.officialName}</div>` : ''}
                      </div>
                    </td>
                    <td style="white-space: nowrap;">ชั้น ${r.floor || 1}</td>
                    <td style="white-space: nowrap;">
                      <strong>${(r.disabledSeats || []).length > 0 ? `<span style="color: #15803D;">${(r.capacity || 0) - r.disabledSeats.length}</span> / ${r.capacity}` : `${r.capacity}`}</strong> ที่นั่ง
                      ${(r.disabledSeats || []).length > 0 ? `<div style="font-size: 10.5px; color: #DC2626; font-weight: 700;">(🚫 ปิด ${r.disabledSeats.length} ที่)</div>` : ''}
                    </td>
                    <td style="white-space: nowrap;"><span class="badge badge-normal" style="font-weight: 700; color: var(--primary-700);">${r.seatStart && r.seatEnd ? `${r.seatStart} - ${r.seatEnd}` : `${r.capacity} ที่`}</span></td>
                    <td style="white-space: nowrap;"><span class="badge ${r.roomType === 'computer' ? 'badge-primary' : 'badge-normal'}">${r.roomType === 'computer' ? '💻 CBT' : '📝 บรรยาย'}</span></td>
                    <td style="white-space: nowrap;">
                      <span class="badge ${r.accessibleForDisabled ? 'badge-success' : 'badge-normal'}">${r.accessibleForDisabled ? '♿ รองรับ' : '❌ ไม่รองรับ'}</span>
                      ${(r.accessibleSeats || []).length > 0 ? `<div style="font-size: 10.5px; color: #1E40AF; font-weight: 700; margin-top: 2px;">(♿ ${r.accessibleSeats.length} ที่)</div>` : ''}
                    </td>
                    <td style="white-space: nowrap;"><span class="badge ${r.isActive !== false ? 'badge-success' : 'badge-danger'}">${r.isActive !== false ? 'เปิดสอบ' : 'ปิด'}</span></td>
                    <td style="text-align: center; white-space: nowrap;">
                      <div style="display: inline-flex; gap: 4px; align-items: center; justify-content: center;">
                        <button class="btn btn-secondary btn-sm" data-action="view-room-detail" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px; font-weight: 600;" title="ดูข้อมูลผังและสเปกห้อง">🔍 รายละเอียด</button>
                        <button class="btn btn-secondary btn-sm" data-action="print-room-sign" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px;" title="พิมพ์ป้ายติดหน้าห้องสอบ">📄 ป้ายห้อง</button>
                        <button class="btn btn-secondary btn-sm" data-action="edit-master" data-type="rooms" data-id="${r.id}" style="padding: 3px 7px; font-size: 12px;" title="แก้ไขข้อมูลห้อง">✏️</button>
                        <button class="btn btn-danger btn-sm" data-action="delete-master" data-type="rooms" data-id="${r.id}" style="padding: 3px 7px; font-size: 12px;" title="ลบห้องสอบ">🗑️</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // --- 7.2 หน้าข้อมูลหลัก (Master Data: ข้อมูลผู้คุมสอบ, รอบการสอบ & ช่วงเวลาไม่ว่าง) ---
  renderMasterDataTab() {
    if (this.masterDataSubTab === 'unavail') {
      this.masterDataSubTab = 'proctors';
      this.proctorFilterType = 'unavail';
    } else if (this.masterDataSubTab !== 'sessions' && this.masterDataSubTab !== 'proctors' && this.masterDataSubTab !== 'examinees') {
      this.masterDataSubTab = 'sessions';
    }

    const examineesCount = (appState.examinees || []).length;
    const subtabsPillsHtml = `
      <div class="master-subtabs-pills" style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
        <button class="btn btn-sm ${this.masterDataSubTab === 'sessions' ? 'btn-primary' : 'btn-secondary'}" data-master-tab="sessions">
          📅 รอบการสอบ (${appState.sessions.length})
        </button>
        <button class="btn btn-sm ${this.masterDataSubTab === 'proctors' ? 'btn-primary' : 'btn-secondary'}" data-master-tab="proctors">
          👤 ข้อมูลผู้คุมสอบ (${appState.proctors.length})
        </button>
        <button class="btn btn-sm ${this.masterDataSubTab === 'examinees' ? 'btn-primary' : 'btn-secondary'}" data-master-tab="examinees">
          🎓 ข้อมูลผู้เข้าสอบ (${examineesCount})
        </button>
        <span style="font-size: 12px; color: var(--text-muted); margin-left: 6px; display: inline-flex; align-items: center; gap: 8px;">
          <span>| เมนูอื่น:</span>
          <a href="#" class="btn-link" data-goto-proctors="true" style="color: var(--primary-700); text-decoration: underline; font-weight: 600;">👥 จัดการกลุ่ม/โควต้าผู้คุมสอบ</a>
          <span>•</span>
          <a href="#" class="btn-link" data-goto-rooms="true" style="color: var(--primary-700); text-decoration: underline; font-weight: 600;">🏢 เมนูห้องสอบ (${appState.rooms.length})</a>
        </span>
      </div>
    `;

    if (this.masterDataSubTab === 'examinees') {
      return `
        <!-- แถบสลับตารางย่อย -->
        <div class="master-header-controls" style="margin-bottom: 12px;">
          <div class="master-subtabs-row">
            ${subtabsPillsHtml}
          </div>
        </div>
        <div class="card" style="box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
          <div class="card-body" style="padding: 0;">
            ${renderExamineesSubTab(appState, this)}
          </div>
        </div>
      `;
    }

    return `
      <!-- แถบสลับตารางย่อย และเครื่องมือ -->
      <div class="master-header-controls">
        <div class="master-subtabs-row">
          ${subtabsPillsHtml}
          <div class="master-action-buttons">
            <button class="btn btn-primary btn-sm" id="btn-add-master-item" style="font-weight: 700; box-shadow: 0 2px 8px rgba(124,58,237,0.25);">
              ➕ เพิ่ม${this.getMasterSubTabLabel()}
            </button>
            <div class="custom-dropdown" id="dropdown-master-csv">
              <button class="btn btn-secondary btn-sm custom-dropdown-trigger" type="button" aria-haspopup="true" aria-expanded="false" title="จัดการไฟล์ CSV">
                <span>📁 นำเข้า/ส่งออก CSV</span>
                <span style="font-size: 10px; margin-left: 2px;">▾</span>
              </button>
              <div class="custom-dropdown-menu custom-dropdown-menu-right" role="menu">
                <button class="custom-dropdown-item" id="btn-download-template" type="button" role="menuitem">
                  <span class="dropdown-item-icon">📥</span>
                  <div>
                    <div class="dropdown-item-title">ดาวน์โหลดแม่แบบ CSV</div>
                    <div class="dropdown-item-desc">ไฟล์ตัวอย่างพร้อมคอลัมน์มาตรฐาน</div>
                  </div>
                </button>
                <label class="custom-dropdown-item" style="cursor: pointer; margin: 0;" role="menuitem">
                  <span class="dropdown-item-icon">📤</span>
                  <div>
                    <div class="dropdown-item-title">นำเข้าไฟล์ CSV</div>
                    <div class="dropdown-item-desc">อัปโหลดไฟล์ข้อมูลเข้าระบบ</div>
                  </div>
                  <input type="file" id="file-import-csv" accept=".csv" style="display: none;">
                </label>
                <div class="custom-dropdown-divider"></div>
                <button class="custom-dropdown-item" id="btn-export-current-csv" type="button" role="menuitem">
                  <span class="dropdown-item-icon">💾</span>
                  <div>
                    <div class="dropdown-item-title">ส่งออกข้อมูลเป็น CSV</div>
                    <div class="dropdown-item-desc">ดาวน์โหลดข้อมูลทั้งหมดในแท็บนี้</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- เครื่องมือทดสอบระบบ & Presets (แบบพับเก็บได้ ปิดไว้เป็นค่าเริ่มต้น) -->
        <div class="test-tools-collapsible ${this.isTestToolsOpen ? 'is-open' : ''}" id="test-tools-accordion">
          <button class="test-tools-header" type="button" id="btn-toggle-test-tools" aria-expanded="${this.isTestToolsOpen ? 'true' : 'false'}">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge badge-warning" style="font-size: 10px; padding: 2px 6px;">ทดสอบระบบ</span>
              <span style="font-size: 13px; font-weight: 600; color: var(--text-main);">🧪 เครื่องมือทดสอบระบบ & ชุดข้อมูลจำลอง</span>
            </div>
            <span class="accordion-arrow" style="font-size: 12px; color: var(--text-muted); font-weight: 600;">
              ${this.isTestToolsOpen ? '▲ ซ่อน' : '▼ เปิดดู'}
            </span>
          </button>
          <div class="test-tools-body" style="${this.isTestToolsOpen ? 'display: block;' : 'display: none;'}">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 10px 14px; background: rgba(245, 158, 11, 0.05); border: 1px dashed rgba(245, 158, 11, 0.35); border-radius: var(--radius-md);">
              ${this.masterDataSubTab === 'proctors' ? `
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span style="font-size: 12px; font-weight: 600; color: #92400e;">สุ่มเพิ่มบุคลากร:</span>
                  <button class="btn btn-secondary btn-sm" id="btn-add-random-20-master" title="สุ่มเพิ่มอาจารย์และบุคลากรอีก 20 ท่าน" style="background: var(--bg-surface); font-size: 12px;">
                    ➕ สุ่มเพิ่ม 20 คน
                  </button>
                </div>
              ` : '<div></div>'}
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 12px; font-weight: 600; color: #92400e;">ชุดข้อมูลจำลอง:</span>
                <div class="master-presets-pills">
                  ${Object.entries(SEED_PRESETS).map(([key, p]) => `
                    <button class="btn btn-secondary btn-sm" data-action="load-preset" data-preset="${key}" style="background: var(--bg-surface); font-size: 11.5px; padding: 4px 8px;">
                      ${p.label}
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ตารางข้อมูล -->
      <div class="card">
        <div class="card-body" style="padding: 0;">
          <div class="table-wrapper" style="border: none;">
            ${this.renderMasterDataTable()}
          </div>
        </div>
      </div>
    `;
  }

  getMasterSubTabLabel() {
    if (this.masterDataSubTab === 'examinees') return 'ข้อมูลผู้เข้าสอบ';
    if (this.masterDataSubTab === 'proctors') {
      return this.proctorFilterType === 'unavail' ? 'ช่วงเวลาไม่ว่าง' : 'ผู้คุมสอบ';
    }
    switch (this.masterDataSubTab) {
      case 'rooms': return 'ห้องสอบ';
      case 'sessions': return 'รอบการสอบ';
      case 'unavail': return 'ช่วงเวลาไม่ว่าง';
      default: return 'ข้อมูล';
    }
  }

  renderMasterDataTable() {
    if (this.masterDataSubTab === 'examinees') return renderExamineesSubTab(appState, this);
    if (this.masterDataSubTab === 'proctors') {
      const query = (this.proctorSearchQuery || '').toLowerCase().trim();
      const levelFilter = this.proctorFilterLevel || 'all';
      const quotaFilter = this.proctorFilterQuota || 'all';
      const typeFilter = this.proctorFilterType || 'all';

      const totalCount = appState.proctors.length;
      const facultyCount = appState.proctors.filter(p => p.proctorType === 'faculty').length;
      const staffCount = appState.proctors.filter(p => p.proctorType === 'staff').length;
      const unavailCount = (appState.unavailabilities || []).length;

      const proctorTypeChipsHtml = `
        <!-- แถบกรองประเภทผู้คุมสอบ (Segmented Control / Chips) -->
        <div class="proctor-type-segmented-bar">
          <div class="proctor-type-chips">
            <button class="proctor-type-chip ${typeFilter === 'all' ? 'active' : ''}" data-proctor-type="all" type="button">
              <span>ทั้งหมด</span>
              <span class="chip-count">${totalCount}</span>
            </button>
            <button class="proctor-type-chip ${typeFilter === 'faculty' ? 'active' : ''}" data-proctor-type="faculty" type="button">
              <span>👨‍🏫 อาจารย์</span>
              <span class="chip-count">${facultyCount}</span>
            </button>
            <button class="proctor-type-chip ${typeFilter === 'staff' ? 'active' : ''}" data-proctor-type="staff" type="button">
              <span>👤 เจ้าหน้าที่</span>
              <span class="chip-count">${staffCount}</span>
            </button>
            <button class="proctor-type-chip ${typeFilter === 'unavail' ? 'active' : ''}" data-proctor-type="unavail" type="button" title="ดูรายการช่วงเวลาที่ผู้คุมสอบแจ้งไม่ว่าง">
              <span>⛔ ช่วงเวลาไม่ว่าง</span>
              <span class="chip-count" style="${unavailCount > 0 ? 'background: rgba(220, 38, 38, 0.12); color: #DC2626; font-weight: 700;' : ''}">${unavailCount}</span>
            </button>
          </div>
        </div>
      `;

      if (typeFilter === 'unavail') {
        const proctorMap = new Map(appState.proctors.map(p => [p.id, p]));
        const filteredUnavails = (appState.unavailabilities || []).filter(u => {
          if (!query) return true;
          const p = proctorMap.get(u.proctorId);
          const fullName = p ? `${p.academicTitle ? `${p.academicTitle} ` : ''}${p.firstName} ${p.lastName}`.toLowerCase() : '';
          return u.proctorId.toLowerCase().includes(query) ||
                 fullName.includes(query) ||
                 (u.reason && u.reason.toLowerCase().includes(query));
        });

        return `
          ${proctorTypeChipsHtml}

          <!-- แถบค้นหาช่วงเวลาไม่ว่าง -->
          <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between; padding: 12px 18px; background: var(--bg-surface-elevated); border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap;">
            <div style="display: flex; gap: 10px; align-items: center; flex: 1; min-width: 260px; flex-wrap: wrap;">
              <input type="text" id="input-search-proctor" class="form-input" style="max-width: 320px; font-size: 13px;" placeholder="🔍 ค้นหารหัส, ชื่อผู้คุม, หรือเหตุผล..." value="${this.proctorSearchQuery || ''}">
              ${query ? `
                <button class="btn btn-secondary btn-sm" id="btn-clear-proctor-filter" style="font-size: 12px;">
                  ✕ ล้างคำค้นหา
                </button>
              ` : ''}
            </div>
            <div style="font-size: 13px; color: var(--text-muted); font-weight: 500;">
              แสดง <strong>${filteredUnavails.length}</strong> จาก ${unavailCount} รายการ
            </div>
          </div>

          ${filteredUnavails.length === 0 ? `
            <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
              <div style="font-size: 32px; margin-bottom: 8px;">⛔</div>
              <div style="font-size: 15px; font-weight: 600;">${query ? 'ไม่พบข้อมูลช่วงเวลาไม่ว่างที่ตรงกับคำค้นหา' : 'ยังไม่มีผู้คุมสอบแจ้งช่วงเวลาไม่ว่าง'}</div>
              <div style="font-size: 13px; margin-top: 4px; margin-bottom: 14px;">
                ${query ? 'ลองเปลี่ยนคำค้นหาหรือล้างคำค้นหา' : 'สามารถกดปุ่ม "➕ เพิ่มช่วงเวลาไม่ว่าง" ด้านบน เพื่อระบุวันที่และเวลาที่ผู้คุมติดภารกิจ'}
              </div>
              ${query ? `
                <button class="btn btn-secondary btn-sm" id="btn-clear-proctor-filter-empty" style="font-size: 12px;">
                  ✕ ล้างคำค้นหา
                </button>
              ` : ''}
            </div>
          ` : `
            <!-- Desktop Table View -->
            <table class="data-table proctor-master-table desktop-only">
              <thead>
                <tr>
                  <th style="width: 80px;">รหัสผู้คุม</th>
                  <th style="min-width: 180px;">ผู้คุมสอบ (ชื่อ-นามสกุล / สังกัด)</th>
                  <th style="min-width: 180px;">ช่วงเวลาที่แจ้งไม่ว่าง</th>
                  <th style="min-width: 150px;">เหตุผล / ภารกิจ</th>
                  <th style="text-align: center; width: 110px;">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${filteredUnavails.map(u => {
                  const p = proctorMap.get(u.proctorId);
                  return `
                    <tr>
                      <td><span class="badge badge-normal" style="font-weight: 700; font-size: 11px;">${u.proctorId}</span></td>
                      <td>
                        <div style="display: flex; flex-direction: column; gap: 2px;">
                          <strong style="font-size: 13px; color: var(--text-main);">${p ? `${p.academicTitle ? `${p.academicTitle} ` : ''}${p.firstName} ${p.lastName}` : u.proctorId}</strong>
                          <div style="font-size: 11px; color: var(--text-muted);">${p ? (p.department || '-') : '-'}</div>
                        </div>
                      </td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <span style="font-size: 14px;">📅</span>
                          <div>
                            <div style="font-weight: 600; font-size: 12.5px; color: var(--text-main);">${formatThaiDate(u.startTime)}</div>
                            <div style="font-size: 11px; color: #DC2626; font-weight: 600;">เวลา ${formatThaiTimeRange(u.startTime, u.endTime)}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style="font-size: 12px; color: var(--text-main); line-height: 1.4;">${u.reason || '-'}</div>
                      </td>
                      <td style="text-align: center; white-space: nowrap;">
                        <div style="display: flex; gap: 4px; justify-content: center;">
                          <button class="btn btn-secondary btn-sm" data-action="edit-master" data-type="unavail" data-id="${u.id}" style="padding: 3px 8px; font-size: 12px;" title="แก้ไขช่วงเวลาไม่ว่างนี้">✏️ แก้ไข</button>
                          <button class="btn btn-ghost-danger btn-sm" data-action="delete-master" data-type="unavail" data-id="${u.id}" style="padding: 3px 6px; font-size: 12px;" title="ลบช่วงเวลานี้">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <!-- Mobile Cards View for Unavailabilities -->
            <div class="mobile-proctor-cards mobile-only" style="padding: 10px; display: flex; flex-direction: column; gap: 10px;">
              ${filteredUnavails.map(u => {
                const p = proctorMap.get(u.proctorId);
                return `
                  <div class="m-card-proctor" style="border-left: 3px solid #DC2626;">
                    <div class="m-card-proctor-header">
                      <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                        <span class="badge badge-normal" style="font-weight: 700; font-size: 11px;">${u.proctorId}</span>
                        <strong style="font-size: 13.5px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                          ${p ? `${p.academicTitle ? `${p.academicTitle} ` : ''}${p.firstName} ${p.lastName}` : u.proctorId}
                        </strong>
                      </div>
                    </div>
                    <div class="m-card-proctor-body">
                      <div class="m-card-row">
                        <span class="m-card-label">📅 วันที่ & เวลา:</span>
                        <div style="text-align: right; font-size: 12px; color: #DC2626; font-weight: 600;">
                          ${formatThaiDate(u.startTime)} (${formatThaiTimeRange(u.startTime, u.endTime)})
                        </div>
                      </div>
                      <div class="m-card-row">
                        <span class="m-card-label">📝 เหตุผล:</span>
                        <span style="font-size: 12px; color: var(--text-main); text-align: right;">${u.reason || '-'}</span>
                      </div>
                    </div>
                    <div class="m-card-proctor-actions">
                      <button class="btn btn-secondary btn-sm" data-action="edit-master" data-type="unavail" data-id="${u.id}" style="flex: 1; justify-content: center; font-size: 12px; padding: 6px 12px;">✏️ แก้ไข</button>
                      <button class="btn btn-danger btn-sm" data-action="delete-master" data-type="unavail" data-id="${u.id}" style="padding: 6px 12px; font-size: 12px;" title="ลบรายการนี้">🗑️</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        `;
      }

      const filteredProctors = appState.proctors.filter(p => {
        if (typeFilter !== 'all' && p.proctorType !== typeFilter) return false;
        if (levelFilter !== 'all' && p.level !== levelFilter) return false;
        if (quotaFilter !== 'all' && String(p.projectQuota) !== String(quotaFilter)) return false;
        if (!query) return true;
        const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
        return p.id.toLowerCase().includes(query) ||
               fullName.includes(query) ||
               (p.department && p.department.toLowerCase().includes(query));
      });

      return `
        ${proctorTypeChipsHtml}

        <!-- แถบค้นหาและกรองผู้คุมสอบ (Search & Filter Bar) -->
        <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between; padding: 12px 18px; background: var(--bg-surface-elevated); border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap;">
          <div style="display: flex; gap: 10px; align-items: center; flex: 1; min-width: 260px; flex-wrap: wrap;">
            <input type="text" id="input-search-proctor" class="form-input" style="max-width: 280px; font-size: 13px;" placeholder="🔍 ค้นหาชื่อ, รหัส (เช่น P001), หรือคณะ..." value="${this.proctorSearchQuery || ''}">
            <select id="select-filter-level" class="form-input" style="width: auto; font-size: 13px;">
              <option value="all" ${levelFilter === 'all' ? 'selected' : ''}>ระดับทั้งหมด</option>
              <option value="chief" ${levelFilter === 'chief' ? 'selected' : ''}>เฉพาะหัวหน้าห้อง (Chief)</option>
              <option value="assistant" ${levelFilter === 'assistant' ? 'selected' : ''}>เฉพาะผู้ช่วย (Assistant)</option>
            </select>
            <select id="select-filter-quota" class="form-input" style="width: auto; font-size: 13px;">
              <option value="all" ${quotaFilter === 'all' ? 'selected' : ''}>โควต้าทั้งหมด (1 - 6 รอบ)</option>
              <option value="1" ${quotaFilter === '1' ? 'selected' : ''}>โควต้า 1 รอบ</option>
              <option value="2" ${quotaFilter === '2' ? 'selected' : ''}>โควต้า 2 รอบ</option>
              <option value="3" ${quotaFilter === '3' ? 'selected' : ''}>โควต้า 3 รอบ</option>
              <option value="4" ${quotaFilter === '4' ? 'selected' : ''}>โควต้า 4 รอบ</option>
              <option value="5" ${quotaFilter === '5' ? 'selected' : ''}>โควต้า 5 รอบ</option>
              <option value="6" ${quotaFilter === '6' ? 'selected' : ''}>โควต้า 6 รอบ</option>
            </select>
            <label class="pdpa-toggle-switch" title="คลิกเพื่อสลับการซ่อน/แสดงอีเมลตามหลัก PDPA">
              <input type="checkbox" id="btn-toggle-pdpa" ${this.maskPDPA ? 'checked' : ''}>
              <span class="pdpa-slider"></span>
              <span class="pdpa-label">${this.maskPDPA ? '🔒 ซ่อน PDPA' : '👁️ แสดงข้อมูล'}</span>
            </label>
            ${(query || levelFilter !== 'all' || quotaFilter !== 'all' || typeFilter !== 'all') ? `
              <button class="btn btn-secondary btn-sm" id="btn-clear-proctor-filter" style="font-size: 12px;">
                ✕ ล้างตัวกรอง
              </button>
            ` : ''}
          </div>
          <div style="font-size: 13px; color: var(--text-muted); font-weight: 500;">
            แสดง <strong>${filteredProctors.length}</strong> จาก ${totalCount} คน
          </div>
        </div>

        ${filteredProctors.length === 0 ? `
          <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
            <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
            <div style="font-size: 15px; font-weight: 600;">ไม่พบรายชื่อผู้คุมสอบที่ตรงกับเงื่อนไข</div>
            <div style="font-size: 13px; margin-top: 4px; margin-bottom: 14px;">
              ${typeFilter !== 'all' ? `ไม่พบผู้คุมสอบประเภท "${typeFilter === 'faculty' ? 'อาจารย์' : 'เจ้าหน้าที่'}" ที่ตรงกับเงื่อนไข` : 'ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง'}
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-clear-proctor-filter-empty" style="font-size: 12px;">
              ✕ ล้างตัวกรองทั้งหมด
            </button>
          </div>
        ` : `
          <!-- Desktop Table View -->
          <table class="data-table proctor-master-table desktop-only">
            <thead>
              <tr>
                <th style="width: 50px;">รหัส</th>
                <th style="min-width: 170px;">ผู้คุมสอบ (ชื่อ-นามสกุล / สิทธิ์)</th>
                <th style="min-width: 130px; max-width: 160px;">สังกัด / คณะ</th>
                <th style="min-width: 110px;">วันที่สะดวก</th>
                <th style="min-width: 155px;">โควต้า & รูปแบบงาน</th>
                <th style="text-align: center; width: 90px;">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${filteredProctors.map(p => {
                const datesDisplay = (!p.availableDates || p.availableDates.length === 0 || p.availableDates.length === 3)
                  ? `<span class="badge" style="background:#e0e7ff; color:#3730a3; font-size:11px; padding: 2px 7px;">ทุกวัน (27-29 มี.ค.)</span>`
                  : p.availableDates.map(d => `<span class="badge badge-normal" style="font-size:10px; margin-right:3px; padding: 2px 6px;">${formatThaiDate(d)}</span>`).join('');

                const patternBadge = p.sessionPattern === 'SINGLE_PER_DAY'
                  ? `<span class="badge badge-warning" style="font-size: 9.5px; padding: 1px 6px;">วันละ 1 รอบ</span>`
                  : (p.sessionPattern === 'FULL_DAY_PAIRED'
                      ? `<span class="badge badge-normal" style="font-size: 9.5px; padding: 1px 6px;">เช้า+บ่าย</span>`
                      : `<span class="badge" style="background:#f1f5f9; color:#475569; font-size: 9.5px; padding: 1px 6px;">ยืดหยุ่น</span>`);

                return `
                  <tr>
                    <td><span class="badge badge-normal" style="font-weight: 700; font-size: 11px;">${p.id}</span></td>
                    <td>
                      <div style="display: flex; flex-direction: column; gap: 2px;">
                        <div>
                          <strong style="font-size: 13px; color: var(--text-main);">${p.academicTitle ? `${p.academicTitle} ` : ''}${p.firstName} ${p.lastName}</strong>
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                          <span class="badge ${p.proctorType === 'faculty' ? 'badge-faculty' : 'badge-staff'}" style="font-size: 10px; padding: 2px 7px;">
                            ${p.proctorType === 'faculty' ? 'อาจารย์' : 'เจ้าหน้าที่'}
                          </span>
                          ${p.level === 'chief' ? `<span class="badge badge-locked" style="font-size: 9.5px; padding: 1px 6px;">หัวหน้าห้อง (Chief)</span>` : `<span class="badge" style="background:#f1f5f9; color:#64748b; font-size: 9.5px; padding: 1px 6px;">ผู้ช่วย</span>`}
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted);">${this.maskPDPA ? '•••••••@••••••' : p.email}</div>
                      </div>
                    </td>
                    <td>
                      <div style="max-width: 160px; font-size: 12px; line-height: 1.35; color: var(--text-main); word-break: break-word;">
                        ${p.department}
                      </div>
                    </td>
                    <td>
                      <div>${datesDisplay}</div>
                    </td>
                    <td>
                      <!-- ปรับโควต้า 1 ถึง 6 รอบผ่าน Dropdown selector สไตล์เดียวกับตัวเลือกระดับ -->
                      <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">โควต้า:</span>
                          <select class="form-input form-select-quota" data-action="change-proctor-quota" data-proctor-id="${p.id}" style="padding: 3px 8px; font-size: 12px; height: 28px; width: auto; font-weight: 600; cursor: pointer; border-radius: 6px; background: var(--bg-surface-elevated); color: var(--text-main); border: 1px solid var(--border-subtle);">
                            ${[1, 2, 3, 4, 5, 6].map(q => `
                              <option value="${q}" ${p.projectQuota === q ? 'selected' : ''}>
                                ${q} รอบ ${q === 6 ? '(สูงสุด)' : ''}
                              </option>
                            `).join('')}
                            ${(p.projectQuota !== undefined && p.projectQuota !== null && (p.projectQuota < 1 || p.projectQuota > 6)) ? `
                              <option value="${p.projectQuota}" selected>${p.projectQuota} รอบ</option>
                            ` : ''}
                          </select>
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 5px;">
                          <span>วันละ ${p.dailyQuota} รอบ</span>
                          <span>•</span>
                          ${patternBadge}
                        </div>
                      </div>
                    </td>
                    <td style="text-align: center; white-space: nowrap;">
                      <div style="display: flex; gap: 4px; justify-content: center;">
                        <button class="btn btn-secondary btn-sm" data-action="edit-master" data-type="proctors" data-id="${p.id}" style="padding: 3px 8px; font-size: 12px;" title="แก้ไขข้อมูลผู้คุมท่านนี้">✏️ แก้ไข</button>
                        <button class="btn btn-ghost-danger btn-sm" data-action="delete-master" data-type="proctors" data-id="${p.id}" style="padding: 3px 6px; font-size: 12px;" title="ลบผู้คุมท่านนี้">🗑️</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <!-- Mobile Cards: การ์ดรายชื่อผู้คุมสอบบนจอมือถือ สะอาดตา ไม่ล้นจอ -->
          <div class="mobile-proctor-cards mobile-only" style="padding: 10px; display: flex; flex-direction: column; gap: 10px;">
            ${filteredProctors.map(p => {
              const datesDisplay = (!p.availableDates || p.availableDates.length === 0 || p.availableDates.length === 3)
                ? `<span class="badge" style="background:#e0e7ff; color:#3730a3; font-size:10.5px; padding: 2px 7px;">ทุกวัน (27-29 มี.ค.)</span>`
                : p.availableDates.map(d => `<span class="badge badge-normal" style="font-size:10px; margin-right:3px; padding: 2px 6px;">${formatThaiDate(d)}</span>`).join('');

              const patternBadge = p.sessionPattern === 'SINGLE_PER_DAY'
                ? `<span class="badge badge-warning" style="font-size: 9.5px; padding: 1px 6px;">วันละ 1 รอบ</span>`
                : (p.sessionPattern === 'FULL_DAY_PAIRED'
                    ? `<span class="badge badge-normal" style="font-size: 9.5px; padding: 1px 6px;">เช้า+บ่าย</span>`
                    : `<span class="badge" style="background:#f1f5f9; color:#475569; font-size: 9.5px; padding: 1px 6px;">ยืดหยุ่น</span>`);

              return `
                <div class="m-card-proctor">
                  <div class="m-card-proctor-header">
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                      <span class="badge badge-normal" style="font-weight: 700; font-size: 11px;">${p.id}</span>
                      <strong style="font-size: 13.5px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${p.academicTitle ? `${p.academicTitle} ` : ''}${p.firstName} ${p.lastName}
                      </strong>
                    </div>
                    <div style="display: flex; gap: 4px; align-items: center; flex-shrink: 0;">
                      <span class="badge ${p.proctorType === 'faculty' ? 'badge-faculty' : 'badge-staff'}" style="font-size: 10px; padding: 2px 7px;">
                        ${p.proctorType === 'faculty' ? 'อาจารย์' : 'เจ้าหน้าที่'}
                      </span>
                      ${p.level === 'chief' ? `<span class="badge badge-locked" style="font-size: 9.5px; padding: 1px 6px;">⭐ Chief</span>` : `<span class="badge" style="background:#f1f5f9; color:#64748b; font-size: 9.5px; padding: 1px 6px;">ผู้ช่วย</span>`}
                    </div>
                  </div>

                  <div class="m-card-proctor-body">
                    <div class="m-card-row">
                      <span class="m-card-label">🏛️ คณะ/สังกัด:</span>
                      <span style="font-size: 12px; color: var(--text-main); text-align: right; max-width: 65%; word-break: break-word;">${p.department || '-'}</span>
                    </div>
                    <div class="m-card-row">
                      <span class="m-card-label">✉️ ติดต่อ:</span>
                      <span style="font-size: 11.5px; color: var(--text-muted);">${this.maskPDPA ? '•••••••@••••••' : p.email}</span>
                    </div>
                    <div class="m-card-row">
                      <span class="m-card-label">📅 วันที่สะดวก:</span>
                      <div style="text-align: right;">${datesDisplay}</div>
                    </div>
                    <div class="m-card-row" style="align-items: center; padding-top: 6px; border-top: 1px dashed var(--border-subtle); margin-top: 2px;">
                      <span class="m-card-label" style="font-weight: 700; color: var(--text-main);">🎯 ปรับโควต้า:</span>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <select class="form-input form-select-quota" data-action="change-proctor-quota" data-proctor-id="${p.id}" style="padding: 3px 8px; font-size: 12px; height: 30px; width: auto; font-weight: 700; cursor: pointer; border-radius: 6px; background: var(--bg-surface-elevated); color: var(--text-main); border: 1px solid var(--border-subtle);">
                          ${[1, 2, 3, 4, 5, 6].map(q => `
                            <option value="${q}" ${p.projectQuota === q ? 'selected' : ''}>
                              ${q} รอบ ${q === 6 ? '(สูงสุด)' : ''}
                            </option>
                          `).join('')}
                          ${(p.projectQuota !== undefined && p.projectQuota !== null && (p.projectQuota < 1 || p.projectQuota > 6)) ? `
                            <option value="${p.projectQuota}" selected>${p.projectQuota} รอบ</option>
                          ` : ''}
                        </select>
                        ${patternBadge}
                      </div>
                    </div>
                  </div>

                  <div class="m-card-proctor-actions">
                    <button class="btn btn-secondary btn-sm" data-action="edit-master" data-type="proctors" data-id="${p.id}" style="flex: 1; justify-content: center; font-size: 12px; padding: 6px 12px;">✏️ แก้ไขข้อมูล</button>
                    <button class="btn btn-danger btn-sm" data-action="delete-master" data-type="proctors" data-id="${p.id}" style="padding: 6px 12px; font-size: 12px;" title="ลบผู้คุมท่านนี้">🗑️</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      `;
    }

    if (this.masterDataSubTab === 'rooms') {
      return `
        <!-- แถบสลับมุมมองห้องสอบ & ผังอาคาร 17 -->
        <div class="building-navigator-header">
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-sm ${this.roomsViewMode === 'table' ? 'btn-primary' : 'btn-secondary'}" data-floor-mode="table">
              📋 ตารางห้องสอบ (${appState.rooms.length} ห้อง)
            </button>
            <button class="btn btn-sm ${this.roomsViewMode === 'floor1' ? 'btn-primary' : 'btn-secondary'}" data-floor-mode="floor1">
              🏢 ผังอาคาร 17 ชั้น 1 (ห้องสอบ 1 - 4)
            </button>
            <button class="btn btn-sm ${this.roomsViewMode === 'floor2' ? 'btn-primary' : 'btn-secondary'}" data-floor-mode="floor2">
              🏢 ผังอาคาร 17 ชั้น 2 (ห้องสอบ 5 - 10)
            </button>
            <button class="btn btn-sm ${this.roomsViewMode === 'directory' ? 'btn-primary' : 'btn-secondary'}" data-floor-mode="directory">
              📑 สารบบอาคาร 17 (Directory)
            </button>
          </div>
          <div style="font-size: 13px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
            <span>💡</span>
            <em>คลิกที่ห้องสอบใดก็ได้ เพื่อเปิดดูผังที่นั่ง สเปกห้อง และตารางผู้คุมสอบ</em>
          </div>
        </div>

        ${this.renderRoomsContentByMode()}
      `;
    }

    if (this.masterDataSubTab === 'sessions') {
      return `
        <table class="data-table">
          <thead>
            <tr>
              <th>รหัสรอบ</th>
              <th>ชื่อรอบการสอบ</th>
              <th>วันที่</th>
              <th>เวลาเริ่ม - จบ</th>
              <th>เตรียมห้อง (นาที)</th>
              <th>หลังสอบ (นาที)</th>
              <th>ผู้เข้าสอบรวม</th>
              <th>หน่วยงานเจ้าของ</th>
              <th style="text-align: center; width: 140px;">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${appState.sessions.map(s => `
              <tr>
                <td><strong>${s.id}</strong></td>
                <td>${s.name}</td>
                <td>${formatThaiDate(s.date)}</td>
                <td>${formatThaiTimeRange(s.startTime, s.endTime)}</td>
                <td>${s.prepMinutes} นาที</td>
                <td>${s.wrapMinutes} นาที</td>
                <td>${s.totalExaminees} คน</td>
                <td>${s.organization}</td>
                <td style="text-align: center; white-space: nowrap;">
                  <button class="btn btn-secondary btn-sm" data-action="edit-master" data-type="sessions" data-id="${s.id}" style="padding: 3px 8px; font-size: 12px;">✏️ แก้ไข</button>
                  <button class="btn btn-danger btn-sm" data-action="delete-master" data-type="sessions" data-id="${s.id}" style="padding: 3px 8px; font-size: 12px;">🗑️ ลบ</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (this.masterDataSubTab === 'unavail') {
      const proctorMap = new Map(appState.proctors.map(p => [p.id, p]));
      return `
        <table class="data-table">
          <thead>
            <tr>
              <th>รหัสผู้คุม</th>
              <th>ชื่อ - นามสกุล</th>
              <th>ช่วงเวลาที่แจ้งไม่ว่าง</th>
              <th>เหตุผล</th>
              <th style="text-align: center; width: 140px;">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${appState.unavailabilities.map(u => {
              const p = proctorMap.get(u.proctorId);
              return `
                <tr>
                  <td><strong>${u.proctorId}</strong></td>
                  <td>${p ? `${p.firstName} ${p.lastName}` : u.proctorId}</td>
                  <td>${formatThaiDate(u.startTime)} เวลา ${formatThaiTimeRange(u.startTime, u.endTime)}</td>
                  <td>${u.reason || '-'}</td>
                  <td style="text-align: center; white-space: nowrap;">
                    <button class="btn btn-secondary btn-sm" data-action="edit-master" data-type="unavail" data-id="${u.id}" style="padding: 3px 8px; font-size: 12px;">✏️ แก้ไข</button>
                    <button class="btn btn-danger btn-sm" data-action="delete-master" data-type="unavail" data-id="${u.id}" style="padding: 3px 8px; font-size: 12px;">🗑️ ลบ</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }

    return '';
  }

  renderRoomsContentByMode() {
    if (this.roomsViewMode === 'floor1') {
      return this.renderFloor1Blueprint();
    }
    if (this.roomsViewMode === 'floor2') {
      return this.renderFloor2Blueprint();
    }
    if (this.roomsViewMode === 'directory') {
      return this.renderBuildingDirectoryTable();
    }

    // Default: Table view
    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>รหัสห้อง</th>
            <th>ชื่อห้องสอบ / ชื่อทางการ</th>
            <th>อาคาร / ชั้น</th>
            <th>ความจุ</th>
            <th>เลขที่นั่งสอบ</th>
            <th>ประเภทห้อง</th>
            <th>รองรับคนพิการ</th>
            <th>สถานะ</th>
            <th style="text-align: center; width: 270px;">การจัดการ</th>
          </tr>
        </thead>
        <tbody>
          ${appState.rooms.map(r => `
            <tr>
              <td>
                <button class="btn btn-link btn-sm" data-action="view-room-detail" data-id="${r.id}" style="font-weight: 800; padding: 0; text-decoration: underline;" title="คลิกเพื่อดูรายละเอียดห้องสอบ">
                  ${r.roomCode || r.id}
                </button>
              </td>
              <td>
                <div style="cursor: pointer;" data-action="view-room-detail" data-id="${r.id}">
                  <strong>${r.name}</strong>
                  ${r.officialName && !r.name.includes(r.officialName) ? `<div style="font-size: 11px; color: var(--text-muted);">${r.officialName}</div>` : ''}
                </div>
              </td>
              <td>${r.building} (ชั้น ${r.floor})</td>
              <td><strong>${r.capacity}</strong> ที่นั่ง</td>
              <td><span class="badge badge-normal" style="font-weight: 700; color: var(--primary-700);">${r.seatStart && r.seatEnd ? `${r.seatStart} - ${r.seatEnd}` : `${r.capacity} ที่`}</span></td>
              <td><span class="badge ${r.roomType === 'computer' ? 'badge-primary' : 'badge-normal'}">${r.roomType === 'computer' ? '💻 CBT คอมพิวเตอร์' : 'ห้องปกติ'}</span></td>
              <td>${r.accessibleForDisabled ? '♿ รองรับ' : '-'}</td>
              <td><span class="badge ${r.isActive ? 'badge-normal' : 'badge-danger'}">${r.isActive ? 'พร้อมใช้' : 'ปิดปรับปรุง'}</span></td>
              <td style="text-align: center; white-space: nowrap;">
                <button class="btn btn-accent btn-sm" data-action="view-room-detail" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px; margin-right: 4px;" title="ดูข้อมูลห้อง ผังที่นั่ง สเปก และผู้คุมสอบ">🏢 รายละเอียด</button>
                <button class="btn btn-primary btn-sm" data-action="view-seating-plan" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px; margin-right: 4px;" title="ดูแผนผังโต๊ะสอบและเลขที่นั่ง">🗺️ ผังที่นั่ง</button>
                <button class="btn btn-secondary btn-sm" data-action="print-room-sign" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px; margin-right: 4px;" title="พิมพ์ป้ายหน้าห้องและผังที่นั่งห้องนี้">🪧 ป้ายห้อง</button>
                <button class="btn btn-secondary btn-sm" data-action="edit-master" data-type="rooms" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px;">✏️</button>
                <button class="btn btn-danger btn-sm" data-action="delete-master" data-type="rooms" data-id="${r.id}" style="padding: 3px 8px; font-size: 12px;">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  renderBlueprintRoomCell(roomCode) {
    return renderBlueprintRoomCell(roomCode, appState);
  }

  renderDirectorySidebar(floor) {
    return renderDirectorySidebar(floor, appState);
  }

  renderFloor1Blueprint() {
    return renderFloor1Blueprint(appState);
  }

  renderFloor2Blueprint() {
    return renderFloor2Blueprint(appState);
  }

  renderBuildingDirectoryTable() {
    return renderBuildingDirectoryTable(appState);
  }

  renderRoomDetailModal(room) {
    const isVisitor = this.currentTab === 'visitor';
    return renderRoomDetailModal({
      room,
      subTab: this.roomDetailSubTab,
      appState,
      maskPDPA: isVisitor ? true : this.maskPDPA,
      isVisitor: isVisitor
    });
  }

  // --- 7.7 หน้าจำลอง What-if (Modern Scenario Cards) ---
  renderWhatIfTab() {
    return `
      <div class="card">
        <div class="card-header" style="background: var(--bg-surface-elevated);">
          <div>
            <div class="card-title">🔮 เครื่องมือทดลองจำลองสถานการณ์ (What-if Simulation Engine)</div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 3px;">
              ทดลองเปลี่ยนตัวแปรเพื่อประเมินความเสี่ยงและเตรียมแผนสำรอง โดย<strong>ไม่กระทบต่อตารางการสอบจริง</strong>
            </div>
          </div>
        </div>
        <div class="card-body">
          <div class="scenario-cards-grid">
            <!-- Scenario 1: ลดโควต้า -->
            <div class="scenario-card-modern">
              <div class="scenario-card-top">
                <div class="scenario-icon-box" style="background: hsl(268, 90%, 96%); color: var(--primary-600);">⏳</div>
                <div class="scenario-card-title">1. ถ้าลดโควต้าลง 1 รอบ/วัน</div>
              </div>
              <div class="scenario-card-desc">
                จำลองว่าหากผู้คุมทุกคนสามารถคุมสอบได้ไม่เกิน 1 รอบต่อวัน จะเกิดคอขวดที่รอบใด และขาดผู้คุมจำนวนเท่าใด
              </div>
              <button class="btn btn-secondary btn-sm" data-action="run-whatif" data-scenario="reduce-quota" style="width: 100%; justify-content: center; font-weight: 600;">
                ▶️ เริ่มจำลองสถานการณ์นี้
              </button>
            </div>

            <!-- Scenario 2: ผู้คุม 5 คนลาป่วย -->
            <div class="scenario-card-modern">
              <div class="scenario-card-top">
                <div class="scenario-icon-box" style="background: hsl(355, 90%, 96%); color: var(--danger-500);">🚑</div>
                <div class="scenario-card-title">2. ถ้าผู้คุม 5 คนลาป่วยกะทันหัน</div>
              </div>
              <div class="scenario-card-desc">
                สุ่มให้ผู้คุม 5 คนติดภารกิจด่วนในวันสอบ เพื่อทดสอบว่าระบบผู้คุมสำรองและบุคลากรที่เหลือจะรองรับได้สมบูรณ์หรือไม่
              </div>
              <button class="btn btn-secondary btn-sm" data-action="run-whatif" data-scenario="proctors-leave" style="width: 100%; justify-content: center; font-weight: 600;">
                ▶️ เริ่มจำลองสถานการณ์นี้
              </button>
            </div>

            <!-- Scenario 3: ห้อง R03 ใช้ไม่ได้ -->
            <div class="scenario-card-modern">
              <div class="scenario-card-top">
                <div class="scenario-icon-box" style="background: hsl(210, 95%, 96%); color: #2563EB;">❄️</div>
                <div class="scenario-card-title">3. ถ้าห้องสอบ R03 แอร์เสีย</div>
              </div>
              <div class="scenario-card-desc">
                ปิดการใช้งานห้องปฏิบัติการ CBT R03 แล้วเกลี่ยผู้เข้าสอบ 35 คนไปยังห้องอื่นเพื่อดูความจุห้องที่เหลือ
              </div>
              <button class="btn btn-secondary btn-sm" data-action="run-whatif" data-scenario="room-broken" style="width: 100%; justify-content: center; font-weight: 600;">
                ▶️ เริ่มจำลองสถานการณ์นี้
              </button>
            </div>
          </div>

          ${this.whatIfScenario ? `
            <div style="margin-top: 24px; padding: 20px; background: var(--bg-surface-elevated); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); border-left: 5px solid ${this.whatIfScenario.success ? 'var(--success-500)' : 'var(--danger-500)'};">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <h4 style="font-size: 16px; margin: 0; color: var(--text-main);">
                  📊 ผลการจำลอง: ${this.whatIfScenario.title}
                </h4>
                <span class="badge ${this.whatIfScenario.success ? 'badge-normal' : 'badge-danger'}" style="font-size: 12px;">
                  ${this.whatIfScenario.success ? 'ผ่านเกณฑ์สมบูรณ์' : 'พบข้อขัดข้อง'}
                </span>
              </div>
              <p style="font-size: 14px; line-height: 1.6; margin-bottom: 12px; color: var(--text-main);">
                ${this.whatIfScenario.description}
              </p>
              <div style="font-size: 13px; font-weight: 600; color: ${this.whatIfScenario.success ? 'var(--success-600)' : 'var(--danger-600)'};">
                ${this.whatIfScenario.success 
                  ? '✅ ข้อเสนอแนะ: ระบบและกำลังพลสำรองมีความยืดหยุ่นเพียงพอ สามารถรับมือสถานการณ์นี้ได้โดยไม่ต้องเพิ่มบุคลากรภายนอก' 
                  : '⚠️ ข้อเสนอแนะ: แนะนำให้สำรองรายชื่อผู้ช่วยคุมสอบเพิ่มเติมอย่างน้อย 8 คน หรือคงโควต้า 2 รอบ/วันตามเดิม'}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // --- 7.8 & 7.9 หน้าเวอร์ชันและเปรียบเทียบ (Version Timeline) ---
  renderVersionsTab() {
    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 20px;">
        <!-- รายการเวอร์ชัน (Timeline View) -->
        <div class="card">
          <div class="card-header" style="background: var(--bg-surface-elevated);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">🕒</span>
              <div class="card-title">ไทม์ไลน์ Snapshot (${appState.versions.length} เวอร์ชัน)</div>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-save-version">➕ บันทึก Snapshot</button>
          </div>
          <div class="card-body" style="padding: 20px;">
            ${appState.versions.length === 0 ? `
              <div style="padding: 30px 20px; text-align: center; color: var(--text-muted); border: 2px dashed var(--border-subtle); border-radius: var(--radius-md);">
                ยังไม่มีการบันทึก Snapshot ไว้<br>
                <small style="font-size: 12px; color: var(--text-muted);">กดปุ่ม "➕ บันทึก Snapshot" ด้านบน เพื่อเก็บประวัติตารางปัจจุบันไว้เปรียบเทียบหรือย้อนคืนได้ตลอดเวลา</small>
              </div>
            ` : `
              <div class="timeline-flow">
                ${appState.versions.map((v, idx) => `
                  <div class="timeline-item">
                    <div class="timeline-dot" style="${idx === 0 ? 'background: var(--success-500); box-shadow: 0 0 0 2px var(--success-50);' : ''}"></div>
                    <div class="timeline-header">
                      <strong class="timeline-title">เวอร์ชันที่ ${v.versionNumber} ${idx === 0 ? '<span class="badge badge-normal" style="font-size: 10px;">ล่าสุด</span>' : ''}</strong>
                      <span class="timeline-time">${formatThaiDate(v.createdAt)} ${formatThaiTime(v.createdAt)}</span>
                    </div>
                    <div class="timeline-desc">${v.note || 'ไม่มีบันทึกช่วยจำ'}</div>
                    <div style="display: flex; gap: 6px;">
                      <button class="btn btn-secondary btn-sm" data-action="restore-version" data-version-id="${v.id}" style="font-size: 12px; padding: 3px 10px;">
                        ↺ ย้อนกลับไปใช้เวอร์ชันนี้
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- กล่องเปรียบเทียบ Diff -->
        <div class="card">
          <div class="card-header" style="background: var(--bg-surface-elevated);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">⚖️</span>
              <div class="card-title">เปรียบเทียบความแตกต่าง (Version Diff)</div>
            </div>
          </div>
          <div class="card-body">
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px; line-height: 1.5;">
              เปรียบเทียบตารางปัจจุบันกับ Snapshot ในอดีต เพื่อตรวจสอบว่ามีผู้คุมคนใดถูกโยกย้ายหรือสลับห้องสอบไปบ้าง
            </p>
            ${appState.versions.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 10px;">
                <button class="btn btn-secondary btn-sm" data-action="compare-diff" data-v1="${appState.versions[0].id}" data-v2="current" style="justify-content: center; padding: 10px;">
                  🔍 เปรียบเทียบตารางปัจจุบันกับเวอร์ชันที่ ${appState.versions[0].versionNumber}
                </button>
              </div>
            ` : '<div style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 20px;">ต้องบันทึกอย่างน้อย 1 Snapshot เพื่อเริ่มเปรียบเทียบ Diff</div>'}
          </div>
        </div>
      </div>
    `;
  }

  // --- 7.11 หน้าตั้งค่า Settings ---
  renderSettingsTab() {
    const s = appState.settings;

    return `
      <form id="form-settings" style="display: flex; flex-direction: column; gap: 20px;">
        <!-- Card 1: โควต้าภาระงาน (H3) -->
        <div class="card">
          <div class="card-header" style="background: var(--bg-surface-elevated);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">📋</span>
              <div class="card-title">1. โควต้าภาระงานผู้คุมสอบ (Hard Constraints H3)</div>
            </div>
            <span class="badge badge-locked">Hard Rule</span>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px;">
              <div class="form-group">
                <label class="form-label">โควต้ารอบสูงสุดต่อวัน (รอบ/วัน)</label>
                <input type="number" class="form-input" name="dailyQuota" value="${s.hardConstraints.h3_daily_quota_default}" min="1" max="5">
                <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">จำกัดจำนวนรอบคุมสอบต่อคนต่อวัน</span>
              </div>
              <div class="form-group">
                <label class="form-label">โควต้ารอบสูงสุดต่อทั้งโครงการ (รอบ)</label>
                <input type="number" class="form-input" name="projectQuota" value="${s.hardConstraints.h3_project_quota_default}" min="1" max="20">
                <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">จำกัดรอบคุมสอบสะสมตลอดช่วงสอบ</span>
              </div>
              <div class="form-group">
                <label class="form-label">ชั่วโมงคุมสอบสูงสุด (ชม.)</label>
                <input type="number" class="form-input" name="maxHours" value="${s.hardConstraints.h3_max_hours_default}" step="0.5">
                <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">รวมเวลาเตรียมตัวและสรุปงาน</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 2: เกณฑ์ห้องสอบและเวลาพัก (H5, H6, H7, H8) -->
        <div class="card">
          <div class="card-header" style="background: var(--bg-surface-elevated);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">🏛️</span>
              <div class="card-title">2. เกณฑ์ห้องสอบและเวลาพัก (H5, H6, H7, H8)</div>
            </div>
            <span class="badge badge-locked">Hard Rule</span>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px;">
              <div class="form-group">
                <label class="form-label">เกณฑ์ผู้เข้าสอบเพื่อใช้ 2 ผู้คุม (คน)</label>
                <input type="number" class="form-input" name="examineeThreshold" value="${s.hardConstraints.h5_examinee_threshold_for_two_proctors}">
                <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">หากผู้สอบเกินเกณฑ์นี้ ห้องนั้นต้องใช้หัวหน้า 1 + ผู้ช่วย 1 (H5)</span>
              </div>
              <div class="form-group">
                <label class="form-label">เวลาพักขั้นต่ำระหว่างรอบ (นาที)</label>
                <input type="number" class="form-input" name="minRest" value="${s.hardConstraints.h6_min_rest_minutes_between_sessions}">
                <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">เวลาพักผ่อนของผู้คุมก่อนเริ่มรอบถัดไป (H6)</span>
              </div>
              <div class="form-group">
                <label class="form-label">ผู้คุมสำรองต่อรอบ (คน)</label>
                <input type="number" class="form-input" name="reserveCount" value="${s.hardConstraints.h8_reserve_proctors_per_session}">
                <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">เตรียมพร้อมกรณีมีเหตุฉุกเฉินหรือลากะทันหัน (H8)</span>
              </div>
              <div class="form-group" style="display: flex; flex-direction: column; justify-content: flex-end;">
                <label class="form-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 0;">
                  <input type="checkbox" name="requireAllComputer" value="1" ${s.hardConstraints.h7_require_all_computer_rooms ? 'checked' : ''}>
                  <span>💻 โหมดสอบบนคอมพิวเตอร์ (CBT 100%)</span>
                </label>
                <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">บังคับให้ทุกห้องสอบต้องเป็นห้องปฏิบัติการคอมพิวเตอร์ (H7)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 3: น้ำหนักความพึงพอใจ Soft Constraints (S1 - S7) -->
        <div class="card">
          <div class="card-header" style="background: var(--bg-surface-elevated);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">⚖️</span>
              <div class="card-title">3. น้ำหนักคะแนนความพึงพอใจและความเป็นธรรม (Soft Weights S1 - S7)</div>
            </div>
            <span class="badge badge-normal">Optimization</span>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px;">
              <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <label class="form-label" style="margin-bottom: 0;">S1: กระจายภาระงานสม่ำเสมอ</label>
                  <span class="badge badge-normal" id="val-s1">${s.softWeights.s1_workload_balance}</span>
                </div>
                <input type="range" class="form-input" name="s1_weight" min="0" max="20" value="${s.softWeights.s1_workload_balance}" oninput="document.getElementById('val-s1').innerText = this.value">
                <span style="font-size: 11px; color: var(--text-muted);">ลดความเหลื่อมล้ำของจำนวนรอบคุมสอบระหว่างผู้คุม</span>
              </div>

              <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <label class="form-label" style="margin-bottom: 0;">S2: รวมงานในวันเดียว</label>
                  <span class="badge badge-normal" id="val-s2">${s.softWeights.s2_concentrate_days}</span>
                </div>
                <input type="range" class="form-input" name="s2_weight" min="0" max="20" value="${s.softWeights.s2_concentrate_days}" oninput="document.getElementById('val-s2').innerText = this.value">
                <span style="font-size: 11px; color: var(--text-muted);">เน้นให้คุมต่อเนื่องในวันเดียวกันเพื่อไม่ต้องเดินทางหลายวัน</span>
              </div>

              <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <label class="form-label" style="margin-bottom: 0;">S4: คุมห้องเดิมตลอดวัน</label>
                  <span class="badge badge-normal" id="val-s4">${s.softWeights.s4_same_room_all_day}</span>
                </div>
                <input type="range" class="form-input" name="s4_weight" min="0" max="20" value="${s.softWeights.s4_same_room_all_day}" oninput="document.getElementById('val-s4').innerText = this.value">
                <span style="font-size: 11px; color: var(--text-muted);">ลดการย้ายห้องสอบระหว่างรอบของผู้คุม</span>
              </div>

              <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <label class="form-label" style="margin-bottom: 0;">S5: ผสมอาจารย์ + เจ้าหน้าที่</label>
                  <span class="badge badge-normal" id="val-s5">${s.softWeights.s5_mix_faculty_and_staff}</span>
                </div>
                <input type="range" class="form-input" name="s5_weight" min="0" max="20" value="${s.softWeights.s5_mix_faculty_and_staff}" oninput="document.getElementById('val-s5').innerText = this.value">
                <span style="font-size: 11px; color: var(--text-muted);">จับคู่อาจารย์และเจ้าหน้าที่ร่วมกันในห้องที่มี 2 คน</span>
              </div>
            </div>
          </div>
        </div>

        <!-- แถบปุ่มบันทึก -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; background: var(--bg-surface); padding: 14px 20px; border-radius: var(--radius-lg); border: 1px solid var(--border-subtle);">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-reset-settings">
            🔄 รีเซ็ตเป็นค่าเริ่มต้น
          </button>
          <button type="submit" class="btn btn-primary" style="padding: 9px 24px; font-weight: 700;">
            💾 บันทึกการตั้งค่าทั้งหมด
          </button>
        </div>
      </form>
    `;
  }

  // --- 7.12 หน้า Audit Log (Modern Activity Feed) ---
  renderAuditTab() {
    return `
      <div class="card">
        <div class="card-header" style="background: var(--bg-surface-elevated); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">📜</span>
            <div class="card-title">บันทึกประวัติการเปลี่ยนแปลง (Audit Activity Feed)</div>
          </div>
          <span class="badge badge-normal">${appState.auditLogs.length} รายการ</span>
        </div>
        <div class="card-body" style="padding: 0;">
          ${appState.auditLogs.length === 0 ? `
            <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
              ยังไม่มีบันทึกประวัติกิจกรรมในระบบ
            </div>
          ` : `
            <div class="activity-feed-list">
              ${[...appState.auditLogs].reverse().map(log => {
                let icon = '📝';
                let iconBg = 'var(--bg-surface-elevated)';
                let actionColor = 'var(--primary-600)';

                const act = (log.action || '').toLowerCase();
                if (act.includes('create') || act.includes('add') || act.includes('insert')) {
                  icon = '➕';
                  iconBg = 'var(--success-50)';
                  actionColor = 'var(--success-600)';
                } else if (act.includes('delete') || act.includes('remove') || act.includes('cancel') || act.includes('clear')) {
                  icon = '🗑️';
                  iconBg = 'var(--danger-50)';
                  actionColor = 'var(--danger-600)';
                } else if (act.includes('solve') || act.includes('auto')) {
                  icon = '🚀';
                  iconBg = 'var(--primary-50)';
                  actionColor = 'var(--primary-600)';
                } else if (act.includes('edit') || act.includes('update') || act.includes('swap') || act.includes('reassign')) {
                  icon = '🔄';
                  iconBg = 'hsl(210, 95%, 96%)';
                  actionColor = '#2563EB';
                }

                return `
                  <div class="activity-feed-item">
                    <div class="activity-feed-icon" style="background: ${iconBg};">
                      ${icon}
                    </div>
                    <div class="activity-feed-content">
                      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
                        <div class="activity-feed-title">
                          <strong>${log.actor}</strong>
                          <span class="badge" style="margin-left: 6px; background: ${iconBg}; color: ${actionColor}; font-weight: 700; border: 1px solid var(--border-subtle);">${log.action}</span>
                          <span style="font-size: 12px; color: var(--text-muted); margin-left: 4px;">(${log.entityType})</span>
                        </div>
                        <span class="activity-feed-time">
                          📅 ${formatThaiDate(log.timestamp)} &bull; ⏰ ${formatThaiTime(log.timestamp)}
                        </span>
                      </div>
                      <div class="activity-feed-detail" style="margin-top: 4px; line-height: 1.5;">
                        ${log.reason || (typeof log.afterValue === 'string' ? log.afterValue : JSON.stringify(log.afterValue || ''))}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }

  // --- หน้าทดสอบระบบ Automated Test Suite ---
  renderTestsTab() {
    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">🧪 รันชุดทดสอบอัตโนมัติ (Automated Test Suite)</div>
          <button class="btn btn-primary btn-sm" id="btn-run-all-tests">
            ▶️ รันการทดสอบทั้งหมดทันที
          </button>
        </div>
        <div class="card-body">
          <p style="font-size: 14px; color: var(--text-muted); margin-bottom: 16px;">
            ทดสอบครอบคลุม: Unit Tests กฎ H1-H8 (ผ่านและไม่ผ่าน), Edge cases กรณีขอบ, Property tests, และ Benchmark 3 ขนาด (20/40/80 คน x 5 seeds)
          </p>

          ${this.testResults ? `
            <div style="margin-bottom: 20px; padding: 14px 18px; border-radius: var(--radius-md); background: ${this.testResults.failed === 0 ? 'var(--success-50)' : 'var(--danger-50)'};">
              <strong style="color: ${this.testResults.failed === 0 ? 'var(--success-500)' : 'var(--danger-500)'}; font-size: 16px;">
                ${this.testResults.failed === 0 ? '🎉 การทดสอบทั้งหมดผ่านฉลุย 100%' : `❌ มีข้อผิดพลาด ${this.testResults.failed} ข้อ`}
              </strong>
              <div>ผ่าน ${this.testResults.passed} จาก ${this.testResults.total} การทดสอบ</div>
            </div>

            <!-- ตาราง Benchmark Matrix จากผลทดสอบ 11.4 -->
            <h3 style="font-size: 15px; margin-bottom: 8px;">ตารางผลทดสอบประสิทธิภาพ (Benchmark Matrix 3 ขนาด x 5 seeds):</h3>
            <div class="table-wrapper" style="margin-bottom: 20px;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>ขนาดการทดสอบ</th>
                    <th>Seed</th>
                    <th>ผลการจัด</th>
                    <th>เวลาที่ใช้ (ms)</th>
                    <th>SD ภาระงาน</th>
                    <th>ผู้คุมขั้นต่ำที่คำนวณได้</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.testResults.benchmarkRows.map(r => `
                    <tr>
                      <td>${r.size}</td>
                      <td>${r.seed}</td>
                      <td><span class="badge badge-normal">${r.success}</span></td>
                      <td>${r.durationMs} ms</td>
                      <td>${r.sdWorkload}</td>
                      <td><strong>${r.minProctors} คน</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="padding: 30px; text-align: center; color: var(--text-muted); border: 2px dashed var(--border-subtle); border-radius: var(--radius-md);">
              กดปุ่ม "▶️ รันการทดสอบทั้งหมดทันที" เพื่อเริ่มรันการทดสอบและดูตาราง Benchmark
            </div>
          `}
        </div>
      </div>
    `;
  }

  // --- หน้า AI Agent (ผู้ช่วยจัดตารางอัจฉริยะแบบ Modern Web AI) ---
  renderAIAgentTab() {
    // คำนวณ Live Health Telemetry
    const val = validateSchedule({
      assignments: appState.assignments,
      allocations: appState.allocations,
      sessions: appState.sessions,
      proctors: appState.proctors,
      rooms: appState.rooms,
      unavailabilities: appState.unavailabilities,
      settings: appState.settings
    });

    const totalRequiredSlots = appState.allocations.reduce((acc, al) => {
      return acc + (al.examineesInRoom > (appState.settings.hardConstraints.h5_examinees_per_assistant || 30) ? 2 : 1);
    }, 0);
    const assignedSlots = appState.assignments.filter(a => a.role !== 'reserve').length;
    const completeness = totalRequiredSlots > 0 ? Math.round((assignedSlots / totalRequiredSlots) * 100) : 0;
    const totalProctors = appState.proctors.filter(p => p.isActive).length;
    const minCalc = appState.calculateMinProctors();

    // คำนวณ SD ภาระงาน
    const counts = appState.proctors.map(p => appState.assignments.filter(a => a.proctorId === p.id).length);
    const avg = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    const variance = counts.length > 0 ? counts.reduce((acc, c) => acc + Math.pow(c - avg, 2), 0) / counts.length : 0;
    const sdWorkload = Math.sqrt(variance).toFixed(2);

    const isInitialChat = this.aiAgent.chatHistory.length <= 1;

    return `
      <!-- Ultra-Modern AI Web App Interface (ChatGPT / Claude / Perplexity Style) -->
      <div class="agent-chat-wrapper">
        <!-- Top App Bar -->
        <div class="agent-chat-header">
          <div class="agent-brand-group">
            <div class="agent-avatar-badge">
              ✨
            </div>
            <div>
              <div class="agent-title-row">
                <span class="agent-title-text">ProctorAI Copilot</span>
                <span class="agent-status-beacon" title="พร้อมทำงาน (Offline Local Engine)"></span>
                <span class="agent-tag-copilot">v2.0</span>
              </div>
              <div class="agent-sub-text">
                Neural Constraint Engine • Local Offline • ปลอดภัยไม่ส่งข้อมูลออกนอกเครื่อง
              </div>
            </div>
          </div>

          <!-- Topbar Telemetry Status Chips -->
          <div class="agent-header-telemetry">
            <div class="agent-telemetry-pill" data-quick-prompt="ช่วยวิเคราะห์สุขภาพและความสมบูรณ์ของตารางปัจจุบันหน่อย" title="คลิกเพื่อให้ AI วิเคราะห์สุขภาพตาราง">
              <span style="color: ${val.isValid && completeness === 100 ? '#86efac' : '#fca5a5'};">●</span>
              <span>ตาราง: <strong>${val.isValid && completeness === 100 ? '100% สมบูรณ์' : `${completeness}% (${val.errorCount} ข้อผิด)`}</strong></span>
            </div>

            <div class="agent-telemetry-pill" data-quick-prompt="ช่วยจัดตารางคุมสอบอัตโนมัติให้หน่อย" title="คลิกเพื่อให้ AI จัดการตำแหน่งที่ยังว่าง">
              <span>⚡ จัดแล้ว: <strong>${assignedSlots}/${totalRequiredSlots}</strong></span>
            </div>

            <div class="agent-telemetry-pill" data-quick-prompt="โครงการนี้ต้องใช้ผู้คุมสอบขั้นต่ำกี่คน?" title="คลิกเพื่อให้ AI วิเคราะห์ความจุบุคลากร">
              <span>👥 บุคลากร: <strong>${totalProctors} คน</strong> (ขั้นต่ำ ${minCalc.minProctorsNeeded})</span>
            </div>

            <div class="agent-telemetry-pill" data-quick-prompt="การเกลี่ยภาระงานของผู้คุมสอบยุติธรรมและสมดุลแค่ไหน?" title="คลิกเพื่อให้ AI วิเคราะห์ความยุติธรรม SD">
              <span>⚖️ SD: <strong>${sdWorkload}</strong></span>
            </div>

            <div class="agent-header-actions">
              <button class="btn btn-secondary btn-sm" id="btn-clear-chat" style="padding: 4px 10px; font-size: 11px; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;" title="ล้างประวัติการสนทนา">
                🗑️ ล้างแชท
              </button>
            </div>
          </div>
        </div>

        <!-- Scrollable Messages Area -->
        <div class="agent-chat-messages" id="agent-messages-box">
          <div class="agent-messages-inner">
            ${isInitialChat ? `
              <!-- ChatGPT / Claude Style Welcome Hero & Prompt Cards -->
              <div class="agent-hero-card-container">
                <div class="agent-hero-logo">✨</div>
                <div class="agent-hero-title">สวัสดีครับ มีอะไรให้ ProctorAI ช่วยจัดตารางวันนี้?</div>
                <div class="agent-hero-subtitle">
                  ผู้ช่วยปัญญาประดิษฐ์อัจฉริยะสำหรับวางแผนกำลังคน ตรวจสอบข้อกำหนดเด็ดขาด H1-H8 และสั่งจัดตารางสอบแบบอัตโนมัติ (100% Local Offline)
                </div>

                <!-- 4 Quick Starter Prompt Cards (2x2 Grid) -->
                <div class="agent-hero-grid">
                  <div class="agent-hero-prompt-card" data-quick-prompt="ช่วยวิเคราะห์สุขภาพและความสมบูรณ์ของตารางปัจจุบันหน่อย">
                    <div class="agent-hero-card-icon">🩺</div>
                    <div class="agent-hero-card-content">
                      <div class="agent-hero-card-title">
                        <span>ตรวจสุขภาพตาราง (Audit)</span>
                        <span style="opacity: 0.5; font-size: 12px;">→</span>
                      </div>
                      <div class="agent-hero-card-desc">สแกนหาข้อผิดพลาดตามกฎ H1-H8, ตรวจห้องว่าง และวิเคราะห์ความพร้อม</div>
                    </div>
                  </div>

                  <div class="agent-hero-prompt-card" data-quick-prompt="ช่วยจัดตารางคุมสอบอัตโนมัติให้หน่อย">
                    <div class="agent-hero-card-icon">⚡</div>
                    <div class="agent-hero-card-content">
                      <div class="agent-hero-card-title">
                        <span>จัดตารางอัตโนมัติ (AI Solver)</span>
                        <span style="opacity: 0.5; font-size: 12px;">→</span>
                      </div>
                      <div class="agent-hero-card-desc">สั่งรัน AI Constraint Solver จัดตำแหน่งที่เหลือ พร้อมเกลี่ยภาระงานให้เท่าเทียม</div>
                    </div>
                  </div>

                  <div class="agent-hero-prompt-card" data-quick-prompt="โครงการนี้ต้องใช้ผู้คุมสอบขั้นต่ำกี่คน?">
                    <div class="agent-hero-card-icon">👥</div>
                    <div class="agent-hero-card-content">
                      <div class="agent-hero-card-title">
                        <span>คำนวณผู้คุมขั้นต่ำ (Capacity)</span>
                        <span style="opacity: 0.5; font-size: 12px;">→</span>
                      </div>
                      <div class="agent-hero-card-desc">วิเคราะห์จำนวนผู้คุมสอบขั้นต่ำที่ต้องใช้ และชี้เป้าช่วงเวลาที่เป็นคอขวด</div>
                    </div>
                  </div>

                  <div class="agent-hero-prompt-card" data-quick-prompt="ถ้ามีผู้คุมลาป่วยกะทันหัน ระบบมีแนวทางรับมืออย่างไร?">
                    <div class="agent-hero-card-icon">🚨</div>
                    <div class="agent-hero-card-content">
                      <div class="agent-hero-card-title">
                        <span>รับมือผู้คุมลาฉุกเฉิน (Substitute)</span>
                        <span style="opacity: 0.5; font-size: 12px;">→</span>
                      </div>
                      <div class="agent-hero-card-desc">ค้นหาตัวแทนที่มีคุณสมบัติเหมาะสม ไม่ติดคุมสอบ และไม่ผิดกฎ H1-H8</div>
                    </div>
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Conversation Messages Stream -->
            ${this.aiAgent.chatHistory.map(m => `
              <div class="agent-message-row ${m.sender}">
                <div class="agent-msg-avatar" title="${m.sender === 'agent' ? 'ProctorAI Agent' : (appState.currentUser?.name || 'คุณ')}">
                  ${m.sender === 'agent' ? '✨' : '👤'}
                </div>
                <div class="agent-bubble ${m.sender}">
                  <div class="agent-bubble-meta">
                    <strong>${m.sender === 'agent' ? 'ProctorAI' : (appState.currentUser?.name || 'คุณ')}</strong>
                    <span>• ${formatThaiTime(m.timestamp)}</span>
                  </div>
                  <div class="agent-msg-content" style="line-height: 1.65;">
                    ${this.formatAgentMarkdown(m.message)}
                  </div>
                  ${m.actions && m.actions.length > 0 ? `
                    <div class="agent-actions-box">
                      ${m.actions.map(act => `
                        <button class="agent-action-btn" data-agent-prompt="${act.prompt || ''}" data-agent-action="${act.actionId || ''}">
                          <span>${act.label}</span>
                          <span style="opacity: 0.5; font-size: 11px;">→</span>
                        </button>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Bottom Floating Input Dock -->
        <div class="agent-chat-footer">
          <div class="agent-footer-inner">
            <!-- Suggestion Chips -->
            <div class="agent-quick-prompts">
              <span style="font-size: 11.5px; color: var(--text-muted); font-weight: 700; margin-right: 2px;">⚡ แนะนำ:</span>
              <button class="agent-prompt-chip" data-quick-prompt="ช่วยวิเคราะห์สุขภาพและความสมบูรณ์ของตารางปัจจุบันหน่อย">🩺 ตรวจสุขภาพตาราง</button>
              <button class="agent-prompt-chip" data-quick-prompt="ช่วยจัดตารางคุมสอบอัตโนมัติให้หน่อย">⚡ สั่งจัดตารางอัตโนมัติ</button>
              <button class="agent-prompt-chip" data-quick-prompt="โครงการนี้ต้องใช้ผู้คุมสอบขั้นต่ำกี่คน?">👥 คำนวณผู้คุมขั้นต่ำ</button>
              <button class="agent-prompt-chip" data-quick-prompt="ถ้ามีผู้คุมลาป่วยกะทันหัน ระบบมีแนวทางรับมืออย่างไร?">🚨 แนะนำคนลากะทันหัน</button>
              <button class="agent-prompt-chip" data-quick-prompt="การเกลี่ยภาระงานของผู้คุมสอบยุติธรรมและสมดุลแค่ไหน?">📊 วิเคราะห์การเกลี่ยงาน</button>
              <button class="agent-prompt-chip" data-quick-prompt="ช่วยสรุปกฎข้อบังคับเด็ดขาด H1 ถึง H8 ให้ฟังหน่อย">⚖️ อธิบายกฎ H1-H8</button>
              <button class="agent-prompt-chip" data-quick-prompt="ระบบนี้เป็น Open Source อย่างไร และมีสิทธิ์การใช้งานแบบไหน?">🌐 สิทธิ์ Open Source (MIT)</button>
            </div>

            <!-- Capsule Input Form -->
            <form id="form-agent-chat" class="agent-input-dock">
              <span style="font-size: 18px; color: var(--primary-500); margin-left: 2px;">✨</span>
              <input type="text" id="input-agent-chat" class="agent-input-field" placeholder="พิมพ์คำถาม หรือสั่งการ ProctorAI (เช่น 'ตรวจสุขภาพตาราง', 'ใครว่างวันที่ 24 บ้าง', 'คำนวณผู้คุมขั้นต่ำ')..." autocomplete="off" required>
              <button type="submit" class="agent-send-btn" title="ส่งคำสั่ง (Enter)">
                ↑
              </button>
            </form>

            <div class="agent-disclaimer">
              🔒 ProctorAI ประมวลผลบนเครื่องของคุณแบบ Local 100% • ปลอดภัย ข้อมูลไม่รั่วไหล • MIT License
            </div>
          </div>
        </div>
      </div>
    `;
  }

  formatAgentMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/`([^`]+)`/g, '<code style="background: rgba(168,85,247,0.12); color: var(--primary-700); padding: 2px 6px; border-radius: 4px; font-size: 12px; font-family: monospace; font-weight: 600;">$1</code>')
      .replace(/^### (.*$)/gim, '<div style="margin: 12px 0 6px 0; font-size: 15px; color: var(--primary-700); font-weight: 800; display: flex; align-items: center; gap: 6px;">$1</div>')
      .replace(/^## (.*$)/gim, '<div style="margin: 14px 0 8px 0; font-size: 16px; color: var(--text-main); font-weight: 800; display: flex; align-items: center; gap: 6px;">$1</div>')
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-main); font-weight: 700;">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em style="color: var(--text-muted);">$1</em>')
      .replace(/^• (.*$)/gim, '<div style="margin: 3px 0 3px 12px; display: flex; align-items: flex-start; gap: 6px;"><span style="color: var(--primary-500); font-weight: bold;">•</span><div>$1</div></div>')
      .replace(/^\- (.*$)/gim, '<div style="margin: 3px 0 3px 12px; display: flex; align-items: flex-start; gap: 6px;"><span style="color: var(--accent-500); font-weight: bold;">▪</span><div>$1</div></div>')
      .replace(/\n\n/g, '<div style="height: 10px;"></div>')
      .replace(/\n/g, '<br>');
  }

  // --- Modal Dialogs (แก้ไขผู้คุมด้วยมือ, แนะนำตัวแทน, ลากะทันหัน) ---
  renderModal() {
    if (!this.activeModal) return '';

    if (this.activeModal.type === 'edit-slot') {
      const { sessionId, allocationId, roomId, role, currentAssign } = this.activeModal.data;
      const allCandidates = appState.getRecommendedSubstitutes(sessionId, allocationId, role, currentAssign ? currentAssign.proctorId : null);
      const availableCandidates = allCandidates.filter(c => c.allowed);
      const busyCandidates = allCandidates.filter(c => !c.allowed);

      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 620px;">
            <div class="modal-header">
              <div>
                <div class="card-title">เลือก/เปลี่ยนผู้คุมสอบ (${role === 'chief' ? 'หัวหน้าห้อง' : (role === 'reserve' ? 'ผู้คุมสำรอง' : 'ผู้ช่วยผู้คุม')})</div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                  รอบสอบ: <strong>${sessionId}</strong> ${roomId ? `| ห้อง: <strong>${roomId}</strong>` : ''}
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
              ${currentAssign ? `
                <div style="background: var(--bg-surface-elevated); padding: 10px 14px; border-radius: var(--radius-md); border-left: 4px solid var(--primary-500); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <div>
                    <div style="font-size: 11px; color: var(--text-muted);">ผู้คุมปัจจุบันในตำแหน่งนี้:</div>
                    <strong style="font-size: 14px;">${(() => {
                      const p = appState.proctors.find(x => x.id === currentAssign.proctorId);
                      return p ? `${p.firstName} ${p.lastName} (${p.id})` : currentAssign.proctorId;
                    })()}</strong>
                  </div>
                  <div style="display: flex; gap: 6px;">
                    <button class="btn btn-secondary btn-sm" data-action="toggle-lock" data-assign-id="${currentAssign.id}" title="ล็อกตำแหน่งไม่ให้อัลกอริทึมเปลี่ยน">
                      ${currentAssign.status === 'locked' ? '🔓 ปลดล็อก' : '🔒 ล็อกตำแหน่ง'}
                    </button>
                    <button class="btn btn-danger btn-sm" data-action="remove-assign" data-assign-id="${currentAssign.id}" title="นำผู้คุมออกจากตำแหน่งนี้เพื่อให้ตำแหน่งว่าง">
                      🗑️ ปลดออก
                    </button>
                  </div>
                </div>
              ` : ''}

              <!-- แถบลัด: สุ่มเลือกผู้คุมที่ผ่านเกณฑ์ทันที (Auto-Pick) -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: linear-gradient(135deg, rgba(245,158,11,0.14), rgba(126,34,206,0.10)); border: 1px solid rgba(245,158,11,0.4); border-radius: var(--radius-md);">
                <div>
                  <strong style="font-size: 13px; color: var(--text-main);">⚡ ขี้เกียจเลือกทีละคน?</strong>
                  <div style="font-size: 11px; color: var(--text-muted);">ให้ระบบสุ่มเลือกผู้คุมที่ผ่านกฎ H1-H8 และเหมาะสมที่สุดให้ทันที</div>
                </div>
                <button type="button" class="btn btn-warning btn-sm" id="btn-auto-pick-slot" style="font-weight: 700; background: linear-gradient(135deg, #F59E0B, #D97706); color: #fff; border: none; box-shadow: 0 2px 6px rgba(245,158,11,0.35);">
                  🎲 สุ่มเลือกผู้คุมให้เลย
                </button>
              </div>

              <!-- กลุ่มที่ 1: ผู้คุมที่ว่างและผ่านเกณฑ์ (แนะนำ) -->
              <div>
                <div style="font-size: 13px; font-weight: 600; color: var(--text-color); margin-bottom: 6px;">
                  ✅ ผู้คุมที่ว่างและผ่านเกณฑ์ในรอบนี้ (${availableCandidates.length} คน)
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto;">
                  ${availableCandidates.map(c => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--bg-surface);">
                      <div>
                        <strong style="font-size: 13px;">${c.proctor.firstName} ${c.proctor.lastName}</strong>
                        <span class="badge badge-normal" style="font-size: 10px; margin-left: 4px;">${c.proctor.level === 'chief' ? 'Chief' : 'Assistant'}</span>
                        <div style="font-size: 11px; color: var(--text-muted);">${c.proctor.department}</div>
                        <div style="font-size: 11px; color: var(--primary-600); margin-top: 1px;">${c.reason}</div>
                      </div>
                      <button class="btn btn-primary btn-sm" data-action="confirm-assign" data-proctor-id="${c.proctor.id}">
                        เลือกเข้าตำแหน่ง
                      </button>
                    </div>
                  `).join('')}
                  ${availableCandidates.length === 0 ? '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 12px; background: var(--bg-surface); border-radius: var(--radius-md);">ไม่มีผู้คุมที่ว่างในรอบนี้ (เนื่องจากคุมห้องอื่นหรือโควต้าเต็ม) ท่านสามารถเลือกจากรายการด้านล่างเพื่อสลับตัวได้</div>' : ''}
                </div>
              </div>

              <!-- กลุ่มที่ 2: ผู้คุมคนอื่นในระบบ (สลับตัว/เลือกแทนได้) -->
              <div>
                <div style="font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">
                  🔄 ผู้คุมคนอื่นในระบบ (สลับห้อง หรือ เลือกแทนได้ - ${busyCandidates.length} คน)
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto;">
                  ${busyCandidates.map(c => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--bg-surface);">
                      <div>
                        <strong style="font-size: 13px;">${c.proctor.firstName} ${c.proctor.lastName}</strong>
                        <span class="badge ${c.assignedInSameSession ? 'badge-warning' : 'badge-danger'}" style="font-size: 10px; margin-left: 4px;">
                          ${c.assignedInSameSession ? `คุม: ${c.assignedRoomName}` : 'โควต้าเต็ม/ติดภารกิจ'}
                        </span>
                        <div style="font-size: 11px; color: var(--text-muted);">${c.proctor.department} | ${c.reason}</div>
                      </div>
                      <div style="display: flex; gap: 4px;">
                        ${c.assignedInSameSession && currentAssign ? `
                          <button class="btn btn-secondary btn-sm" data-action="confirm-assign" data-proctor-id="${c.proctor.id}" data-swap="true" title="สลับห้องระหว่างสองคนนี้">
                            🔄 สลับห้อง
                          </button>
                        ` : ''}
                        <button class="btn btn-secondary btn-sm" data-action="confirm-assign" data-proctor-id="${c.proctor.id}" data-swap="false" title="เลือกคนนี้มาคุมตำแหน่งนี้">
                          เลือกแทน
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-close-modal">ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeModal.type === 'sudden-leave') {
      return `
        <div class="modal-overlay">
          <div class="modal-content">
            <div class="modal-header">
              <div class="card-title">🔄 ขอสลับตัว / เปลี่ยนตัวผู้คุมสอบ & เสนอตัวแทน</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">เลือกรอบการสอบ</label>
                <select class="form-select" id="select-leave-session">
                  ${appState.sessions.map(s => `<option value="${s.id}">${s.name} (${formatThaiDate(s.date)})</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">เลือกผู้คุมที่ต้องการลา</label>
                <select class="form-select" id="select-leave-proctor">
                  ${appState.proctors.map(p => `<option value="${p.id}">${p.firstName} ${p.lastName} (${p.department})</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">เหตุผลการลา</label>
                <input type="text" class="form-input" id="input-leave-reason" placeholder="เช่น ป่วยกะทันหัน / ติดภารกิจด่วน">
              </div>

              <div style="border-top: 1px solid var(--border-subtle); padding-top: 14px;">
                <label class="form-label" style="margin-bottom: 6px;">ระบบเสนอตัวแทนเข้าปฏิบัติหน้าที่แทนทันที (เริ่มจากผู้คุมสำรอง):</label>
                <div id="substitute-candidates-box" style="display: flex; flex-direction: column; gap: 8px;">
                  <!-- จะเติม candidate ผ่าน JS -->
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Modal: แก้ไข/เพิ่ม ผู้เข้าสอบ
    if (this.activeModal.type === 'modal-master-examinees') {
      return renderExamineeModal(this.activeModal.data, appState, this);
    }

    // Modal: แก้ไข/เพิ่ม ผู้คุมสอบ
    if (this.activeModal.type === 'modal-master-proctors') {
      const p = this.activeModal.data || {};
      const isEdit = Boolean(p.id);
      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 640px; width: 95vw;">
            <div class="modal-header">
              <div class="card-title">${isEdit ? `✏️ แก้ไขข้อมูลผู้คุมสอบ (${p.id})` : '➕ เพิ่มผู้คุมสอบใหม่'}</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <form id="form-master-proctor">
              <input type="hidden" name="id" value="${p.id || ''}">
              <div class="modal-body" style="gap: 10px;">
                <!-- แถว 1: คำนำหน้า, ชื่อ, นามสกุล (3 คอลัมน์) -->
                <div style="display: grid; grid-template-columns: 1.1fr 1.5fr 1.5fr; gap: 10px;">
                  <div class="form-group">
                    <label class="form-label">คำนำหน้า / ตำแหน่ง</label>
                    <input type="text" class="form-input" name="academicTitle" value="${p.academicTitle || ''}" placeholder="เช่น ผศ.ดร. หรือ อาจารย์">
                  </div>
                  <div class="form-group">
                    <label class="form-label">ชื่อ <span style="color:var(--danger-500);">*</span></label>
                    <input type="text" class="form-input" name="firstName" value="${p.firstName || ''}" required placeholder="เช่น สมชาย">
                  </div>
                  <div class="form-group">
                    <label class="form-label">นามสกุล <span style="color:var(--danger-500);">*</span></label>
                    <input type="text" class="form-input" name="lastName" value="${p.lastName || ''}" required placeholder="เช่น สุขใจ">
                  </div>
                </div>

                <!-- แถว 2: ประเภทบุคลากร และ ระดับหน้าที่ -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div class="form-group">
                    <label class="form-label">ประเภทบุคลากร</label>
                    <select class="form-select" name="proctorType">
                      <option value="faculty" ${p.proctorType === 'faculty' ? 'selected' : ''}>อาจารย์ (Faculty)</option>
                      <option value="staff" ${p.proctorType === 'staff' ? 'selected' : ''}>เจ้าหน้าที่ (Staff)</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">ระดับหน้าที่</label>
                    <select class="form-select" name="level">
                      <option value="chief" ${p.level === 'chief' ? 'selected' : ''}>หัวหน้าห้องได้ (Chief Proctor)</option>
                      <option value="assistant" ${p.level === 'assistant' ? 'selected' : ''}>ผู้ช่วยผู้คุม (Assistant)</option>
                    </select>
                  </div>
                </div>

                <!-- แถว 3: สังกัด / คณะ และ เบอร์โทรศัพท์ -->
                <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 10px;">
                  <div class="form-group">
                    <label class="form-label">สังกัด / คณะ / สำนัก</label>
                    <input type="text" class="form-input" name="department" value="${p.department || 'ศูนย์คอมพิวเตอร์และอินเทอร์เน็ต'}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">เบอร์โทรศัพท์</label>
                    <input type="text" class="form-input" name="phone" value="${p.phone || ''}" placeholder="081-234-5678">
                  </div>
                </div>

                <!-- แถว 4: อีเมล และ รูปแบบกะ -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div class="form-group">
                    <label class="form-label">อีเมล</label>
                    <input type="email" class="form-input" name="email" value="${p.email || ''}" placeholder="example@bru.ac.th">
                  </div>
                  <div class="form-group">
                    <label class="form-label">รูปแบบกะที่ต้องการ (Session Pattern)</label>
                    <select class="form-select" name="sessionPattern">
                      <option value="FULL_DAY_PAIRED" ${p.sessionPattern === 'FULL_DAY_PAIRED' ? 'selected' : ''}>เช้า + บ่าย คู่กัน (FULL_DAY_PAIRED)</option>
                      <option value="SINGLE_PER_DAY" ${p.sessionPattern === 'SINGLE_PER_DAY' ? 'selected' : ''}>ขอคุมวันละ 1 รอบเท่านั้น (SINGLE_PER_DAY)</option>
                      <option value="ANY" ${p.sessionPattern === 'ANY' ? 'selected' : ''}>ยืดหยุ่น รอบใดก็ได้ (ANY)</option>
                    </select>
                  </div>
                </div>

                <!-- แถว 5: วันที่สะดวกปฏิบัติหน้าที่ -->
                <div style="background: var(--bg-surface-elevated, #f8fafc); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 8px 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 4px;">
                    <label class="form-label" style="font-weight: 600; margin: 0; font-size: 13px;">📅 วันที่สะดวกปฏิบัติหน้าที่ (Available Dates):</label>
                    <span style="font-size: 11px; color: var(--text-muted);">* สำหรับผู้ที่ขอคุมวันเดียว ให้เลือกเฉพาะวันนั้น ระบบจะล็อกไม่ให้จัดวันอื่น</span>
                  </div>
                  <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; background: var(--bg-surface); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                      <input type="checkbox" name="availableDates" value="2026-03-27" ${(!p.availableDates || p.availableDates.length === 0 || p.availableDates.includes('2026-03-27')) ? 'checked' : ''}>
                      <span>ศุกร์ 27 มี.ค. 2569</span>
                    </label>
                    <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; background: var(--bg-surface); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                      <input type="checkbox" name="availableDates" value="2026-03-28" ${(!p.availableDates || p.availableDates.length === 0 || p.availableDates.includes('2026-03-28')) ? 'checked' : ''}>
                      <span>เสาร์ 28 มี.ค. 2569</span>
                    </label>
                    <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; background: var(--bg-surface); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                      <input type="checkbox" name="availableDates" value="2026-03-29" ${(!p.availableDates || p.availableDates.length === 0 || p.availableDates.includes('2026-03-29')) ? 'checked' : ''}>
                      <span>อาทิตย์ 29 มี.ค. 2569</span>
                    </label>
                  </div>
                </div>

                <!-- แถว 6: โควต้า และ สถานะพร้อมใช้งาน -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 10px; align-items: end; border-top: 1px solid var(--border-subtle); padding-top: 10px;">
                  <div class="form-group">
                    <label class="form-label">โควต้า/วัน (รอบ)</label>
                    <input type="number" class="form-input" name="dailyQuota" min="1" max="5" value="${p.dailyQuota ?? 2}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">โควต้าโครงการ (รอบ)</label>
                    <select class="form-select" name="projectQuota" required>
                      ${[1, 2, 3, 4, 5, 6].map(q => `
                        <option value="${q}" ${p.projectQuota === q ? 'selected' : ''}>${q} รอบ ${q === 6 ? '(เต็ม 3 วัน)' : ''}</option>
                      `).join('')}
                      <option value="0" ${p.projectQuota === 0 ? 'selected' : ''}>0 รอบ (งดรับงาน)</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">ชั่วโมงสูงสุด</label>
                    <input type="number" class="form-input" name="maxHours" min="1" max="50" step="0.5" value="${p.maxHours ?? 18}" required>
                  </div>
                  <div class="form-group" style="padding-bottom: 8px;">
                    <label class="form-label" style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; margin: 0; white-space: nowrap;">
                      <input type="checkbox" name="isActive" value="1" ${p.isActive !== false ? 'checked' : ''}>
                      <span>พร้อมปฏิบัติหน้าที่ (Active)</span>
                    </label>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-modal">ยกเลิก</button>
                <button type="submit" class="btn btn-primary btn-sm">💾 บันทึกข้อมูลผู้คุม</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Modal: แก้ไข/เพิ่ม ห้องสอบ
    if (this.activeModal.type === 'modal-master-rooms') {
      const r = this.activeModal.data || {};
      const isEdit = Boolean(r.id);
      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 520px;">
            <div class="modal-header">
              <div class="card-title">${isEdit ? `✏️ แก้ไขข้อมูลห้องสอบ (${r.id})` : '➕ เพิ่มห้องสอบใหม่'}</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <form id="form-master-room">
              <input type="hidden" name="id" value="${r.id || ''}">
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label">ชื่อห้องสอบ <span style="color:var(--danger-500);">*</span></label>
                  <input type="text" class="form-input" name="name" value="${r.name || ''}" required placeholder="เช่น ห้องปฏิบัติการคอมพิวเตอร์ LAB 1">
                </div>

                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label class="form-label">อาคาร</label>
                    <input type="text" class="form-input" name="building" value="${r.building || 'อาคารปฏิบัติการ'}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">ชั้น</label>
                    <input type="number" class="form-input" name="floor" min="1" max="20" value="${r.floor ?? 1}" required>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label class="form-label">ความจุเครื่องคอมพิวเตอร์ <span style="color:var(--danger-500);">*</span></label>
                    <input type="number" class="form-input" name="capacity" min="5" max="200" value="${r.capacity ?? 35}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">ประเภทห้อง</label>
                    <select class="form-select" name="roomType">
                      <option value="computer" ${r.roomType === 'computer' || !r.roomType ? 'selected' : ''}>💻 ห้องคอมพิวเตอร์ (CBT)</option>
                      <option value="normal" ${r.roomType === 'normal' ? 'selected' : ''}>ห้องปกติ</option>
                    </select>
                  </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--border-subtle); padding-top: 12px;">
                  <label class="form-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" name="accessibleForDisabled" value="1" ${r.accessibleForDisabled ? 'checked' : ''}>
                    <span>♿ รองรับผู้พิการ (ทางลาด/ลิฟต์)</span>
                  </label>
                  <label class="form-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" name="isActive" value="1" ${r.isActive !== false ? 'checked' : ''}>
                    <span>สถานะพร้อมใช้งาน (Active)</span>
                  </label>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-modal">ยกเลิก</button>
                <button type="submit" class="btn btn-primary btn-sm">💾 บันทึกข้อมูลห้อง</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Modal: แก้ไข/เพิ่ม รอบการสอบ
    if (this.activeModal.type === 'modal-master-sessions') {
      const s = this.activeModal.data || {};
      const isEdit = Boolean(s.id);
      let startTimeStr = '09:00';
      let endTimeStr = '12:00';
      if (s.startTime) {
        const m = s.startTime.match(/T(\d{2}:\d{2})/);
        if (m) startTimeStr = m[1];
      }
      if (s.endTime) {
        const m = s.endTime.match(/T(\d{2}:\d{2})/);
        if (m) endTimeStr = m[1];
      }

      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 540px;">
            <div class="modal-header">
              <div class="card-title">${isEdit ? `✏️ แก้ไขรอบการสอบ (${s.id})` : '➕ เพิ่มรอบการสอบใหม่'}</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <form id="form-master-session">
              <input type="hidden" name="id" value="${s.id || ''}">
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label">ชื่อรอบ / วิชาการสอบ <span style="color:var(--danger-500);">*</span></label>
                  <input type="text" class="form-input" name="name" value="${s.name || ''}" required placeholder="เช่น การทดสอบวัดความรู้เฉพาะทาง รอบเช้า">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label class="form-label">วันที่สอบ</label>
                    <input type="date" class="form-input" name="date" value="${s.date || '2026-10-24'}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">เวลาเริ่มสอบ</label>
                    <input type="time" class="form-input" name="startTime" value="${startTimeStr}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">เวลาเสร็จสิ้น</label>
                    <input type="time" class="form-input" name="endTime" value="${endTimeStr}" required>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label class="form-label">เวลาเตรียมห้องก่อนสอบ (นาที)</label>
                    <input type="number" class="form-input" name="prepMinutes" min="0" max="120" value="${s.prepMinutes ?? 30}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">เวลาสรุปงานหลังสอบ (นาที)</label>
                    <input type="number" class="form-input" name="wrapMinutes" min="0" max="120" value="${s.wrapMinutes ?? 15}" required>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">หน่วยงานเจ้าของข้อสอบ / ผู้จัด</label>
                  <input type="text" class="form-input" name="organization" value="${s.organization || 'ศูนย์สอบมหาวิทยาลัย'}" required>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-modal">ยกเลิก</button>
                <button type="submit" class="btn btn-primary btn-sm">💾 บันทึกรอบการสอบ</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Modal: แก้ไข/เพิ่ม ช่วงเวลาไม่ว่าง
    if (this.activeModal.type === 'modal-master-unavail') {
      const u = this.activeModal.data || {};
      const isEdit = Boolean(u.id);
      let dateStr = '2026-10-24';
      let startTimeStr = '08:00';
      let endTimeStr = '12:00';
      if (u.startTime) {
        const parts = u.startTime.split('T');
        if (parts[0]) dateStr = parts[0];
        if (parts[1]) startTimeStr = parts[1].substring(0, 5);
      }
      if (u.endTime) {
        const parts = u.endTime.split('T');
        if (parts[1]) endTimeStr = parts[1].substring(0, 5);
      }

      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
              <div class="card-title">${isEdit ? '✏️ แก้ไขช่วงเวลาไม่ว่าง' : '➕ บันทึกช่วงเวลาไม่ว่างของผู้คุม'}</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <form id="form-master-unavail">
              <input type="hidden" name="id" value="${u.id || ''}">
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label">ผู้คุมสอบ <span style="color:var(--danger-500);">*</span></label>
                  <select class="form-select" name="proctorId" required>
                    ${appState.proctors.map(p => `
                      <option value="${p.id}" ${u.proctorId === p.id ? 'selected' : ''}>
                        ${p.id} - ${p.firstName} ${p.lastName} (${p.department})
                      </option>
                    `).join('')}
                  </select>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label class="form-label">วันที่ไม่ว่าง</label>
                    <input type="date" class="form-input" name="date" value="${dateStr}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">ตั้งแต่เวลา</label>
                    <input type="time" class="form-input" name="startTime" value="${startTimeStr}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">ถึงเวลา</label>
                    <input type="time" class="form-input" name="endTime" value="${endTimeStr}" required>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">เหตุผลความจำเป็น</label>
                  <input type="text" class="form-input" name="reason" value="${u.reason || ''}" placeholder="เช่น ติดสอน / ติดราชการ / ลาป่วย">
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-modal">ยกเลิก</button>
                <button type="submit" class="btn btn-primary btn-sm">💾 บันทึกช่วงเวลา</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Modal: สลับบทบาท / เข้าสู่ระบบ (User & Role Switcher)
    if (this.activeModal.type === 'switch-user') {
      const accounts = appState.getAvailableAccounts();
      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 680px;">
            <div class="modal-header">
              <div>
                <div class="card-title" style="display: flex; align-items: center; gap: 8px;">
                  <span>🔑</span> เข้าสู่ระบบ / สลับบัญชีผู้ใช้งาน
                </div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                  เลือกว่าต้องการใช้งานในฐานะ Admin หรือ อาจารย์ หรือ ผู้คุมสอบ เพื่อทดสอบระบบได้ทันที
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
              <!-- บทบาทที่ 1: แอดมิน (Admin) -->
              <div style="border: 2px solid var(--accent-500); background: linear-gradient(135deg, var(--bg-surface), var(--accent-50)); padding: 16px; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 22px;">👑</span>
                    <strong style="font-size: 16px;">ผู้ดูแลระบบ (Admin)</strong>
                    <span class="role-tag admin">สิทธิ์เต็ม 100%</span>
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                    สิทธิ์เต็ม: แก้ไขผู้คุม, แก้เวลาสอบ, แก้ห้องสอบ CBT, แก้ตาราง, ล้างตาราง, สลับคน, ตั้งค่ากฎเกณฑ์
                  </div>
                </div>
                <button class="btn btn-accent" data-action="confirm-switch-user" data-user-id="admin">
                  เข้าสู่ระบบเป็น Admin
                </button>
              </div>

              <!-- บทบาทที่ 2: อาจารย์ (Teachers / Faculty) -->
              <div>
                <div style="font-size: 14px; font-weight: 700; color: var(--primary-600); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                  <span>👨‍🏫</span> อาจารย์ (Faculty Proctors)
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
                  ${accounts.teachers.map(t => `
                    <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 12px; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <strong>${t.name}</strong>
                        <div style="font-size: 11px; color: var(--text-muted);">${t.department} (${t.id})</div>
                      </div>
                      <button class="btn btn-primary btn-sm" data-action="confirm-switch-user" data-user-id="${t.id}">
                        เข้าสู่ระบบ
                      </button>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- บทบาทที่ 3: ผู้คุมสอบทั่วไป/เจ้าหน้าที่ (Staff Proctors) -->
              <div>
                <div style="font-size: 14px; font-weight: 700; color: var(--text-main); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                  <span>👤</span> เจ้าหน้าที่คุมสอบ (Staff Proctors)
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
                  ${accounts.staff.map(s => `
                    <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 12px; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <strong>${s.name}</strong>
                        <div style="font-size: 11px; color: var(--text-muted);">${s.department} (${s.id})</div>
                      </div>
                      <button class="btn btn-secondary btn-sm" data-action="confirm-switch-user" data-user-id="${s.id}">
                        เข้าสู่ระบบ
                      </button>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- หรือเลือกจากผู้คุมสอบคนอื่นในระบบ -->
              <div style="border-top: 1px solid var(--border-subtle); padding-top: 12px;">
                <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">
                  หรือเลือกบัญชีผู้คุมสอบคนอื่นในระบบ (${appState.proctors.length} คน):
                </div>
                <div style="display: flex; gap: 8px;">
                  <select class="form-select" id="select-any-proctor-user" style="flex: 1;">
                    ${appState.proctors.filter(p => p.isActive).map(p => `
                      <option value="${p.id}" ${appState.currentUser?.proctorId === p.id ? 'selected' : ''}>
                        ${p.id}: ${p.firstName} ${p.lastName} (${p.department}) - ${p.proctorType === 'faculty' ? 'อาจารย์' : 'เจ้าหน้าที่'}
                      </option>
                    `).join('')}
                  </select>
                  <button class="btn btn-secondary btn-sm" id="btn-select-custom-proctor">เข้าสู่ระบบ</button>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-close-modal">ปิด</button>
            </div>
          </div>
        </div>
      `;
    }

    // Modal: แก้ไขข้อมูลส่วนตัวและความพร้อมของผู้คุม/อาจารย์เอง
    if (this.activeModal.type === 'edit-my-profile') {
      const p = appState.getLoggedInProctor();
      if (!p) return '';
      const allExamDates = Array.from(new Set(appState.sessions.map(s => s.date))).sort();
      const pDates = p.availableDates || [];

      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 600px; width: 95vw;">
            <div class="modal-header">
              <div class="card-title">✏️ แก้ไขข้อมูลส่วนตัว & โควต้าของฉัน (${p.id})</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <form id="form-edit-my-profile">
              <input type="hidden" name="id" value="${p.id}">
              <div class="modal-body" style="gap: 12px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label class="form-label">ชื่อ <span style="color:var(--danger-500);">*</span></label>
                    <input type="text" class="form-input" name="firstName" value="${p.firstName}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">นามสกุล <span style="color:var(--danger-500);">*</span></label>
                    <input type="text" class="form-input" name="lastName" value="${p.lastName}" required>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">สังกัด / คณะ / สำนัก</label>
                  <input type="text" class="form-input" name="department" value="${p.department}" required>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label class="form-label">เบอร์โทรศัพท์ติดต่อ</label>
                    <input type="text" class="form-input" name="phone" value="${p.phone}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">อีเมล</label>
                    <input type="email" class="form-input" name="email" value="${p.email}" required>
                  </div>
                </div>

                <!-- วันที่สะดวกปฏิบัติหน้าที่ -->
                <div style="background: var(--bg-surface-elevated, #f8fafc); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 10px 14px;">
                  <label class="form-label" style="font-weight: 700; margin-bottom: 6px; font-size: 13px;">📅 วันที่สะดวกปฏิบัติหน้าที่ (Available Dates):</label>
                  <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    ${allExamDates.map(dStr => {
                      const isChecked = pDates.length === 0 || pDates.includes(dStr);
                      return `
                        <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; background: var(--bg-surface); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                          <input type="checkbox" name="availableDates" value="${dStr}" ${isChecked ? 'checked' : ''} style="accent-color: var(--primary-600);">
                          <span>${formatThaiDate(dStr)}</span>
                        </label>
                      `;
                    }).join('')}
                  </div>
                </div>

                <!-- รูปแบบกะที่ต้องการ -->
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">รูปแบบกะที่ต้องการ (Session Pattern)</label>
                  <select class="form-select" name="sessionPattern">
                    <option value="FULL_DAY_PAIRED" ${p.sessionPattern === 'FULL_DAY_PAIRED' ? 'selected' : ''}>เช้า + บ่าย คู่กัน (FULL_DAY_PAIRED) - แนะนำ</option>
                    <option value="SINGLE_PER_DAY" ${p.sessionPattern === 'SINGLE_PER_DAY' ? 'selected' : ''}>ขอคุมวันละ 1 รอบเท่านั้น (SINGLE_PER_DAY)</option>
                    <option value="ANY" ${p.sessionPattern === 'ANY' ? 'selected' : ''}>ยืดหยุ่น รอบใดก็ได้ (ANY)</option>
                  </select>
                </div>

                <!-- โควต้าคุมสอบ -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; border-top: 1px solid var(--border-subtle); padding-top: 10px;">
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700; font-size: 12px;">โควต้า/วัน (รอบ)</label>
                    <input type="number" class="form-input" name="dailyQuota" min="1" max="2" value="${p.dailyQuota ?? 2}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700; font-size: 12px;">โควต้าโครงการ (รอบ)</label>
                    <select class="form-select" name="projectQuota" required>
                      ${[1, 2, 3, 4, 5, 6].map(q => `
                        <option value="${q}" ${p.projectQuota === q ? 'selected' : ''}>${q} รอบ ${q === 6 ? '(เต็ม 3 วัน)' : ''}</option>
                      `).join('')}
                      <option value="0" ${p.projectQuota === 0 ? 'selected' : ''}>0 รอบ (งดรับงาน)</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700; font-size: 12px;">ชั่วโมงสูงสุด</label>
                    <input type="number" class="form-input" name="maxHours" min="1" max="50" step="0.5" value="${p.maxHours ?? 18}" required>
                  </div>
                </div>

                <div style="display: flex; gap: 14px; flex-wrap: wrap; margin-top: 4px;">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px;">
                    <input type="checkbox" name="keepSameRoom" value="1" ${p.keepSameRoom !== false ? 'checked' : ''} style="accent-color: var(--primary-600);">
                    <span>ขอประจำห้องเดิมตลอดวัน</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px;">
                    <input type="checkbox" name="isActive" value="1" ${p.isActive !== false ? 'checked' : ''} style="accent-color: var(--success-600);">
                    <span>พร้อมปฏิบัติงาน (Active)</span>
                  </label>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-close-modal">ยกเลิก</button>
                <button type="submit" class="btn btn-primary btn-sm">💾 บันทึกข้อมูลส่วนตัว & โควต้า</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Modal: เพิ่มห้องสอบ CBT ในรอบ (Admin Only)
    if (this.activeModal.type === 'modal-add-room-session') {
      const sessionId = this.activeModal.data?.sessionId;
      const session = appState.sessions.find(s => s.id === sessionId);
      const usedRoomIds = new Set(appState.allocations.filter(a => a.sessionId === sessionId).map(a => a.roomId));
      const availableRooms = appState.rooms.filter(r => r.isActive && !usedRoomIds.has(r.id));

      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
              <div class="card-title">➕ เพิ่มห้องสอบ CBT ในรอบ (${sessionId})</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <form id="form-add-room-session">
              <input type="hidden" name="sessionId" value="${sessionId}">
              <div class="modal-body">
                <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">
                  รอบสอบ: <strong>${session ? session.name : sessionId}</strong>
                </div>

                <div class="form-group">
                  <label class="form-label">เลือกห้องปฏิบัติการคอมพิวเตอร์ที่ว่างในรอบนี้</label>
                  <select class="form-select" name="roomId" required>
                    ${availableRooms.map(r => `
                      <option value="${r.id}">
                        💻 ${r.name} (${r.building} ชั้น ${r.floor}) - จุ ${r.capacity} เครื่อง
                      </option>
                    `).join('')}
                    ${availableRooms.length === 0 ? '<option disabled>ไม่มีห้องว่างเหลือในรอบนี้</option>' : ''}
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">จำนวนผู้เข้าสอบในห้องนี้ (คน)</label>
                  <input type="number" class="form-input" name="examinees" min="1" max="100" value="30" required>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-close-modal">ยกเลิก</button>
                <button type="submit" class="btn btn-primary btn-sm" ${availableRooms.length === 0 ? 'disabled' : ''}>➕ เพิ่มห้องนี้</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Modal: ปรับจำนวนผู้เข้าสอบ / ห้องสอบ (Admin Only)
    if (this.activeModal.type === 'modal-edit-alloc') {
      const allocId = this.activeModal.data?.allocId;
      const alloc = appState.allocations.find(a => a.id === allocId);

      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 480px;">
            <div class="modal-header">
              <div class="card-title">✏️ ปรับจำนวนผู้สอบ / ห้อง (${alloc?.roomId})</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <form id="form-edit-alloc">
              <input type="hidden" name="allocId" value="${allocId}">
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label">ห้องสอบ</label>
                  <select class="form-select" name="roomId">
                    ${appState.rooms.filter(r => r.isActive).map(r => `
                      <option value="${r.id}" ${r.id === alloc?.roomId ? 'selected' : ''}>
                        💻 ${r.name} (${r.building} ชั้น ${r.floor}) - จุ ${r.capacity} เครื่อง
                      </option>
                    `).join('')}
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">จำนวนผู้เข้าสอบในห้อง (คน)</label>
                  <input type="number" class="form-input" name="examinees" min="1" max="100" value="${alloc?.examineesInRoom || 30}" required>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                    * หากเกิน ${appState.settings.hardConstraints.h5_examinee_threshold_for_two_proctors} คน ระบบจะจัดผู้คุม 2 คนอัตโนมัติ
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-close-modal">ยกเลิก</button>
                <button type="submit" class="btn btn-primary btn-sm">💾 บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Modal: เพิ่มช่วงเวลาไม่ว่างส่วนตัว (My Unavailability)
    if (this.activeModal.type === 'modal-add-my-unavail') {
      const proctor = appState.getLoggedInProctor();
      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
              <div class="card-title">⏳ แจ้งวัน-เวลาที่ไม่สะดวกคุมสอบ</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <form id="form-add-my-unavail">
              <input type="hidden" name="proctorId" value="${proctor ? proctor.id : ''}">
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label">วันที่ติดภารกิจ</label>
                  <input type="date" class="form-input" name="date" value="2026-10-24" required>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label class="form-label">ตั้งแต่เวลา</label>
                    <input type="time" class="form-input" name="startTime" value="08:00" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">ถึงเวลา</label>
                    <input type="time" class="form-input" name="endTime" value="12:00" required>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">เหตุผล / ภารกิจ</label>
                  <input type="text" class="form-input" name="reason" placeholder="เช่น ติดสอนวิชาสัมมนา, ติดราชการต่างจังหวัด" required>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-close-modal">ยกเลิก</button>
                <button type="submit" class="btn btn-primary btn-sm">💾 บันทึกช่วงไม่สะดวก</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // Modal: เลือกลักษณะเอกสาร PDF (เฉพาะบุคคล หรือ รวมทุกห้อง)
    if (this.activeModal.type === 'choose-pdf-type') {
      const proctor = this.activeModal.proctor;
      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 520px;">
            <div class="modal-header">
              <div class="card-title">🖨️ เลือกรูปแบบเอกสาร PDF ที่ต้องการพิมพ์</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
              <div style="font-size: 13px; color: var(--text-muted);">
                ผู้ใช้งานปัจจุบัน: <strong style="color: var(--text-main);">${proctor.firstName} ${proctor.lastName}</strong>
              </div>

              <!-- ทางเลือกที่ 1: ตารางคุมสอบของฉัน -->
              <div style="padding: 16px; border: 2px solid var(--primary-300); background: var(--bg-surface-elevated); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <strong style="font-size: 15px; color: var(--primary-700);">📄 ตารางและใบแจ้งปฏิบัติหน้าที่ของฉัน</strong>
                  <button class="btn btn-primary btn-sm" id="btn-do-print-personal">
                    พิมพ์เอกสารนี้
                  </button>
                </div>
                <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">
                  แสดงเฉพาะชื่อของคุณ พร้อมรายการห้องสอบ วันเวลา และบทบาทหน้าที่ที่คุณต้องไปปฏิบัติงานคุมสอบ (สำหรับพกติดตัวหรือเซ็นรับรอง)
                </div>
              </div>

              <!-- ทางเลือกที่ 2: ใบลงนามรวมทุกห้องสอบ (ของส่วนกลาง) -->
              <div style="padding: 16px; border: 1px solid var(--border-subtle); background: var(--bg-surface); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <strong style="font-size: 15px; color: var(--text-main);">📑 ใบลงนามประจำห้องสอบทั้งหมด (ของศูนย์สอบ)</strong>
                  <button class="btn btn-secondary btn-sm" id="btn-do-print-all-rooms">
                    พิมพ์เอกสารนี้
                  </button>
                </div>
                <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">
                  เอกสารชุดใหญ่สำหรับศูนย์สอบ (1 หน้า = 1 ห้องสอบ) เพื่อนำไปวางหน้าห้องสอบ โดยหน้าแรกจะเป็นห้องที่ 1 ของรอบแรก (ซึ่งแสดงชื่อกรรมการประจำห้องนั้น)
                </div>
              </div>

              <!-- ทางเลือกที่ 3: ชุดป้ายติดบอร์ดหน้าห้องสอบ & ผังที่นั่ง (สำนักงาน ก.พ.) -->
              <div style="padding: 16px; border: 2px solid var(--accent-300); background: var(--accent-50); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <strong style="font-size: 15px; color: var(--accent-700);">🪧 ชุดป้ายติดบอร์ดหน้าห้องสอบ & ผังที่นั่ง (สนามสอบ ก.พ.)</strong>
                  <button class="btn btn-accent btn-sm" id="btn-do-print-door-signs" style="font-weight: 700;">
                    พิมพ์เอกสารนี้
                  </button>
                </div>
                <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">
                  ชุดป้ายติดบอร์ดหน้าห้องสอบจริง (ป้ายหัวห้องสอบตัวโต, แผนผังห้องสอบแสดงเลขที่นั่ง 1-520, ป้ายห้ามนำเข้า และป้ายสิ่งที่อนุญาต สำนักงาน ก.พ.)
                </div>
              </div>

              <!-- ทางเลือกที่ 4: คำสั่งแต่งตั้งคณะกรรมการกำกับการสอบ (ก.พ.) ฉบับทางการตราครุฑ -->
              <div style="padding: 16px; border: 2px solid var(--primary-300); background: var(--bg-surface-elevated); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <strong style="font-size: 15px; color: var(--primary-700);">📜 คำสั่งแต่งตั้งคณะกรรมการคุมสอบ (ก.พ.)</strong>
                  <button class="btn btn-primary btn-sm" id="btn-do-print-appointment-order" style="font-weight: 700;">
                    พิมพ์เอกสารนี้
                  </button>
                </div>
                <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">
                  คำสั่งมหาวิทยาลัยราชภัฏบุรีรัมย์ ฉบับทางการตราครุฑ พร้อมตารางรายชื่ออาจารย์คุมสอบแยกตามวันและห้องสอบ CBT อาคาร 17
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      `;
    }

    // Modal: ดูผังที่นั่งสอบจริง (Seating Plan Chart)
    if (this.activeModal.type === 'modal-non-exam-room') {
      return renderNonExamRoomModal(this.activeModal);
    }

    if (this.activeModal.type === 'modal-room-detail' || this.activeModal.type === 'modal-seating-plan') {
      return this.renderRoomDetailModal(this.activeModal.room);
    }

    // Modal: สัญญาอนุญาต Open Source (MIT License)
    if (this.activeModal.type === 'modal-license') {
      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 620px;">
            <div class="modal-header">
              <div class="card-title">🌐 สัญญาอนุญาต Open Source (MIT License)</div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
            </div>
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
              <div style="background: var(--bg-surface-elevated); padding: 14px; border-radius: var(--radius-md); border-left: 4px solid var(--accent-500);">
                <strong style="color: var(--primary-700); font-size: 14px;">📜 MIT License — Open Source 100%</strong>
                <p style="font-size: 13px; color: var(--text-color); margin: 6px 0 0 0; line-height: 1.5;">
                  ระบบจัดตารางผู้คุมสอบนี้เป็นซอฟต์แวร์เสรีและเปิดเผยรหัสต้นฉบับ (Open Source) ภายใต้ใบอนุญาตสากล <strong>MIT License</strong> สามารถนำไปใช้งาน, คัดลอก, ปรับแต่ง หรือต่อยอดในสถาบันการศึกษาและหน่วยงานต่าง ๆ ได้อย่างอิสระ
                </p>
              </div>

              <div>
                <strong style="font-size: 13px;">🔒 การรับประกันความเป็นส่วนตัวระดับสูงสุด (Local-First):</strong>
                <ul style="font-size: 12px; color: var(--text-muted); margin: 4px 0 0 16px; line-height: 1.5;">
                  <li>ระบบทำงานบนเบราว์เซอร์ของคุณ 100% (Client-Side Only)</li>
                  <li>ข้อมูลส่วนบุคคลผู้คุมสอบ (PDPA), ตารางสอบ และคะแนน จะไม่ถูกส่งออกไปยังเซิร์ฟเวอร์ภายนอก</li>
                  <li>ทำงานแบบ Standalone เปิดผ่านไฟล์ index.html หรือ start.bat ได้ทันทีโดยไม่ต้องเชื่อมต่ออินเทอร์เน็ต</li>
                </ul>
              </div>

              <div style="background: var(--bg-surface); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); font-family: monospace; font-size: 11px; color: var(--text-muted); max-height: 110px; overflow-y: auto;">
Copyright (c) 2026 Exam Proctor Scheduler Contributors<br><br>
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software...
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-primary btn-sm" id="btn-close-modal">รับทราบและปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      `;
    }

    // Modal: KPI 1 - ข้อมูลห้องปฏิบัติการคอมพิวเตอร์ (CBT)
    if (this.activeModal.type === 'modal-kpi-rooms') {
      return renderKpiRoomsModal(appState);
    }

    // Modal: KPI 2 - ข้อมูลผู้คุมสอบในระบบ
    if (this.activeModal.type === 'modal-kpi-proctors') {
      return renderKpiProctorsModal(appState);
    }

    // Modal: ใบเซ็นสลับ/เปลี่ยนตัวผู้คุมสอบ (จาก ผศ.ดร.ณัฐพล แสนคำ)
    if (this.activeModal.type === 'swap-document') {
      const mData = this.activeModal.data || {};
      const isHistory = mData.mode === 'history';
      const historyList = appState.swapDocHistory || [];
      const activeHistoryDoc = isHistory
        ? (historyList.find(d => d.id === mData.docId) || mData.doc || historyList[0] || null)
        : null;
      const swaps = isHistory ? (activeHistoryDoc?.swaps || []) : (appState.pendingSwaps || []);
      const docNumber = isHistory
        ? (activeHistoryDoc?.docNumber || 'บส. 001/2569')
        : (appState.swapDocIssued && historyList[0]?.docNumber
          ? historyList[0].docNumber
          : appState.getNextSwapDocNumber());
      const issuedDate = isHistory ? activeHistoryDoc?.issuedAt : new Date().toISOString();
      const note = mData.note !== undefined ? mData.note : (isHistory ? (activeHistoryDoc?.note || '') : '');
      const alreadyIssued = isHistory || Boolean(appState.swapDocIssued);
      const swapTypeText = (t) => t === 'SWAP' ? 'สลับตัว' : (t === 'MOVE' ? 'ย้ายตำแหน่ง' : 'เปลี่ยนตัว');

      return `
        <div class="modal-overlay">
          <div class="modal-content" style="max-width: 900px;">
            <div class="modal-header">
              <div>
                <div class="card-title" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span>📄 เอกสารขออนุมัติเปลี่ยนตัว / สลับหน้าที่ผู้คุมสอบ</span>
                  <span class="badge ${alreadyIssued ? 'badge-normal' : 'badge-warning'}">
                    ${isHistory ? `ประวัติเอกสาร (${docNumber})` : (alreadyIssued ? `ส่งตรวจแล้ว (${docNumber})` : `รอส่งตรวจ (${swaps.length} รายการ)`)}
                  </span>
                </div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px;">
                  เสนอขออนุมัติต่อ: <strong>ผศ.ดร.ณัฐพล แสนคำ</strong> (ผู้ช่วยศาสตราจารย์ ดร.ณัฐพล แสนคำ — ผู้อนุมัติ)
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal" type="button">✕</button>
            </div>

            <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px; max-height: 70vh; overflow-y: auto;">
              ${!isHistory ? `
                <!-- แผงจัดการรายการในใบสลับตัว (เอาออกทีละรายการหรือล้างทั้งหมด กรณีทดสอบ/สลับผิด) -->
                <div class="swap-manage-panel">
                  <div class="swap-manage-header">
                    <div>
                      <strong>📋 รายการในใบสลับตัว (${swaps.length} รายการ)</strong>
                      <div style="font-size: 11.5px; color: var(--text-muted);">
                        กรณีทดสอบหรือสลับผิด สามารถกดเอาออกทีละรายการ หรือล้างใบสลับทั้งหมดได้
                      </div>
                    </div>
                    ${swaps.length > 0 ? `
                      <button class="btn btn-ghost btn-sm swap-clear-btn" id="btn-clear-pending-swaps-modal" type="button">
                        🗑️ ล้างใบสลับทั้งหมด
                      </button>
                    ` : ''}
                  </div>
                  ${swaps.length > 0 ? `
                    <div class="swap-manage-list">
                      ${swaps.map((sw, i) => `
                        <div class="swap-manage-item">
                          <div class="swap-manage-item-text">
                            <span class="swap-manage-index">${i + 1}.</span>
                            <span class="badge badge-normal" style="font-size: 10.5px; padding: 1px 6px;">${swapTypeText(sw.type)}</span>
                            <span>
                              <strong>${sw.sessionId || ''}</strong>:
                              ${sw.type === 'SWAP'
                                ? `${sw.fromProctorName} ⇄ ${sw.toProctorName}`
                                : (sw.type === 'MOVE'
                                  ? `${sw.fromProctorName} (${sw.fromRoomLabel} → ${sw.toRoomLabel})`
                                  : `${sw.fromProctorName} → ${sw.toProctorName}`)}
                            </span>
                          </div>
                          <button
                            class="btn btn-ghost btn-sm swap-remove-item-btn"
                            type="button"
                            data-action="remove-pending-swap"
                            data-swap-id="${sw.id}"
                            title="เอารายการนี้ออกจากใบสลับตัว"
                          >
                            ✕ เอาออก
                          </button>
                        </div>
                      `).join('')}
                    </div>
                  ` : `
                    <div style="font-size: 12.5px; color: var(--text-muted); padding: 8px 0;">ไม่มีรายการสลับตัวค้างอยู่แล้ว</div>
                  `}
                </div>

                <div class="swap-doc-modal-note-bar">
                  <label for="input-swap-doc-note" style="font-size: 12.5px; font-weight: 700; color: var(--brand-purple); display: block; margin-bottom: 4px;">
                    หมายเหตุ / เหตุผลประกอบในบันทึกข้อความ (แก้ไขได้ก่อนพิมพ์หรือส่งตรวจ):
                  </label>
                  <input
                    type="text"
                    id="input-swap-doc-note"
                    class="form-input"
                    value="${String(note).replace(/"/g, '&quot;')}"
                    placeholder="เช่น เพื่อความเหมาะสมและสอดคล้องกับภารกิจของกรรมการกำกับการสอบ..."
                  >
                </div>
              ` : `
                <!-- แถบเลือกดู / ลบประวัติเอกสารใบเซ็นสลับ -->
                <div class="swap-manage-panel">
                  <div class="swap-manage-header">
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; flex: 1;">
                      <strong style="font-size: 13px;">📚 ประวัติใบเซ็นสลับ (${historyList.length} ฉบับ):</strong>
                      ${historyList.length > 0 ? `
                        <select id="select-swap-doc-history" class="form-select" style="max-width: 320px; padding: 5px 10px; font-size: 12.5px;">
                          ${historyList.map(d => `
                            <option value="${d.id}" ${activeHistoryDoc && d.id === activeHistoryDoc.id ? 'selected' : ''}>
                              ${d.docNumber} — ${d.swaps?.length || 0} รายการ (${formatThaiDate((d.issuedAt || '').slice(0, 10))})
                            </option>
                          `).join('')}
                        </select>
                      ` : ''}
                    </div>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                      ${activeHistoryDoc ? `
                        <button class="btn btn-ghost btn-sm swap-clear-btn" id="btn-delete-swap-doc-history" data-doc-id="${activeHistoryDoc.id}" type="button" title="ลบเอกสารใบเซ็นสลับฉบับนี้ออกจากประวัติ">
                          🗑️ ลบฉบับนี้
                        </button>
                      ` : ''}
                      ${historyList.length > 1 ? `
                        <button class="btn btn-ghost btn-sm swap-clear-btn" id="btn-clear-swap-doc-history" type="button" title="ล้างประวัติเอกสารใบเซ็นสลับทั้งหมด (กรณีทดสอบ)">
                          ล้างประวัติทั้งหมด
                        </button>
                      ` : ''}
                    </div>
                  </div>
                </div>
              `}

              <div class="swap-doc-preview-frame" id="swap-doc-preview-inner">
                ${renderSwapMemoDocumentHtml({
                  swaps,
                  docNumber,
                  issuedDate,
                  note,
                  settings: appState.settings
                })}
              </div>
            </div>

            <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              <button class="btn btn-secondary btn-sm" id="btn-print-swap-memo" type="button" ${swaps.length === 0 ? 'disabled' : ''}>
                🖨️ พิมพ์ / บันทึก PDF ใบเซ็นสลับ
              </button>
              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <button class="btn btn-secondary btn-sm" id="btn-close-modal" type="button">ปิดหน้าต่าง</button>
                ${!isHistory && swaps.length > 0 ? (alreadyIssued ? `
                  <button class="btn btn-primary btn-sm" id="btn-close-modal-ready" type="button">
                    ✅ ส่งตรวจแล้ว — กลับไปกดยืนยันตาราง
                  </button>
                ` : `
                  <button class="btn btn-accent btn-sm" id="btn-mark-swap-doc-issued" type="button">
                    ✅ ยืนยันส่งใบเซ็นสลับให้ตรวจสอบแล้ว (ปลดล็อกยืนยันตาราง)
                  </button>
                `) : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Modal: KPI 3 - สถานะความคืบหน้าการจัดตาราง
    if (this.activeModal.type === 'modal-kpi-schedule-status') {
      const stateForModal = this.activeModal.data?.useConfirmed
        ? { ...appState, assignments: appState.confirmedAssignments || [] }
        : appState;
      return renderKpiScheduleStatusModal(stateForModal, this.activeModal.data || {});
    }

    // Modal: KPI 4 - รายงานการตรวจสอบกฎ (Rules Audit)
    if (this.activeModal.type === 'modal-kpi-rules-audit') {
      return renderKpiRulesAuditModal(appState, this.activeModal.data?.valResult || {});
    }

    // Modal: ผังห้องสอบใหญ่และปรับแต่งสถานะที่นั่ง (Interactive Large Seating Plan)
    if (this.activeModal.type === 'room-floorplan' || this.activeModal.type === 'large-room-floorplan') {
      const room = (appState.rooms || []).find(r => r.id === this.activeModal.roomId || r.roomCode === this.activeModal.roomId || r.code === this.activeModal.roomId) || appState.rooms[0];
      if (room) {
        return this.renderLargeRoomFloorplanModal(room.id);
      }
    }

    // Modal: ปรับความจุและเลื่อนเลขที่นั่งสอบอัตโนมัติ (ตามรูปที่ 3)
    if (this.activeModal.type === 'capacity-adjustment') {
      return this.renderCapacityAdjustmentModal();
    }

    return '';
  }

  // --- ผังห้องสอบใหญ่และปรับแต่งสถานะที่นั่ง (Interactive Large Seating Plan - มีแค่ผังใหญ่สบายตา) ---
  renderLargeRoomFloorplanModal(roomId) {
    const room = (appState.rooms || []).find(r => r.id === roomId || r.roomCode === roomId || r.code === roomId) || appState.rooms[0];
    if (!room) return '';

    // Auto-heal check: หากห้องเคยสูญเสียโต๊ะเดิมไปเนื่องจากบั๊กการบันทึก ให้กู้คืนผังเดิมครบถ้วน 100%
    const cfg = (REAL_EXAM_ROOM_CONFIGS || []).find(c => c.code === (room.roomCode || room.code || room.id));
    if (cfg && cfg.blocks && room.blocks) {
      let curCount = 0;
      room.blocks.forEach(b => { if (b.columns) b.columns.forEach(col => curCount += col.length); });
      if (curCount < cfg.capacity) {
        const restoredBlocks = JSON.parse(JSON.stringify(cfg.blocks));
        let curDesks = [];
        room.blocks.forEach(b => { if (b.columns) b.columns.forEach(col => curDesks.push(...col)); });
        let defDesks = [];
        cfg.blocks.forEach(b => { if (b.columns) b.columns.forEach(col => defDesks.push(...col)); });
        const addedDesks = curDesks.filter(d => !defDesks.includes(d));
        if (addedDesks.length > 0) {
          const lastBlock = restoredBlocks[restoredBlocks.length - 1];
          lastBlock.columns[lastBlock.columns.length - 1].push(...addedDesks);
        }
        room.blocks = restoredBlocks;
        room.capacity = defDesks.length + addedDesks.length;
      }
    }

    room.disabledSeats = room.disabledSeats || [];
    room.accessibleSeats = room.accessibleSeats || [];

    const disabledSet = new Set(room.disabledSeats);
    const accessibleSet = new Set(room.accessibleSeats);
    const totalCap = room.capacity || 0;
    const disabledCount = disabledSet.size;
    const accessibleCount = accessibleSet.size;
    const usableCount = Math.max(0, totalCap - disabledCount);

    const roomCode = room.roomCode || room.code || room.id;
    const officialName = room.officialName || room.name;
    const floor = room.floor || 1;
    const pCount = totalCap >= 70 ? 3 : 2;

    const isFrontBoth = room.doorPosition === 'front-both';
    const isRightSide = room.doorPosition === 'right-side-two' || room.doorPosition === 'right-side';
    const isLeftSide = room.doorPosition === 'left-side-two' || room.doorPosition === 'left-side';

    // Helper to calculate seat number offset if capacity or start seat was changed
    let baseMinSeat = 1;
    if (room.rows && room.rows.length > 0) {
      const allS = [];
      room.rows.forEach(r => {
        if (r.left) allS.push(...r.left);
        if (r.right) allS.push(...r.right);
      });
      if (allS.length > 0) baseMinSeat = Math.min(...allS);
    } else if (room.blocks && room.blocks.length > 0) {
      const allS = [];
      room.blocks.forEach(b => {
        if (b.columns) b.columns.forEach(col => allS.push(...col));
      });
      if (allS.length > 0) baseMinSeat = Math.min(...allS);
    }
    const curStart = room.seatStart !== undefined ? room.seatStart : baseMinSeat;
    const seatOffset = curStart - baseMinSeat;

    // Helper to render interactive seat workstation node with permanent data-desk-id and real-time active sequential numbering
    let activeSeatSeq = curStart;
    const renderInteractiveSeatNode = (rawSeat, bIdx, cIdx, sIdx, side) => {
      const deskId = Number(rawSeat);
      const isDisabled = disabledSet.has(deskId);
      const isAccessible = accessibleSet.has(deskId);
      const statusCls = isDisabled ? 'seat-status-disabled' : (isAccessible ? 'seat-status-accessible' : 'seat-status-normal');
      const icon = isDisabled ? '🚫' : (isAccessible ? '♿' : '🖥️');
      const badgeText = isDisabled ? 'ปิด' : (isAccessible ? 'พิการ' : 'ปกติ');
      const assignedSeat = isDisabled ? '' : String(activeSeatSeq++);
      const displayText = isDisabled ? '—' : assignedSeat;

      return `
        <div class="interactive-seat-node ${statusCls}" 
             draggable="true" 
             data-desk-id="${deskId}" 
             data-seat="${assignedSeat}" 
             data-room-id="${room.id}"
             ${bIdx !== undefined ? `data-block-idx="${bIdx}"` : ''}
             ${cIdx !== undefined ? `data-col-idx="${cIdx}"` : ''}
             ${sIdx !== undefined ? `data-seat-idx="${sIdx}"` : ''}
             ${side ? `data-side="${side}"` : ''}
             title="${isDisabled ? `โต๊ะตัวที่ ${deskId} (ปิดการใช้งาน / ชำรุด — คลิกเพื่อเปิดใช้งาน)` : `ที่นั่งสอบ #${assignedSeat} [โต๊ะที่ ${deskId}] (ลากเพื่อสลับตำแหน่ง | คลิกซ้าย: รายละเอียด | คลิกขวา: เมนู)`}">
          <div class="seat-node-top">
            <span class="seat-node-icon">${icon}</span>
            <span class="seat-node-badge">${badgeText}</span>
          </div>
          <div class="seat-node-num" style="${isDisabled ? 'color: #DC2626; font-weight: 800;' : ''}">${displayText}</div>
        </div>
      `;
    };

    // Render physical layout diagrams matching the room's real architecture
    let desksHtml = '';

    if (room.layoutType === 'trapezoid-rows' && room.rows) {
      // 17201: หงส์พันธ์ สโลปใหญ่ 80 ที่นั่ง (6 แถว แถวละ 8-20 ที่นั่ง)
      desksHtml = `
        <div class="trapezoid-interactive-wrapper" style="display: flex; flex-direction: column; gap: 8px; align-items: center; width: 100%; margin: 12px 0;">
          ${room.rows.map((r, rIdx) => `
            <div class="interactive-row-wrapper" data-row-idx="${rIdx}" style="display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%;">
              <div style="font-size: 11.5px; color: #64748B; width: 48px; text-align: right; font-weight: 700; white-space: nowrap;">แถว ${r.rowNum}</div>
              <div class="interactive-seat-col col-seat-list" data-row-idx="${rIdx}" data-side="left" style="display: flex; gap: 4px; padding: 4px; border-radius: 6px; border: 1px dashed transparent;">
                ${r.left.map((s, sIdx) => renderInteractiveSeatNode(s, undefined, undefined, sIdx, 'left')).join('')}
              </div>
              <div style="font-size: 10.5px; color: #94A3B8; padding: 0 6px; font-weight: 600; white-space: nowrap; writing-mode: vertical-rl; letter-spacing: 2px;">ทางเดิน</div>
              <div class="interactive-seat-col col-seat-list" data-row-idx="${rIdx}" data-side="right" style="display: flex; gap: 4px; padding: 4px; border-radius: 6px; border: 1px dashed transparent;">
                ${r.right.map((s, sIdx) => renderInteractiveSeatNode(s, undefined, undefined, sIdx, 'right')).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if ((room.layoutType === 'grid-rows' || room.layoutType === 'staggered-rows') && room.rows) {
      // 17205 (สุตปัญญา 40 ที่นั่ง สับหว่าง) / 17206 (วงษ์แก้ว 40 ที่นั่ง 5 แถว)
      desksHtml = `
        <div style="display: flex; flex-direction: column; gap: 10px; align-items: center; width: 100%; margin: 12px 0;">
          ${room.rows.map((r, rIdx) => `
            <div class="interactive-row-wrapper" data-row-idx="${rIdx}" style="display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%;">
              <div style="font-size: 12px; color: #64748B; width: 55px; text-align: right; font-weight: 700;">แถว ${r.rowNum} ➜</div>
              ${r.left ? `
                <div class="interactive-seat-col col-seat-list" data-row-idx="${rIdx}" data-side="left" style="display: flex; gap: 5px; padding: 4px; border-radius: 6px; border: 1px dashed transparent;">
                  ${r.left.map((s, sIdx) => renderInteractiveSeatNode(s, undefined, undefined, sIdx, 'left')).join('')}
                </div>
              ` : `
                <div style="display: flex; gap: 5px; visibility: hidden;" aria-hidden="true">
                  <div style="width: 50px; height: 48px;"></div>
                </div>
              `}
              <div style="font-size: 11px; color: #94A3B8; padding: 0 4px; font-weight: 600;">ทางเดิน</div>
              ${r.right ? `
                <div class="interactive-seat-col col-seat-list" data-row-idx="${rIdx}" data-side="right" style="display: flex; gap: 5px; padding: 4px; border-radius: 6px; border: 1px dashed transparent;">
                  ${r.right.map((s, sIdx) => renderInteractiveSeatNode(s, undefined, undefined, sIdx, 'right')).join('')}
                </div>
              ` : `
                <div style="display: flex; gap: 5px; visibility: hidden;" aria-hidden="true">
                  <div style="width: 50px; height: 48px;"></div>
                </div>
              `}
            </div>
          `).join('')}
        </div>
      `;
    } else if (room.blocks && room.blocks.length > 0) {
      // 17108, 17109, 17110, 17111, 17211, 17212, 17213 (บล็อกคอลัมน์มาตรฐาน)
      desksHtml = `
        <div class="interactive-blocks-container" style="display: flex; justify-content: center; gap: 24px; width: 100%; margin: 12px 0; flex-wrap: wrap;">
          ${room.blocks.map((block, bIdx) => `
            <div class="interactive-block-wrapper" data-block-idx="${bIdx}" style="display: flex; flex-direction: column; align-items: center; border: 1.5px dashed #CBD5E1; padding: 10px 14px; border-radius: 8px; background: #F8FAFC; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
              <div class="block-title" style="font-size: 11.5px; color: #475569; margin-bottom: 8px; font-weight: 700;">${block.name}</div>
              <div style="display: flex; gap: 8px;">
                ${block.columns.map((col, cIdx) => `
                  <div class="interactive-seat-col" data-block-idx="${bIdx}" data-col-idx="${cIdx}" style="display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 52px; min-height: 80px; padding: 4px; border-radius: 6px; background: rgba(241, 245, 249, 0.4); border: 1.5px dashed transparent; transition: all 0.2s;">
                    <span style="font-size: 10px; color: #94A3B8; line-height: 1;">⬇️</span>
                    <div class="col-seat-list" style="display: flex; flex-direction: column; gap: 6px; width: 100%; align-items: center;">
                      ${col.map((s, sIdx) => renderInteractiveSeatNode(s, bIdx, cIdx, sIdx)).join('')}
                    </div>
                    <button type="button" class="btn btn-sm btn-col-add-seat" data-block-idx="${bIdx}" data-col-idx="${cIdx}" title="เพิ่มที่นั่งต่อท้ายคอลัมน์นี้" style="margin-top: 6px; font-size: 10px; padding: 3px 6px; border-radius: 4px; background: #FFFFFF; border: 1px dashed #94A3B8; color: #475569; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 3px; width: 100%;">
                      <span>➕</span>
                      <span>เพิ่ม</span>
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      // Fallback
      const sStart = room.seatStart || 1;
      const sEnd = room.seatEnd || (sStart + totalCap - 1);
      const seatsArr = [];
      for (let s = sStart; s <= sEnd; s++) seatsArr.push(s);
      desksHtml = `
        <div class="interactive-blocks-container col-seat-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(52px, 1fr)); gap: 8px; padding: 12px; max-width: 650px; margin: 0 auto; width: 100%;">
          ${seatsArr.map((s, sIdx) => renderInteractiveSeatNode(s, 0, 0, sIdx)).join('')}
        </div>
      `;
    }

    return `
      <div class="modal-overlay" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px; overflow-y: auto;">
        <div class="modal-content" style="background: #FFFFFF; border-radius: 12px; width: 100%; max-width: 1060px; height: 92vh; max-height: 92vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); border: 1px solid var(--border-subtle); overflow: hidden; margin: auto;">
          
          <!-- Modal Header -->
          <div class="modal-header" style="padding: 14px 22px; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; flex-shrink: 0;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 22px;">🪑</span>
                <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: var(--text-main);">
                  ผังที่นั่งสอบห้อง ${roomCode} : ${officialName}
                </h3>
                <span class="badge" style="background: #E2E8F0; color: #475569; font-size: 11px; padding: 2px 7px;">ชั้น ${floor}</span>
                <span class="badge" style="${pCount === 3 ? 'background: #FEF3C7; color: #92400E;' : 'background: #DCFCE7; color: #166534;'} font-size: 11px; padding: 2px 7px;">กรรมการ ${pCount} คน</span>
              </div>
              <div id="modal-floorplan-subtitle" style="font-size: 12px; color: var(--text-muted); margin-top: 3px;">
                ความจุ <strong style="color: #15803D;" id="hdr-usable-cap">${usableCount}</strong> / <span id="hdr-total-cap">${totalCap}</span> ที่นั่ง • ช่วงเลขที่นั่ง: <strong style="color: var(--primary-700);">${curStart} - ${usableCount > 0 ? (curStart + usableCount - 1) : curStart}</strong> • ${room.building || 'อาคาร 17'}
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-modal-reset-room-floorplan" style="font-size: 11.5px; font-weight: 700; padding: 5px 11px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; background: #FFFFFF; border: 1px solid var(--border-subtle); color: #B91C1C;" title="คืนค่าผังโต๊ะของห้องนี้เป็นผังมาตรฐานเริ่มต้น (ป้องกันโต๊ะสูญหาย)">
                <span>↺</span>
                <span>คืนค่าผังเดิม</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-modal-resequence-seats" style="font-size: 11.5px; font-weight: 700; padding: 5px 11px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; background: #FFFFFF; border: 1px solid var(--border-subtle);" title="จัดเรียงเลขที่นั่งโต๊ะที่พร้อมใช้ใหม่ เริ่มนับ 1 ที่โต๊ะแรก">
                <span>🔢</span>
                <span>เรียงเลขที่นั่ง 1..N</span>
              </button>
              <button type="button" class="btn btn-primary btn-sm" id="btn-modal-add-seat-top" style="background: #16A34A !important; border: 1px solid #15803D !important; font-weight: 700; font-size: 12px; padding: 5px 12px; border-radius: 6px; box-shadow: 0 1px 3px rgba(22,163,74,0.3); cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                <span>➕</span>
                <span>เพิ่มที่นั่งสอบ</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-close-room-floorplan-modal" style="padding: 5px 12px; border-radius: 6px; font-weight: 700; cursor: pointer;">
                ✖ ปิด
              </button>
            </div>
          </div>

          <!-- Modal Body (มีแค่ผังที่นั่งใหญ่ๆ สบายตา และกล่องรายละเอียดที่นั่งพร้อมปุ่มเลื่อนจัดอย่างอิสระ) -->
          <div class="modal-body" style="padding: 16px 22px; overflow-y: auto; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;">
            
            <!-- กล่องแสดงรายละเอียดที่นั่งเมื่อคลิก หรือคำแนะนำเมื่อยังไม่คลิก -->
            <div id="seat-detail-container" style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; padding: 10px 16px; margin-bottom: 14px; display: flex; flex-direction: column; justify-content: center; gap: 8px; flex-shrink: 0; min-height: 48px;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div style="font-size: 12.5px; color: #475569; display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 16px;">💡</span>
                  <span>คลิกซ้ายที่นั่งเพื่อดูรายละเอียด/เลื่อนตำแหน่ง หรือ <strong>ลากเมาส์ (Drag & Drop)</strong> เพื่อสลับหรือจัดย้ายตำแหน่งได้อย่างอิสระ</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; font-size: 12px; color: #64748B;">
                  <span>🟢 ปกติ</span>
                  <span>🚫 ปิดที่นั่ง</span>
                  <span>♿ คนพิการ</span>
                </div>
              </div>
            </div>

            <!-- กล่องผังที่นั่งใหญ่ -->
            <div style="background: #FFFFFF; border: 1.5px solid var(--border-subtle); border-radius: 10px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); overflow-x: auto; flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; width: 100%; box-sizing: border-box;">
              
              <!-- จอโปรเจคเตอร์ / กระดานดำหน้าห้องสอบ & ประตูทางเข้า/ออก -->
              <div style="width: 100%; max-width: 860px; margin-bottom: 8px;">
                <div style="position: relative; display: flex; justify-content: center; align-items: center; min-height: 40px; padding: 6px 12px; border-bottom: 2px solid #E2E8F0;">
                  ${isFrontBoth ? `<div class="door-badge" style="position: absolute; left: 10px; font-size: 11px; padding: 3px 8px; background: #F1F5F9; border: 1px dashed #94A3B8; border-radius: 4px; font-weight: 600;">🚪 ประตูหน้า (ซ้าย)</div>` : ''}
                  ${isLeftSide ? `<div class="door-badge" style="position: absolute; left: 10px; font-size: 11px; padding: 3px 8px; background: #F1F5F9; border: 1px dashed #94A3B8; border-radius: 4px; font-weight: 600;">🚪 ประตูข้าง (ฝั่งซ้าย)</div>` : ''}
                  
                  <div style="background: linear-gradient(135deg, #2D1445 0%, #3B1F54 100%); color: #FFFFFF; padding: 6px 24px; border-radius: 6px; font-weight: 700; font-size: 12.5px; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(59,31,84,0.2);">
                    <span>🖥️</span>
                    <span>จอโปรเจคเตอร์ / กระดานดำหน้าห้องสอบ (โต๊ะกรรมการกำกับการสอบ)</span>
                  </div>

                  ${isFrontBoth ? `<div class="door-badge" style="position: absolute; right: 10px; font-size: 11px; padding: 3px 8px; background: #F1F5F9; border: 1px dashed #94A3B8; border-radius: 4px; font-weight: 600;">🚪 ประตูหน้า (ขวา)</div>` : ''}
                  ${isRightSide ? `<div class="door-badge" style="position: absolute; right: 10px; font-size: 11px; padding: 3px 8px; background: #FFFBEB; border: 1px dashed #F59E0B; color: #92400E; border-radius: 4px; font-weight: 600;">🚪 ประตูข้าง (ฝั่งขวา)</div>` : ''}
                </div>
              </div>

              <!-- ผังโต๊ะคอมพิวเตอร์ตามสเปกจริงของห้อง -->
              <div style="width: 100%; display: flex; justify-content: center; padding: 10px 0;">
                ${desksHtml}
              </div>

            </div>

          </div>

          <!-- Modal Footer (สรุปและปุ่มบันทึกซิงค์ข้อมูล) -->
          <div class="modal-footer" style="padding: 12px 22px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; flex-shrink: 0; flex-wrap: wrap; gap: 10px;">
            <div style="font-size: 13px;">
              <strong style="color: var(--text-main);">สถานะห้อง:</strong>
              <span style="margin-left: 6px; color: #15803D; font-weight: 700;">พร้อมใช้ <span id="summary-floorplan-usable">${usableCount}</span> / <span id="summary-floorplan-total">${totalCap}</span> ที่</span>
              <span id="summary-floorplan-badges" style="margin-left: 6px;">
                ${disabledCount > 0 ? `<span class="badge" style="background: #FEE2E2; color: #991B1B; font-weight: 700;">🚫 ปิด ${disabledCount} ที่</span>` : ''}
                ${accessibleCount > 0 ? `<span class="badge" style="background: #DBEAFE; color: #1E40AF; font-weight: 700; margin-left: 4px;">♿ พิการ ${accessibleCount} ที่</span>` : ''}
              </span>
            </div>

            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-print-room-plan-modal" data-room-id="${room.id}" style="font-size: 12px;">
                🖨️ พิมพ์ผังที่นั่งห้องนี้ (A4)
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-print-room-slips-modal" data-room-id="${room.id}" style="font-size: 12px;">
                🪪 พิมพ์บัตรประจำตัวที่นั่งเฉพาะห้องนี้
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-close-room-floorplan-modal-2" style="font-size: 12px;">
                ยกเลิก
              </button>
              <button type="button" class="btn btn-primary btn-sm" id="btn-save-floorplan-custom" data-room-id="${room.id}" style="background-color: #16A34A !important; border: 1px solid #15803D !important; font-weight: 700; font-size: 12.5px; box-shadow: 0 1px 3px rgba(22,163,74,0.35);">
                ✔ ยืนยันและซิงค์ข้อมูลห้อง
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  renderCapacityAdjustmentModal() {
    const rooms = (appState.rooms || []).slice().sort((a, b) => {
      const codeA = a.roomCode || a.code || a.id;
      const codeB = b.roomCode || b.code || b.id;
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    });

    const activeRooms = rooms.filter(r => r.isActive !== false);
    const totalCap = activeRooms.reduce((s, r) => s + (r.capacity || 0), 0);
    const totalProctors = activeRooms.reduce((s, r) => s + ((r.capacity || 0) >= 70 ? 3 : 2), 0);
    const minSeat = activeRooms.length > 0 ? (activeRooms[0].seatStart || 1) : 1;
    const maxSeat = activeRooms.length > 0 ? (activeRooms[activeRooms.length - 1].seatEnd || totalCap) : totalCap;

    return `
      <div class="modal-overlay" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px; overflow-y: auto;">
        <div class="modal-content" style="background: #FFFFFF; border-radius: 12px; width: 100%; max-width: 980px; height: 90vh; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); border: 1px solid var(--border-subtle); overflow: hidden; margin: auto;">
          
          <!-- Modal Header -->
          <div class="modal-header" style="padding: 14px 22px; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; flex-shrink: 0;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 20px;">⚙</span>
                <h3 style="margin: 0; font-size: 17.5px; font-weight: 800; color: var(--text-main);">
                  ปรับความจุและคำนวณเลื่อนเลขที่นั่งสอบอัตโนมัติ
                </h3>
              </div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                ระบบคำนวณและเลื่อน (Shift) ลำดับเลขที่นั่งสอบของห้องถัดไปอัตโนมัติเมื่อปรับจำนวนที่นั่ง
              </div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-cap-modal" style="padding: 5px 12px; border-radius: 6px; font-weight: 700; cursor: pointer;">
              ✖ ปิด
            </button>
          </div>

          <!-- Modal Body (เลื่อนลงได้อย่างราบรื่น 100%) -->
          <div class="modal-body" style="padding: 16px 22px; overflow-y: auto; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 12px;">
            
            <!-- แถบควบคุมทางลัดและเลขเริ่มต้นแบบกะทัดรัด -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: #F1F5F9; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-subtle); flex-shrink: 0;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 12px; font-weight: 700; color: #475569;">⚡ ทางลัดผังสอบ:</span>
                <button type="button" class="btn btn-secondary btn-sm btn-cap-preset" data-preset="standard" style="background: #FFFFFF; font-size: 12px; padding: 4px 10px; border-radius: 6px; font-weight: 600; cursor: pointer;">
                  ↺ มาตรฐานเดิม (10 ห้อง 520 ที่นั่ง)
                </button>
                <button type="button" class="btn btn-secondary btn-sm btn-cap-preset" data-preset="floor1" style="background: #FFFFFF; font-size: 12px; padding: 4px 10px; border-radius: 6px; font-weight: 600; cursor: pointer;">
                  ⊞ เฉพาะชั้น 1 (4 ห้อง 210 ที่นั่ง)
                </button>
                <button type="button" class="btn btn-secondary btn-sm btn-cap-preset" data-preset="floor2" style="background: #FFFFFF; font-size: 12px; padding: 4px 10px; border-radius: 6px; font-weight: 600; cursor: pointer;">
                  ⊞ เฉพาะชั้น 2 (6 ห้อง 310 ที่นั่ง)
                </button>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 12px; font-weight: 700; color: #92400E;">เลขเริ่มต้น:</span>
                <input type="number" id="input-start-seat-num" value="${minSeat || 1}" min="1" max="99999" style="width: 75px; padding: 4px 8px; font-size: 13px; font-weight: 800; text-align: center; border-radius: 6px; border: 1.5px solid #F59E0B; background: #FFFBEB; color: #78350F;">
              </div>
            </div>

            <!-- กล่องตารางห้องสอบ 10 ห้อง ที่เลื่อนดูได้อย่างชัดเจน -->
            <div class="table-wrapper" style="border: 1px solid var(--border-subtle); border-radius: 8px; overflow-y: auto; flex: 1 1 auto; min-height: 220px; background: #FFFFFF; box-shadow: inset 0 1px 3px rgba(0,0,0,0.03);">
              <table class="data-table" id="table-adjust-capacity" style="margin: 0; width: 100%; border-collapse: separate; border-spacing: 0;">
                <thead style="position: sticky; top: 0; z-index: 5; background: #F8FAFC;">
                  <tr style="border-bottom: 1.5px solid #E2E8F0;">
                    <th style="padding: 10px 14px; width: 28%; font-size: 12.5px; font-weight: 700; color: #475569; background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0;">ห้องสอบ</th>
                    <th style="padding: 10px 10px; width: 12%; text-align: center; font-size: 12.5px; font-weight: 700; color: #475569; background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0;">เปิดใช้งาน</th>
                    <th style="padding: 10px 14px; width: 22%; text-align: center; font-size: 12.5px; font-weight: 700; color: #475569; background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0;">ความจุที่นั่ง</th>
                    <th style="padding: 10px 14px; width: 18%; text-align: center; font-size: 12.5px; font-weight: 700; color: #475569; background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0;">ช่วงเลขที่นั่ง (สด)</th>
                    <th style="padding: 10px 10px; width: 10%; text-align: center; font-size: 12.5px; font-weight: 700; color: #475569; background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0;">กรรมการ</th>
                    <th style="padding: 10px 10px; width: 10%; text-align: center; font-size: 12.5px; font-weight: 700; color: #475569; background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0;">โต๊ะทะเบียน</th>
                  </tr>
                </thead>
                <tbody>
                  ${rooms.map((r, idx) => {
                    const isActive = r.isActive !== false;
                    const cap = r.capacity || 0;
                    const pCount = cap >= 70 ? 3 : 2;
                    const disCount = (r.disabledSeats || []).length;
                    const accCount = (r.accessibleSeats || []).length;
                    const usableCap = Math.max(0, cap - disCount);

                    return `
                      <tr class="room-cap-row" data-room-id="${r.id}" data-disabled-count="${disCount}" style="border-bottom: 1px solid #F1F5F9; transition: background 0.15s; ${!isActive ? 'opacity: 0.45; background: #F8FAFC;' : ''}">
                        <td style="padding: 9px 14px;">
                          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <span style="font-weight: 800; color: var(--text-main); font-size: 13.5px;">ห้อง ${r.roomCode || r.code || r.id}</span>
                            <span class="badge" style="font-size: 10px; padding: 1px 5px; background: #E2E8F0; color: #475569;">ชั้น ${r.floor || 1}</span>
                            ${disCount > 0 ? `<span class="badge" style="font-size: 10px; padding: 1px 5px; background: #FEE2E2; color: #991B1B; font-weight: 700; border: 1px solid #FCA5A5;">🚫 ปิด ${disCount} ที่</span>` : ''}
                            ${accCount > 0 ? `<span class="badge" style="font-size: 10px; padding: 1px 5px; background: #DBEAFE; color: #1E40AF; font-weight: 700; border: 1px solid #BFDBFE;">♿ พิการ ${accCount} ที่</span>` : ''}
                          </div>
                          <div style="font-size: 11px; color: var(--primary-700); font-weight: 600; margin-top: 1px;">
                            ${r.officialName || r.name}
                          </div>
                        </td>
                        <td style="text-align: center; padding: 9px 10px;">
                          <input type="checkbox" class="toggle-room-active" data-room-id="${r.id}" ${isActive ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #16A34A; cursor: pointer;">
                        </td>
                        <td style="text-align: center; padding: 9px 14px;">
                          <div style="display: inline-flex; align-items: center; gap: 4px;">
                            <button type="button" class="btn btn-secondary btn-sm btn-cap-step" data-dir="-1" data-room-id="${r.id}" style="width: 28px; height: 28px; padding: 0; font-size: 14px; font-weight: 700; line-height: 1; border-radius: 4px; cursor: pointer;">-</button>
                            <input type="number" class="form-input input-room-capacity" data-room-id="${r.id}" value="${cap}" min="1" max="500" style="width: 65px; height: 28px; text-align: center; font-weight: 800; font-size: 13.5px; padding: 2px 4px; border-radius: 4px; border: 1px solid var(--border-subtle);">
                            <button type="button" class="btn btn-secondary btn-sm btn-cap-step" data-dir="1" data-room-id="${r.id}" style="width: 28px; height: 28px; padding: 0; font-size: 14px; font-weight: 700; line-height: 1; border-radius: 4px; cursor: pointer;">+</button>
                          </div>
                          <div class="usable-cap-note" data-room-id="${r.id}" style="font-size: 11px; margin-top: 3px;">
                            ${disCount > 0 ? `<strong style="color: #15803D;">พร้อมใช้: <span class="usable-cap-val">${usableCap}</span> ที่</strong>` : `<span style="color: #64748B;">พร้อมใช้เต็ม (${cap} ที่)</span>`}
                          </div>
                        </td>
                        <td style="text-align: center; padding: 9px 14px;">
                          <span class="seat-range-display" data-room-id="${r.id}" style="font-weight: 800; font-size: 13px; color: var(--primary-700);">
                            ${isActive ? `${r.seatStart || 1} - ${r.seatEnd || cap}` : '-'}
                          </span>
                        </td>
                        <td style="text-align: center; padding: 9px 10px;">
                          <span class="badge proctors-badge-display" data-room-id="${r.id}" style="${pCount === 3 ? 'background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A;' : 'background: #DCFCE7; color: #166534; border: 1px solid #BBF7D0;'} font-size: 11px; font-weight: 700; padding: 2px 7px;">
                            ${isActive ? `${pCount} คน` : '-'}
                          </span>
                        </td>
                        <td style="text-align: center; padding: 9px 10px;">
                          <span class="desk-display" data-room-id="${r.id}" style="font-size: 11.5px; color: var(--text-muted); font-weight: 600;">
                            ${isActive ? `โต๊ะ ${idx + 1}` : '-'}
                          </span>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- สรุปผลการปรับตั้งค่าแบบกะทัดรัด & ตัวเลือก Re-allocate -->
            ${(() => {
              const totalDis = activeRooms.reduce((s, r) => s + ((r.disabledSeats || []).length), 0);
              const totalUsable = Math.max(0, totalCap - totalDis);
              return `
                <div id="capacity-modal-summary" style="padding: 10px 16px; background: #F8FAFC; border: 1px solid var(--border-subtle); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; flex-shrink: 0;">
                  <div style="font-size: 13px;">
                    <strong style="color: var(--text-main);">สรุปผล:</strong>
                    <span id="summary-active-rooms" style="margin-left: 6px; color: #334155;">เปิดสอบ ${activeRooms.length} ห้อง</span> • 
                    <span id="summary-total-cap" style="color: #475569; font-weight: 700;">ความจุโต๊ะรวม ${totalCap} ที่นั่ง</span> • 
                    <span id="summary-usable-cap" style="color: #15803D; font-weight: 800;">พร้อมใช้จริง ${totalUsable} ที่นั่ง${totalDis > 0 ? ` <span style="color: #DC2626; font-size: 11.5px; font-weight: 700;">(🚫 ปิด ${totalDis} ที่)</span>` : ''}</span> • 
                    <span id="summary-seat-range" style="color: #1D4ED8; font-weight: 800;">ช่วงเลขที่นั่ง: ${minSeat} - ${maxSeat}</span>
                  </div>
                  <div style="font-size: 13px;">
                    <span style="color: var(--text-muted);">กรรมการคุมสอบรวม:</span>
                    <strong id="summary-total-proctors" style="color: #B45309; font-size: 14px; margin-left: 4px;">${totalProctors} คน</strong>
                  </div>
                </div>
              `;
            })()}

            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--text-muted); margin-top: -4px; flex-shrink: 0;">
              <input type="checkbox" id="chk-auto-reallocate" checked style="width: 15px; height: 15px; accent-color: #16A34A;">
              <span>ปรับเลื่อนเลขที่นั่งของผู้เข้าสอบที่จัดสรรไว้แล้วโดยอัตโนมัติ (Re-allocate examinees)</span>
            </label>

          </div>

          <!-- Modal Footer (ตรึงอยู่ด้านล่างเสมอ) -->
          <div class="modal-footer" style="padding: 12px 22px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; flex-shrink: 0;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-reset-cap-modal-default" style="font-weight: 600; font-size: 12px;">
              ↺ คืนค่ามาตรฐานเดิม (520 ที่นั่ง)
            </button>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-cap-modal-2" style="font-weight: 600; font-size: 12px;">
                ยกเลิก
              </button>
              <button type="button" class="btn btn-primary btn-sm" id="btn-save-cap-modal" style="background-color: #16A34A !important; border: 1px solid #15803D !important; font-weight: 700; font-size: 12.5px; box-shadow: 0 1px 3px rgba(22,163,74,0.3);">
                ✔ บันทึกและคำนวณเลขที่นั่งสอบใหม่ทั้งหมด
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  // --- ผูก Event Handlers ทั้งหมด ---
  attachEvents() {
    // Delegated click handler for room modals, examinees, and subtabs (100% Resilient)
    if (!this._rootDelegatedBound) {
      this._rootDelegatedBound = true;
      this.root.addEventListener('click', (e) => {
        // 1. Modal Subtab Switcher (แผนผัง, สเปกห้อง, รอบการสอบ & ผู้คุมสอบ)
        const subtabBtn = e.target.closest('[data-room-detail-tab]');
        if (subtabBtn) {
          e.preventDefault();
          e.stopPropagation();
          const tab = subtabBtn.getAttribute('data-room-detail-tab');
          if (tab && this.roomDetailSubTab !== tab) {
            this.roomDetailSubTab = tab;
            this.render();
          }
          return;
        }

        // 2. Open Non-Exam Room Name Modal (สำหรับห้องทั่วไปที่ไม่ได้ใช้เป็นห้องสอบ)
        const nonExamBtn = e.target.closest('[data-action="view-non-exam-room"]');
        if (nonExamBtn) {
          e.preventDefault();
          e.stopPropagation();
          const roomCode = nonExamBtn.getAttribute('data-room-code');
          const roomName = nonExamBtn.getAttribute('data-room-name') || roomCode;
          const floor = nonExamBtn.getAttribute('data-floor') || '1';
          const desc = nonExamBtn.getAttribute('data-desc') || '';
          this.activeModal = {
            type: 'modal-non-exam-room',
            roomCode,
            roomName,
            floor,
            desc
          };
          this.render();
          return;
        }

        // 3. Open Room Detail / Seating Plan Modal
        const viewRoomBtn = e.target.closest('.btn-view-room-plan, .btn-view-examinee-blueprint, [data-action="view-room-detail"], [data-action="view-seating-plan"]');
        if (viewRoomBtn) {
          e.preventDefault();
          e.stopPropagation();
          const rId = viewRoomBtn.getAttribute('data-id') || viewRoomBtn.getAttribute('data-room-id') || viewRoomBtn.getAttribute('data-room-code');
          const room = appState.rooms.find(x =>
            (rId && (x.id === rId || x.roomCode === rId || x.code === rId || String(x.roomNumber) === rId))
          );
          if (room) {
            const action = viewRoomBtn.getAttribute('data-action');
            if (action === 'view-seating-plan') {
              this.roomDetailSubTab = 'seating';
            }
            this.activeModal = {
              type: 'modal-room-detail',
              room
            };
            this.render();
          }
          return;
        }

        // 4. Examinees: Toggle Mock Tools Accordion
        const toggleMockBtn = e.target.closest('#btn-toggle-examinee-mock-tools');
        if (toggleMockBtn) {
          e.preventDefault();
          e.stopPropagation();
          this.isExamineeTestToolsOpen = !this.isExamineeTestToolsOpen;
          this.render();
          return;
        }

        // 5. Examinees: Close Mock Tools Accordion
        const closeMockBtn = e.target.closest('#btn-close-examinee-mock-tools');
        if (closeMockBtn) {
          e.preventDefault();
          e.stopPropagation();
          this.isExamineeTestToolsOpen = false;
          this.render();
          return;
        }

        // 6. Examinees: Clear All Examinees
        const clearAllBtn = e.target.closest('#btn-clear-all-examinees-main, #btn-clear-all-examinees-menu');
        if (clearAllBtn) {
          e.preventDefault();
          e.stopPropagation();
          const total = (appState.examinees || []).length;
          if (total === 0) {
            alert('ไม่มีข้อมูลผู้เข้าสอบในระบบ');
            return;
          }
          if (confirm(`⚠️ ยืนยันการล้างข้อมูลผู้เข้าสอบทั้งหมดหรือไม่?\n\nระบบจะลบข้อมูลผู้เข้าสอบทั้งหมด ${total} คน (ทั้งข้อมูลจริงและข้อมูลจำลอง)\nกด "ตกลง" เพื่อยืนยันการล้างข้อมูล`)) {
            const deleted = appState.clearAllExaminees();
            this.examineeCurrentPage = 1;
            alert(`ล้างข้อมูลผู้เข้าสอบทั้งหมดเรียบร้อยแล้ว (${deleted} คน)`);
            this.render();
          }
          return;
        }

        // 7. Examinees: Clear Mock Only
        const clearMockBtn = e.target.closest('#btn-clear-mock-examinees-direct');
        if (clearMockBtn) {
          e.preventDefault();
          e.stopPropagation();
          const mockCount = (appState.examinees || []).filter(ex => ex.isMock).length;
          if (confirm(`คุณต้องการลบข้อมูลจำลอง (Mock) ทั้งหมด ${mockCount} คน ใช่หรือไม่? (ข้อมูลจริงจะไม่ถูกลบ)`)) {
            const deleted = appState.clearMockExaminees();
            alert(`ลบข้อมูลจำลองสำเร็จ ${deleted} คน`);
            this.render();
          }
          return;
        }

        // 8. Examinees: Add Direct Button
        const addExDirectBtn = e.target.closest('#btn-add-examinee-direct');
        if (addExDirectBtn) {
          e.preventDefault();
          e.stopPropagation();
          this.activeModal = {
            type: 'modal-master-examinees',
            data: null
          };
          this.render();
          return;
        }

        // 9. Examinees: Auto Allocate Seats Direct
        const autoSeatBtn = e.target.closest('#btn-auto-allocate-seats-direct, #btn-quick-auto-seat, #btn-auto-allocate-seats-menu');
        if (autoSeatBtn) {
          e.preventDefault();
          e.stopPropagation();
          const sessId = this.examineeFilterSession !== 'all' ? this.examineeFilterSession : (appState.sessions[0]?.id || 's1');
          const count = appState.autoAllocateSeats(sessId);
          alert(`จัดที่นั่งอัตโนมัติสำเร็จ ${count} คน ในรอบ ${sessId}`);
          this.render();
          return;
        }

        // 10. Examinees: Room Filter Chips
        const roomChipBtn = e.target.closest('[data-examinee-room]');
        if (roomChipBtn) {
          e.preventDefault();
          e.stopPropagation();
          this.examineeFilterRoom = roomChipBtn.getAttribute('data-examinee-room');
          this.examineeCurrentPage = 1;
          this.render();
          return;
        }

        // 11. Examinees: Mock Generation Presets
        const mock20 = e.target.closest('#btn-mock-gen-20');
        if (mock20) {
          e.preventDefault();
          e.stopPropagation();
          const sessId = this.examineeFilterSession !== 'all' ? this.examineeFilterSession : (appState.sessions[0]?.id || 's1');
          appState.generateMockExaminees(20, sessId);
          this.render();
          return;
        }
        const mock100 = e.target.closest('#btn-mock-gen-100');
        if (mock100) {
          e.preventDefault();
          e.stopPropagation();
          const sessId = this.examineeFilterSession !== 'all' ? this.examineeFilterSession : (appState.sessions[0]?.id || 's1');
          appState.generateMockExaminees(100, sessId);
          this.render();
          return;
        }
        const mock520 = e.target.closest('#btn-mock-gen-520');
        if (mock520) {
          e.preventDefault();
          e.stopPropagation();
          const sessId = this.examineeFilterSession !== 'all' ? this.examineeFilterSession : (appState.sessions[0]?.id || 's1');
          appState.generateMockExaminees(520, sessId);
          this.render();
          return;
        }
        const mockCustom = e.target.closest('#btn-mock-gen-custom');
        if (mockCustom) {
          e.preventDefault();
          e.stopPropagation();
          const count = parseInt(this.root.querySelector('#input-custom-mock-count')?.value || '50', 10);
          const sessId = this.examineeFilterSession !== 'all' ? this.examineeFilterSession : (appState.sessions[0]?.id || 's1');
          appState.generateMockExaminees(count, sessId);
          this.render();
          return;
        }
      });
    }
    // 1. จัดการเหตุการณ์ในแถบมหาวิทยาลัย (University Header & Visitor Portal)
    this.attachUniversityAndVisitorEvents();

    // นำทางแท็บหลักบน Sidebar
    this.root.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => {
        const tab = el.getAttribute('data-tab');
        if (tab) this.setTab(tab);
      });
    });

    // นำทางแท็บด่วนบน Mobile Bottom Bar
    this.root.querySelectorAll('.mobile-nav-btn[data-tab]').forEach(el => {
      el.addEventListener('click', () => {
        const tab = el.getAttribute('data-tab');
        if (tab) this.setTab(tab);
      });
    });

    // นำทางข้ามหน้าแบบ Quick Link
    this.root.querySelectorAll('[data-goto-master]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.setTab('master-data');
      });
    });
    this.root.querySelectorAll('[data-goto-proctors]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.setTab('proctors');
      });
    });
    this.root.querySelectorAll('[data-goto-rooms]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.setTab('rooms');
      });
    });

    // เปิด / ปิด Sidebar Drawer บนมือถือ
    const toggleMobileSidebar = (forceState) => {
      const sidebar = this.root.querySelector('.sidebar');
      const backdrop = this.root.querySelector('#sidebar-backdrop');
      if (!sidebar) return;
      const isOpen = forceState !== undefined ? forceState : !sidebar.classList.contains('mobile-open');
      sidebar.classList.toggle('mobile-open', isOpen);
      if (backdrop) backdrop.classList.toggle('active', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    const mobileToggleBtn = this.root.querySelector('#btn-toggle-mobile-sidebar');
    if (mobileToggleBtn) {
      mobileToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMobileSidebar();
      });
    }

    const mobileCloseBtn = this.root.querySelector('#btn-close-mobile-sidebar');
    if (mobileCloseBtn) {
      mobileCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMobileSidebar(false);
      });
    }

    const backdrop = this.root.querySelector('#sidebar-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => toggleMobileSidebar(false));
    }

    const bottomMoreBtn = this.root.querySelector('#btn-bottom-more-menu');
    if (bottomMoreBtn) {
      bottomMoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMobileSidebar(true);
      });
    }

    // สลับโหมดสี Dark / Light
    const themeBtn = this.root.querySelector('#btn-toggle-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
      });
    }

    // Show License Modal
    const showLicenseBtn = this.root.querySelector('#btn-show-license');
    if (showLicenseBtn) {
      showLicenseBtn.addEventListener('click', () => {
        this.activeModal = { type: 'modal-license' };
        this.render();
      });
    }

    // AI Agent Chat Form Submit
    const agentChatForm = this.root.querySelector('#form-agent-chat');
    if (agentChatForm) {
      agentChatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = this.root.querySelector('#input-agent-chat');
        if (!input) return;
        const msg = input.value.trim();
        if (!msg) return;
        input.value = '';
        await this.aiAgent.processMessage(msg);
        this.render();
        setTimeout(() => {
          const box = this.root.querySelector('#agent-messages-box');
          if (box) box.scrollTop = box.scrollHeight;
        }, 50);
      });
    }

    // Quick Prompt Triggers in AI Chat (Hero Cards, Telemetry Pills, Bottom Chips)
    this.root.querySelectorAll('[data-quick-prompt]').forEach(chip => {
      chip.addEventListener('click', async () => {
        const prompt = chip.getAttribute('data-quick-prompt');
        if (prompt) {
          await this.aiAgent.processMessage(prompt);
          this.render();
          setTimeout(() => {
            const box = this.root.querySelector('#agent-messages-box');
            if (box) box.scrollTop = box.scrollHeight;
          }, 50);
        }
      });
    });

    // Action buttons inside AI Agent messages
    this.root.querySelectorAll('.agent-action-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const prompt = btn.getAttribute('data-agent-prompt');
        const actId = btn.getAttribute('data-agent-action');
        if (prompt) {
          await this.aiAgent.processMessage(prompt);
          this.render();
          setTimeout(() => {
            const box = this.root.querySelector('#agent-messages-box');
            if (box) box.scrollTop = box.scrollHeight;
          }, 50);
          return;
        }

        if (actId === 'run-auto-schedule') {
          this.runSolverWithFeedback();
        } else if (actId === 'export-pdf') {
          openPrintableSignoffSheets({
            assignments: appState.assignments,
            sessions: appState.sessions,
            proctors: appState.proctors,
            rooms: appState.rooms,
            allocations: appState.allocations,
            settings: appState.settings
          });
        } else if (actId === 'nav-what-if') {
          this.setTab('what-if');
        } else if (actId === 'nav-scheduler') {
          this.setTab('scheduler');
        } else if (actId === 'open-license-modal') {
          this.activeModal = { type: 'modal-license' };
          this.render();
        }
      });
    });

    // Clear Chat
    const clearChatBtn = this.root.querySelector('#btn-clear-chat');
    if (clearChatBtn) {
      clearChatBtn.addEventListener('click', () => {
        if (confirm('คุณต้องการล้างประวัติการสนทนากับ AI Agent ใช่หรือไม่?')) {
          this.aiAgent.chatHistory = this.aiAgent.chatHistory.slice(0, 1);
          this.render();
        }
      });
    }

    // Undo / Redo
    const undoBtn = this.root.querySelector('#btn-undo');
    if (undoBtn) undoBtn.addEventListener('click', () => appState.undo());
    const redoBtn = this.root.querySelector('#btn-redo');
    if (redoBtn) redoBtn.addEventListener('click', () => appState.redo());

    // Export Excel & PDF
    const exportExcelBtn = this.root.querySelector('#btn-export-excel');
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener('click', () => {
        exportExcelWorkbook({
          assignments: appState.assignments,
          sessions: appState.sessions,
          proctors: appState.proctors,
          rooms: appState.rooms,
          allocations: appState.allocations
        });
      });
    }

    // สลับดูผู้คุมสอบด่วนบนมือถือ (Mobile Proctor Selector)
    const proctorMobileSelect = this.root.querySelector('#select-active-proctor-mobile');
    if (proctorMobileSelect) {
      proctorMobileSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'admin') {
          appState.setCurrentUser({
            id: 'admin',
            role: 'admin',
            name: 'ผู้ดูแลระบบ (Admin)',
            proctorId: null
          });
          this.activeViewingProctorId = null;
          this.currentTab = 'dashboard';
        } else {
          const p = appState.proctors.find(x => x.id === val);
          if (p) {
            appState.setCurrentUser({
              id: p.id,
              role: p.proctorType === 'faculty' ? 'teacher' : 'proctor',
              name: appState.formatProctorDisplayName(p),
              proctorId: p.id
            });
            this.activeViewingProctorId = p.id;
          }
        }
        this.render();
      });
    }

    // สลับดูวันสะดวกและโควต้าของผู้คุมสอบ
    const proctorAvailSelect = this.root.querySelector('#select-active-proctor-avail');
    if (proctorAvailSelect) {
      proctorAvailSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'admin') {
          appState.setCurrentUser({
            id: 'admin',
            role: 'admin',
            name: 'ผู้ดูแลระบบ (Admin)',
            proctorId: null
          });
          this.activeViewingProctorId = null;
          this.currentTab = 'dashboard';
        } else {
          const p = appState.proctors.find(x => x.id === val);
          if (p) {
            appState.setCurrentUser({
              id: p.id,
              role: p.proctorType === 'faculty' ? 'teacher' : 'proctor',
              name: appState.formatProctorDisplayName(p),
              proctorId: p.id
            });
            this.activeViewingProctorId = p.id;
          }
        }
        this.render();
      });
    }

    // พิมพ์ตารางคุมสอบของฉัน (PDF) จากหน้า my-profile
    const handlePrintMySchedule = () => {
      const p = appState.getLoggedInProctor() || (this.activeViewingProctorId ? appState.proctors.find(x => x.id === this.activeViewingProctorId) : appState.proctors[0]);
      if (p) {
        openPersonalDutySheet({
          proctor: p,
          assignments: appState.assignments,
          sessions: appState.sessions,
          rooms: appState.rooms,
          settings: appState.settings
        });
      }
    };

    const printMyScheduleBtn = this.root.querySelector('#btn-print-my-schedule');
    if (printMyScheduleBtn) {
      printMyScheduleBtn.addEventListener('click', handlePrintMySchedule);
    }

    this.root.querySelectorAll('[data-action="print-my-schedule"]').forEach(btn => {
      btn.addEventListener('click', handlePrintMySchedule);
    });

    this.root.querySelectorAll('[data-action="sudden-leave"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeModal = { type: 'sudden-leave', data: null };
        this.render();
      });
    });

    const exportPdfBtn = this.root.querySelector('#btn-export-pdf');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => {
        const loggedProctor = appState.getLoggedInProctor();
        if (loggedProctor) {
          // หากเป็นอาจารย์หรือผู้คุมสอบ เปิด modal ให้เลือกรูปแบบที่ต้องการพิมพ์
          this.activeModal = {
            type: 'choose-pdf-type',
            proctor: loggedProctor
          };
          this.render();
          return;
        }

        openPrintableSignoffSheets({
          assignments: appState.assignments,
          sessions: appState.sessions,
          proctors: appState.proctors,
          rooms: appState.rooms,
          allocations: appState.allocations,
          settings: appState.settings
        });
      });
    }

    // Modal: choose-pdf-type triggers
    const doPrintPersonal = this.root.querySelector('#btn-do-print-personal');
    if (doPrintPersonal && this.activeModal?.proctor) {
      doPrintPersonal.addEventListener('click', () => {
        const p = this.activeModal.proctor;
        this.activeModal = null;
        this.render();
        openPersonalDutySheet({
          proctor: p,
          assignments: appState.assignments,
          sessions: appState.sessions,
          rooms: appState.rooms,
          settings: appState.settings
        });
      });
    }

    const doPrintAllRooms = this.root.querySelector('#btn-do-print-all-rooms');
    if (doPrintAllRooms) {
      doPrintAllRooms.addEventListener('click', () => {
        this.activeModal = null;
        this.render();
        openPrintableSignoffSheets({
          assignments: appState.assignments,
          sessions: appState.sessions,
          proctors: appState.proctors,
          rooms: appState.rooms,
          allocations: appState.allocations,
          settings: appState.settings
        });
      });
    }

    // พิมพ์ชุดป้ายติดบอร์ดหน้าห้องสอบและผังที่นั่งจริง (10 ห้อง 520 ที่นั่ง) จาก Topbar
    const printDoorSignsBtn = this.root.querySelector('#btn-print-door-signs');
    if (printDoorSignsBtn) {
      printDoorSignsBtn.addEventListener('click', () => {
        openPrintableDoorSignsAndSeatingPlan({
          rooms: appState.rooms,
          sessions: appState.sessions,
          settings: appState.settings
        });
      });
    }

    // พิมพ์ชุดป้ายติดหน้าห้องสอบจาก Modal
    const doPrintDoorSigns = this.root.querySelector('#btn-do-print-door-signs');
    if (doPrintDoorSigns) {
      doPrintDoorSigns.addEventListener('click', () => {
        this.activeModal = null;
        this.render();
        openPrintableDoorSignsAndSeatingPlan({
          rooms: appState.rooms,
          sessions: appState.sessions,
          settings: appState.settings
        });
      });
    }

    // พิมพ์คำสั่งแต่งตั้งคณะกรรมการคุมสอบ (ก.พ.) ฉบับทางการตราครุฑ จาก Topbar
    const printAppointmentOrderBtn = this.root.querySelector('#btn-print-appointment-order');
    if (printAppointmentOrderBtn) {
      printAppointmentOrderBtn.addEventListener('click', () => {
        const activeAssignments = (appState.confirmedAssignments && appState.confirmedAssignments.length > 0)
          ? appState.confirmedAssignments
          : appState.assignments;
        openPrintableAppointmentOrder({
          assignments: activeAssignments,
          sessions: appState.sessions,
          proctors: appState.proctors,
          rooms: appState.rooms,
          allocations: appState.allocations,
          settings: appState.settings
        });
      });
    }

    // พิมพ์คำสั่งแต่งตั้งคณะกรรมการคุมสอบจาก Modal
    const doPrintAppointmentOrder = this.root.querySelector('#btn-do-print-appointment-order');
    if (doPrintAppointmentOrder) {
      doPrintAppointmentOrder.addEventListener('click', () => {
        this.activeModal = null;
        this.render();
        const activeAssignments = (appState.confirmedAssignments && appState.confirmedAssignments.length > 0)
          ? appState.confirmedAssignments
          : appState.assignments;
        openPrintableAppointmentOrder({
          assignments: activeAssignments,
          sessions: appState.sessions,
          proctors: appState.proctors,
          rooms: appState.rooms,
          allocations: appState.allocations,
          settings: appState.settings
        });
      });
    }

    // คลิกดูแผนผังห้องสอบ (Seating Chart Modal)
    this.root.querySelectorAll('[data-action="view-seating-plan"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rId = btn.getAttribute('data-id');
        const room = appState.rooms.find(x => x.id === rId);
        if (room) {
          this.roomDetailSubTab = 'seating';
          this.activeModal = {
            type: 'modal-room-detail',
            room
          };
          this.render();
        }
      });
    });

    // คลิกดูรายละเอียดห้องสอบ (Room Detail Modal)
    this.root.querySelectorAll('[data-action="view-room-detail"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rId = btn.getAttribute('data-id');
        const room = appState.rooms.find(x => x.id === rId);
        if (room) {
          this.activeModal = {
            type: 'modal-room-detail',
            room
          };
          this.render();
        }
      });
    });

    // แสดงข้อมูลห้องแบบ Realtime เมื่อเลื่อนเมาส์ไปบนรูปทรงห้องในผังอาคาร
    this.root.querySelectorAll('.blueprint-svg-room').forEach(poly => {
      poly.addEventListener('mouseenter', () => {
        const code = poly.getAttribute('data-room-code');
        const name = poly.getAttribute('data-room-name');
        const isExam = poly.getAttribute('data-is-exam') === 'true';
        const examInfo = poly.getAttribute('data-exam-info') || '';

        const banner = this.root.querySelector('#blueprint-live-banner-f1') || this.root.querySelector('#blueprint-live-banner-f2');
        if (banner) {
          if (isExam) {
            banner.innerHTML = `
              <span class="banner-icon">🏫</span>
              <span class="banner-text"><strong>ห้อง ${code} : ${name}</strong> • <span class="badge badge-primary" style="font-size:11.5px; padding:2px 7px;">${examInfo}</span> <span style="color:var(--primary-600); font-weight:700; margin-left:8px;">👉 คลิกเพื่อเปิดผังที่นั่ง & สเปกห้อง</span></span>
            `;
          } else {
            banner.innerHTML = `
              <span class="banner-icon">🏢</span>
              <span class="banner-text"><strong>ห้อง ${code} : ${name}</strong> ${examInfo ? `• ${examInfo}` : ''}</span>
            `;
          }
        }
      });

      poly.addEventListener('mouseleave', () => {
        const banner = this.root.querySelector('#blueprint-live-banner-f1') || this.root.querySelector('#blueprint-live-banner-f2');
        if (banner) {
          banner.innerHTML = `
            <span class="banner-icon">💡</span>
            <span class="banner-text">เลื่อนเมาส์ไปที่ห้องเพื่อดูรายละเอียด • <strong>คลิกที่ห้องสอบ (กรอบสีม่วง)</strong> เพื่อเปิดผังที่นั่งจริงและข้อมูลห้อง</span>
          `;
        }
      });
    });

    // สลับแท็บใน Modal รายละเอียดห้องสอบ (Direct + Delegation)
    this.root.querySelectorAll('[data-room-detail-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tab = btn.getAttribute('data-room-detail-tab');
        if (tab) {
          this.roomDetailSubTab = tab;
          this.render();
        }
      });
    });

    // สลับมุมมองผังอาคาร 17 (Table / Floor 1 / Floor 2 / Directory)
    this.root.querySelectorAll('[data-floor-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.roomsViewMode = btn.getAttribute('data-floor-mode');
        this.render();
      });
    });

    // ----------------------------------------------------
    // หน้าจัดการห้องสอบ: สลับ 4 แท็บหลักระดับบน
    // 1. 🪑 ผังห้องสอบและที่นั่ง (seating-grid)
    // 2. 📋 ตารางห้องสอบ (table)
    // 3. 🏢 ผังอาคาร 17 (blueprint)
    // 4. 📑 สารบบอาคาร 17 (directory)
    // ----------------------------------------------------
    const btnRoomsSeating = this.root.querySelector('#btn-subtab-rooms-seating');
    if (btnRoomsSeating) {
      btnRoomsSeating.addEventListener('click', () => {
        this.roomsSubTab = 'seating-grid';
        this.render();
      });
    }
    const btnRoomsTable = this.root.querySelector('#btn-subtab-rooms-table');
    if (btnRoomsTable) {
      btnRoomsTable.addEventListener('click', () => {
        this.roomsSubTab = 'table';
        this.render();
      });
    }
    const btnRoomsBlueprint = this.root.querySelector('#btn-subtab-rooms-blueprint');
    if (btnRoomsBlueprint) {
      btnRoomsBlueprint.addEventListener('click', () => {
        this.roomsSubTab = 'blueprint';
        this.render();
      });
    }
    const btnRoomsDirectory = this.root.querySelector('#btn-subtab-rooms-directory');
    if (btnRoomsDirectory) {
      btnRoomsDirectory.addEventListener('click', () => {
        this.roomsSubTab = 'directory';
        this.render();
      });
    }

    // ปุ่มสลับชั้นในแท็บผังอาคาร 17 (ชั้น 1 / ชั้น 2)
    this.root.querySelectorAll('.btn-select-blueprint-floor').forEach(btn => {
      btn.addEventListener('click', () => {
        const floor = parseInt(btn.getAttribute('data-floor'), 10) || 1;
        this.blueprintFloor = floor;
        this.render();
      });
    });

    // ดับเบิ้ลคลิกแถวในตารางห้องสอบเพื่อเปิดดูรายละเอียดและผังที่นั่ง
    this.root.querySelectorAll('.room-table-row').forEach(tr => {
      tr.addEventListener('dblclick', (e) => {
        if (e.target.closest('button, a, input, select')) return;
        const rId = tr.getAttribute('data-id');
        const room = (appState.rooms || []).find(x => x.id === rId);
        if (room) {
          this.roomDetailSubTab = 'seating';
          this.activeModal = { type: 'modal-room-detail', room };
          this.render();
        }
      });
    });

    // ปุ่มคืนค่าผังมาตรฐาน (520 ที่นั่ง)
    const btnResetStdCap = this.root.querySelector('#btn-reset-standard-capacity');
    if (btnResetStdCap) {
      btnResetStdCap.addEventListener('click', () => {
        const standardCaps = [40, 60, 60, 50, 80, 40, 40, 50, 52, 48];
        const sortedRooms = [...(appState.rooms || [])].sort((a, b) => {
          const codeA = a.roomCode || a.code || a.id;
          const codeB = b.roomCode || b.code || b.id;
          return codeA.localeCompare(codeB, undefined, { numeric: true });
        });
        let curSeat = 1;
        sortedRooms.forEach((r, idx) => {
          const cfg = (REAL_EXAM_ROOM_CONFIGS || []).find(c => c.code === (r.roomCode || r.code || r.id));
          const cap = standardCaps[idx] !== undefined ? standardCaps[idx] : (cfg ? cfg.capacity : (r.capacity || 40));
          r.capacity = cap;
          r.isActive = true;
          r.seatStart = curSeat;
          r.seatEnd = curSeat + cap - 1;
          r.disabledSeats = [];
          r.accessibleSeats = [];
          r.usableCapacity = cap;
          if (cfg) {
            if (cfg.blocks) r.blocks = JSON.parse(JSON.stringify(cfg.blocks));
            if (cfg.rows) r.rows = JSON.parse(JSON.stringify(cfg.rows));
          }
          curSeat = r.seatEnd + 1;
        });
        appState.notify();
        this.showToast('คืนค่าผังมาตรฐาน (10 ห้อง 520 ที่นั่ง) เรียบร้อยแล้ว', 'success');
      });
    }

    // ปุ่มเปิด Modal ปรับความจุ / เลื่อนเลขที่นั่งสอบ
    const btnOpenCapModal = this.root.querySelector('#btn-open-capacity-modal');
    if (btnOpenCapModal) {
      btnOpenCapModal.addEventListener('click', () => {
        this.activeModal = { type: 'capacity-adjustment' };
        this.render();
      });
    }

    // ปุ่มพิมพ์บัตรประจำตัวที่นั่งสอบ (8 ที่นั่ง/A4) ทั้งศูนย์สอบ
    const btnPrintSeatSlips = this.root.querySelector('#btn-print-seat-slips');
    if (btnPrintSeatSlips) {
      btnPrintSeatSlips.addEventListener('click', () => {
        openPrintableSeatSlips(appState);
      });
    }

    // ปุ่มดูและปรับแต่งผังที่นั่งรายห้อง (เปิด Large Room Floorplan Modal)
    this.root.querySelectorAll('.btn-open-room-floorplan, [data-action="open-room-floorplan"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const roomId = btn.getAttribute('data-room-id');
        if (roomId) {
          this.activeModal = { type: 'room-floorplan', roomId };
          this.render();
        }
      });
    });

    // ปุ่มปิด Large Room Floorplan Modal
    const btnCloseRoomPlan = this.root.querySelector('#btn-close-room-floorplan-modal');
    if (btnCloseRoomPlan) {
      btnCloseRoomPlan.addEventListener('click', () => {
        this.activeModal = null;
        this.render();
      });
    }
    const btnCloseRoomPlan2 = this.root.querySelector('#btn-close-room-floorplan-modal-2');
    if (btnCloseRoomPlan2) {
      btnCloseRoomPlan2.addEventListener('click', () => {
        this.activeModal = null;
        this.render();
      });
    }

    // ปุ่มพิมพ์ผังที่นั่งห้องนี้ (A4) ใน Large Room Floorplan Modal
    const btnPrintRoomPlan = this.root.querySelector('#btn-print-room-plan-modal');
    if (btnPrintRoomPlan) {
      btnPrintRoomPlan.addEventListener('click', () => {
        const targetRoomId = btnPrintRoomPlan.getAttribute('data-room-id');
        openPrintableDoorSignsAndSeatingPlan({
          rooms: appState.rooms,
          sessions: appState.sessions,
          settings: appState.settings,
          targetRoomId
        });
      });
    }

    // ปุ่มพิมพ์บัตรประจำตัวที่นั่งเฉพาะห้องนี้ (8 ที่นั่ง/A4) ใน Large Room Floorplan Modal
    const btnPrintRoomSlips = this.root.querySelector('#btn-print-room-slips-modal');
    if (btnPrintRoomSlips) {
      btnPrintRoomSlips.addEventListener('click', () => {
        const targetRoomId = btnPrintRoomSlips.getAttribute('data-room-id');
        openPrintableSeatSlips(appState, targetRoomId);
      });
    }

    // ----------------------------------------------------
    // เหตุการณ์ใน Interactive Large Seating Plan Modal
    // 1. เพิ่มที่นั่งสอบ (+1 ที่นั่ง) ทั้งจากปุ่มส่วนหัวและปุ่มท้ายคอลัมน์
    // 2. ลากและปล่อย (Drag & Drop) เพื่อสลับ/ย้ายตำแหน่งที่นั่งได้อย่างอิสระ
    // 3. ปุ่มเลื่อนตำแหน่ง (ขึ้น/ลง/ซ้าย/ขวา) และลบที่นั่งในกล่องรายละเอียดและคลิกขวา
    // 4. กดยืนยัน: ซิงค์ข้อมูลผังห้อง ความจุ disabledSeats / accessibleSeats ไปยังห้องทั้งหมด
    // ----------------------------------------------------
    const curFloorplanRoomId = (this.activeModal && (this.activeModal.type === 'room-floorplan' || this.activeModal.type === 'large-room-floorplan'))
      ? this.activeModal.roomId
      : (this.root.querySelector('#btn-save-floorplan-custom')?.getAttribute('data-room-id') || null);

    const floorplanRoom = curFloorplanRoomId
      ? ((appState.rooms || []).find(r => r.id === curFloorplanRoomId || r.roomCode === curFloorplanRoomId || r.code === curFloorplanRoomId) || appState.rooms[0])
      : (appState.rooms ? appState.rooms[0] : null);

    let draggedSeatNode = null;

    const resequenceActiveSeatsRealtime = () => {
      const targetRoom = floorplanRoom || (appState.rooms ? appState.rooms[0] : { id: 'R01', seatStart: 1 });
      let activeSeq = targetRoom && targetRoom.seatStart ? targetRoom.seatStart : 1;

      this.root.querySelectorAll('.interactive-seat-node').forEach(node => {
        const deskId = node.getAttribute('data-desk-id') || node.getAttribute('data-seat') || '';
        const isDis = node.classList.contains('seat-status-disabled');
        const numEl = node.querySelector('.seat-node-num');
        const badgeEl = node.querySelector('.seat-node-badge');
        const iconEl = node.querySelector('.seat-node-icon');

        if (isDis) {
          node.setAttribute('data-seat', '');
          if (numEl) {
            numEl.textContent = '—';
            numEl.style.color = '#DC2626';
            numEl.style.fontWeight = '800';
          }
          if (badgeEl) badgeEl.textContent = 'ปิด';
          if (iconEl) iconEl.textContent = '🚫';
          node.setAttribute('title', `โต๊ะตัวที่ ${deskId} (ปิดการใช้งาน / โต๊ะชำรุด — คลิกเพื่อเปิดใช้งาน)`);
        } else {
          node.setAttribute('data-seat', String(activeSeq));
          if (numEl) {
            numEl.textContent = activeSeq;
            numEl.style.color = '#1E293B';
            numEl.style.fontWeight = '700';
          }
          const isAcc = node.classList.contains('seat-status-accessible');
          if (badgeEl) badgeEl.textContent = isAcc ? 'พิการ' : 'ปกติ';
          if (iconEl) iconEl.textContent = isAcc ? '♿' : '🖥️';
          node.setAttribute('title', `ที่นั่งสอบ #${activeSeq} [โต๊ะที่ ${deskId}] (ลากเพื่อย้าย/สลับตำแหน่ง | คลิกซ้าย: รายละเอียด | คลิกขวา: เมนู)`);
          activeSeq++;
        }
      });

      updateRoomFloorplanSummary();
    };

    const updateSeatNodeDisplay = (node, newStatus) => {
      node.classList.remove('seat-status-normal', 'seat-status-disabled', 'seat-status-accessible');
      const iconSpan = node.querySelector('.seat-node-icon');
      const badgeSpan = node.querySelector('.seat-node-badge');

      if (newStatus === 'disabled') {
        node.classList.add('seat-status-disabled');
        if (iconSpan) iconSpan.textContent = '🚫';
        if (badgeSpan) badgeSpan.textContent = 'ปิด';
      } else if (newStatus === 'accessible') {
        node.classList.add('seat-status-accessible');
        if (iconSpan) iconSpan.textContent = '♿';
        if (badgeSpan) badgeSpan.textContent = 'พิการ';
      } else {
        node.classList.add('seat-status-normal');
        if (iconSpan) iconSpan.textContent = '🖥️';
        if (badgeSpan) badgeSpan.textContent = 'ปกติ';
      }

      // ปรับเปลี่ยนเลขที่นั่งทันทีแบบ Real-time บนโต๊ะที่พร้อมใช้ (เช่น ปิด 1,2 -> โต๊ะ 3 กลายเป็น 1 ทันที)
      resequenceActiveSeatsRealtime();
    };

    const updateRoomFloorplanSummary = () => {
      const allNodes = Array.from(this.root.querySelectorAll('.interactive-seat-node'));
      const totalCount = allNodes.length;
      const disabledCount = this.root.querySelectorAll('.interactive-seat-node.seat-status-disabled').length;
      const accessibleCount = this.root.querySelectorAll('.interactive-seat-node.seat-status-accessible').length;
      const usableCount = Math.max(0, totalCount - disabledCount);

      const sumUsable = this.root.querySelector('#summary-floorplan-usable');
      if (sumUsable) sumUsable.textContent = usableCount;

      const sumTotal = this.root.querySelector('#summary-floorplan-total');
      if (sumTotal) sumTotal.textContent = totalCount;

      const hdrUsable = this.root.querySelector('#hdr-usable-cap');
      if (hdrUsable) hdrUsable.textContent = usableCount;

      const hdrTotal = this.root.querySelector('#hdr-total-cap');
      if (hdrTotal) hdrTotal.textContent = totalCount;

      const sumBadges = this.root.querySelector('#summary-floorplan-badges');
      if (sumBadges) {
        sumBadges.innerHTML = `
          ${disabledCount > 0 ? `<span class="badge" style="background: #FEE2E2; color: #991B1B; font-weight: 700;">🚫 ปิด ${disabledCount} ที่</span>` : ''}
          ${accessibleCount > 0 ? `<span class="badge" style="background: #DBEAFE; color: #1E40AF; font-weight: 700; margin-left: 4px;">♿ พิการ ${accessibleCount} ที่</span>` : ''}
        `;
      }

      // อัปเดตช่วงเลขที่นั่งในหัวเรื่องแบบ Real-time
      const targetRoom = floorplanRoom || (appState.rooms ? appState.rooms[0] : { id: 'R01', seatStart: 1 });
      const sStart = targetRoom && targetRoom.seatStart ? targetRoom.seatStart : 1;
      const sEnd = usableCount > 0 ? (sStart + usableCount - 1) : sStart;
      const subtitle = this.root.querySelector('#modal-floorplan-subtitle');
      if (subtitle) {
        subtitle.innerHTML = `ความจุ <strong style="color: #15803D;" id="hdr-usable-cap">${usableCount}</strong> / <span id="hdr-total-cap">${totalCount}</span> ที่นั่ง • ช่วงเลขที่นั่ง: <strong style="color: var(--primary-700);">${sStart} - ${sEnd}</strong> • ${targetRoom && targetRoom.building ? targetRoom.building : 'อาคาร 17'}`;
      }
    };

    const moveSeatNode = (node, dir) => {
      const sNum = node.getAttribute('data-seat');
      if (dir === 'up') {
        const prev = node.previousElementSibling;
        if (prev && prev.classList.contains('interactive-seat-node')) {
          node.parentNode.insertBefore(node, prev);
          node.classList.add('seat-just-moved');
          setTimeout(() => node.classList.remove('seat-just-moved'), 400);
          updateRoomFloorplanSummary();
        }
      } else if (dir === 'down') {
        const next = node.nextElementSibling;
        if (next && next.classList.contains('interactive-seat-node')) {
          node.parentNode.insertBefore(next, node);
          node.classList.add('seat-just-moved');
          setTimeout(() => node.classList.remove('seat-just-moved'), 400);
          updateRoomFloorplanSummary();
        }
      } else if (dir === 'left' || dir === 'right') {
        const colLists = Array.from(this.root.querySelectorAll('.col-seat-list'));
        const curColList = node.closest('.col-seat-list');
        const curIdx = colLists.indexOf(curColList);
        if (curIdx !== -1) {
          const targetIdx = dir === 'left' ? curIdx - 1 : curIdx + 1;
          if (targetIdx >= 0 && targetIdx < colLists.length) {
            colLists[targetIdx].appendChild(node);
            node.classList.add('seat-just-moved');
            setTimeout(() => node.classList.remove('seat-just-moved'), 400);
            updateRoomFloorplanSummary();
          }
        }
      }
    };

    const deleteSeatNode = (node) => {
      const deskId = node.getAttribute('data-desk-id') || node.getAttribute('data-seat') || '';
      node.remove();
      resequenceActiveSeatsRealtime();
      const container = this.root.querySelector('#seat-detail-container');
      if (container) {
        container.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; width: 100%;">
            <div style="font-size: 12.5px; color: #475569; display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">💡</span>
              <span>ลบโต๊ะตัวที่ #${deskId} เรียบร้อยแล้ว • คลิกซ้ายที่นั่งอื่นเพื่อดูรายละเอียด หรือ <strong>ลากเมาส์ (Drag & Drop)</strong> เพื่อจัดผัง</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 12px; color: #64748B;">
              <span>🟢 ปกติ</span>
              <span>🚫 ปิดที่นั่ง</span>
              <span>♿ คนพิการ</span>
            </div>
          </div>
        `;
      }
      this.showToast(`ลบโต๊ะตัวที่ #${deskId} ออกจากห้องสอบเรียบร้อยแล้ว`, 'info');
    };

    const renderSeatDetailBox = (node) => {
      const deskId = node.getAttribute('data-desk-id') || node.getAttribute('data-seat') || '';
      const sNum = node.getAttribute('data-seat') || '';
      const container = this.root.querySelector('#seat-detail-container');
      if (!container) return;

      const isDisabled = node.classList.contains('seat-status-disabled');
      const isAccessible = node.classList.contains('seat-status-accessible');
      const curStatus = isDisabled ? 'disabled' : (isAccessible ? 'accessible' : 'normal');

      const targetRoom = floorplanRoom || (appState.rooms ? appState.rooms[0] : null);
      const roomCode = targetRoom ? (targetRoom.roomCode || targetRoom.code || targetRoom.id) : '';
      const roomId = targetRoom ? targetRoom.id : '';

      const examinee = !isDisabled ? (appState.examinees || []).find(ex => 
        (String(ex.roomCode) === String(roomCode) || String(ex.roomId) === String(roomId) || String(ex.roomCode) === String(roomId)) &&
        (String(ex.seatNumber) === String(sNum) || String(ex.seatNumber) === String(deskId))
      ) : null;

      const maskCitizenId = (cid) => {
        if (!cid) return '-';
        const clean = String(cid).replace(/[^0-9]/g, '');
        if (clean.length === 13) {
          return `${clean.slice(0, 1)}-${clean.slice(1, 5)}-XXXXX-${clean.slice(10, 12)}-${clean.slice(12)}`;
        }
        return cid;
      };

      const icon = isDisabled ? '🚫' : (examinee ? '👤' : (isAccessible ? '♿' : '🖥️'));
      const statusTitle = isDisabled ? 'ปิดการใช้งาน (ชำรุด)' : (isAccessible ? 'ที่นั่งสำหรับผู้พิการ (♿)' : (examinee ? 'จัดที่นั่งแล้ว' : 'ใช้งานปกติ (ว่าง)'));
      const badgeStyle = isDisabled
        ? 'background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5;'
        : (examinee ? 'background: #DCFCE7; color: #15803D; border: 1px solid #86EFAC;' : (isAccessible ? 'background: #DBEAFE; color: #1E40AF; border: 1px solid #BFDBFE;' : 'background: #DCFCE7; color: #15803D; border: 1px solid #86EFAC;'));

      let examineeInfoHtml = '';
      if (examinee) {
        examineeInfoHtml = `
          <div style="font-size: 14.5px; font-weight: 800; color: #1E293B;">
            ที่นั่งสอบ #${sNum} (โต๊ะตัวที่ ${deskId})
            <span class="badge" style="background: #F3E8FF; color: #6D28D9; border: 1px solid #D8B4FE; margin-left: 6px; font-size: 12px; font-weight: 700;">
              👤 ${examinee.title || ''}${examinee.firstName} ${examinee.lastName}
            </span>
            <span class="badge" style="${badgeStyle} margin-left: 4px; font-size: 11px;">${statusTitle}</span>
          </div>
          <div style="font-size: 12px; color: #475569; margin-top: 3px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span>เลขประจำตัวผู้เข้าสอบ: <strong style="color: #1E293B;">${examinee.id}</strong></span>
            <span>•</span>
            <span>เลข ปชช: <strong>${maskCitizenId(examinee.citizenId)}</strong></span>
            <span>•</span>
            <span>${examinee.faculty || ''} ${examinee.major ? `(${examinee.major})` : ''}</span>
            ${examinee.specialNeeds ? `<span class="badge" style="background: #FEF3C7; color: #B45309; border: 1px solid #FCD34D;">♿ ${examinee.specialNeeds}</span>` : ''}
          </div>
        `;
      } else {
        examineeInfoHtml = `
          <div style="font-size: 14.5px; font-weight: 800; color: #1E293B;">
            ${isDisabled ? `โต๊ะตัวที่ ${deskId} (ปิดการใช้งาน / ชำรุด)` : `ที่นั่งสอบ #${sNum} (โต๊ะตัวที่ ${deskId})`}
            <span class="badge" style="${badgeStyle} margin-left: 6px; font-size: 11px;">${statusTitle}</span>
          </div>
          <div style="font-size: 11.5px; color: #64748B; margin-top: 2px;">
            ${isDisabled ? 'ที่นั่งนี้ถูกปิดการใช้งาน' : 'ที่นั่งว่าง (ยังไม่มีผู้เข้าสอบจัดนั่ง) • ลากเพื่อย้ายตำแหน่ง หรือใช้ปุ่มด้านล่างเพื่อเลื่อนจัดได้อย่างอิสระ'}
          </div>
        `;
      }

      container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 26px;">${icon}</span>
            <div>
              ${examineeInfoHtml}
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span style="font-size: 12px; font-weight: 700; color: #475569;">สถานะ:</span>
            <button type="button" class="btn btn-sm btn-quick-seat-status" data-status="normal" style="background: ${curStatus === 'normal' ? '#10B981' : '#FFFFFF'}; color: ${curStatus === 'normal' ? '#FFFFFF' : '#065F46'}; border: 1.5px solid #10B981; font-weight: 700; font-size: 11px; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
              🟢 ปกติ
            </button>
            <button type="button" class="btn btn-sm btn-quick-seat-status" data-status="disabled" style="background: ${curStatus === 'disabled' ? '#EF4444' : '#FFFFFF'}; color: ${curStatus === 'disabled' ? '#FFFFFF' : '#991B1B'}; border: 1.5px solid #EF4444; font-weight: 700; font-size: 11px; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
              🚫 ปิดที่นั่ง
            </button>
            <button type="button" class="btn btn-sm btn-quick-seat-status" data-status="accessible" style="background: ${curStatus === 'accessible' ? '#3B82F6' : '#FFFFFF'}; color: ${curStatus === 'accessible' ? '#FFFFFF' : '#1E40AF'}; border: 1.5px solid #3B82F6; font-weight: 700; font-size: 11px; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
              ♿ คนพิการ
            </button>
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; border-top: 1px dashed #CBD5E1; padding-top: 8px; margin-top: 6px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span style="font-size: 11.5px; font-weight: 700; color: #475569;">🎯 เลื่อนตำแหน่ง:</span>
            <button type="button" class="btn btn-secondary btn-sm btn-move-seat-ctrl" data-dir="up" style="font-size: 11px; padding: 3px 8px; font-weight: 600; cursor: pointer;" title="เลื่อนที่นั่งขึ้น 1 ลำดับ">
              ⬆️ เลื่อนขึ้น
            </button>
            <button type="button" class="btn btn-secondary btn-sm btn-move-seat-ctrl" data-dir="down" style="font-size: 11px; padding: 3px 8px; font-weight: 600; cursor: pointer;" title="เลื่อนที่นั่งลง 1 ลำดับ">
              ⬇️ เลื่อนลง
            </button>
            <button type="button" class="btn btn-secondary btn-sm btn-move-seat-ctrl" data-dir="left" style="font-size: 11px; padding: 3px 8px; font-weight: 600; cursor: pointer;" title="ย้ายที่นั่งไปคอลัมน์ทางซ้าย">
              ⬅️ ย้ายไปซ้าย
            </button>
            <button type="button" class="btn btn-secondary btn-sm btn-move-seat-ctrl" data-dir="right" style="font-size: 11px; padding: 3px 8px; font-weight: 600; cursor: pointer;" title="ย้ายที่นั่งไปคอลัมน์ทางขวา">
              ➡️ ย้ายไปขวา
            </button>
          </div>

          <button type="button" class="btn btn-danger btn-sm btn-delete-seat-ctrl" style="font-size: 11px; padding: 3px 10px; font-weight: 700; background: #FEE2E2 !important; color: #991B1B !important; border: 1px solid #FCA5A5 !important; border-radius: 4px; cursor: pointer;" title="ลบที่นั่งนี้ออกจากห้องสอบ">
            🗑️ ลบที่นั่งนี้
          </button>
        </div>
      `;

      container.querySelectorAll('.btn-quick-seat-status').forEach(btn => {
        btn.addEventListener('click', () => {
          const st = btn.getAttribute('data-status');
          updateSeatNodeDisplay(node, st);
          renderSeatDetailBox(node);
        });
      });

      container.querySelectorAll('.btn-move-seat-ctrl').forEach(btn => {
        btn.addEventListener('click', () => {
          const dir = btn.getAttribute('data-dir');
          moveSeatNode(node, dir);
          resequenceActiveSeatsRealtime();
        });
      });

      const delBtn = container.querySelector('.btn-delete-seat-ctrl');
      if (delBtn) {
        delBtn.addEventListener('click', () => {
          if (confirm(`คุณต้องการลบโต๊ะตัวที่ ${deskId} ออกจากห้องสอบนี้หรือไม่?`)) {
            deleteSeatNode(node);
            resequenceActiveSeatsRealtime();
          }
        });
      }
    };

    const wireInteractiveSeatNode = (node) => {
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        this.root.querySelectorAll('.interactive-seat-node').forEach(n => n.classList.remove('seat-is-selected'));
        node.classList.add('seat-is-selected');
        renderSeatDetailBox(node);
      });

      node.addEventListener('dragstart', (e) => {
        draggedSeatNode = node;
        node.classList.add('seat-is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', node.getAttribute('data-seat'));
      });

      node.addEventListener('dragend', () => {
        node.classList.remove('seat-is-dragging');
        this.root.querySelectorAll('.seat-drop-target').forEach(el => el.classList.remove('seat-drop-target'));
        this.root.querySelectorAll('.col-drop-active').forEach(el => el.classList.remove('col-drop-active'));
        draggedSeatNode = null;
      });

      node.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedSeatNode && draggedSeatNode !== node) {
          node.classList.add('seat-drop-target');
        }
      });

      node.addEventListener('dragleave', () => {
        node.classList.remove('seat-drop-target');
      });

      node.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        node.classList.remove('seat-drop-target');
        if (!draggedSeatNode || draggedSeatNode === node) return;

        const srcSeat = draggedSeatNode.getAttribute('data-seat');
        const tgtSeat = node.getAttribute('data-seat');

        const srcParent = draggedSeatNode.parentNode;
        const tgtParent = node.parentNode;
        const srcNext = draggedSeatNode.nextSibling === node ? draggedSeatNode : draggedSeatNode.nextSibling;

        tgtParent.insertBefore(draggedSeatNode, node);
        srcParent.insertBefore(node, srcNext);

        draggedSeatNode.classList.add('seat-just-moved');
        node.classList.add('seat-just-moved');
        setTimeout(() => {
          if (draggedSeatNode) draggedSeatNode.classList.remove('seat-just-moved');
          node.classList.remove('seat-just-moved');
        }, 400);

        updateRoomFloorplanSummary();
        renderSeatDetailBox(draggedSeatNode);
        this.showToast(`สลับตำแหน่งที่นั่ง #${srcSeat} ⇄ #${tgtSeat} เรียบร้อยแล้ว`, 'info');
      });

      node.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const oldMenu = document.getElementById('seat-context-menu');
        if (oldMenu) oldMenu.remove();

        const sNum = node.getAttribute('data-seat');
        const menu = document.createElement('div');
        menu.id = 'seat-context-menu';
        menu.style.position = 'fixed';
        menu.style.left = `${Math.min(window.innerWidth - 220, e.clientX)}px`;
        menu.style.top = `${Math.min(window.innerHeight - 260, e.clientY)}px`;
        menu.style.zIndex = '100000';
        menu.style.background = '#FFFFFF';
        menu.style.borderRadius = '8px';
        menu.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.1)';
        menu.style.padding = '6px';
        menu.style.minWidth = '210px';

        menu.innerHTML = `
          <div style="padding: 6px 10px; font-size: 11.5px; font-weight: 800; color: #64748B; border-bottom: 1px solid #E2E8F0; margin-bottom: 4px;">
            ที่นั่งสอบ #${sNum}
          </div>
          <button class="ctx-opt-btn" data-action="status" data-status="normal" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 10px; border: none; background: none; font-size: 12px; font-weight: 600; color: #1E293B; border-radius: 4px; cursor: pointer; text-align: left;">
            🟢 ใช้งานปกติ (Normal)
          </button>
          <button class="ctx-opt-btn" data-action="status" data-status="disabled" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 10px; border: none; background: none; font-size: 12px; font-weight: 600; color: #DC2626; border-radius: 4px; cursor: pointer; text-align: left;">
            🚫 ปิดที่นั่ง / ชำรุด (Disabled)
          </button>
          <button class="ctx-opt-btn" data-action="status" data-status="accessible" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 10px; border: none; background: none; font-size: 12px; font-weight: 600; color: #2563EB; border-radius: 4px; cursor: pointer; text-align: left;">
            ♿ ที่สำหรับคนพิการ (Accessible)
          </button>
          <div style="height: 1px; background: #E2E8F0; margin: 4px 0;"></div>
          <button class="ctx-opt-btn" data-action="move" data-dir="up" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 10px; border: none; background: none; font-size: 12px; font-weight: 600; color: #475569; border-radius: 4px; cursor: pointer; text-align: left;">
            ⬆️ เลื่อนขึ้น 1 ตำแหน่ง
          </button>
          <button class="ctx-opt-btn" data-action="move" data-dir="down" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 10px; border: none; background: none; font-size: 12px; font-weight: 600; color: #475569; border-radius: 4px; cursor: pointer; text-align: left;">
            ⬇️ เลื่อนลง 1 ตำแหน่ง
          </button>
          <button class="ctx-opt-btn" data-action="move" data-dir="left" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 10px; border: none; background: none; font-size: 12px; font-weight: 600; color: #475569; border-radius: 4px; cursor: pointer; text-align: left;">
            ⬅️ ย้ายไปคอลัมน์ซ้าย
          </button>
          <button class="ctx-opt-btn" data-action="move" data-dir="right" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 10px; border: none; background: none; font-size: 12px; font-weight: 600; color: #475569; border-radius: 4px; cursor: pointer; text-align: left;">
            ➡️ ย้ายไปคอลัมน์ขวา
          </button>
          <div style="height: 1px; background: #E2E8F0; margin: 4px 0;"></div>
          <button class="ctx-opt-btn" data-action="delete" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 10px; border: none; background: none; font-size: 12px; font-weight: 700; color: #DC2626; border-radius: 4px; cursor: pointer; text-align: left;">
            🗑️ ลบที่นั่งนี้ออกจากห้อง
          </button>
        `;

        menu.querySelectorAll('.ctx-opt-btn').forEach(btn => {
          btn.addEventListener('mouseenter', () => btn.style.background = '#F1F5F9');
          btn.addEventListener('mouseleave', () => btn.style.background = 'none');
          btn.addEventListener('click', () => {
            const act = btn.getAttribute('data-action');
            if (act === 'status') {
              const st = btn.getAttribute('data-status');
              updateSeatNodeDisplay(node, st);
              renderSeatDetailBox(node);
            } else if (act === 'move') {
              const dir = btn.getAttribute('data-dir');
              moveSeatNode(node, dir);
            } else if (act === 'delete') {
              deleteSeatNode(node);
            }
            menu.remove();
          });
        });

        document.body.appendChild(menu);
      });
    };

    // Attach to all existing seat nodes
    this.root.querySelectorAll('.interactive-seat-node').forEach(node => {
      wireInteractiveSeatNode(node);
    });

    // Wire column drop zones
    this.root.querySelectorAll('.interactive-seat-col').forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.classList.add('col-drop-active');
      });
      col.addEventListener('dragleave', () => {
        col.classList.remove('col-drop-active');
      });
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('col-drop-active');
        if (!draggedSeatNode) return;
        const seatList = col.querySelector('.col-seat-list') || col;
        if (seatList && !seatList.contains(draggedSeatNode)) {
          seatList.appendChild(draggedSeatNode);
          updateRoomFloorplanSummary();
        }
      });
    });

    // Helper: Add New Seat to Room
    const addNewSeatToRoom = (targetColList) => {
      const allNodes = Array.from(this.root.querySelectorAll('.interactive-seat-node'));
      const allDeskIds = allNodes.map(n => parseInt(n.getAttribute('data-desk-id'), 10)).filter(n => !isNaN(n));
      const maxDeskId = allDeskIds.length > 0 ? Math.max(...allDeskIds) : 0;
      const newDeskId = maxDeskId + 1;

      const currentRoom = floorplanRoom || (appState.rooms ? appState.rooms[0] : { id: 'R01' });

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = `
        <div class="interactive-seat-node seat-status-normal seat-just-moved" 
             draggable="true" 
             data-desk-id="${newDeskId}" 
             data-seat="" 
             data-room-id="${currentRoom.id}"
             title="โต๊ะตัวที่ ${newDeskId} (ลากเพื่อย้าย/สลับตำแหน่ง | คลิกซ้าย: รายละเอียด | คลิกขวา: เมนู)">
          <div class="seat-node-top">
            <span class="seat-node-icon">🖥️</span>
            <span class="seat-node-badge">ปกติ</span>
          </div>
          <div class="seat-node-num"></div>
        </div>
      `;
      const newNode = tempDiv.firstElementChild;

      let destList = targetColList;
      if (!destList) {
        const curSelected = this.root.querySelector('.interactive-seat-node.seat-is-selected');
        if (curSelected) {
          destList = curSelected.closest('.col-seat-list');
        }
      }
      if (!destList) {
        const allLists = this.root.querySelectorAll('.col-seat-list');
        destList = allLists.length > 0 ? allLists[allLists.length - 1] : null;
      }

      if (destList) {
        destList.appendChild(newNode);
      } else {
        const grid = this.root.querySelector('.interactive-blocks-container') || this.root.querySelector('.modal-body');
        if (grid) grid.appendChild(newNode);
      }

      wireInteractiveSeatNode(newNode);
      resequenceActiveSeatsRealtime();

      this.root.querySelectorAll('.interactive-seat-node').forEach(n => n.classList.remove('seat-is-selected'));
      newNode.classList.add('seat-is-selected');
      renderSeatDetailBox(newNode);

      setTimeout(() => newNode.classList.remove('seat-just-moved'), 500);
      this.showToast(`เพิ่มโต๊ะสอบตัวที่ ${newDeskId} เรียบร้อยแล้ว (รันเลขที่นั่งสอบอัตโนมัติ ลากจัดตำแหน่งได้อย่างอิสระ)`, 'success');
    };

    // ปุ่มคืนค่าผังมาตรฐานเริ่มต้น (ป้องกันโต๊ะสูญหายหรือเริ่มผังใหม่)
    const btnResetRoomPlan = this.root.querySelector('#btn-modal-reset-room-floorplan');
    if (btnResetRoomPlan) {
      btnResetRoomPlan.addEventListener('click', () => {
        const targetRoom = floorplanRoom || (appState.rooms ? appState.rooms[0] : null);
        if (!targetRoom) return;
        if (confirm(`คุณต้องการคืนค่าผังห้อง ${targetRoom.roomCode || targetRoom.code} เป็นค่ามาตรฐานเริ่มต้นหรือไม่? (โต๊ะทุกตัวจะกลับมาครบถ้วน)`)) {
          const cfg = (REAL_EXAM_ROOM_CONFIGS || []).find(c => c.code === (targetRoom.roomCode || targetRoom.code || targetRoom.id));
          if (cfg) {
            if (cfg.blocks) targetRoom.blocks = JSON.parse(JSON.stringify(cfg.blocks));
            if (cfg.rows) targetRoom.rows = JSON.parse(JSON.stringify(cfg.rows));
            targetRoom.capacity = cfg.capacity;
            targetRoom.usableCapacity = cfg.capacity;
            targetRoom.disabledSeats = [];
            targetRoom.accessibleSeats = [];
            appState.notify();
            this.activeModal = { type: 'room-floorplan', roomId: targetRoom.id };
            this.render();
            this.showToast(`คืนค่าผังห้อง ${targetRoom.roomCode || targetRoom.code} เป็นค่ามาตรฐานเริ่มต้นเรียบร้อยแล้ว (โต๊ะครบ ${cfg.capacity} ตัว)`, 'success');
          }
        }
      });
    }

    // Buttons to add seat
    const btnModalAddSeatTop = this.root.querySelector('#btn-modal-add-seat-top');
    if (btnModalAddSeatTop) {
      btnModalAddSeatTop.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        addNewSeatToRoom();
      });
    }

    // ปุ่มจัดเรียงเลขที่นั่ง 1..N ใหม่บนโต๊ะที่พร้อมใช้
    const btnResequenceSeats = this.root.querySelector('#btn-modal-resequence-seats');
    if (btnResequenceSeats) {
      btnResequenceSeats.addEventListener('click', () => {
        resequenceActiveSeatsRealtime();
        this.showToast('จัดเรียงเลขที่นั่งโต๊ะที่พร้อมใช้ใหม่เรียบร้อยแล้ว (เริ่มนับ 1 ที่โต๊ะแรกที่พร้อมใช้)', 'success');
      });
    }

    this.root.querySelectorAll('.btn-col-add-seat').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const colEl = btn.closest('.interactive-seat-col');
        const colList = colEl ? (colEl.querySelector('.col-seat-list') || colEl) : null;
        addNewSeatToRoom(colList);
      });
    });

    // Close floating contextmenu on outside click
    document.addEventListener('click', () => {
      const oldMenu = document.getElementById('seat-context-menu');
      if (oldMenu) oldMenu.remove();
    });

    // Save Floorplan Changes
    const btnSaveFloorplan = this.root.querySelector('#btn-save-floorplan-custom');
    if (btnSaveFloorplan) {
      btnSaveFloorplan.addEventListener('click', () => {
        const targetRoomId = btnSaveFloorplan.getAttribute('data-room-id');
        const room = (appState.rooms || []).find(r => r.id === targetRoomId);
        if (room) {
          const disabledList = [];
          const accessibleList = [];
          const allCurrentDesks = [];

          const blockWrappers = this.root.querySelectorAll('.interactive-block-wrapper');
          if (blockWrappers.length > 0) {
            const updatedBlocks = [];
            blockWrappers.forEach((bWrap, bIdx) => {
              const originalBlock = (room.blocks && room.blocks[bIdx]) ? room.blocks[bIdx] : { name: `บล็อก ${bIdx + 1}` };
              const cols = [];
              bWrap.querySelectorAll('.interactive-seat-col').forEach(colEl => {
                const colSeats = [];
                colEl.querySelectorAll('.interactive-seat-node').forEach(node => {
                  let deskId = parseInt(node.getAttribute('data-desk-id'), 10);
                  if (isNaN(deskId)) {
                    deskId = parseInt(node.getAttribute('data-seat'), 10);
                  }
                  if (!isNaN(deskId)) {
                    colSeats.push(deskId);
                    allCurrentDesks.push(deskId);
                    if (node.classList.contains('seat-status-disabled')) disabledList.push(deskId);
                    if (node.classList.contains('seat-status-accessible')) accessibleList.push(deskId);
                  }
                });
                cols.push(colSeats);
              });
              updatedBlocks.push({
                ...originalBlock,
                columns: cols
              });
            });
            room.blocks = updatedBlocks;
          } else {
            const rowWrappers = this.root.querySelectorAll('.interactive-row-wrapper');
            if (rowWrappers.length > 0 && room.rows) {
              const updatedRows = [];
              rowWrappers.forEach((rWrap, rIdx) => {
                const originalRow = room.rows[rIdx] || { rowNum: rIdx + 1 };
                const leftDesks = [];
                const rightDesks = [];
                const leftCol = rWrap.querySelector('.interactive-seat-col[data-side="left"]');
                if (leftCol) {
                  leftCol.querySelectorAll('.interactive-seat-node').forEach(node => {
                    let dId = parseInt(node.getAttribute('data-desk-id'), 10);
                    if (isNaN(dId)) dId = parseInt(node.getAttribute('data-seat'), 10);
                    if (!isNaN(dId)) {
                      leftDesks.push(dId);
                      allCurrentDesks.push(dId);
                      if (node.classList.contains('seat-status-disabled')) disabledList.push(dId);
                      if (node.classList.contains('seat-status-accessible')) accessibleList.push(dId);
                    }
                  });
                }
                const rightCol = rWrap.querySelector('.interactive-seat-col[data-side="right"]');
                if (rightCol) {
                  rightCol.querySelectorAll('.interactive-seat-node').forEach(node => {
                    let dId = parseInt(node.getAttribute('data-desk-id'), 10);
                    if (isNaN(dId)) dId = parseInt(node.getAttribute('data-seat'), 10);
                    if (!isNaN(dId)) {
                      rightDesks.push(dId);
                      allCurrentDesks.push(dId);
                      if (node.classList.contains('seat-status-disabled')) disabledList.push(dId);
                      if (node.classList.contains('seat-status-accessible')) accessibleList.push(dId);
                    }
                  });
                }
                updatedRows.push({
                  ...originalRow,
                  left: leftDesks,
                  right: rightDesks
                });
              });
              room.rows = updatedRows;
            } else {
              this.root.querySelectorAll('.interactive-seat-node').forEach(node => {
                let dId = parseInt(node.getAttribute('data-desk-id'), 10);
                if (isNaN(dId)) dId = parseInt(node.getAttribute('data-seat'), 10);
                if (!isNaN(dId)) {
                  allCurrentDesks.push(dId);
                  if (node.classList.contains('seat-status-disabled')) disabledList.push(dId);
                  if (node.classList.contains('seat-status-accessible')) accessibleList.push(dId);
                }
              });
            }
          }

          const totalNodesCount = this.root.querySelectorAll('.interactive-seat-node').length;
          const disNodesCount = this.root.querySelectorAll('.interactive-seat-node.seat-status-disabled').length;
          const usableNodesCount = Math.max(0, totalNodesCount - disNodesCount);

          room.capacity = totalNodesCount;
          room.usableCapacity = usableNodesCount;
          room.disabledSeats = disabledList;
          room.accessibleSeats = accessibleList;

          // จัดเรียงลำดับเลขที่นั่งของทุกห้องที่เปิดสอบต่อเนื่องกันอัตโนมัติ
          // โดยนับเฉพาะที่นั่งพร้อมใช้จริง (เช่น ห้อง 1 พร้อมใช้ 42 -> ช่วงเลข 1 - 42, ห้อง 2 เริ่มที่ 43 ทันที)
          const sortedRooms = [...(appState.rooms || [])].sort((a, b) => {
            const codeA = a.roomCode || a.code || a.id;
            const codeB = b.roomCode || b.code || b.id;
            return codeA.localeCompare(codeB, undefined, { numeric: true });
          });

          let curSeqSeat = 1;
          sortedRooms.forEach(r => {
            if (r.isActive !== false) {
              const rDis = (r.disabledSeats || []).length;
              const effectiveSeats = rDis > 0 ? Math.max(0, (r.capacity || 0) - rDis) : (r.capacity || 0);
              r.seatStart = curSeqSeat;
              r.seatEnd = curSeqSeat + effectiveSeats - 1;
              curSeqSeat = r.seatEnd + 1;
            } else {
              r.seatStart = 0;
              r.seatEnd = 0;
            }
          });

          appState.notify();
          this.activeModal = null;
          this.render();
          this.showToast(`บันทึกและซิงค์ผังห้อง ${room.roomCode || room.code} เรียบร้อยแล้ว (โต๊ะรวม ${room.capacity} ตัว, พร้อมใช้ ${room.usableCapacity} ที่นั่ง, โต๊ะปิดไม่สูญหาย)`, 'success');
        }
      });
    }

    // ----------------------------------------------------
    // เหตุการณ์ภายใน Capacity Adjustment Modal (คำนวณสดและบันทึก)
    // ----------------------------------------------------
    const capModalTable = this.root.querySelector('#table-adjust-capacity');
    if (capModalTable) {
      const recalcCapacityModal = () => {
        const startSeatInput = this.root.querySelector('#input-start-seat-num');
        const startSeatBase = parseInt(startSeatInput ? startSeatInput.value : 1, 10) || 1;
        let curSeat = startSeatBase;
        let activeCount = 0;
        let totalCap = 0;
        let totalUsableCap = 0;
        let totalDisabled = 0;
        let totalProctors = 0;
        let minSeat = null;
        let maxSeat = null;

        const rows = this.root.querySelectorAll('.room-cap-row');
        rows.forEach((row) => {
          const chk = row.querySelector('.toggle-room-active');
          const capInput = row.querySelector('.input-room-capacity');
          const seatRangeSpan = row.querySelector('.seat-range-display');
          const badgeSpan = row.querySelector('.proctors-badge-display');
          const deskSpan = row.querySelector('.desk-display');
          const usableNoteSpan = row.querySelector('.usable-cap-val');
          const rId = row.getAttribute('data-room-id');
          const targetRoom = (appState.rooms || []).find(r => r.id === rId);

          const isActive = chk ? chk.checked : true;
          let cap = parseInt(capInput ? capInput.value : 0, 10);
          if (isNaN(cap) || cap < 0) cap = 0;

          const disCount = targetRoom ? (targetRoom.disabledSeats || []).length : 0;
          const usableCap = Math.max(0, cap - disCount);

          if (usableNoteSpan) {
            usableNoteSpan.textContent = usableCap;
          }

          if (isActive) {
            activeCount++;
            totalCap += cap;
            totalUsableCap += usableCap;
            totalDisabled += disCount;

            const effectiveCap = disCount > 0 ? usableCap : cap;
            const sStart = curSeat;
            const sEnd = effectiveCap > 0 ? (curSeat + effectiveCap - 1) : curSeat;
            if (minSeat === null) minSeat = sStart;
            maxSeat = sEnd;
            curSeat = sEnd + 1;

            const pCount = cap >= 70 ? 3 : 2;
            totalProctors += pCount;

            if (seatRangeSpan) seatRangeSpan.textContent = `${sStart} - ${sEnd}`;
            if (badgeSpan) {
              badgeSpan.textContent = `${pCount} คน`;
              badgeSpan.style.background = pCount === 3 ? '#FEF3C7' : '#DCFCE7';
              badgeSpan.style.color = pCount === 3 ? '#92400E' : '#166534';
              badgeSpan.style.border = pCount === 3 ? '1px solid #FDE68A' : '1px solid #BBF7D0';
            }
            if (deskSpan) deskSpan.textContent = `โต๊ะ ${activeCount}`;
            row.style.opacity = '1';
          } else {
            if (seatRangeSpan) seatRangeSpan.textContent = '-';
            if (badgeSpan) {
              badgeSpan.textContent = '-';
              badgeSpan.style.background = '#F1F5F9';
              badgeSpan.style.color = '#94A3B8';
              badgeSpan.style.border = '1px solid #E2E8F0';
            }
            if (deskSpan) deskSpan.textContent = '-';
            row.style.opacity = '0.45';
          }
        });

        const sumActive = this.root.querySelector('#summary-active-rooms');
        const sumCap = this.root.querySelector('#summary-total-cap');
        const sumUsable = this.root.querySelector('#summary-usable-cap');
        const sumRange = this.root.querySelector('#summary-seat-range');
        const sumProctors = this.root.querySelector('#summary-total-proctors');

        if (sumActive) sumActive.textContent = `เปิดสอบ ${activeCount} ห้อง`;
        if (sumCap) sumCap.textContent = `ความจุโต๊ะรวม ${totalCap} ที่นั่ง`;
        if (sumUsable) {
          sumUsable.innerHTML = `พร้อมใช้จริง ${totalUsableCap} ที่นั่ง${totalDisabled > 0 ? ` <span style="color: #DC2626; font-size: 11.5px; font-weight: 700;">(🚫 ปิด ${totalDisabled} ที่)</span>` : ''}`;
        }
        if (sumRange) sumRange.textContent = activeCount > 0 ? `ช่วงเลขที่นั่ง: ${minSeat} - ${maxSeat}` : 'ช่วงเลขที่นั่ง: -';
        if (sumProctors) sumProctors.textContent = `${totalProctors} คน`;
      };

      // ปุ่ม Stepper +/-
      this.root.querySelectorAll('.btn-cap-step').forEach(btn => {
        btn.addEventListener('click', () => {
          const rId = btn.getAttribute('data-room-id');
          const dir = parseInt(btn.getAttribute('data-dir'), 10) || 0;
          const input = this.root.querySelector(`.input-room-capacity[data-room-id="${rId}"]`);
          if (input) {
            let val = parseInt(input.value, 10) || 0;
            val = Math.max(1, Math.min(500, val + dir));
            input.value = val;
            recalcCapacityModal();
          }
        });
      });

      // ตรวจจับพิมพ์ capacity
      this.root.querySelectorAll('.input-room-capacity').forEach(input => {
        input.addEventListener('input', () => recalcCapacityModal());
      });

      // ตรวจจับสลับ active
      this.root.querySelectorAll('.toggle-room-active').forEach(chk => {
        chk.addEventListener('change', () => recalcCapacityModal());
      });

      // ตรวจจับเปลี่ยนเลขที่นั่งเริ่มต้น
      const startSeatInput = this.root.querySelector('#input-start-seat-num');
      if (startSeatInput) {
        startSeatInput.addEventListener('input', () => recalcCapacityModal());
      }

      // ทางลัด Presets
      this.root.querySelectorAll('.btn-cap-preset').forEach(btn => {
        btn.addEventListener('click', () => {
          const preset = btn.getAttribute('data-preset');
          const rows = this.root.querySelectorAll('.room-cap-row');
          const stdCaps = [40, 60, 60, 50, 80, 40, 40, 50, 52, 48];

          rows.forEach((row, idx) => {
            const chk = row.querySelector('.toggle-room-active');
            const capInput = row.querySelector('.input-room-capacity');
            if (!chk || !capInput) return;

            if (preset === 'standard') {
              chk.checked = true;
              capInput.value = stdCaps[idx] || 40;
            } else if (preset === 'floor1') {
              if (idx < 4) {
                chk.checked = true;
                capInput.value = stdCaps[idx] || 40;
              } else {
                chk.checked = false;
              }
            } else if (preset === 'floor2') {
              if (idx >= 4) {
                chk.checked = true;
                capInput.value = stdCaps[idx] || 40;
              } else {
                chk.checked = false;
              }
            }
          });
          if (startSeatInput) startSeatInput.value = '1';
          recalcCapacityModal();
        });
      });

      // คืนค่ามาตรฐานเดิมใน Modal
      const btnResetCapDefault = this.root.querySelector('#btn-reset-cap-modal-default');
      if (btnResetCapDefault) {
        btnResetCapDefault.addEventListener('click', () => {
          const stdCaps = [40, 60, 60, 50, 80, 40, 40, 50, 52, 48];
          const rows = this.root.querySelectorAll('.room-cap-row');
          rows.forEach((row, idx) => {
            const chk = row.querySelector('.toggle-room-active');
            const capInput = row.querySelector('.input-room-capacity');
            if (chk) chk.checked = true;
            if (capInput) capInput.value = stdCaps[idx] || 40;
          });
          if (startSeatInput) startSeatInput.value = '1';
          recalcCapacityModal();
        });
      }

      // ปุ่มปิด / ยกเลิก Modal ปรับความจุ
      const btnCancelCap = this.root.querySelector('#btn-cancel-cap-modal');
      if (btnCancelCap) {
        btnCancelCap.addEventListener('click', () => {
          this.activeModal = null;
          this.render();
        });
      }
      const btnCancelCap2 = this.root.querySelector('#btn-cancel-cap-modal-2');
      if (btnCancelCap2) {
        btnCancelCap2.addEventListener('click', () => {
          this.activeModal = null;
          this.render();
        });
      }

      // ปุ่มบันทึกและคำนวณเลขที่นั่งสอบใหม่ทั้งหมด
      const btnSaveCapModal = this.root.querySelector('#btn-save-cap-modal');
      if (btnSaveCapModal) {
        btnSaveCapModal.addEventListener('click', () => {
          const startSeatVal = parseInt(startSeatInput ? startSeatInput.value : 1, 10) || 1;
          let curSeat = startSeatVal;

          const rows = this.root.querySelectorAll('.room-cap-row');
          const sortedRooms = [...(appState.rooms || [])].sort((a, b) => {
            const codeA = a.roomCode || a.code || a.id;
            const codeB = b.roomCode || b.code || b.id;
            return codeA.localeCompare(codeB, undefined, { numeric: true });
          });

          rows.forEach(row => {
            const rId = row.getAttribute('data-room-id');
            const chk = row.querySelector('.toggle-room-active');
            const capInput = row.querySelector('.input-room-capacity');

            const targetRoom = sortedRooms.find(r => r.id === rId || r.roomCode === rId || r.code === rId);
            if (targetRoom) {
              const isActive = chk ? chk.checked : true;
              let cap = parseInt(capInput ? capInput.value : 0, 10);
              if (isNaN(cap) || cap < 1) cap = 1;

              targetRoom.isActive = isActive;
              targetRoom.capacity = cap;
              targetRoom.usableCapacity = Math.max(0, cap - (targetRoom.disabledSeats || []).length);

              // Filter out any disabled seats that are beyond the new capacity
              if (targetRoom.disabledSeats && targetRoom.disabledSeats.length > 0) {
                targetRoom.disabledSeats = targetRoom.disabledSeats.filter(s => s <= targetRoom.capacity);
                targetRoom.usableCapacity = Math.max(0, cap - targetRoom.disabledSeats.length);
              }

              if (isActive) {
                const disCount = (targetRoom.disabledSeats || []).length;
                const effectiveSeats = disCount > 0 ? targetRoom.usableCapacity : cap;
                targetRoom.seatStart = curSeat;
                targetRoom.seatEnd = effectiveSeats > 0 ? (curSeat + effectiveSeats - 1) : curSeat;
                curSeat = effectiveSeats > 0 ? (targetRoom.seatEnd + 1) : curSeat;
              } else {
                targetRoom.seatStart = 0;
                targetRoom.seatEnd = 0;
              }
            }
          });

          appState.notify();
          this.activeModal = null;
          this.render();
          this.showToast('บันทึกและคำนวณเลขที่นั่งสอบใหม่ทั้งศูนย์สอบเรียบร้อยแล้ว', 'success');
        });
      }
    }


    // พิมพ์ใบเซ็นชื่อผู้คุมห้องนี้จากใน Modal
    const printRoomSignoffBtn = this.root.querySelector('#btn-print-room-signoff');
    if (printRoomSignoffBtn) {
      printRoomSignoffBtn.addEventListener('click', () => {
        const rId = printRoomSignoffBtn.getAttribute('data-id');
        const room = appState.rooms.find(x => x.id === rId);
        if (room) {
          openPrintableSignoffSheets({
            assignments: appState.assignments,
            sessions: appState.sessions,
            proctors: appState.proctors,
            rooms: [room],
            allocations: appState.allocations.filter(a => a.roomId === room.id),
            settings: appState.settings
          });
        }
      });
    }

    // ลิงก์จากใน Modal ไปหน้าจัดตาราง
    const modalGotoScheduler = this.root.querySelector('#btn-modal-goto-scheduler');
    if (modalGotoScheduler) {
      modalGotoScheduler.addEventListener('click', () => {
        this.activeModal = null;
        this.setTab('scheduler');
      });
    }

    // คลิกพิมพ์ป้ายหน้าห้องของห้องเดี่ยว
    this.root.querySelectorAll('[data-action="print-room-seat-slips"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const rId = btn.getAttribute('data-id');
        openPrintableSeatSlips(appState, rId);
      });
    });

    this.root.querySelectorAll('[data-action="print-room-sign"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const rId = btn.getAttribute('data-id');
        const room = appState.rooms.find(x => x.id === rId);
        if (room) {
          openPrintableDoorSignsAndSeatingPlan({
            rooms: appState.rooms,
            sessions: appState.sessions,
            settings: appState.settings,
            targetRoomId: room.id
          });
        }
      });
    });

    // Quick Solver & Min Proctor Calc
    const runSolverQuick = this.root.querySelector('#btn-run-solver-quick');
    if (runSolverQuick) {
      runSolverQuick.addEventListener('click', () => {
        this.runSolverWithFeedback(true);
      });
    }

    // ปุ่มจากแบนเนอร์หน้าแดชบอร์ด -> ไปหน้าจัดตารางเพื่อตรวจสอบ/ออกใบเซ็น/ยืนยัน
    const gotoConfirmScheduleBtn = this.root.querySelector('#btn-goto-confirm-schedule');
    if (gotoConfirmScheduleBtn) {
      gotoConfirmScheduleBtn.addEventListener('click', () => {
        this.setTab('scheduler');
      });
    }

    // ปุ่มออกใบเซ็นสลับ/เปลี่ยนตัวผู้คุมสอบ (จาก ผศ.ดร.ณัฐพล แสนคำ)
    const openSwapDocBtn = this.root.querySelector('#btn-open-swap-doc-modal');
    if (openSwapDocBtn) {
      openSwapDocBtn.addEventListener('click', () => {
        this.activeModal = {
          type: 'swap-document',
          data: { mode: 'pending', note: '' }
        };
        this.render();
      });
    }

    // ปุ่มดูใบเซ็นสลับฉบับล่าสุดจากประวัติ
    const viewLastSwapDocBtn = this.root.querySelector('#btn-view-last-swap-doc');
    if (viewLastSwapDocBtn) {
      viewLastSwapDocBtn.addEventListener('click', () => {
        const lastDoc = appState.swapDocHistory?.[0];
        if (lastDoc) {
          this.activeModal = {
            type: 'swap-document',
            data: { mode: 'history', docId: lastDoc.id, doc: lastDoc }
          };
          this.render();
        }
      });
    }

    // ปุ่มเอาใบสลับตัวออกทั้งหมด (จากแถบ Scheduler หรือใน Modal — กรณีทดสอบ/สลับผิด)
    const handleClearPendingSwaps = () => {
      const count = (appState.pendingSwaps || []).length;
      if (count === 0) return;
      if (confirm(`ต้องการเอาใบสลับตัวออกทั้งหมด (${count} รายการ) ใช่หรือไม่?\n\n• ปุ่มยืนยันตารางจะถูกปลดล็อกทันที (ตำแหน่งผู้คุมในตารางยังคงเดิม)\n• หากต้องการย้อนตำแหน่งกลับด้วย สามารถกดปุ่ม Undo (↶) หรือ "ยกเลิกฉบับร่าง" ได้`)) {
        const res = appState.clearPendingSwaps(true);
        if (res.success) {
          if (this.activeModal?.type === 'swap-document') {
            this.activeModal = null;
          }
          this.render();
          this.showToast(`เอาใบสลับตัวออกทั้งหมด (${res.clearedCount} รายการ) เรียบร้อยแล้ว`, 'info');
        }
      }
    };

    const clearPendingSwapsBtn = this.root.querySelector('#btn-clear-pending-swaps');
    if (clearPendingSwapsBtn) {
      clearPendingSwapsBtn.addEventListener('click', handleClearPendingSwaps);
    }

    const clearPendingSwapsModalBtn = this.root.querySelector('#btn-clear-pending-swaps-modal');
    if (clearPendingSwapsModalBtn) {
      clearPendingSwapsModalBtn.addEventListener('click', handleClearPendingSwaps);
    }

    // ปุ่มเอารายการออกจากใบสลับตัวทีละรายการ (ภายใน Modal)
    this.root.querySelectorAll('[data-action="remove-pending-swap"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const swapId = btn.getAttribute('data-swap-id');
        if (!swapId) return;
        const res = appState.removePendingSwap(swapId);
        if (res.success) {
          if (res.remaining === 0) {
            this.activeModal = null;
            this.render();
            this.showToast('เอารายการสุดท้ายออกจากใบสลับตัวแล้ว — ปลดล็อกปุ่มยืนยันตารางเรียบร้อย', 'info');
          } else {
            this.render();
            this.showToast(`เอารายการออกจากใบสลับตัวแล้ว (เหลือ ${res.remaining} รายการ)`, 'info');
          }
        }
      });
    });

    // เปลี่ยนดูเอกสารแต่ละฉบับในประวัติใบเซ็นสลับ
    const historySelect = this.root.querySelector('#select-swap-doc-history');
    if (historySelect && this.activeModal?.type === 'swap-document') {
      historySelect.addEventListener('change', (e) => {
        const selectedId = e.target.value;
        const found = (appState.swapDocHistory || []).find(d => d.id === selectedId);
        if (found) {
          this.activeModal.data = { mode: 'history', docId: found.id, doc: found };
          this.render();
        }
      });
    }

    // ลบเอกสารใบเซ็นสลับฉบับที่เลือกออกจากประวัติ
    const deleteHistoryDocBtn = this.root.querySelector('#btn-delete-swap-doc-history');
    if (deleteHistoryDocBtn) {
      deleteHistoryDocBtn.addEventListener('click', () => {
        const docId = deleteHistoryDocBtn.getAttribute('data-doc-id');
        if (!docId) return;
        if (confirm('ต้องการลบเอกสารใบเซ็นสลับฉบับนี้ออกจากประวัติใช่หรือไม่?')) {
          const res = appState.deleteSwapDocHistory(docId);
          if (res.success) {
            if (res.remaining === 0) {
              this.activeModal = null;
            } else {
              const nextDoc = appState.swapDocHistory[0];
              this.activeModal.data = { mode: 'history', docId: nextDoc.id, doc: nextDoc };
            }
            this.render();
            this.showToast(`ลบเอกสาร ${res.removed?.docNumber || ''} ออกจากประวัติแล้ว`, 'info');
          }
        }
      });
    }

    // ล้างประวัติเอกสารใบเซ็นสลับทั้งหมด
    const clearHistoryDocsBtn = this.root.querySelector('#btn-clear-swap-doc-history');
    if (clearHistoryDocsBtn) {
      clearHistoryDocsBtn.addEventListener('click', () => {
        if (confirm('ต้องการล้างประวัติเอกสารใบเซ็นสลับทั้งหมดใช่หรือไม่?')) {
          const res = appState.clearSwapDocHistory();
          if (res.success) {
            this.activeModal = null;
            this.render();
            this.showToast(`ล้างประวัติเอกสารใบเซ็นสลับทั้งหมด (${res.clearedCount} ฉบับ) เรียบร้อยแล้ว`, 'info');
          }
        }
      });
    }

    // ปุ่มยืนยันตารางสอบเพื่อส่งขึ้นหน้าแดชบอร์ด
    const confirmPublishBtn = this.root.querySelector('#btn-confirm-publish-schedule');
    if (confirmPublishBtn) {
      confirmPublishBtn.addEventListener('click', () => {
        const res = appState.confirmAndPublishSchedule();
        if (!res.success) {
          this.showToast(res.message, 'warning');
          if (res.requireSwapDoc) {
            this.activeModal = {
              type: 'swap-document',
              data: { mode: 'pending', note: '' }
            };
            this.render();
          }
          return;
        }
        this.showToast(res.message, 'success');
      });
    }

    // ปุ่มยกเลิกฉบับร่างและคืนค่าตารางที่ยืนยันล่าสุด
    const discardDraftBtn = this.root.querySelector('#btn-discard-draft');
    if (discardDraftBtn) {
      discardDraftBtn.addEventListener('click', () => {
        if (confirm('ต้องการยกเลิกการแก้ไขฉบับร่างและคืนค่าตารางที่ยืนยันล่าสุดใช่หรือไม่?')) {
          appState.discardDraftChanges();
          this.showToast('ยกเลิกฉบับร่างและคืนค่าตารางที่ยืนยันล่าสุดเรียบร้อยแล้ว', 'info');
        }
      });
    }

    // เหตุการณ์ภายใน Modal เอกสารใบเซ็นสลับตัว
    const swapNoteInput = this.root.querySelector('#input-swap-doc-note');
    if (swapNoteInput && this.activeModal?.type === 'swap-document') {
      swapNoteInput.addEventListener('input', (e) => {
        const newNote = e.target.value;
        this.activeModal.data.note = newNote;
        const previewEl = this.root.querySelector('#swap-doc-preview-inner');
        if (previewEl) {
          const docNumber = (appState.swapDocIssued && appState.swapDocHistory?.[0]?.docNumber)
            ? appState.swapDocHistory[0].docNumber
            : appState.getNextSwapDocNumber();
          previewEl.innerHTML = renderSwapMemoDocumentHtml({
            swaps: appState.pendingSwaps || [],
            docNumber,
            issuedDate: new Date().toISOString(),
            note: newNote,
            settings: appState.settings
          });
        }
      });
    }

    const printSwapMemoBtn = this.root.querySelector('#btn-print-swap-memo');
    if (printSwapMemoBtn && this.activeModal?.type === 'swap-document') {
      printSwapMemoBtn.addEventListener('click', () => {
        const mData = this.activeModal.data || {};
        const isHistory = mData.mode === 'history';
        const swaps = isHistory ? (mData.doc?.swaps || []) : (appState.pendingSwaps || []);
        const docNumber = isHistory
          ? (mData.doc?.docNumber || 'บส. 001/2569')
          : (appState.swapDocIssued && appState.swapDocHistory?.[0]?.docNumber
            ? appState.swapDocHistory[0].docNumber
            : appState.getNextSwapDocNumber());
        const issuedDate = isHistory ? mData.doc?.issuedAt : new Date().toISOString();
        const note = isHistory ? (mData.doc?.note || '') : (mData.note || '');
        openPrintableSwapMemo({
          swaps,
          docNumber,
          issuedDate,
          note,
          settings: appState.settings
        });
      });
    }

    const markSwapDocIssuedBtn = this.root.querySelector('#btn-mark-swap-doc-issued');
    if (markSwapDocIssuedBtn && this.activeModal?.type === 'swap-document') {
      markSwapDocIssuedBtn.addEventListener('click', () => {
        const note = this.activeModal.data?.note || '';
        const res = appState.markSwapDocumentIssued(note);
        if (res.success) {
          this.activeModal = null;
          this.render();
          this.showToast(`ออกใบเซ็นสลับเลขที่ ${res.doc.docNumber} (จาก ผศ.ดร.ณัฐพล แสนคำ) ส่งตรวจเรียบร้อย — ปลดล็อกปุ่มยืนยันตารางแล้ว`, 'success');
        } else {
          this.showToast(res.message, 'error');
        }
      });
    }

    const closeModalReadyBtn = this.root.querySelector('#btn-close-modal-ready');
    if (closeModalReadyBtn) {
      closeModalReadyBtn.addEventListener('click', () => {
        this.activeModal = null;
        this.render();
      });
    }

    // สุ่มสร้างผู้คุม 80 คนทันที (Hero & Master Data)
    const handleGen80 = () => {
      appState.autoGenerateSufficientProctors(80);
      alert('🎉 สุ่มสร้างรายชื่ออาจารย์และบุคลากรผู้คุมสอบ 80 ท่านเรียบร้อยแล้ว!\n\nคุณสามารถกดปุ่ม "🚀 เริ่มจัดตารางอัตโนมัติ" ได้ทันทีโดยไม่ต้องพิมพ์เองแม้แต่คนเดียว');
    };

    const genProctorsHeroBtn = this.root.querySelector('#btn-quick-gen-proctors-hero');
    if (genProctorsHeroBtn) genProctorsHeroBtn.addEventListener('click', handleGen80);

    const genProctorsMasterBtn = this.root.querySelector('#btn-auto-gen-proctors-master');
    if (genProctorsMasterBtn) genProctorsMasterBtn.addEventListener('click', handleGen80);

    // สุ่มเพิ่มผู้คุมอีก 20 คน (Hero & Master Data)
    const handleAdd20 = () => {
      const total = appState.addRandomProctors(20);
      alert(`➕ สุ่มเพิ่มผู้คุมสอบให้อีก 20 ท่านเรียบร้อยแล้ว! (รวมทั้งสิ้น ${total} ท่าน)`);
    };

    const add20HeroBtn = this.root.querySelector('#btn-add-20-proctors-hero');
    if (add20HeroBtn) add20HeroBtn.addEventListener('click', handleAdd20);

    const add20MasterBtn = this.root.querySelector('#btn-add-random-20-master');
    if (add20MasterBtn) add20MasterBtn.addEventListener('click', handleAdd20);

    const calcMinBtn = this.root.querySelector('#btn-calc-min-proctor');
    if (calcMinBtn) {
      calcMinBtn.addEventListener('click', () => {
        this.minProctorResult = appState.calculateMinProctors();
        this.render();
      });
    }

    const closeMinCalc = this.root.querySelector('#btn-close-min-calc');
    if (closeMinCalc) {
      closeMinCalc.addEventListener('click', () => {
        this.minProctorResult = null;
        this.render();
      });
    }

    const gotoScheduler = this.root.querySelector('#btn-goto-scheduler');
    if (gotoScheduler) gotoScheduler.addEventListener('click', () => this.setTab('scheduler'));

    // คลิกที่ 4 การ์ดสถิติหน้าแดชบอร์ด (Dashboard KPI Cards)
    const cardKpiRooms = this.root.querySelector('[data-action="view-kpi-rooms"]');
    if (cardKpiRooms) {
      cardKpiRooms.addEventListener('click', () => {
        this.activeModal = { type: 'modal-kpi-rooms' };
        this.render();
      });
      cardKpiRooms.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.activeModal = { type: 'modal-kpi-rooms' };
          this.render();
        }
      });
    }

    const cardKpiProctors = this.root.querySelector('[data-action="view-kpi-proctors"]');
    if (cardKpiProctors) {
      cardKpiProctors.addEventListener('click', () => {
        this.activeModal = { type: 'modal-kpi-proctors' };
        this.render();
      });
      cardKpiProctors.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.activeModal = { type: 'modal-kpi-proctors' };
          this.render();
        }
      });
    }

    const cardKpiSchedule = this.root.querySelector('[data-action="view-kpi-schedule-status"]');
    if (cardKpiSchedule) {
      cardKpiSchedule.addEventListener('click', () => {
        const confirmedAssigns = appState.confirmedAssignments || [];
        const valResult = validateSchedule({
          assignments: confirmedAssigns,
          allocations: appState.allocations,
          sessions: appState.sessions,
          proctors: appState.proctors,
          rooms: appState.rooms,
          unavailabilities: appState.unavailabilities,
          settings: appState.settings
        });
        const totalSlots = appState.allocations.reduce((sum, al) => sum + (al.examineesInRoom > appState.settings.hardConstraints.h5_examinee_threshold_for_two_proctors ? 2 : 1), 0)
          + (appState.sessions.length * appState.settings.hardConstraints.h8_reserve_proctors_per_session);
        const assignedSlots = confirmedAssigns.length;
        const isComplete = assignedSlots >= totalSlots && valResult.isValid;

        this.activeModal = {
          type: 'modal-kpi-schedule-status',
          data: { valResult, totalSlots, assignedSlots, isComplete, useConfirmed: true }
        };
        this.render();
      });
      cardKpiSchedule.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          cardKpiSchedule.click();
        }
      });
    }

    const cardKpiRules = this.root.querySelector('[data-action="view-kpi-rules-audit"]');
    if (cardKpiRules) {
      cardKpiRules.addEventListener('click', () => {
        const valResult = validateSchedule({
          assignments: appState.confirmedAssignments || [],
          allocations: appState.allocations,
          sessions: appState.sessions,
          proctors: appState.proctors,
          rooms: appState.rooms,
          unavailabilities: appState.unavailabilities,
          settings: appState.settings
        });
        this.activeModal = {
          type: 'modal-kpi-rules-audit',
          data: { valResult }
        };
        this.render();
      });
      cardKpiRules.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          cardKpiRules.click();
        }
      });
    }

    // ปุ่มนำทางใน KPI Modals
    const navMasterRooms = this.root.querySelector('[data-action="nav-master-rooms"]');
    if (navMasterRooms) {
      navMasterRooms.addEventListener('click', () => {
        this.activeModal = null;
        this.setTab('rooms');
        this.masterDataSubTab = 'rooms';
        this.roomsViewMode = 'table';
      });
    }

    const navMasterProctors = this.root.querySelector('[data-action="nav-master-proctors"]');
    if (navMasterProctors) {
      navMasterProctors.addEventListener('click', () => {
        this.activeModal = null;
        this.setTab('master-data');
        this.masterDataSubTab = 'proctors';
        this.proctorFilterType = 'all';
      });
    }

    const navScheduler = this.root.querySelector('[data-action="nav-scheduler"]');
    if (navScheduler) {
      navScheduler.addEventListener('click', () => {
        this.activeModal = null;
        this.setTab('scheduler');
      });
    }

    const navSettings = this.root.querySelector('[data-action="nav-settings"]');
    if (navSettings) {
      navSettings.addEventListener('click', () => {
        this.activeModal = null;
        this.setTab('settings');
      });
    }

    // สลับมุมมองรอบการสอบหน้าแดชบอร์ด (Cards / Table)
    this.root.querySelectorAll('[data-session-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-session-view');
        if (mode) {
          this.dashboardSessionView = mode;
          this.render();
        }
      });
    });

    // Quick Actions ใน Hero Banner
    this.root.querySelectorAll('[data-quick-action]').forEach(card => {
      card.addEventListener('click', () => {
        const act = card.getAttribute('data-quick-action');
        if (act === 'run-solver') {
          this.runSolverWithFeedback(true);
        } else if (act === 'gen-proctors') {
          handleGen80();
        } else if (act === 'calc-min') {
          this.minProctorResult = appState.calculateMinProctors();
          this.render();
        } else if (act === 'floor-plan') {
          this.setTab('rooms');
          this.masterDataSubTab = 'rooms';
          this.roomsViewMode = 'floor1';
          this.render();
        } else if (act === 'rules-audit') {
          const valResult = validateSchedule({
            assignments: appState.confirmedAssignments || [],
            allocations: appState.allocations,
            sessions: appState.sessions,
            proctors: appState.proctors,
            rooms: appState.rooms,
            unavailabilities: appState.unavailabilities,
            settings: appState.settings
          });
          this.activeModal = {
            type: 'modal-kpi-rules-audit',
            data: { valResult }
          };
          this.render();
        }
      });
    });

    // ลิงก์ดูรอบการสอบใน Scheduler จากการ์ดหรือแถวตารางละเอียดในแดชบอร์ด
    this.root.querySelectorAll('[data-action="view-session-scheduler"]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="cancel-session"]')) return;
        e.stopPropagation();
        const sId = el.getAttribute('data-session-id');
        if (sId) {
          this.selectedSessionFilter = sId;
        }
        this.setTab('scheduler');
      });
    });

    // กรองรอบการสอบในหน้า Scheduler ด้วย Filter Pills
    this.root.querySelectorAll('[data-filter-session]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-filter-session');
        if (sId) {
          this.selectedSessionFilter = sId;
          this.render();
        }
      });
    });

    const runSolverModal = this.root.querySelector('#btn-run-solver-from-modal');
    if (runSolverModal) {
      runSolverModal.addEventListener('click', () => {
        this.activeModal = null;
        this.runSolverWithFeedback();
      });
    }

    // Subviews ในหน้าจัดตาราง
    const subGrid = this.root.querySelector('#subview-grid');
    if (subGrid) subGrid.addEventListener('click', () => this.setScheduleSubView('grid'));
    const subPersonal = this.root.querySelector('#subview-personal');
    if (subPersonal) subPersonal.addEventListener('click', () => this.setScheduleSubView('personal'));
    const subWorkload = this.root.querySelector('#subview-workload');
    if (subWorkload) subWorkload.addEventListener('click', () => this.setScheduleSubView('workload'));

    const runSolverBtn = this.root.querySelector('#btn-run-solver');
    if (runSolverBtn) runSolverBtn.addEventListener('click', () => this.runSolverWithFeedback());

    // ลากะทันหัน Modal
    const suddenLeaveBtn = this.root.querySelector('#btn-sudden-leave-modal');
    if (suddenLeaveBtn) {
      suddenLeaveBtn.addEventListener('click', () => {
        this.activeModal = { type: 'sudden-leave', data: {} };
        this.render();
        this.updateSuddenLeaveCandidates();
      });
    }

    // Master data sub-tabs
    this.root.querySelectorAll('[data-master-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.masterDataSubTab = btn.getAttribute('data-master-tab');
        this.render();
      });
    });

    // PDPA toggle
    const togglePdpaBtn = this.root.querySelector('#btn-toggle-pdpa');
    if (togglePdpaBtn) {
      togglePdpaBtn.addEventListener('click', () => {
        this.maskPDPA = !this.maskPDPA;
        this.render();
      });
    }

    // Presets
    this.root.querySelectorAll('[data-action="load-preset"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pKey = btn.getAttribute('data-preset');
        if (pKey) appState.loadPreset(pKey);
      });
    });

    // CSV Download Template
    const dlTplBtn = this.root.querySelector('#btn-download-template');
    if (dlTplBtn) {
      dlTplBtn.addEventListener('click', () => {
        const tplKey = this.masterDataSubTab === 'rooms' ? 'rooms' : ((this.masterDataSubTab === 'unavail' || (this.masterDataSubTab === 'proctors' && this.proctorFilterType === 'unavail')) ? 'unavailabilities' : 'proctors');
        const tpl = CSV_TEMPLATES[tplKey];
        const csvContent = exportToCSV(tpl.sampleData, tpl.columns);
        triggerCSVDownload(csvContent, tpl.filename);
      });
    }

    // CSV Export Current
    const exportCsvBtn = this.root.querySelector('#btn-export-current-csv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        if (this.masterDataSubTab === 'proctors') {
          if (this.proctorFilterType === 'unavail') {
            const tpl = CSV_TEMPLATES.unavailabilities;
            triggerCSVDownload(exportToCSV(appState.unavailabilities, tpl.columns), 'unavailability_data.csv');
          } else {
            const tpl = CSV_TEMPLATES.proctors;
            triggerCSVDownload(exportToCSV(appState.proctors, tpl.columns), 'proctors_data.csv');
          }
        } else if (this.masterDataSubTab === 'rooms') {
          const tpl = CSV_TEMPLATES.rooms;
          triggerCSVDownload(exportToCSV(appState.rooms, tpl.columns), 'rooms_data.csv');
        } else if (this.masterDataSubTab === 'unavail') {
          const tpl = CSV_TEMPLATES.unavailabilities;
          triggerCSVDownload(exportToCSV(appState.unavailabilities, tpl.columns), 'unavailability_data.csv');
        }
      });
    }

    // CSV Import
    const importFileInput = this.root.querySelector('#file-import-csv');
    if (importFileInput) {
      importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const rows = parseCSV(evt.target.result);
            if (rows.length > 0) {
              alert(`นำเข้าข้อมูลสำเร็จ ${rows.length} รายการ`);
            }
          };
          reader.readAsText(file, 'UTF-8');
        }
      });
    }

    // ค้นหาและกรองผู้คุมสอบใน Master Data
    const searchProctorInput = this.root.querySelector('#input-search-proctor');
    if (searchProctorInput) {
      searchProctorInput.addEventListener('input', (e) => {
        this.proctorSearchQuery = e.target.value;
        this.render();
        const inp = this.root.querySelector('#input-search-proctor');
        if (inp) {
          inp.focus();
          inp.setSelectionRange(inp.value.length, inp.value.length);
        }
      });
    }

    const filterLevelSelect = this.root.querySelector('#select-filter-level');
    if (filterLevelSelect) {
      filterLevelSelect.addEventListener('change', (e) => {
        this.proctorFilterLevel = e.target.value;
        this.render();
      });
    }

    const filterQuotaSelect = this.root.querySelector('#select-filter-quota');
    if (filterQuotaSelect) {
      filterQuotaSelect.addEventListener('change', (e) => {
        this.proctorFilterQuota = e.target.value;
        this.render();
      });
    }

    const clearProctorFilterBtn = this.root.querySelector('#btn-clear-proctor-filter');
    if (clearProctorFilterBtn) {
      clearProctorFilterBtn.addEventListener('click', () => {
        this.proctorSearchQuery = '';
        this.proctorFilterLevel = 'all';
        this.proctorFilterQuota = 'all';
        this.proctorFilterType = 'all';
        this.render();
      });
    }

    const clearProctorFilterEmptyBtn = this.root.querySelector('#btn-clear-proctor-filter-empty');
    if (clearProctorFilterEmptyBtn) {
      clearProctorFilterEmptyBtn.addEventListener('click', () => {
        this.proctorSearchQuery = '';
        this.proctorFilterLevel = 'all';
        this.proctorFilterQuota = 'all';
        this.proctorFilterType = 'all';
        this.render();
      });
    }

    // กรองประเภทผู้คุมสอบ (Segmented Control: ทั้งหมด / อาจารย์ / เจ้าหน้าที่)
    this.root.querySelectorAll('[data-proctor-type]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.proctorFilterType = chip.getAttribute('data-proctor-type');
        this.render();
      });
    });

    // --- ผู้คุมสอบ: สลับแท็บย่อย (5 แท็บ: กำหนดกลุ่ม/โควต้า, ข้อมูลผู้คุม, สรุปรายบุคคล, คำขอเปลี่ยนตัว, เอกสารคำสั่ง) ---
    const subtabQuotaBtn = this.root.querySelector('#btn-subtab-proctor-quota');
    if (subtabQuotaBtn) {
      subtabQuotaBtn.addEventListener('click', () => {
        this.proctorSubTab = 'quota';
        this.render();
      });
    }

    const subtabInfoBtn = this.root.querySelector('#btn-subtab-proctor-info');
    if (subtabInfoBtn) {
      subtabInfoBtn.addEventListener('click', () => {
        this.proctorSubTab = 'info';
        this.render();
      });
    }

    const subtabSummaryBtn = this.root.querySelector('#btn-subtab-proctor-summary');
    if (subtabSummaryBtn) {
      subtabSummaryBtn.addEventListener('click', () => {
        this.proctorSubTab = 'personal-summary';
        this.render();
      });
    }

    const subtabSwapsBtn = this.root.querySelector('#btn-subtab-proctor-swaps');
    if (subtabSwapsBtn) {
      subtabSwapsBtn.addEventListener('click', () => {
        this.proctorSubTab = 'swaps';
        this.render();
      });
    }

    const subtabDocsBtn = this.root.querySelector('#btn-subtab-proctor-docs');
    if (subtabDocsBtn) {
      subtabDocsBtn.addEventListener('click', () => {
        this.proctorSubTab = 'docs';
        this.render();
      });
    }

    // ปุ่มในหน้าคำขอเปลี่ยนตัว
    const openSuddenLeaveSwapsBtn = this.root.querySelector('#btn-open-sudden-leave-swaps, #btn-create-first-swap');
    if (openSuddenLeaveSwapsBtn) {
      openSuddenLeaveSwapsBtn.addEventListener('click', () => {
        this.activeModal = { type: 'sudden-leave' };
        this.render();
      });
    }

    const openSwapMemoSwapsBtn = this.root.querySelector('#btn-open-swap-memo-swaps, #btn-issue-swap-doc-swaps');
    if (openSwapMemoSwapsBtn) {
      openSwapMemoSwapsBtn.addEventListener('click', () => {
        this.activeModal = { type: 'swap-memo-preview' };
        this.render();
      });
    }

    // ปุ่มในหน้าเอกสารและคำสั่งสอบ
    const printApptOrderDocBtn = this.root.querySelector('#btn-print-appointment-order-doc');
    if (printApptOrderDocBtn) {
      printApptOrderDocBtn.addEventListener('click', () => {
        openPrintableAppointmentOrder(appState);
      });
    }

    const printSwapMemoDocBtn = this.root.querySelector('#btn-print-swap-memo-doc');
    if (printSwapMemoDocBtn) {
      printSwapMemoDocBtn.addEventListener('click', () => {
        const latestDoc = (appState.swapDocHistory && appState.swapDocHistory.length > 0) ? appState.swapDocHistory[0] : null;
        openPrintableSwapMemo(appState, latestDoc?.swaps || appState.pendingSwaps, latestDoc?.docNumber || 'มอ.บร. 017/2569');
      });
    }

    const viewSwapHistoryDocBtn = this.root.querySelector('#btn-view-swap-history-doc');
    if (viewSwapHistoryDocBtn) {
      viewSwapHistoryDocBtn.addEventListener('click', () => {
        this.activeModal = { type: 'swap-memo-history' };
        this.render();
      });
    }

    // กรองกลุ่มบุคลากร (ทั้งหมด / กลุ่มหลัก / กลุ่มสำรอง) ในหน้าโควต้า
    this.root.querySelectorAll('.btn-filter-pool').forEach(btn => {
      btn.addEventListener('click', () => {
        this.proctorPoolFilter = btn.getAttribute('data-pool') || 'all';
        this.render();
      });
    });

    // ค้นหาในหน้าโควต้าผู้คุมสอบ
    const searchQuotaInput = this.root.querySelector('#search-proctors-quota-input');
    if (searchQuotaInput) {
      searchQuotaInput.addEventListener('input', (e) => {
        this.proctorQuotaSearchKeyword = e.target.value;
        this.render();
        const refocused = this.root.querySelector('#search-proctors-quota-input');
        if (refocused) {
          refocused.focus();
          refocused.setSelectionRange(refocused.value.length, refocused.value.length);
        }
      });
    }

    // ปุ่มสลับ Pool รายคน (Core <-> Reserve)
    this.root.querySelectorAll('[data-action="toggle-proctor-pool"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = btn.getAttribute('data-proctor-id') || btn.getAttribute('data-id');
        if (pId) {
          appState.toggleProctorPool(pId);
          this.render();
        }
      });
    });

    // ตั้งค่าเป็นกลุ่มหลักทั้งหมด
    const setAllCoreBtn = this.root.querySelector('#btn-set-all-core');
    if (setAllCoreBtn) {
      setAllCoreBtn.addEventListener('click', () => {
        appState.setAllProctorsPool('core');
        this.showToast('ตั้งค่าบุคลากรทั้งหมดเป็นกลุ่มหลัก (Core Pool) เรียบร้อย', 'success');
        this.render();
      });
    }

    // ตั้งค่าเป็นกลุ่มสำรองทั้งหมด
    const setAllReserveBtn = this.root.querySelector('#btn-set-all-reserve');
    if (setAllReserveBtn) {
      setAllReserveBtn.addEventListener('click', () => {
        appState.setAllProctorsPool('reserve');
        this.showToast('ตั้งค่าบุคลากรทั้งหมดเป็นกลุ่มสำรอง (Reserve Pool) เรียบร้อย', 'info');
        this.render();
      });
    }

    // จำลองข้อมูล (Preset Quotas)
    const presetQuotasBtn = this.root.querySelector('#btn-preset-quotas');
    if (presetQuotasBtn) {
      presetQuotasBtn.addEventListener('click', () => {
        appState.presetDefaultQuotas();
        this.showToast('จำลองตั้งค่าโควต้าและกลุ่มอัตโนมัติ (Preset) เรียบร้อยแล้ว', 'success');
        this.render();
      });
    }

    // รีเซ็ตโควต้าและเงื่อนไขทั้งหมด
    const resetQuotasBtn = this.root.querySelector('#btn-reset-proctor-quotas');
    if (resetQuotasBtn) {
      resetQuotasBtn.addEventListener('click', () => {
        if (confirm('ต้องการรีเซ็ตโควต้าและเงื่อนไขผู้คุมสอบทั้งหมดกลับเป็นค่าเริ่มต้นใช่หรือไม่?')) {
          appState.resetAllProctorQuotas();
          this.showToast('รีเซ็ตเงื่อนไขและโควต้าผู้คุมสอบทั้งหมดเรียบร้อยแล้ว', 'info');
          this.render();
        }
      });
    }

    // เปลี่ยนโควต้าผ่าน Select Dropdown
    this.root.querySelectorAll('.select-proctor-quota').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const pId = sel.getAttribute('data-proctor-id') || sel.getAttribute('data-id');
        if (pId) {
          appState.updateProctorQuota(pId, sel.value);
          this.showToast(`บันทึกโควต้า ${sel.value} รอบเรียบร้อย`, 'success');
        }
      });
    });

    // เปลี่ยนรูปแบบการคุมสอบ (Session Pattern)
    this.root.querySelectorAll('.select-proctor-pattern').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const pId = sel.getAttribute('data-proctor-id') || sel.getAttribute('data-id');
        if (pId) {
          appState.updateProctorSessionPattern(pId, sel.value);
          this.showToast('บันทึกรูปแบบการคุมสอบเรียบร้อย', 'success');
        }
      });
    });

    // สลับความสะดวกในแต่ละรอบ (เช้า/บ่าย)
    this.root.querySelectorAll('[data-action="toggle-session-avail"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = btn.getAttribute('data-proctor-id');
        const sId = btn.getAttribute('data-session-id');
        if (pId && sId) {
          appState.toggleProctorSessionAvailability(pId, sId);
          this.render();
        }
      });
    });

    // สะดวกทุกรอบ (เช้า-บ่าย)
    this.root.querySelectorAll('[data-action="set-all-avail"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = btn.getAttribute('data-proctor-id');
        if (pId) {
          appState.setProctorAllSessionsAvailable(pId);
          this.showToast('เปิดสถานะสะดวกทุกรอบการสอบเรียบร้อย', 'success');
          this.render();
        }
      });
    });

    // ปุ่มเพิ่มผู้คุมสอบจากหน้าโควต้า
    const addProctorQuotaBtn = this.root.querySelector('#btn-add-proctor-quota');
    if (addProctorQuotaBtn) {
      addProctorQuotaBtn.addEventListener('click', () => {
        this.activeModal = {
          type: 'modal-master-proctors',
          data: null
        };
        this.render();
      });
    }

    // สลับเปิด/ปิดกล่อง Priority Logic
    const togglePriorityBtn = this.root.querySelector('#btn-toggle-priority-logic');
    if (togglePriorityBtn) {
      togglePriorityBtn.addEventListener('click', () => {
        this.isPriorityLogicOpen = !this.isPriorityLogicOpen;
        this.render();
      });
    }

    // ล้างกลุ่มหลัก (ย้ายทั้งหมดไปสำรอง)
    const clearCoreBtn = this.root.querySelector('#btn-clear-core-pool');
    if (clearCoreBtn) {
      clearCoreBtn.addEventListener('click', () => {
        if (confirm('ต้องการล้างกลุ่มหลัก โดยย้ายบุคลากรทั้งหมดไปเป็นกลุ่มสำรองใช่หรือไม่?')) {
          appState.setAllProctorsPool('reserve');
          this.showToast('ล้างกลุ่มหลักแล้ว (ย้ายบุคลากรทั้งหมดไปกลุ่มสำรอง)', 'info');
          this.render();
        }
      });
    }

    // ล้างกลุ่มสำรอง (ย้ายทั้งหมดไปกลุ่มหลัก)
    const clearReserveBtn = this.root.querySelector('#btn-clear-reserve-pool');
    if (clearReserveBtn) {
      clearReserveBtn.addEventListener('click', () => {
        if (confirm('ต้องการล้างกลุ่มสำรอง โดยย้ายบุคลากรทั้งหมดไปเป็นกลุ่มหลักใช่หรือไม่?')) {
          appState.setAllProctorsPool('core');
          this.showToast('ล้างกลุ่มสำรองแล้ว (ย้ายบุคลากรทั้งหมดไปกลุ่มหลัก)', 'info');
          this.render();
        }
      });
    }

    // ปุ่มติ๊กถูก บันทึกโควต้า & เงื่อนไขรายแถว
    this.root.querySelectorAll('[data-action="save-proctor-quota-row"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = btn.getAttribute('data-proctor-id');
        const p = appState.proctors.find(x => x.id === pId);
        const name = p ? `${p.academicTitle ? p.academicTitle + ' ' : ''}${p.firstName} ${p.lastName}` : pId;
        this.showToast(`บันทึกโควต้าและเงื่อนไขของ "${name}" เรียบร้อยแล้ว`, 'success');
      });
    });

    // ปุ่มลบผู้คุมสอบ (จากหน้าโควต้า)
    this.root.querySelectorAll('[data-action="delete-proctor"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = btn.getAttribute('data-proctor-id') || btn.getAttribute('data-id');
        const p = appState.proctors.find(x => x.id === pId);
        const name = p ? `${p.firstName} ${p.lastName} (${pId})` : pId;
        if (confirm(`คุณต้องการลบข้อมูลผู้คุมสอบ "${name}" ใช่หรือไม่?`)) {
          appState.deleteProctor(pId);
          this.showToast(`ลบข้อมูล ${name} เรียบร้อยแล้ว`, 'info');
          this.render();
        }
      });
    });

    // เปิด/ปิด กล่องเครื่องมือทดสอบระบบ & Presets
    const toggleTestToolsBtn = this.root.querySelector('#btn-toggle-test-tools');
    if (toggleTestToolsBtn) {
      toggleTestToolsBtn.addEventListener('click', () => {
        this.isTestToolsOpen = !this.isTestToolsOpen;
        this.render();
      });
    }

    // Dropdown เมนูแบบเปิด/ปิด (Topbar Export & CSV I/O)
    this.root.querySelectorAll('.custom-dropdown-trigger').forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = trigger.closest('.custom-dropdown');
        const wasActive = dropdown?.classList.contains('is-active');
        this.root.querySelectorAll('.custom-dropdown.is-active').forEach(d => d.classList.remove('is-active'));
        if (!wasActive && dropdown) {
          dropdown.classList.add('is-active');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    });

    this.root.querySelectorAll('.custom-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        this.root.querySelectorAll('.custom-dropdown.is-active').forEach(d => d.classList.remove('is-active'));
      });
    });

    if (!this._dropdownDocListenerAttached) {
      this._dropdownDocListenerAttached = true;
      document.addEventListener('click', () => {
        document.querySelectorAll('.custom-dropdown.is-active').forEach(d => d.classList.remove('is-active'));
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          document.querySelectorAll('.custom-dropdown.is-active').forEach(d => d.classList.remove('is-active'));
        }
      });
    }

    // What-if actions
    this.root.querySelectorAll('[data-action="run-whatif"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sc = btn.getAttribute('data-scenario');
        if (sc === 'reduce-quota') {
          this.whatIfScenario = {
            title: 'ลดโควต้าลง 1 รอบ/วัน',
            description: 'ระบบทดลองจำลองตารางเมื่อปรับ daily quota เหลือ 1 รอบ/วัน ผลลัพธ์: พบว่าผู้คุมไม่เพียงพอสำหรับรอบบ่าย ขาดอีก 8 ตำแหน่ง',
            success: false
          };
        } else if (sc === 'proctors-leave') {
          this.whatIfScenario = {
            title: 'ผู้คุม 5 คนลาป่วยกะทันหัน',
            description: 'สุ่มดึงผู้คุม 5 คนออก และใช้ผู้คุมสำรอง ผลลัพธ์: สามารถจัดตารางแทนที่ได้สมบูรณ์ 100% โดยดึงผู้คุมสำรอง 4 คน และผู้คุมที่มีโควต้าว่าง 1 คน',
            success: true
          };
        } else if (sc === 'room-broken') {
          this.whatIfScenario = {
            title: 'ห้อง R03 แอร์เสีย',
            description: 'ปิดห้อง R03 และเกลี่ยผู้สอบ 35 คนไปห้องที่เหลือ ผลลัพธ์: ทุกห้องยังคงจุได้ไม่เกิน capacity และจัดผู้คุมลงตัว',
            success: true
          };
        }
        this.render();
      });
    });

    // Save Snapshot Version
    const saveVerBtn = this.root.querySelector('#btn-save-version');
    if (saveVerBtn) {
      saveVerBtn.addEventListener('click', () => {
        const note = prompt('ระบุบันทึกช่วยจำสำหรับ Snapshot นี้:', 'ตารางฉบับปรับปรุง');
        if (note !== null) {
          appState.saveVersionSnapshot(note);
        }
      });
    }

    // Restore Version
    this.root.querySelectorAll('[data-action="restore-version"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const vId = btn.getAttribute('data-version-id');
        if (vId && confirm('ต้องการย้อนกลับไปใช้เวอร์ชันนี้ใช่หรือไม่?')) {
          appState.restoreVersion(vId);
        }
      });
    });

    // Diff compare
    this.root.querySelectorAll('[data-action="compare-diff"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const v1 = btn.getAttribute('data-v1');
        const v2 = btn.getAttribute('data-v2');
        const diff = appState.compareVersions(v1, v2);
        if (diff) {
          alert(`เปรียบเทียบเวอร์ชัน ${diff.versionA} กับ ${diff.versionB}:\nพบการเปลี่ยนแปลงทั้งหมด ${diff.differences.length} ตำแหน่ง`);
        }
      });
    });

    // Settings form submit
    const settingsForm = this.root.querySelector('#form-settings');
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(settingsForm);
        appState.settings.hardConstraints.h3_daily_quota_default = Number(fd.get('dailyQuota'));
        appState.settings.hardConstraints.h3_project_quota_default = Number(fd.get('projectQuota'));
        appState.settings.hardConstraints.h3_max_hours_default = Number(fd.get('maxHours'));
        appState.settings.hardConstraints.h5_examinee_threshold_for_two_proctors = Number(fd.get('examineeThreshold'));
        appState.settings.hardConstraints.h6_min_rest_minutes_between_sessions = Number(fd.get('minRest'));
        appState.settings.hardConstraints.h8_reserve_proctors_per_session = Number(fd.get('reserveCount'));
        appState.settings.hardConstraints.h7_require_all_computer_rooms = fd.get('requireAllComputer') === '1';
        appState.notify();
        alert('บันทึกการตั้งค่าเรียบร้อยแล้ว');
      });
    }

    const resetSettingsBtn = this.root.querySelector('#btn-reset-settings');
    if (resetSettingsBtn) {
      resetSettingsBtn.addEventListener('click', () => {
        if (confirm('ต้องการรีเซ็ตการตั้งค่าเป็นค่ามาตรฐานทั้งหมดใช่หรือไม่?')) {
          appState.resetSettings();
        }
      });
    }

    // Run All Tests
    const runTestsBtn = this.root.querySelector('#btn-run-all-tests');
    if (runTestsBtn) {
      runTestsBtn.addEventListener('click', async () => {
        runTestsBtn.disabled = true;
        runTestsBtn.textContent = '⏳ กำลังรันการทดสอบ...';
        this.testResults = await runAllTests();
        this.render();
      });
    }

    // --- ระบบลากปรับเปลี่ยนคน เปลี่ยนรอบได้ (Ultra-Smooth rAF Pointer Drag & Drop: รองรับลูกกลิ้งเมาส์ + Auto-Scroll + Touch + Esc) ---
    if (this._cleanupActiveDrag) {
      this._cleanupActiveDrag();
      this._cleanupActiveDrag = null;
    }

    const MOUSE_DRAG_THRESHOLD = 4;
    const TOUCH_HANDLE_THRESHOLD = 4;
    const TOUCH_LONG_PRESS_MS = 200;
    const TOUCH_CANCEL_MOVE = 8;
    const AUTO_SCROLL_EDGE = 85;
    const HIT_TEST_INTERVAL_MS = 32;

    const previewDropAllowed = (sourceData, targetContainer, targetChip) => {
      if (!sourceData || typeof canProctorTakeSlot !== 'function') return true;
      const targetSessionId = targetContainer?.getAttribute('data-session-id') || targetChip?.getAttribute('data-session-id');
      const targetAllocId = targetContainer?.getAttribute('data-alloc-id') || targetChip?.getAttribute('data-alloc-id');
      const targetRole = targetContainer?.getAttribute('data-role') || targetChip?.getAttribute('data-role') || 'proctor';
      const targetOrderIndex = parseInt(targetContainer?.getAttribute('data-order-index') || targetChip?.getAttribute('data-order-index'), 10) || 1;
      const targetAssignId = targetChip ? targetChip.getAttribute('data-assign-id') : null;

      if (!targetSessionId || !targetAllocId) return false;
      if (targetAssignId && targetAssignId === sourceData.assignId) return true;

      const sourceAssign = appState.assignments.find(a => a.id === sourceData.assignId);
      if (!sourceAssign) return false;

      let targetAssign = null;
      if (targetAssignId) {
        targetAssign = appState.assignments.find(a => a.id === targetAssignId);
      } else {
        targetAssign = appState.assignments.find(a => {
          if (targetRole === 'reserve') {
            return a.sessionId === targetSessionId && a.allocationId === targetAllocId && a.role === 'reserve';
          }
          return a.allocationId === targetAllocId && a.role === targetRole && (a.orderIndex || (targetRole === 'chief' ? 1 : 2)) === targetOrderIndex;
        });
      }
      if (targetAssign && targetAssign.id === sourceAssign.id) return true;

      const sessionMap = new Map(appState.sessions.map(s => [s.id, s]));
      const proctorMap = new Map(appState.proctors.map(p => [p.id, p]));

      if (targetAssign) {
        const withoutBoth = appState.assignments.filter(a => a.id !== sourceAssign.id && a.id !== targetAssign.id);
        const check1 = canProctorTakeSlot({
          proctorId: sourceAssign.proctorId,
          sessionId: targetSessionId,
          allocationId: targetAllocId,
          role: targetRole,
          currentAssignments: withoutBoth,
          sessionMap,
          proctorMap,
          unavailabilities: appState.unavailabilities,
          settings: appState.settings
        });
        if (!check1.allowed) return false;

        const check2 = canProctorTakeSlot({
          proctorId: targetAssign.proctorId,
          sessionId: sourceAssign.sessionId,
          allocationId: sourceAssign.allocationId,
          role: sourceAssign.role,
          currentAssignments: [...withoutBoth, { ...targetAssign, proctorId: sourceAssign.proctorId, allocationId: targetAllocId, sessionId: targetSessionId, role: targetRole }],
          sessionMap,
          proctorMap,
          unavailabilities: appState.unavailabilities,
          settings: appState.settings
        });
        return !!check2.allowed;
      }

      const withoutSource = appState.assignments.filter(a => a.id !== sourceAssign.id);
      const check = canProctorTakeSlot({
        proctorId: sourceAssign.proctorId,
        sessionId: targetSessionId,
        allocationId: targetAllocId,
        role: targetRole,
        currentAssignments: withoutSource,
        sessionMap,
        proctorMap,
        unavailabilities: appState.unavailabilities,
        settings: appState.settings
      });
      return !!check.allowed;
    };

    const findScrollableContainer = (el) => {
      let cur = el?.parentElement;
      while (cur && cur !== document.body && cur !== document.documentElement) {
        const st = window.getComputedStyle(cur);
        if ((st.overflowY === 'auto' || st.overflowY === 'scroll') && cur.scrollHeight > cur.clientHeight + 2) {
          return cur;
        }
        cur = cur.parentElement;
      }
      return null;
    };

    this.root.querySelectorAll('.proctor-chip[data-draggable-proctor="true"]').forEach(chip => {
      chip.addEventListener('dragstart', (e) => e.preventDefault());

      chip.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          chip.click();
        }
      });

      chip.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        const pointerId = e.pointerId;
        const pointerType = e.pointerType || 'mouse';
        const isHandle = !!e.target.closest('.drag-handle');
        const startX = e.clientX;
        const startY = e.clientY;
        let lastX = startX;
        let lastY = startY;

        const sourceData = {
          assignId: chip.getAttribute('data-assign-id'),
          proctorId: chip.getAttribute('data-proctor-id'),
          sessionId: chip.getAttribute('data-session-id'),
          allocId: chip.getAttribute('data-alloc-id'),
          roomId: chip.getAttribute('data-room-id'),
          role: chip.getAttribute('data-role'),
          orderIndex: parseInt(chip.getAttribute('data-order-index'), 10) || 1
        };

        let dragStarted = false;
        let longPressTimer = null;
        let ghostEl = null;
        let offsetX = 0;
        let offsetY = 0;
        let hoveredEl = null;
        let hoveredContainer = null;
        let hoveredChip = null;
        let rafId = null;
        let posDirty = false;
        let hitDirty = false;
        let lastHitTime = 0;
        const scrollContainer = findScrollableContainer(chip);

        const clearHover = () => {
          if (hoveredEl) {
            hoveredEl.classList.remove('drag-over', 'drag-over-invalid');
            hoveredEl = null;
          }
          hoveredContainer = null;
          hoveredChip = null;
          if (ghostEl) ghostEl.classList.remove('ghost-invalid');
        };

        const updateDropTarget = (clientX, clientY) => {
          const el = document.elementFromPoint(clientX, clientY);
          const foundChip = el?.closest?.('.proctor-chip[data-assign-id]') || null;
          const foundSlot = el?.closest?.('[data-drop-zone="slot"]') || (foundChip ? foundChip.closest('[data-drop-zone="slot"]') : null);

          const validChip = (foundChip && this.root.contains(foundChip)) ? foundChip : null;
          const validSlot = (foundSlot && this.root.contains(foundSlot)) ? foundSlot : null;
          const targetEl = validChip || validSlot;

          if (!targetEl || (validChip && validChip.getAttribute('data-assign-id') === sourceData.assignId)) {
            clearHover();
            return;
          }
          if (targetEl === hoveredEl) return;

          clearHover();
          hoveredEl = targetEl;
          hoveredChip = validChip;
          hoveredContainer = validSlot;
          const allowed = previewDropAllowed(sourceData, hoveredContainer, hoveredChip);
          hoveredEl.classList.add(allowed ? 'drag-over' : 'drag-over-invalid');
          if (ghostEl) ghostEl.classList.toggle('ghost-invalid', !allowed);
        };

        const frameLoop = (now) => {
          if (!dragStarted) {
            rafId = null;
            return;
          }

          // 1) เลื่อนการ์ดลอยด้วย GPU transform 0ms lag
          if (posDirty && ghostEl) {
            ghostEl.style.transform = `translate3d(${Math.round(lastX - offsetX)}px, ${Math.round(lastY - offsetY)}px, 0)`;
            posDirty = false;
          }

          // 2) Edge Auto-Scroll (เลื่อนขอบบน-ล่างอัตโนมัติควบคู่กับลูกกลิ้งเมาส์)
          const vh = window.innerHeight;
          let deltaY = 0;
          if (lastY < AUTO_SCROLL_EDGE) {
            const ratio = Math.min(1, Math.max(0, (AUTO_SCROLL_EDGE - lastY) / AUTO_SCROLL_EDGE));
            deltaY = -Math.round(5 + ratio * ratio * 18);
          } else if (lastY > vh - AUTO_SCROLL_EDGE) {
            const ratio = Math.min(1, Math.max(0, (lastY - (vh - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE));
            deltaY = Math.round(5 + ratio * ratio * 18);
          }
          if (deltaY !== 0) {
            if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
              const prev = scrollContainer.scrollTop;
              scrollContainer.scrollTop += deltaY;
              if (scrollContainer.scrollTop === prev) window.scrollBy(0, deltaY);
            } else {
              window.scrollBy(0, deltaY);
            }
            hitDirty = true;
          }

          // 3) ตรวจจับช่องปลายทางแบบ throttle เบามาก ไม่สะดุด
          if (hitDirty && (now - lastHitTime >= HIT_TEST_INTERVAL_MS)) {
            updateDropTarget(lastX, lastY);
            lastHitTime = now;
            hitDirty = false;
          }

          rafId = window.requestAnimationFrame(frameLoop);
        };

        const onScrollRefresh = () => {
          if (dragStarted) hitDirty = true;
        };

        const onTouchMovePrevent = (te) => {
          if (dragStarted && te.cancelable) te.preventDefault();
        };

        const cleanup = (wasDrag) => {
          if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
          if (rafId) { window.cancelAnimationFrame(rafId); rafId = null; }
          clearHover();
          if (ghostEl && ghostEl.parentNode) ghostEl.parentNode.removeChild(ghostEl);
          ghostEl = null;
          chip.classList.remove('is-dragging');
          document.body.classList.remove('is-proctor-dragging');

          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('pointercancel', onPointerCancel);
          window.removeEventListener('keydown', onKeyDown);
          window.removeEventListener('scroll', onScrollRefresh, true);
          window.removeEventListener('touchmove', onTouchMovePrevent, { passive: false });

          if (this._cleanupActiveDrag === forceCancel) this._cleanupActiveDrag = null;

          if (wasDrag) {
            setTimeout(() => { this._isDragging = false; }, 160);
          } else {
            this._isDragging = false;
          }
          dragStarted = false;
        };

        const forceCancel = () => cleanup(dragStarted);

        const startDrag = () => {
          if (dragStarted) return;
          dragStarted = true;
          this._isDragging = true;
          this._cleanupActiveDrag = forceCancel;

          try { window.getSelection?.()?.removeAllRanges?.(); } catch (err) {}

          const rect = chip.getBoundingClientRect();
          offsetX = Math.min(Math.max(lastX - rect.left, 16), rect.width - 16);
          offsetY = Math.min(Math.max(lastY - rect.top, 10), rect.height - 10);

          ghostEl = chip.cloneNode(true);
          ghostEl.classList.remove('is-dragging');
          ghostEl.classList.add('proctor-drag-ghost');
          ghostEl.style.width = `${rect.width}px`;
          ghostEl.style.height = `${rect.height}px`;
          ghostEl.style.transform = `translate3d(${Math.round(lastX - offsetX)}px, ${Math.round(lastY - offsetY)}px, 0)`;
          document.body.appendChild(ghostEl);

          chip.classList.add('is-dragging');
          document.body.classList.add('is-proctor-dragging');

          if (pointerType !== 'mouse' && typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(15); } catch (err) {}
          }

          posDirty = true;
          hitDirty = true;
          lastHitTime = 0;
          rafId = window.requestAnimationFrame(frameLoop);
        };

        const onPointerMove = (mv) => {
          if (mv.pointerId !== pointerId) return;
          lastX = mv.clientX;
          lastY = mv.clientY;

          if (!dragStarted) {
            const dist = Math.hypot(lastX - startX, lastY - startY);
            if (pointerType === 'mouse') {
              if (dist >= MOUSE_DRAG_THRESHOLD) startDrag();
            } else if (isHandle) {
              if (dist >= TOUCH_HANDLE_THRESHOLD) startDrag();
            } else if (dist > TOUCH_CANCEL_MOVE) {
              cleanup(false);
            }
            return;
          }

          posDirty = true;
          hitDirty = true;
        };

        const onPointerUp = (up) => {
          if (up.pointerId !== pointerId) return;
          if (!dragStarted) {
            cleanup(false);
            return;
          }

          lastX = up.clientX;
          lastY = up.clientY;
          updateDropTarget(lastX, lastY);

          const finalContainer = hoveredContainer;
          const finalChip = hoveredChip;
          const finalEl = hoveredEl;

          cleanup(true);

          if (!finalEl) return;

          const targetSessionId = finalContainer?.getAttribute('data-session-id') || finalEl.getAttribute('data-session-id');
          const targetAllocId = finalContainer?.getAttribute('data-alloc-id') || finalEl.getAttribute('data-alloc-id');
          const targetRoomId = finalContainer?.getAttribute('data-room-id') || finalEl.getAttribute('data-room-id');
          const targetRole = finalContainer?.getAttribute('data-role') || finalEl.getAttribute('data-role') || 'proctor';
          const targetOrderIndex = parseInt(finalContainer?.getAttribute('data-order-index') || finalEl.getAttribute('data-order-index'), 10) || 1;
          const targetAssignId = finalChip ? finalChip.getAttribute('data-assign-id') : null;

          if (!targetSessionId || !targetAllocId) return;
          if (targetAssignId && targetAssignId === sourceData.assignId) return;

          const res = appState.dragAndDropReassign({
            sourceAssignId: sourceData.assignId,
            targetSessionId,
            targetAllocId,
            targetRoomId,
            targetRole,
            targetOrderIndex,
            targetAssignId
          });

          if (res.success) {
            this.showToast(res.message, 'success');
          } else {
            this.showToast(res.message, 'error');
          }
        };

        const onPointerCancel = (ce) => {
          if (ce.pointerId !== pointerId) return;
          cleanup(dragStarted);
        };

        const onKeyDown = (ke) => {
          if (ke.key === 'Escape' && dragStarted) {
            ke.preventDefault();
            cleanup(true);
          }
        };

        window.addEventListener('pointermove', onPointerMove, { passive: true });
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerCancel);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('scroll', onScrollRefresh, { capture: true, passive: true });
        window.addEventListener('touchmove', onTouchMovePrevent, { passive: false });

        if (pointerType !== 'mouse' && !isHandle) {
          longPressTimer = setTimeout(() => {
            longPressTimer = null;
            startDrag();
          }, TOUCH_LONG_PRESS_MS);
        }
      });
    });

    // Dropdown เปลี่ยนโควต้า (1 ถึง 6 รอบ) ในตารางผู้คุมสอบ Master Data
    this.root.querySelectorAll('[data-action="change-proctor-quota"]').forEach(sel => {
      sel.addEventListener('change', (e) => {
        e.stopPropagation();
        const proctorId = sel.getAttribute('data-proctor-id');
        const newQuota = parseInt(sel.value, 10);
        const p = appState.proctors.find(x => x.id === proctorId);
        if (p) {
          appState.updateProctorQuotaAndDates(proctorId, {
            projectQuota: newQuota,
            dailyQuota: newQuota === 1 ? 1 : (p.dailyQuota || 2)
          });
          this.showToast(`ปรับโควต้า ${p.firstName} ${p.lastName} เป็น ${newQuota} รอบเรียบร้อยแล้ว`, 'success');
        }
      });
    });

    // Quick Quota Buttons (6, 3, 2, 1) ในตารางผู้คุมสอบ Master Data
    this.root.querySelectorAll('[data-action="quick-quota"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const proctorId = btn.getAttribute('data-proctor-id');
        const newQuota = parseInt(btn.getAttribute('data-quota'), 10);
        const p = appState.proctors.find(x => x.id === proctorId);
        if (p) {
          appState.updateProctorQuotaAndDates(proctorId, {
            projectQuota: newQuota,
            dailyQuota: newQuota === 1 ? 1 : 2
          });
          this.showToast(`ปรับโควต้า ${p.firstName} ${p.lastName} เป็น ${newQuota} รอบสำเร็จ`, 'success');
        }
      });
    });

    // Click on proctor chip -> Open edit slot modal (ป้องกัน popup ขณะลากวาง)
    this.root.querySelectorAll('.proctor-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (this._isDragging) return;
        const assignId = chip.getAttribute('data-assign-id');
        const assign = appState.assignments.find(a => a.id === assignId);
        if (assign) {
          this.activeModal = {
            type: 'edit-slot',
            data: {
              sessionId: assign.sessionId,
              allocationId: assign.allocationId,
              roomId: assign.roomId,
              role: assign.role,
              currentAssign: assign
            }
          };
          this.render();
        }
      });
    });

    // Add proctor button on empty slot
    this.root.querySelectorAll('[data-action="assign-slot"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeModal = {
          type: 'edit-slot',
          data: {
            sessionId: btn.getAttribute('data-session-id'),
            allocationId: btn.getAttribute('data-alloc-id'),
            roomId: btn.getAttribute('data-room-id'),
            role: btn.getAttribute('data-role'),
            currentAssign: null
          }
        };
        this.render();
      });
    });

    // Modal Close
    this.root.querySelectorAll('#btn-close-modal, #btn-cancel-modal, [data-action="close-modal"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeModal = null;
        this.render();
      });
    });

    // คลิกที่นั่งสอบในผังห้องสอบ (Room Detail Modal) เพื่อดูรายละเอียดผู้เข้าสอบ
    this.root.querySelectorAll('.modal-overlay .seat-cell[data-seat]').forEach(seatEl => {
      seatEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const sNum = seatEl.getAttribute('data-seat');
        const deskId = seatEl.getAttribute('data-desk') || sNum;
        const rCode = seatEl.getAttribute('data-room');
        const detailBox = this.root.querySelector('#room-modal-seat-detail-box');
        if (!detailBox) return;

        // Visual selection highlight on clicked seat
        this.root.querySelectorAll('.modal-overlay .seat-cell').forEach(c => {
          c.style.outline = 'none';
          c.style.transform = 'none';
        });
        seatEl.style.outline = '3px solid #7C3AED';
        seatEl.style.transform = 'scale(1.15)';
        seatEl.style.zIndex = '10';

        const isDisabled = seatEl.classList.contains('seat-cell-disabled');
        const examinee = !isDisabled ? (appState.examinees || []).find(ex => 
          (String(ex.roomCode) === String(rCode) || String(ex.roomId) === String(rCode)) &&
          (String(ex.seatNumber) === String(sNum) || String(ex.seatNumber) === String(deskId))
        ) : null;

        const maskCitizenId = (cid) => {
          if (!cid) return '-';
          const clean = String(cid).replace(/[^0-9]/g, '');
          if (clean.length === 13) {
            return `${clean.slice(0, 1)}-${clean.slice(1, 5)}-XXXXX-${clean.slice(10, 12)}-${clean.slice(12)}`;
          }
          return cid;
        };

        if (examinee) {
          detailBox.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; flex-wrap: wrap; gap: 10px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 26px;">👤</span>
                <div>
                  <div style="font-size: 14px; font-weight: 800; color: #1E293B;">
                    ที่นั่งสอบ #${sNum} (โต๊ะตัวที่ ${deskId}) : <span style="color: #6D28D9;">${examinee.title || ''}${examinee.firstName} ${examinee.lastName}</span>
                    <span class="badge" style="background: #DCFCE7; color: #15803D; border: 1px solid #86EFAC; font-size: 11px; margin-left: 6px;">จัดที่นั่งแล้ว</span>
                  </div>
                  <div style="font-size: 12px; color: #475569; margin-top: 3px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span>เลขประจำตัวผู้เข้าสอบ: <strong style="color: #1E293B;">${examinee.id}</strong></span>
                    <span>•</span>
                    <span>เลขประจำตัว ปชช: <strong>${maskCitizenId(examinee.citizenId)}</strong></span>
                    <span>•</span>
                    <span>${examinee.faculty || ''} ${examinee.major ? `(${examinee.major})` : ''}</span>
                    ${examinee.specialNeeds ? `<span class="badge" style="background: #FEF3C7; color: #B45309; border: 1px solid #FCD34D;">♿ ${examinee.specialNeeds}</span>` : ''}
                  </div>
                </div>
              </div>
              <div style="font-size: 11.5px; color: #64748B;">
                ห้อง ${rCode} • CBT Client พร้อมใช้งาน
              </div>
            </div>
          `;
          detailBox.style.background = '#FAF5FF';
          detailBox.style.borderColor = '#C084FC';
        } else if (isDisabled) {
          detailBox.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 22px;">🚫</span>
              <div>
                <strong style="color: #DC2626;">โต๊ะตัวที่ ${deskId} (ปิดการใช้งาน / ชำรุด)</strong>
                <div style="font-size: 11.5px; color: #64748B;">ที่นั่งนี้ไม่เปิดให้จัดผู้เข้าสอบ</div>
              </div>
            </div>
          `;
          detailBox.style.background = '#FEF2F2';
          detailBox.style.borderColor = '#FCA5A5';
        } else {
          detailBox.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 22px;">🖥️</span>
              <div>
                <strong style="color: #1E293B;">ที่นั่งสอบ #${sNum} (โต๊ะตัวที่ ${deskId})</strong>
                <span class="badge" style="background: #F1F5F9; color: #475569; font-size: 11px; margin-left: 6px;">ที่นั่งว่าง (ยังไม่มีผู้เข้าสอบจัดนั่ง)</span>
                <div style="font-size: 11.5px; color: #64748B;">สถานะเครื่องคอมพิวเตอร์ CBT ปกติ พร้อมใช้งาน</div>
              </div>
            </div>
          `;
          detailBox.style.background = '#F8FAFC';
          detailBox.style.borderColor = '#CBD5E1';
        }
      });
    });

    // Modal: Confirm Assign candidate (รองรับการสลับตัว swap)
    this.root.querySelectorAll('[data-action="confirm-assign"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = btn.getAttribute('data-proctor-id');
        const doSwap = btn.getAttribute('data-swap') === 'true';
        const data = this.activeModal.data;
        appState.assignProctorManually({
          sessionId: data.sessionId,
          allocationId: data.allocationId,
          roomId: data.roomId,
          proctorId: pId,
          role: data.role,
          reason: doSwap ? 'สลับตัวผู้คุมระหว่างห้อง' : 'เลือกด้วยตนเองจากรายการ',
          doSwap
        });
        this.activeModal = null;
        this.render();
      });
    });

    // Modal: Auto-Pick Proctor for Slot (สุ่มเลือกผู้คุมที่ผ่านเกณฑ์ทันที)
    const autoPickBtn = this.root.querySelector('#btn-auto-pick-slot');
    if (autoPickBtn && this.activeModal?.type === 'edit-slot') {
      autoPickBtn.addEventListener('click', () => {
        const { sessionId, allocationId, roomId, role, currentAssign } = this.activeModal.data;
        const res = appState.autoPickProctorForSlot(sessionId, allocationId, roomId, role, currentAssign?.id);
        if (res.success) {
          this.activeModal = null;
          this.render();
          alert(`🎲 สุ่มเลือก "${res.proctor.firstName} ${res.proctor.lastName}" (${res.proctor.academicTitle || ''}) เข้าคุมตำแหน่งนี้เรียบร้อยแล้ว!\nเหตุผล: ${res.reason || 'ผ่านเกณฑ์ Hard Rules H1-H8 สมบูรณ์'}`);
        } else {
          alert(res.message || 'ไม่สามารถสุ่มเลือกได้');
        }
      });
    }

    // เพิ่มผู้คุมสำรองประจำรอบ
    this.root.querySelectorAll('[data-action="add-reserve"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-session-id');
        this.activeModal = {
          type: 'edit-slot',
          data: {
            sessionId: sId,
            allocationId: `RESERVE_${sId}`,
            roomId: null,
            role: 'reserve',
            currentAssign: null
          }
        };
        this.render();
      });
    });

    // Quick Add Session (จากหน้าจัดตาราง หรือ หน้าแดชบอร์ด)
    const openAddSessionModal = () => {
      this.activeModal = {
        type: 'modal-master-sessions',
        data: {}
      };
      this.render();
    };
    const addQuickBtn = this.root.querySelector('#btn-add-session-quick');
    if (addQuickBtn) addQuickBtn.addEventListener('click', openAddSessionModal);
    const addDashBtn = this.root.querySelector('#btn-add-session-dash');
    if (addDashBtn) addDashBtn.addEventListener('click', openAddSessionModal);

    // ล้างตารางที่จัดไว้ทั้งหมด (Clear Schedule)
    const clearSchedBtn = this.root.querySelector('#btn-clear-schedule');
    if (clearSchedBtn) {
      clearSchedBtn.addEventListener('click', () => {
        if (confirm('คุณต้องการล้างตารางการจัดสอบทั้งหมดหรือไม่?\n\n(หากต้องการล้างทั้งหมด ให้กดตกลง เพื่อเริ่มจัดหรือแก้ไขใหม่ได้อย่างอิสระ)')) {
          appState.clearSchedule(true);
          this.render();
        }
      });
    }

    // ล้างผู้คุมเฉพาะในรอบที่ระบุ
    this.root.querySelectorAll('[data-action="clear-session-assigns"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-session-id');
        const sess = appState.sessions.find(s => s.id === sId);
        const name = sess ? sess.name : sId;
        if (confirm(`คุณต้องการล้างผู้คุมทั้งหมดเฉพาะในรอบ "${name}" ใช่หรือไม่?`)) {
          appState.clearSessionAssignments(sId);
          this.render();
        }
      });
    });

    // ยกเลิก/ลบรอบการสอบออกจากระบบ
    this.root.querySelectorAll('[data-action="cancel-session"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-session-id');
        const sess = appState.sessions.find(s => s.id === sId);
        const name = sess ? `${sess.name} (${sId})` : sId;
        if (confirm(`คุณต้องการยกเลิกและลบรอบการสอบ "${name}" ออกจากระบบใช่หรือไม่?\n\n(ข้อมูลการจัดผู้คุมและห้องสอบในรอบนี้จะถูกลบออกทั้งหมด)`)) {
          appState.deleteSession(sId);
          this.render();
        }
      });
    });

    // Modal: Toggle Lock
    this.root.querySelectorAll('[data-action="toggle-lock"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const aId = btn.getAttribute('data-assign-id');
        appState.toggleLockAssignment(aId);
        this.activeModal = null;
        this.render();
      });
    });

    // Modal: Remove Assignment
    this.root.querySelectorAll('[data-action="remove-assign"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const aId = btn.getAttribute('data-assign-id');
        appState.removeAssignment(aId);
        this.activeModal = null;
        this.render();
      });
    });

    // Sudden leave selects
    const leaveSessionSelect = this.root.querySelector('#select-leave-session');
    const leaveProctorSelect = this.root.querySelector('#select-leave-proctor');
    if (leaveSessionSelect && leaveProctorSelect) {
      leaveSessionSelect.addEventListener('change', () => this.updateSuddenLeaveCandidates());
      leaveProctorSelect.addEventListener('change', () => this.updateSuddenLeaveCandidates());
    }

    // Modal Cancel Button
    const cancelModalBtn = this.root.querySelector('#btn-cancel-modal');
    if (cancelModalBtn) {
      cancelModalBtn.addEventListener('click', () => {
        this.activeModal = null;
        this.render();
      });
    }

    // Master Data: Add Button
    const addMasterBtn = this.root.querySelector('#btn-add-master-item');
    if (addMasterBtn) {
      addMasterBtn.addEventListener('click', () => {
        const itemType = (this.masterDataSubTab === 'proctors' && this.proctorFilterType === 'unavail') ? 'unavail' : this.masterDataSubTab;
        this.activeModal = {
          type: 'modal-master-' + itemType,
          data: null
        };
        this.render();
      });
    }

    // Master Data: Edit Buttons
    this.root.querySelectorAll('[data-action="edit-master"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        const id = btn.getAttribute('data-id');
        let item = null;
        if (type === 'proctors') item = appState.proctors.find(p => p.id === id);
        else if (type === 'rooms') item = appState.rooms.find(r => r.id === id);
        else if (type === 'sessions') item = appState.sessions.find(s => s.id === id);
        else if (type === 'unavail') item = appState.unavailabilities.find(u => u.id === id);
        else if (type === 'examinees') item = (appState.examinees || []).find(e => String(e.id) === String(id));

        if (item) {
          this.activeModal = {
            type: 'modal-master-' + type,
            data: JSON.parse(JSON.stringify(item))
          };
          this.render();
        }
      });
    });

    // Master Data: Delete Buttons
    this.root.querySelectorAll('[data-action="delete-master"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        const id = btn.getAttribute('data-id');
        let name = id;
        if (type === 'proctors') {
          const p = appState.proctors.find(x => x.id === id);
          if (p) name = `${p.firstName} ${p.lastName} (${id})`;
        } else if (type === 'rooms') {
          const r = appState.rooms.find(x => x.id === id);
          if (r) name = `${r.name} (${id})`;
        } else if (type === 'sessions') {
          const s = appState.sessions.find(x => x.id === id);
          if (s) name = `${s.name} (${id})`;
        } else if (type === 'unavail') {
          const u = (appState.unavailabilities || []).find(x => x.id === id);
          const p = u ? appState.proctors.find(x => x.id === u.proctorId) : null;
          name = p ? `ช่วงเวลาไม่ว่างของ ${p.firstName} ${p.lastName}` : `ช่วงเวลาไม่ว่าง (${id})`;
        } else if (type === 'examinees') {
          const ex = (appState.examinees || []).find(x => String(x.id) === String(id));
          name = ex ? `ผู้เข้าสอบ ${ex.firstName} ${ex.lastName} (${id})` : `ผู้เข้าสอบ (${id})`;
        }

        if (confirm(`คุณต้องการลบข้อมูล "${name}" ใช่หรือไม่?`)) {
          if (type === 'proctors') appState.deleteProctor(id);
          else if (type === 'rooms') appState.deleteRoom(id);
          else if (type === 'sessions') appState.deleteSession(id);
          else if (type === 'unavail') appState.deleteUnavailability(id);
          else if (type === 'examinees') appState.deleteExaminee(id);
          this.render();
        }
      });
    });

    // Master Data: Submit Proctor Form
    const proctorForm = this.root.querySelector('#form-master-proctor');
    if (proctorForm) {
      proctorForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(proctorForm);
        const selectedDates = fd.getAll('availableDates');
        appState.saveProctor({
          id: fd.get('id') || undefined,
          academicTitle: fd.get('academicTitle'),
          firstName: fd.get('firstName'),
          lastName: fd.get('lastName'),
          proctorType: fd.get('proctorType'),
          level: fd.get('level'),
          department: fd.get('department'),
          email: fd.get('email'),
          phone: fd.get('phone'),
          dailyQuota: fd.get('dailyQuota'),
          projectQuota: fd.get('projectQuota'),
          maxHours: fd.get('maxHours'),
          availableDates: selectedDates,
          sessionPattern: fd.get('sessionPattern') || 'FULL_DAY_PAIRED',
          isActive: fd.get('isActive') === '1'
        });
        this.activeModal = null;
        this.showToast('บันทึกข้อมูลผู้คุมสอบเรียบร้อยแล้ว', 'success');
        this.render();
      });
    }

    // Master Data: Submit Room Form
    const roomForm = this.root.querySelector('#form-master-room');
    if (roomForm) {
      roomForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(roomForm);
        appState.saveRoom({
          id: fd.get('id') || undefined,
          name: fd.get('name'),
          building: fd.get('building'),
          floor: fd.get('floor'),
          capacity: fd.get('capacity'),
          roomType: fd.get('roomType'),
          accessibleForDisabled: fd.get('accessibleForDisabled') === '1',
          isActive: fd.get('isActive') === '1'
        });
        this.activeModal = null;
        this.render();
      });
    }

    // Master Data: Submit Session Form
    const sessionForm = this.root.querySelector('#form-master-session');
    if (sessionForm) {
      sessionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(sessionForm);
        const date = fd.get('date');
        const startTime = fd.get('startTime');
        const endTime = fd.get('endTime');
        appState.saveSession({
          id: fd.get('id') || undefined,
          name: fd.get('name'),
          date,
          startTime: `${date}T${startTime}:00+07:00`,
          endTime: `${date}T${endTime}:00+07:00`,
          prepMinutes: fd.get('prepMinutes'),
          wrapMinutes: fd.get('wrapMinutes'),
          organization: fd.get('organization')
        });
        this.activeModal = null;
        this.render();
      });
    }

    // Master Data: Submit Unavailability Form
    const unavailForm = this.root.querySelector('#form-master-unavail');
    if (unavailForm) {
      unavailForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(unavailForm);
        const date = fd.get('date');
        const startTime = fd.get('startTime');
        const endTime = fd.get('endTime');
        appState.saveUnavailability({
          id: fd.get('id') || undefined,
          proctorId: fd.get('proctorId'),
          startTime: `${date}T${startTime}:00+07:00`,
          endTime: `${date}T${endTime}:00+07:00`,
          reason: fd.get('reason')
        });
        this.activeModal = null;
        this.render();
      });
    }

    // Master Data: Submit Examinee Form
    const examineeForm = this.root.querySelector('#form-master-examinee');
    if (examineeForm) {
      examineeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(examineeForm);
        const seatVal = fd.get('seatNumber');
        appState.saveExaminee({
          id: fd.get('id'),
          citizenId: fd.get('citizenId'),
          title: fd.get('title'),
          firstName: fd.get('firstName'),
          lastName: fd.get('lastName'),
          faculty: fd.get('faculty'),
          major: fd.get('major'),
          sessionId: fd.get('sessionId'),
          roomCode: fd.get('roomCode'),
          seatNumber: seatVal !== '' && seatVal !== null ? Number(seatVal) : null,
          status: fd.get('status'),
          specialNeeds: fd.get('specialNeeds'),
          notes: fd.get('notes')
        });
        this.activeModal = null;
        this.render();
      });
    }

    // Examinees Events: Edit & Delete buttons
    this.root.querySelectorAll('[data-action="edit-examinee"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const ex = (appState.examinees || []).find(e => String(e.id) === String(id));
        if (ex) {
          this.activeModal = {
            type: 'modal-master-examinees',
            data: JSON.parse(JSON.stringify(ex))
          };
          this.render();
        }
      });
    });

    this.root.querySelectorAll('[data-action="delete-examinee"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const ex = (appState.examinees || []).find(e => String(e.id) === String(id));
        const name = ex ? `${ex.firstName} ${ex.lastName} (${id})` : id;
        if (confirm(`คุณต้องการลบข้อมูลผู้เข้าสอบ "${name}" ใช่หรือไม่?`)) {
          appState.deleteExaminee(id);
          this.render();
        }
      });
    });

    // Examinees: Add Direct Button
    const addExamineeBtn = this.root.querySelector('#btn-add-examinee-direct');
    if (addExamineeBtn) {
      addExamineeBtn.addEventListener('click', () => {
        this.activeModal = {
          type: 'modal-master-examinees',
          data: null
        };
        this.render();
      });
    }

    // Examinees: CSV Download Template
    const dlExTplBtn = this.root.querySelector('#btn-download-examinee-template');
    if (dlExTplBtn) {
      dlExTplBtn.addEventListener('click', () => {
        triggerCSVDownload(generateExamineeCSVTemplate(), 'examinees_template.csv');
      });
    }

    // Examinees: CSV Export
    const expExCsvBtn = this.root.querySelector('#btn-export-examinees-csv');
    if (expExCsvBtn) {
      expExCsvBtn.addEventListener('click', () => {
        triggerCSVDownload(exportExamineesToCSV(appState.examinees || []), `examinees_${Date.now()}.csv`);
      });
    }

    // Examinees: CSV Import with Preview
    const importExCsvInp = this.root.querySelector('#file-import-examinees-csv');
    if (importExCsvInp) {
      importExCsvInp.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const rows = parseCSVWithEncoding(evt.target.result);
            if (rows.length > 0) {
              renderCSVPreviewModal(rows, appState, this);
            } else {
              alert('ไม่พบข้อมูลในไฟล์ CSV หรือไฟล์ว่างเปล่า');
            }
          };
          reader.readAsArrayBuffer(file);
        }
      });
    }

    // Examinees: Print Attendance Sheet (A4)
    const onPrintExaminees = () => {
      const sessId = this.examineeFilterSession !== 'all' ? this.examineeFilterSession : (appState.sessions[0]?.id || 's1');
      const sess = appState.sessions.find(s => s.id === sessId);
      const rm = this.examineeFilterRoom !== 'all' ? appState.rooms.find(r => (r.roomCode || r.code) === this.examineeFilterRoom) : null;
      openPrintableExamineeAttendanceSheet({
        appState,
        session: sess,
        room: rm,
        examinees: [],
        masked: Boolean(this.maskPDPA)
      });
    };
    this.root.querySelector('#btn-print-examinees-sheet')?.addEventListener('click', onPrintExaminees);
    this.root.querySelector('#btn-quick-print-examinees')?.addEventListener('click', onPrintExaminees);

    // Examinees: Auto Allocate Seats 1-520
    const onAutoAllocate = () => {
      const sessId = this.examineeFilterSession !== 'all' ? this.examineeFilterSession : (appState.sessions[0]?.id || 's1');
      const count = appState.autoAllocateSeats(sessId);
      alert(`จัดที่นั่งอัตโนมัติสำเร็จ ${count} คน ในรอบ ${sessId}`);
      this.render();
    };
    this.root.querySelector('#btn-auto-allocate-seats-menu')?.addEventListener('click', onAutoAllocate);
    this.root.querySelector('#btn-quick-auto-seat')?.addEventListener('click', onAutoAllocate);
    this.root.querySelector('#btn-auto-allocate-seats-direct')?.addEventListener('click', onAutoAllocate);

    // Examinees: Clear Session Examinees
    this.root.querySelector('#btn-clear-session-examinees-menu')?.addEventListener('click', () => {
      if (this.examineeFilterSession !== 'all') {
        if (confirm(`คุณต้องการลบข้อมูลผู้เข้าสอบในรอบ "${this.examineeFilterSession}" ทั้งหมดใช่หรือไม่?`)) {
          const count = appState.clearSessionExaminees(this.examineeFilterSession);
          alert(`ลบข้อมูลผู้เข้าสอบรอบนี้สำเร็จ ${count} คน`);
          this.render();
        }
      }
    });

    // Examinees: Search Debounce & Filters
    const exSearchInp = this.root.querySelector('#input-search-examinees');
    if (exSearchInp) {
      exSearchInp.addEventListener('input', (e) => {
        this.examineeSearchQuery = e.target.value;
        this.examineeCurrentPage = 1;
        if (this._exSearchTimer) clearTimeout(this._exSearchTimer);
        this._exSearchTimer = setTimeout(() => {
          this.render();
          const reFocus = this.root.querySelector('#input-search-examinees');
          if (reFocus) {
            reFocus.focus();
            reFocus.setSelectionRange(reFocus.value.length, reFocus.value.length);
          }
        }, 250);
      });
    }

    this.root.querySelector('#select-filter-examinee-session')?.addEventListener('change', (e) => {
      this.examineeFilterSession = e.target.value;
      this.examineeCurrentPage = 1;
      this.render();
    });

    this.root.querySelector('#select-filter-examinee-room')?.addEventListener('change', (e) => {
      this.examineeFilterRoom = e.target.value;
      this.examineeCurrentPage = 1;
      this.render();
    });

    this.root.querySelector('#chk-filter-unseated')?.addEventListener('change', (e) => {
      this.examineeFilterUnseatedOnly = e.target.checked;
      this.examineeCurrentPage = 1;
      this.render();
    });

    this.root.querySelector('#chk-filter-special')?.addEventListener('change', (e) => {
      this.examineeFilterSpecialNeedsOnly = e.target.checked;
      this.examineeCurrentPage = 1;
      this.render();
    });

    this.root.querySelector('#btn-toggle-examinee-pdpa')?.addEventListener('change', (e) => {
      this.maskPDPA = e.target.checked;
      this.render();
    });

    this.root.querySelector('#btn-clear-examinee-filters')?.addEventListener('click', () => {
      this.examineeSearchQuery = '';
      this.examineeFilterSession = 'all';
      this.examineeFilterRoom = 'all';
      this.examineeFilterUnseatedOnly = false;
      this.examineeFilterSpecialNeedsOnly = false;
      this.examineeCurrentPage = 1;
      this.render();
    });

    this.root.querySelector('#btn-examinee-prev-page')?.addEventListener('click', () => {
      this.examineeCurrentPage = Math.max(1, (this.examineeCurrentPage || 1) - 1);
      this.render();
    });

    this.root.querySelector('#btn-examinee-next-page')?.addEventListener('click', () => {
      this.examineeCurrentPage = (this.examineeCurrentPage || 1) + 1;
      this.render();
    });

    // Examinees: Room Filter Chips Bar
    this.root.querySelectorAll('[data-examinee-room]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.examineeFilterRoom = btn.getAttribute('data-examinee-room');
        this.examineeCurrentPage = 1;
        this.render();
      });
    });

    // Examinees: Page Size Selector
    this.root.querySelector('#select-examinee-page-size')?.addEventListener('change', (e) => {
      this.examineePageSize = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
      this.examineeCurrentPage = 1;
      this.render();
    });

    // Examinees: Print This Room Sheet (A4)
    this.root.querySelector('#btn-print-this-room')?.addEventListener('click', (e) => {
      const rCode = e.currentTarget.getAttribute('data-room');
      const rm = appState.rooms.find(r => (r.roomCode || r.code) === rCode) || { roomCode: rCode, code: rCode, capacity: 40 };
      const sessId = this.examineeFilterSession !== 'all' ? this.examineeFilterSession : (appState.sessions[0]?.id || 's1');
      const sess = appState.sessions.find(s => s.id === sessId);
      openPrintableExamineeAttendanceSheet({
        appState,
        session: sess,
        room: rm,
        examinees: (appState.examinees || []).filter(ex => (ex.roomCode || ex.roomId) === rCode),
        masked: Boolean(this.maskPDPA)
      });
    });

    // Examinees: Quick View Room Seating Plan
    this.root.querySelector('#btn-quick-goto-room-grid')?.addEventListener('click', (e) => {
      const rCode = e.currentTarget.getAttribute('data-room');
      this.currentTab = 'rooms';
      this.roomsSubTab = 'seating-grid';
      this.activeSeatingRoomId = rCode;
      this.render();
    });

    // สลับบัญชี / เข้าสู่ระบบ (Open Switch User Modal)
    const openUserModal = () => {
      this.activeModal = { type: 'switch-user', data: null };
      this.render();
    };
    const openUserBtn = this.root.querySelector('#btn-open-user-modal');
    if (openUserBtn) openUserBtn.addEventListener('click', openUserModal);
    const openUserBtnInline = this.root.querySelector('#btn-open-user-modal-inline');
    if (openUserBtnInline) openUserBtnInline.addEventListener('click', openUserModal);
    const openUserBtnNotice = this.root.querySelector('#btn-open-user-modal-notice');
    if (openUserBtnNotice) openUserBtnNotice.addEventListener('click', openUserModal);

    // Confirm Switch User
    this.root.querySelectorAll('[data-action="confirm-switch-user"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const uId = btn.getAttribute('data-user-id');
        if (uId === 'admin') {
          appState.setCurrentUser({
            id: 'admin',
            role: 'admin',
            name: 'ผู้ดูแลระบบ (Admin)',
            proctorId: null
          });
          this.activeViewingProctorId = null;
          this.currentTab = 'dashboard';
        } else {
          const p = appState.proctors.find(x => x.id === uId);
          if (p) {
            appState.setCurrentUser({
              id: p.id,
              role: p.proctorType === 'faculty' ? 'teacher' : 'proctor',
              name: `${p.proctorType === 'faculty' ? 'อ.' : ''}${p.firstName} ${p.lastName}`,
              proctorId: p.id
            });
            this.currentTab = 'my-profile';
          }
        }
        this.activeModal = null;
        this.render();
      });
    });

    // Switch custom proctor from dropdown
    const customProctorBtn = this.root.querySelector('#btn-select-custom-proctor');
    if (customProctorBtn) {
      customProctorBtn.addEventListener('click', () => {
        const pId = this.root.querySelector('#select-any-proctor-user')?.value;
        const p = appState.proctors.find(x => x.id === pId);
        if (p) {
          appState.setCurrentUser({
            id: p.id,
            role: p.proctorType === 'faculty' ? 'teacher' : 'proctor',
            name: `${p.proctorType === 'faculty' ? 'อ.' : ''}${p.firstName} ${p.lastName}`,
            proctorId: p.id
          });
          this.currentTab = 'my-profile';
          this.activeModal = null;
          this.render();
        }
      });
    }

    // ไปที่โปรไฟล์ของฉัน
    const gotoProfileBtn = this.root.querySelector('#btn-goto-my-profile');
    if (gotoProfileBtn) {
      gotoProfileBtn.addEventListener('click', () => {
        this.setTab('my-profile');
      });
    }

    const gotoSchedFromProfile = this.root.querySelector('#btn-goto-scheduler-from-profile');
    if (gotoSchedFromProfile) {
      gotoSchedFromProfile.addEventListener('click', () => {
        const activeAssignments = (appState.confirmedAssignments && appState.confirmedAssignments.length > 0)
          ? appState.confirmedAssignments
          : (appState.assignments || []);
        openPrintableAppointmentOrder({
          assignments: activeAssignments,
          sessions: appState.sessions,
          proctors: appState.proctors,
          rooms: appState.rooms,
          allocations: appState.allocations || [],
          settings: appState.settings
        });
      });
    }

    // แก้ไขข้อมูลส่วนตัวของฉัน (Proctor / Teacher)
    const editMyProfileBtn = this.root.querySelector('#btn-edit-my-profile');
    if (editMyProfileBtn) {
      editMyProfileBtn.addEventListener('click', () => {
        this.activeModal = { type: 'edit-my-profile', data: null };
        this.render();
      });
    }

    // ปรับวันเวลาสะดวก & โควต้า (จากปุ่มบนการ์ด หรือในหน้า my-profile)
    const gotoAvailBtns = this.root.querySelectorAll('#btn-goto-my-availability, #btn-goto-my-availability-top');
    gotoAvailBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.setTab('my-availability');
      });
    });

    // กลับไปยังโปรไฟล์ของฉัน
    const backToProfileBtns = this.root.querySelectorAll('#btn-back-to-my-profile, #btn-cancel-my-preferences');
    backToProfileBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.setTab('my-profile');
      });
    });

    // พิมพ์ตารางคุมสอบของฉันจาก Topbar Header
    const topbarPrintBtn = this.root.querySelector('#btn-topbar-print-my-schedule');
    if (topbarPrintBtn) {
      topbarPrintBtn.addEventListener('click', () => {
        const p = appState.getLoggedInProctor();
        if (p) {
          openPersonalDutySheet({
            proctor: p,
            assignments: appState.assignments,
            sessions: appState.sessions,
            rooms: appState.rooms,
            settings: appState.settings
          });
        }
      });
    }

    // แจ้งขอสลับเวร / ลา จาก Sidebar
    const sidebarLeaveBtn = this.root.querySelector('#btn-sidebar-sudden-leave');
    if (sidebarLeaveBtn) {
      sidebarLeaveBtn.addEventListener('click', () => {
        this.activeModal = { type: 'sudden-leave', data: null };
        this.render();
      });
    }

    // สลับชั้นในหน้าข้อมูลอาคาร 17 (Rooms Overview)
    this.root.querySelectorAll('[data-action="switch-room-floor"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const floor = Number(btn.getAttribute('data-floor')) || 1;
        this.roomOverviewFloor = floor;
        this.render();
      });
    });

    // เลือกทุกวัน / ล้างการเลือกวันสะดวก
    const selectAllDatesBtn = this.root.querySelector('[data-action="select-all-dates"]');
    if (selectAllDatesBtn) {
      selectAllDatesBtn.addEventListener('click', () => {
        this.root.querySelectorAll('input[name="availableDates"]').forEach(cb => cb.checked = true);
      });
    }
    const clearAllDatesBtn = this.root.querySelector('[data-action="clear-all-dates"]');
    if (clearAllDatesBtn) {
      clearAllDatesBtn.addEventListener('click', () => {
        this.root.querySelectorAll('input[name="availableDates"]').forEach(cb => cb.checked = false);
      });
    }

    // โควต้า Presets (0, 2, 4, 6)
    this.root.querySelectorAll('[data-action="set-quota-preset"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.getAttribute('data-quota');
        const input = this.root.querySelector('input[name="projectQuota"]');
        if (input) input.value = q;
      });
    });

    // บันทึกความพร้อม & โควต้า จากฟอร์มหน้า my-availability
    const myPrefForm = this.root.querySelector('#form-my-availability-preferences');
    if (myPrefForm) {
      myPrefForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(myPrefForm);
        const pId = fd.get('proctorId');
        const checkedDates = [];
        myPrefForm.querySelectorAll('input[name="availableDates"]:checked').forEach(cb => {
          checkedDates.push(cb.value);
        });

        appState.saveProctor({
          id: pId,
          availableDates: checkedDates,
          sessionPattern: fd.get('sessionPattern') || 'FULL_DAY_PAIRED',
          dailyQuota: Number(fd.get('dailyQuota')) || 2,
          projectQuota: Number(fd.get('projectQuota')) || 0,
          maxHours: Number(fd.get('maxHours')) || 18,
          keepSameRoom: myPrefForm.querySelector('input[name="keepSameRoom"]')?.checked ?? true,
          isActive: myPrefForm.querySelector('input[name="isActive"]')?.checked ?? false
        });

        alert('✅ บันทึกวันเวลาที่สะดวกและโควต้าคุมสอบของท่านเรียบร้อยแล้ว');
        this.setTab('my-profile');
      });
    }

    // Submit edit my profile
    const editMyProfileForm = this.root.querySelector('#form-edit-my-profile');
    if (editMyProfileForm) {
      editMyProfileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(editMyProfileForm);
        const checkedDates = [];
        editMyProfileForm.querySelectorAll('input[name="availableDates"]:checked').forEach(cb => {
          checkedDates.push(cb.value);
        });

        appState.saveProctor({
          id: fd.get('id'),
          firstName: fd.get('firstName'),
          lastName: fd.get('lastName'),
          department: fd.get('department'),
          phone: fd.get('phone'),
          email: fd.get('email'),
          availableDates: checkedDates,
          sessionPattern: fd.get('sessionPattern') || 'FULL_DAY_PAIRED',
          dailyQuota: Number(fd.get('dailyQuota')) || 2,
          projectQuota: Number(fd.get('projectQuota')) || 0,
          maxHours: Number(fd.get('maxHours')) || 18,
          keepSameRoom: editMyProfileForm.querySelector('input[name="keepSameRoom"]')?.checked ?? true,
          isActive: editMyProfileForm.querySelector('input[name="isActive"]')?.checked ?? true
        });
        this.activeModal = null;
        this.render();
        alert('✅ บันทึกข้อมูลส่วนตัวและความพร้อมของคุณเรียบร้อยแล้ว');
      });
    }

    // เพิ่มช่วงไม่สะดวกส่วนตัว (My Unavailability)
    const addMyUnavailBtn = this.root.querySelector('#btn-add-my-unavail');
    if (addMyUnavailBtn) {
      addMyUnavailBtn.addEventListener('click', () => {
        this.activeModal = { type: 'modal-add-my-unavail', data: null };
        this.render();
      });
    }

    // Submit My Unavailability
    const addMyUnavailForm = this.root.querySelector('#form-add-my-unavail');
    if (addMyUnavailForm) {
      addMyUnavailForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(addMyUnavailForm);
        const date = fd.get('date');
        const startTime = fd.get('startTime');
        const endTime = fd.get('endTime');
        appState.saveUnavailability({
          proctorId: fd.get('proctorId'),
          startTime: `${date}T${startTime}:00+07:00`,
          endTime: `${date}T${endTime}:00+07:00`,
          reason: fd.get('reason')
        });
        this.activeModal = null;
        this.render();
        alert('บันทึกช่วงเวลาที่คุณไม่สะดวกเรียบร้อยแล้ว');
      });
    }

    // ลบช่วงเวลาไม่สะดวกของฉัน
    this.root.querySelectorAll('[data-action="delete-my-unavail"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const uId = btn.getAttribute('data-unavail-id');
        if (confirm('ต้องการลบช่วงเวลาไม่สะดวกนี้ใช่หรือไม่?')) {
          appState.deleteUnavailability(uId);
          this.render();
        }
      });
    });

    // Admin: แก้ไขเวลา/ข้อมูลรอบการสอบ
    this.root.querySelectorAll('[data-action="edit-session"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-session-id');
        const s = appState.sessions.find(x => x.id === sId);
        if (s) {
          this.activeModal = {
            type: 'modal-master-sessions',
            data: JSON.parse(JSON.stringify(s))
          };
          this.render();
        }
      });
    });

    // Admin: เพิ่มห้องในรอบการสอบ
    this.root.querySelectorAll('[data-action="add-room-to-session"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-session-id');
        this.activeModal = {
          type: 'modal-add-room-session',
          data: { sessionId: sId }
        };
        this.render();
      });
    });

    const addRoomSessionForm = this.root.querySelector('#form-add-room-session');
    if (addRoomSessionForm) {
      addRoomSessionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(addRoomSessionForm);
        appState.addRoomToSession(fd.get('sessionId'), fd.get('roomId'), fd.get('examinees'));
        this.activeModal = null;
        this.render();
      });
    }

    // Admin: ปรับจำนวนคน / ห้องในรอบสอบ
    this.root.querySelectorAll('[data-action="edit-alloc"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const allocId = btn.getAttribute('data-alloc-id');
        this.activeModal = {
          type: 'modal-edit-alloc',
          data: { allocId }
        };
        this.render();
      });
    });

    const editAllocForm = this.root.querySelector('#form-edit-alloc');
    if (editAllocForm) {
      editAllocForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(editAllocForm);
        appState.updateAllocation(fd.get('allocId'), {
          roomId: fd.get('roomId'),
          examineesInRoom: fd.get('examinees')
        });
        this.activeModal = null;
        this.render();
      });
    }

    // Admin: ถอดห้องออกจากรอบการสอบ
    this.root.querySelectorAll('[data-action="remove-alloc"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const allocId = btn.getAttribute('data-alloc-id');
        const alloc = appState.allocations.find(a => a.id === allocId);
        const room = alloc ? appState.rooms.find(r => r.id === alloc.roomId) : null;
        const name = room ? room.name : allocId;
        if (confirm(`คุณต้องการถอดห้อง "${name}" ออกจากรอบการสอบนี้ใช่หรือไม่?`)) {
          appState.removeRoomFromSession(allocId);
          this.render();
        }
      });
    });
  }

  // อัปเดตรายชื่อตัวแทนในกล่องลากะทันหัน
  updateSuddenLeaveCandidates() {
    const sId = this.root.querySelector('#select-leave-session')?.value;
    const pId = this.root.querySelector('#select-leave-proctor')?.value;
    const box = this.root.querySelector('#substitute-candidates-box');
    if (!sId || !pId || !box) return;

    const candidates = appState.getRecommendedSubstitutes(sId, null, 'proctor', pId);
    if (candidates.length === 0) {
      box.innerHTML = '<div style="color: var(--danger-500); font-size: 13px;">ไม่มีผู้คุมสำรองหรือผู้คุมที่ว่างในรอบนี้</div>';
      return;
    }

    box.innerHTML = candidates.slice(0, 4).map(c => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
        <div>
          <strong style="font-size: 13px;">${c.proctor.firstName} ${c.proctor.lastName}</strong>
          <span style="font-size: 11px; color: ${c.isReserve ? 'var(--success-500)' : 'var(--text-muted)'}; font-weight: ${c.isReserve ? '700' : 'normal'};">
            ${c.reason}
          </span>
        </div>
        <button class="btn btn-primary btn-sm" data-action="confirm-substitute" data-sub-id="${c.proctor.id}">
          ส่งเข้าแทนทันที
        </button>
      </div>
    `).join('');

    box.querySelectorAll('[data-action="confirm-substitute"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const subId = btn.getAttribute('data-sub-id');
        const reason = this.root.querySelector('#input-leave-reason')?.value;
        appState.handleSuddenLeave(pId, sId, subId, reason);
        this.activeModal = null;
        this.render();
      });
    });
  }

  // รัน Solver พร้อมฟีดแบ็กความคืบหน้า (จัดเข้าสู่ฉบับร่างก่อน — ต้องกดยืนยันตารางเพื่อส่งขึ้นแดชบอร์ด)
  runSolverWithFeedback(navigateToScheduler = false) {
    const res = appState.runAutoSchedule();
    if (res.success) {
      if (navigateToScheduler && this.currentTab !== 'scheduler') {
        this.setTab('scheduler');
      }
      const extraMsg = res.autoGeneratedNotice
        ? '\n\n💡 ระบบได้สุ่มสร้างรายชื่ออาจารย์และบุคลากรผู้คุมสอบให้เพียงพอกับ 10 ห้องสอบ CBT อัตโนมัติ'
        : '';
      this.showToast(`จัดตารางฉบับร่างสำเร็จ (${res.assignments.length} ตำแหน่ง) — กรุณาตรวจสอบและกด "✅ ยืนยันตารางสอบ" เพื่อส่งขึ้นแดชบอร์ด`, 'info');
      alert(`🎉 จัดตารางฉบับร่างอัตโนมัติสำเร็จ 100%!\n\nจัดได้ครบทั้งหมด ${res.assignments.length} ตำแหน่ง (เวลาที่ใช้: ${res.durationMs} มิลลิวินาที | คะแนนคุณภาพ: ${res.qualityScore}/100)\n\n📌 ขั้นตอนถัดไป: กรุณาตรวจสอบตารางในหน้า "จัดตารางและตรวจสอบผู้คุมสอบ" และกดปุ่ม "✅ ยืนยันตารางสอบ (ส่งขึ้นแดชบอร์ด)" เพื่อให้ข้อมูลแสดงผลบนแดชบอร์ด${extraMsg}`);
    } else {
      if (confirm(`⚠️ ยังขาดผู้คุมอีก ${res.missingSlots || 'บาง'} ตำแหน่ง\n\nต้องการให้ระบบ "สุ่มสร้างผู้คุมเพิ่มอัตโนมัติ 80 คน" ทันทีเพื่อจัดให้เสร็จสมบูรณ์เลยหรือไม่? (ไม่ต้องพิมพ์เอง)`)) {
        appState.autoGenerateSufficientProctors(80);
        const retry = appState.runAutoSchedule();
        if (retry.success) {
          if (navigateToScheduler && this.currentTab !== 'scheduler') {
            this.setTab('scheduler');
          }
          this.showToast(`จัดตารางฉบับร่างสำเร็จ (${retry.assignments.length} ตำแหน่ง) — กรุณากด "✅ ยืนยันตารางสอบ" เพื่อส่งขึ้นแดชบอร์ด`, 'info');
          alert(`🎉 สุ่มสร้างผู้คุมและจัดตารางฉบับร่างสำเร็จ 100% ครบทุกห้อง (${retry.assignments.length} ตำแหน่ง)!\n\n📌 กรุณาตรวจสอบและกดปุ่ม "✅ ยืนยันตารางสอบ (ส่งขึ้นแดชบอร์ด)" เพื่อยืนยันการใช้งานจริง`);
          return;
        }
      }
      alert(`⚠️ ไม่สามารถจัดตารางได้ครบทุกห้อง:\n\n${res.errorMessage}\n\nคำแนะนำ: ${res.diagnostic?.recommendation || 'กรุณาลองปรับเพิ่มผู้คุมหรือโควต้า'}`);
    }
  }

  // จัดการเหตุการณ์ในแถบมหาวิทยาลัยและหน้าระบบผู้เข้าชม (Visitor & Examinee Portal)
  attachUniversityAndVisitorEvents() {
    // 1. สลับเข้าระบบเจ้าหน้าที่จัดตาราง
    const enterStaffBtns = this.root.querySelectorAll('#btn-enter-staff-system, #btn-footer-staff-login, #link-staff-view');
    enterStaffBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        // บนหน้าจอมือถือ ให้พาไปหน้าตารางของฉัน (my-profile) เพื่อความสะดวกของอาจารย์ผู้คุมสอบทันที
        if (window.innerWidth <= 768 && !appState.isAdmin()) {
          this.setTab('my-profile');
        } else {
          this.setTab('dashboard');
        }
      });
    });

    // 2. สลับกลับมาหน้าหลักผู้เข้าชม / นักศึกษา
    const backVisitorBtns = this.root.querySelectorAll('#btn-back-to-visitor, #btn-uni-home, #link-student-view');
    backVisitorBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.setTab('visitor');
      });
    });

    // 3. คลิกเมนูนำทางมหาวิทยาลัยเพื่อเลื่อนไปยังหมวดหมู่
    this.root.querySelectorAll('.uni-nav-link[data-scroll]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('data-scroll');
        if (this.currentTab !== 'visitor') {
          this.setTab('visitor');
        }
        setTimeout(() => {
          const targetEl = document.getElementById(targetId);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 60);
      });
    });

    // 4. ปุ่มค้นหาด่วนในแถบด้านบน
    const searchTrigger = this.root.querySelector('#btn-uni-search-trigger');
    if (searchTrigger) {
      searchTrigger.addEventListener('click', () => {
        if (this.currentTab !== 'visitor') {
          this.setTab('visitor');
        }
        setTimeout(() => {
          const searchSection = document.getElementById('visitor-search');
          if (searchSection) {
            searchSection.scrollIntoView({ behavior: 'smooth' });
            document.getElementById('input-examinee-search')?.focus();
          }
        }, 60);
      });
    }

    // 5. ระบบค้นหาที่นั่งสอบและห้องสอบรายบุคคล (Examinee Search)
    const searchInput = this.root.querySelector('#input-examinee-search');
    const searchBtn = this.root.querySelector('#btn-submit-examinee-search');
    const clearBtn = this.root.querySelector('#btn-clear-examinee-search');
    const resultArea = this.root.querySelector('#examinee-search-result-area');

    const performExamineeSearch = (query) => {
      const q = (query || '').trim().toLowerCase();
      if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';
      if (!resultArea) return;

      const allExaminees = [
        ...(appState.examinees || []),
        ...SAMPLE_EXAMINEES.filter(s => !(appState.examinees || []).some(e => String(e.id) === String(s.id)))
      ];

      if (!q) {
        resultArea.innerHTML = renderExamineePassCard(null, appState, false);
        this.attachVisitorCardEvents();
        return;
      }

      const match = allExaminees.find(ex => 
        String(ex.id || '').toLowerCase().includes(q) || 
        String(ex.firstName || '').toLowerCase().includes(q) || 
        String(ex.lastName || '').toLowerCase().includes(q) || 
        String(ex.roomCode || '').toLowerCase().includes(q) ||
        String(ex.seatNumber || '').toLowerCase() === q ||
        String(ex.seatNumber || '').toLowerCase() === q.replace(/^#/, '') ||
        String(ex.citizenId || '').replace(/-/g, '').includes(q.replace(/-/g, '')) ||
        String(ex.faculty || '').toLowerCase().includes(q) ||
        String(ex.major || '').toLowerCase().includes(q) ||
        `${ex.firstName || ''} ${ex.lastName || ''}`.toLowerCase().includes(q) ||
        `${ex.title || ''}${ex.firstName || ''} ${ex.lastName || ''}`.toLowerCase().includes(q)
      );

      resultArea.innerHTML = renderExamineePassCard(match || null, appState, !match);
      this.attachVisitorCardEvents();
    };

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        performExamineeSearch(e.target.value);
      });
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performExamineeSearch(searchInput.value);
      });
    }

    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', () => {
        performExamineeSearch(searchInput.value);
      });
    }

    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        performExamineeSearch('');
        searchInput.focus();
      });
    }

    // 6. ชิปตัวอย่างคลิกเดียวค้นหา (Demo Chips)
    this.root.querySelectorAll('.demo-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const searchId = chip.getAttribute('data-search-id');
        if (searchInput) {
          searchInput.value = searchId;
          performExamineeSearch(searchId);
          searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });

    // 7. ปุ่มกรองชั้นในทำเนียบห้องสอบ (Floor Filter Pills)
    this.root.querySelectorAll('#visitor-floor-filters .floor-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const floor = pill.getAttribute('data-floor');
        this.root.querySelectorAll('#visitor-floor-filters .floor-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        this.root.querySelectorAll('.visitor-room-card').forEach(card => {
          const cardFloor = card.getAttribute('data-room-floor');
          if (floor === 'all' || cardFloor === floor) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });

    // 8. คัดลอกลิงก์ประกาศศูนย์สอบ CBT
    const copyLinkBtn = this.root.querySelector('#btn-copy-portal-link');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(window.location.href);
          alert('📋 คัดลอกลิงก์ระบบจัดห้องคุมสอบ กพ. และคุรุสภา เรียบร้อยแล้ว!');
        } else {
          alert('📋 ลิงก์ระบบ: ' + window.location.href);
        }
      });
    }

    // 9. ผูกเหตุการณ์ในการ์ดบัตรสอบ & รายการห้อง
    this.attachVisitorCardEvents();
  }

  // ผูกเหตุการณ์ภายในบัตรผู้เข้าสอบและห้องสอบ
  attachVisitorCardEvents() {
    // ดูผังห้องสอบและตำแหน่งเครื่องสอบ
    this.root.querySelectorAll('.btn-view-examinee-blueprint, .btn-view-room-plan').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const roomCode = btn.getAttribute('data-room-code');
        const roomId = btn.getAttribute('data-room-id') || btn.getAttribute('data-id');
        const room = appState.rooms.find(r =>
          (roomId && (r.id === roomId || r.roomCode === roomId || r.code === roomId)) ||
          (roomCode && (r.roomCode === roomCode || r.code === roomCode || r.id === roomCode))
        );
        if (room) {
          this.activeModal = {
            type: 'modal-room-detail',
            room: room
          };
          this.render();
        }
      });
    });

    // ปุ่มปิดบัตรประจำตัวผู้เข้าสอบ (ทั้งใน header และ action footer)
    const closePassBtns = this.root.querySelectorAll('#btn-close-exam-pass, #btn-close-exam-pass-action');
    closePassBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const searchInput = this.root.querySelector('#visitor-examinee-search-input');
        const clearBtn = this.root.querySelector('#btn-clear-examinee-search');
        const resultArea = this.root.querySelector('#examinee-search-result-area');
        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        if (resultArea) {
          resultArea.innerHTML = renderExamineePassCard(null, appState, false);
          this.attachVisitorCardEvents();
        }
      });
    });

    // ปุ่มปิดข้อความไม่พบข้อมูล
    const closeNoResultBtn = this.root.querySelector('#btn-close-no-result');
    if (closeNoResultBtn) {
      closeNoResultBtn.addEventListener('click', () => {
        const searchInput = this.root.querySelector('#visitor-examinee-search-input');
        const clearBtn = this.root.querySelector('#btn-clear-examinee-search');
        const resultArea = this.root.querySelector('#examinee-search-result-area');
        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        if (resultArea) {
          resultArea.innerHTML = renderExamineePassCard(null, appState, false);
          this.attachVisitorCardEvents();
        }
      });
    }
  }

  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    const icon = type === 'success' ? '✅' : (type === 'error' ? '⚠️' : (type === 'warning' ? '🔔' : 'ℹ️'));
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">${icon}</span>
        <span>${message}</span>
      </div>
      <button style="background:none; border:none; color:inherit; font-size:16px; cursor:pointer; opacity:0.8; margin-left: 8px;" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px) scale(0.95)';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }
}