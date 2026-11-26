import re

# 1. Update src/ui/app-view.js
with open('src/ui/app-view.js', 'r', encoding='utf-8') as f:
    src = f.read()

old_proctor_title = "case 'proctors': return this.proctorSubTab === 'quota' ? 'จัดการกลุ่มบุคลากร & กำหนดโควต้าการคุมสอบ (Core & Reserve Pool)' : 'จัดการข้อมูลผู้คุมสอบ';"
new_proctor_title = """case 'proctors': {
        if (this.proctorSubTab === 'quota') return 'จัดการกลุ่มบุคลากร & กำหนดโควต้าการคุมสอบ (Core & Reserve Pool)';
        if (this.proctorSubTab === 'info') return 'จัดการข้อมูลผู้คุมสอบ';
        if (this.proctorSubTab === 'personal-summary') return 'สรุปตารางคุมสอบรายบุคคล และภาระงาน';
        if (this.proctorSubTab === 'swaps') return 'คำขอเปลี่ยนตัว & สลับตัวผู้คุมสอบ';
        if (this.proctorSubTab === 'docs') return 'เอกสารและคำสั่งแต่งตั้งกรรมการคุมสอบ';
        return 'จัดการข้อมูลผู้คุมสอบ';
      }"""

if old_proctor_title in src:
    src = src.replace(old_proctor_title, new_proctor_title, 1)
    print("Updated getPageTitle in src/ui/app-view.js")
else:
    print("old_proctor_title not found in src/ui/app-view.js (already updated?)")

src = src.replace('🟢 กลุ่มหลัก (Core)', 'กลุ่มหลัก (Core)')
src = src.replace('🟡 กลุ่มสำรอง (Reserve)', 'กลุ่มสำรอง (Reserve)')

with open('src/ui/app-view.js', 'w', encoding='utf-8') as f:
    f.write(src)

# 2. Update split/js/25-app-view.js
with open('split/js/25-app-view.js', 'r', encoding='utf-8') as f:
    split = f.read()

if old_proctor_title in split:
    split = split.replace(old_proctor_title, new_proctor_title, 1)
    print("Updated getPageTitle in split/js/25-app-view.js")
else:
    print("old_proctor_title not found in split/js/25-app-view.js (already updated?)")

split = split.replace('🟢 กลุ่มหลัก (Core)', 'กลุ่มหลัก (Core)')
split = split.replace('🟡 กลุ่มสำรอง (Reserve)', 'กลุ่มสำรอง (Reserve)')

# Check event listeners in split/js/25-app-view.js
old_listeners = """    const subtabInfoBtn = this.root.querySelector('#btn-subtab-proctor-info');
    if (subtabInfoBtn) {
      subtabInfoBtn.addEventListener('click', () => {
        this.proctorSubTab = 'info';
        this.render();
      });
    }"""

new_listeners = """    const subtabInfoBtn = this.root.querySelector('#btn-subtab-proctor-info');
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
    }"""

if old_listeners in split:
    split = split.replace(old_listeners, new_listeners, 1)
    print("Added subtab listeners to split/js/25-app-view.js")
else:
    print("old_listeners not found in split/js/25-app-view.js (already updated?)")

with open('split/js/25-app-view.js', 'w', encoding='utf-8') as f:
    f.write(split)

print("Finished processing updates.")
