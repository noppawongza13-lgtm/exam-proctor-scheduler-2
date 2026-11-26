import re

def update_pdf_export(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update dateRangeText fallback
    content = content.replace("let dateRangeText = '๒7 - 29 มีนาคม พ.ศ. ๒๕๖9';", "let dateRangeText = `๒๗ - ๒๙ มีนาคม พ.ศ. ${toThaiDigits(examYearBE)}`;")

    # 2. Update dateRangeText when same month
    old_same_month = "dateRangeText = `๒7 - 29 ${sMonth} พ.ศ. ๒๕๖9`;"
    new_same_month = "dateRangeText = `${toThaiDigits(sDay)} - ${toThaiDigits(eDay)} ${sMonth} พ.ศ. ${toThaiDigits(sYear)}`;"
    content = content.replace(old_same_month, new_same_month)

    # 3. Update roomCountText to Thai digits
    content = content.replace("const roomCountText = `${roomCountNum} ห้องสอบ`;", "const roomCountText = `${toThaiDigits(roomCountNum)} ห้องสอบ`;")

    # 4. Update orderNumberSlot
    content = content.replace("ที่ ${toThaiDigits(orderNumber)}/๒๕๖9", "ที่ ${toThaiDigits(orderNumber)}/${toThaiDigits(examYearBE)}")
    content = content.replace("/๒๕๖9`;", "/${toThaiDigits(examYearBE)}`);")

    # 5. Update signDateHtml default
    content = content.replace("let signDateHtml = 'สั่ง ณ วันที่ ๑๒ กุมภาพันธ์ พ.ศ. ๒๕๖9';", "let signDateHtml = `สั่ง ณ วันที่ ๑๒ กุมภาพันธ์ พ.ศ. ${toThaiDigits(examYearBE)}`;")

    # 6. Update dayStr and yearStr in loop
    old_day_year = """    const dayVal = !isNaN(dObj.getTime()) ? dObj.getDate() : '';
    const dayStr = dayVal === 27 ? '๒7' : (dayVal === 28 ? '๒8' : (dayVal === 29 ? '๒9' : toThaiDigits(dayVal)));
    const monthStr = !isNaN(dObj.getTime()) ? thaiMonths[dObj.getMonth()] : '';
    const yearStr = '๒๕๖9';"""
    new_day_year = """    const dayVal = !isNaN(dObj.getTime()) ? dObj.getDate() : '';
    const dayStr = toThaiDigits(dayVal);
    const monthStr = !isNaN(dObj.getTime()) ? thaiMonths[dObj.getMonth()] : '';
    const yearStr = toThaiDigits(examYearBE);"""
    content = content.replace(old_day_year, new_day_year)

    # 7. Update roomCode to Thai digits in table cell
    old_room_cell = '<td class="cell-center cell-room" rowspan="${rSessions.length}">${escHtml(roomCode)}</td>'
    new_room_cell = '<td class="cell-center cell-room" rowspan="${rSessions.length}">${escHtml(toThaiDigits(roomCode))}</td>'
    content = content.replace(old_room_cell, new_room_cell)

    # 8. Update numLabel in room proctors
    old_num_label1 = "const numLabel = pIdx === 0 ? '1' : (pIdx === 1 ? '2' : (pIdx === 2 ? '3' : String(pIdx + 1)));"
    new_num_label1 = "const numLabel = toThaiDigits(pIdx + 1);"
    content = content.replace(old_num_label1, new_num_label1)

    # 9. Update numLabel in reserve proctors
    old_num_label2 = "const numLabel = pIdx === 0 ? '1' : (pIdx === 1 ? '2' : String(pIdx + 1));"
    new_num_label2 = "const numLabel = toThaiDigits(pIdx + 1);"
    content = content.replace(old_num_label2, new_num_label2)

    # 10. Update subject, preamble, duties text
    content = content.replace("ของสำนักงาน ก.พ. ประจำปี ๒๕๖9", "ของสำนักงาน ก.พ. ประจำปี ${toThaiDigits(examYearBE)}")
    content = content.replace("ประจำปี ๒๕๖9", "ประจำปี ${toThaiDigits(examYearBE)}")
    content = content.replace("ประจำปี ๒๕๖๘", "ประจำปี ${toThaiDigits(examYearBE)}")
    content = content.replace("ตั้งแต่เวลา ๐๘.0๐ น.-๑๗.๓๐ น.", "ตั้งแต่เวลา ๐๘.๐๐ น. - ๑๗.๓๐ น.")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Successfully updated {filepath}")

update_pdf_export('src/io/pdf-export.js')
update_pdf_export('split/js/18-pdf-export.js')

def update_app_view(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Update event listener for btn-goto-scheduler-from-profile
    old_listener = """    const gotoSchedFromProfile = this.root.querySelector('#btn-goto-scheduler-from-profile');
    if (gotoSchedFromProfile) {
      gotoSchedFromProfile.addEventListener('click', () => {
        this.setTab('scheduler');
      });
    }"""

    new_listener = """    const gotoSchedFromProfile = this.root.querySelector('#btn-goto-scheduler-from-profile');
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
    }"""

    if old_listener in content:
        content = content.replace(old_listener, new_listener)
        print(f"Updated gotoSchedFromProfile listener in {filepath}")
    else:
        print(f"old_listener not found in {filepath} (already updated?)")

    # Update button title attribute for clarity
    old_btn_tag = '<button class="btn btn-secondary btn-sm" id="btn-goto-scheduler-from-profile">'
    new_btn_tag = '<button class="btn btn-secondary btn-sm" id="btn-goto-scheduler-from-profile" title="ดูเอกสารคำสั่งแต่งตั้งคณะกรรมการกำกับการสอบภาคความรู้ความสามารถทั่วไป (ก.พ.) ฉบับทางการ">'
    if old_btn_tag in content:
        content = content.replace(old_btn_tag, new_btn_tag)
        print(f"Updated btn-goto-scheduler-from-profile button in {filepath}")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

update_app_view('src/ui/app-view.js')
update_app_view('split/js/25-app-view.js')
print("All files processed.")
