
const NAMES={"17201": "ห้องประชุมหอสัมทันธ์", "17202": "ห้องประชุมเจริญพันธุ์วงศ์", "17203": "ห้องประชุมลักษณะงาน", "17204": "ห้องควบคุม", "17205": "สถิติปัญญา", "17206": "ห้องประชุมมงคลแก้ว", "17207": "ห้องประชุมเซ็มกลาง", "17208": "ห้องแต่งตัวหญิง", "17209": "ห้องแต่งตัวชาย", "17210": "ห้องรับรอง", "17211": "จิตตปัญญา 1", "17212": "จิตตปัญญา 2", "17213": "จิตตปัญญา 3", "17214": "ห้องน้ำคนพิการ", "17101": "นัดค่ายแม่ปัญญา", "17102": "นันทนปัญญา 1", "17103": "นันทนปัญญา 2", "17104": "วิริณปัญญา 1", "17105": "วิริณปัญญา 2", "17106": "วิริณปัญญา 3", "17107": "วิริณปัญญา 4", "17108": "วิริณปัญญา 5", "17109": "วิริณปัญญา 6", "17110": "วิริณปัญญา 7", "17111": "วิริณปัญญา 8", "17112": "ห้องน้ำคนพิการ", "17113": "งานเทคนิคอาคาร", "wc-2": "ห้องน้ำ (ชั้น 2)", "wc-1": "ห้องน้ำ (ชั้น 1)"}, TY={"17201": "hall", "17202": "hall", "17203": "hall", "17204": "ctl", "17205": "off", "17206": "meet", "17207": "hall", "17208": "dress", "17209": "dress", "17210": "recv", "17211": "cls", "17212": "cls", "17213": "cls", "17214": "wc", "17101": "hall", "17102": "meet", "17103": "hall", "17112": "wc", "17113": "tech", "wc-2": "wcg", "wc-1": "wcg", "17104": "cls", "17105": "cls", "17106": "cls", "17107": "cls", "17108": "cls", "17109": "cls", "17110": "cls", "17111": "cls"};
const TYPE={
 hall:['หอประชุม/ห้องประชุมใหญ่',['โปรเจกเตอร์','ระบบเสียง','ไมโครโฟนไร้สาย','เครื่องปรับอากาศ'],180],
 meet:['ห้องประชุม',['จอ LED','โต๊ะประชุม','ไมโครโฟน','Wi-Fi'],60],
 cls:['ห้องเรียน',['โปรเจกเตอร์','กระดานไวท์บอร์ด','เครื่องปรับอากาศ','Wi-Fi'],40],
 off:['ห้องปฏิบัติงาน',['คอมพิวเตอร์','เครื่องพิมพ์','ตู้เก็บเอกสาร'],12],
 ctl:['ห้องควบคุม',['แท่นควบคุมเสียง/แสง','จอมอนิเตอร์','ตู้ Rack'],6],
 dress:['ห้องแต่งตัว',['กระจกแต่งหน้า','ราวแขวนเสื้อ','ตู้ล็อกเกอร์'],15],
 recv:['ห้องรับรอง',['โซฟารับรอง','เครื่องปรับอากาศ','ตู้เย็น'],20],
 wc:['ห้องน้ำคนพิการ',['ราวจับ','สัญญาณขอความช่วยเหลือ','พื้นกันลื่น','โถงลิฟต์ 2 ตัวติดกัน'],0],
 wcg:['ห้องน้ำ',['สุขภัณฑ์ชาย/หญิง','อ่างล้างมือ','พื้นกันลื่น'],0],
 tech:['งานเทคนิคอาคาร',['ตู้เครื่องมือ','โต๊ะปฏิบัติงาน','ตู้ควบคุมไฟฟ้า'],8]
};
const CAP={17207:600,17201:300,17202:260,17203:200,17103:120,17206:80};
const side=document.getElementById('side');let cur=null;
const $=id=>document.getElementById(id);
function setActive(id){
 document.querySelectorAll('.active').forEach(e=>e.classList.remove('active'));
 if(!id)return;
 const s=$('room-'+id);if(s)s.classList.add('active');
 document.querySelectorAll('.cols a[data-room="'+id+'"]').forEach(a=>a.classList.add('active'));
}
function openRoom(id){
 const T=TYPE[TY[id]],fl=id.startsWith('172')||id==='wc-2'?2:1;
 const cap=CAP[id]||T[2],n=parseInt(id.slice(-2))||0;
 setActive(id);
 $('dFloor').textContent='ชั้น '+fl;$('dType').textContent=T[0];
 $('dName').textContent=(id[0]==='w'?'':id+' · ')+NAMES[id];
 const rows=[['ชื่อห้อง',NAMES[id]],['ประเภท',T[0]]];
 if(id[0]!=='w')rows.unshift(['รหัสห้อง',id]);
 if(id==='17112')rows.push(['หมายเหตุ','ในผังเดิมกำกับเลข 17114']);
 if(cap)rows.push(['ความจุ',cap+' ที่นั่ง'],['พื้นที่ใช้สอย (โดยประมาณ)',Math.round(cap*1.8+6)+' ตร.ม.']);
 rows.push(['เวลาเปิดใช้งาน','08:30 – 16:30 น.'],['สถานะวันนี้',n%3===0?'มีการใช้งาน':'ว่าง'],['ผู้ดูแล','ฝ่ายอาคารสถานที่']);
 $('dList').innerHTML=rows.map(x=>`<dt>${x[0]}</dt><dd>${x[1]}</dd>`).join('');
 $('dEq').innerHTML=T[1].map(x=>`<li>${x}</li>`).join('');
 $('dDesc').textContent=`${NAMES[id]} ตั้งอยู่ ชั้น ${fl} ของอาคาร`;
 side.classList.add('open');
}
function closeRoom(){setActive(null);side.classList.remove('open')}
document.querySelectorAll('[data-room]').forEach(e=>{
 const id=e.dataset.room;
 e.addEventListener('click',ev=>{ev.preventDefault();openRoom(id)});
 e.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();openRoom(id)}});
 if(e.tagName!=='polygon'){ // label ภายนอก / รายชื่อ → ไฮไลต์ห้องคู่กัน
  e.addEventListener('mouseenter',()=>{const s=$('room-'+id);s&&s.classList.add('hov')});
  e.addEventListener('mouseleave',()=>{const s=$('room-'+id);s&&s.classList.remove('hov')});
 }else{
  e.addEventListener('mouseenter',()=>document.querySelectorAll('.cols a[data-room="'+id+'"]').forEach(a=>a.classList.add('hov')));
  e.addEventListener('mouseleave',()=>document.querySelectorAll('.cols a[data-room="'+id+'"]').forEach(a=>a.classList.remove('hov')));
 }
});
$('closeBtn').onclick=closeRoom;
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeRoom()});
