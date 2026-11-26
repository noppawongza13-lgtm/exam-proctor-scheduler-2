import sys

code_to_insert = """
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
          const cap = standardCaps[idx] !== undefined ? standardCaps[idx] : (r.capacity || 40);
          r.capacity = cap;
          r.isActive = true;
          r.seatStart = curSeat;
          r.seatEnd = curSeat + cap - 1;
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

          const isActive = chk ? chk.checked : true;
          let cap = parseInt(capInput ? capInput.value : 0, 10);
          if (isNaN(cap) || cap < 0) cap = 0;

          if (isActive) {
            activeCount++;
            totalCap += cap;
            const sStart = curSeat;
            const sEnd = curSeat + cap - 1;
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
        const sumRange = this.root.querySelector('#summary-seat-range');
        const sumProctors = this.root.querySelector('#summary-total-proctors');

        if (sumActive) sumActive.textContent = `เปิดสอบ ${activeCount} ห้อง`;
        if (sumCap) sumCap.textContent = `ความจุรวม ${totalCap} ที่นั่ง`;
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

              if (isActive) {
                targetRoom.seatStart = curSeat;
                targetRoom.seatEnd = curSeat + cap - 1;
                curSeat = targetRoom.seatEnd + 1;
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
"""

def update_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update constructor to include this.roomsSubTab and this.blueprintFloor if missing
    if "this.roomsSubTab = 'seating-grid';" not in content:
        target_ctor = "this.roomsViewMode = 'table';"
        if target_ctor in content:
            content = content.replace(target_ctor, "this.roomsSubTab = 'seating-grid';\n    this.blueprintFloor = 1;\n    this.roomsViewMode = 'table';", 1)
            print(f"Added roomsSubTab to constructor in {path}")

    # 2. Add event listeners after [data-floor-mode]
    target_event = """    // สลับมุมมองผังอาคาร 17 (Table / Floor 1 / Floor 2 / Directory)
    this.root.querySelectorAll('[data-floor-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.roomsViewMode = btn.getAttribute('data-floor-mode');
        this.render();
      });
    });"""

    if target_event in content and "btn-subtab-rooms-seating" not in content[content.find(target_event):content.find(target_event)+1000]:
        content = content.replace(target_event, target_event + "\n" + code_to_insert, 1)
        print(f"Added room event handlers to {path}")
    else:
        print(f"Checking alternative match for {path}...")
        # Check if already present
        if "btn-subtab-rooms-seating" in content:
            print(f"btn-subtab-rooms-seating already present in {path}")
        else:
            print(f"Target not found in {path}")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

update_file('src/ui/app-view.js')
update_file('split/js/25-app-view.js')
