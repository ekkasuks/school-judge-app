# TODO — V2 Plan (Single Round)

> **V1–V10 ของแผนเดิมถูก rework** — เปลี่ยนเป็น 7 Phase ใหม่
> ทำทีละ phase **หยุดรอ confirm หลังจบทุก phase**

✅ = เสร็จ • 🔄 = กำลังทำ • ⏸️ = รอ confirm • ⬜ = ยังไม่เริ่ม

---

## Phase V1 — Schema + Spec + Todo ⏸️ รอ confirm

- [x] [database-schema.md](database-schema.md) — ใหม่ทั้งหมด 7 sheet
  - [x] ลบ `Round1Votes`, `Round2Votes` → รวมเป็น `Votes` ก้อนเดียว
  - [x] ลบ field `Round` จาก `Judges` + ลบ `Token` (ใช้ shared link)
  - [x] ลบ status `Winner-Round1`
  - [x] ลบรางวัล "น่ารักจนกรรมการใจละลาย" → เหลือ 6 รางวัล
  - [x] เพิ่ม Config keys: `votingOpen`, `voteComputed`, `revealIndex`, `revealedTeam`
  - [x] Seed: 11 กรรมการตามรายชื่อจริง (ครูชมพู่ ... ผอ.)
- [x] [project-spec.md](project-spec.md) — V2 (single round, TV reveal mode)
- [x] [todo.md](todo.md) — ไฟล์นี้
- [x] [CLAUDE.md](CLAUDE.md) — ปรับให้สอดคล้องกับ V2

⏸️ รอ confirm

---

## Phase V2 — Apps Script ⏸️ รอ confirm

### ลบโค้ดเก่า ✅
- [x] ลบ `submitRound1Vote`, `submitRound2Vote`
- [x] ลบ `computeRound1`, `setRound1Winner`, `computeRound2`, `setRound2Results`
- [x] ลบ field `Round` + `Token` + `resetJudgeToken` + `generateJudgeToken_`
- [x] ลบ `getJudgeContext` (V1) + `validateJudgeToken_`
- [x] ไม่มี `Winner-Round1` references หลงเหลือ

### เพิ่มโค้ดใหม่ ✅
- [x] [Auth.gs](apps-script/Auth.gs): `getJudgesList`, `getVoteContext(judgeId)`
- [x] [Votes.gs](apps-script/Votes.gs): `submitVote` เดียว — atomic 6 rows + lock + double-check
- [x] [Results.gs](apps-script/Results.gs): `computeResults` + `computeResultsInternal_` (no-lock)
- [x] [Results.gs](apps-script/Results.gs): `publishResults` + `unpublishResults`
- [x] [Results.gs](apps-script/Results.gs): `setRevealState` (admin) + `getRevealState` (public)
- [x] [Results.gs](apps-script/Results.gs): `getResults` filter ตาม revealIndex/revealedTeam
- [x] [Config.gs](apps-script/Config.gs) auto-trigger:
  - [x] ปิดโหวต (TRUE→FALSE) → `computeResultsInternal_`
  - [x] เปิดโหวตใหม่หลังคำนวณ → reset state ทั้งหมด
- [x] [Judges.gs](apps-script/Judges.gs): `reorderJudges` (bonus)

### ปรับ Init.gs ✅
- [x] Schema 7 sheets (ลบ Round1Votes, Round2Votes, รวมเป็น Votes)
- [x] Seed 6 รางวัล (ตัด "น่ารักจนกรรมการใจละลาย" ออก)
- [x] Seed 11 กรรมการ: ครูชมพู่ ครูอ้อม ครูอ้อน ครูดาว ครูแนน ครูน๊อต ครูดิว ครูเอก ครูเบียร์ ครูสา ผอ.
- [x] Seed Config 7 keys: votingOpen, voteComputed, resultsPublished, revealIndex, revealedTeam + eventName/eventDate
- [x] `seedSampleTeams` — 6 ทีมตัวอย่าง

### อัปเดต README
- [x] [apps-script/README.md](apps-script/README.md) — สอดคล้อง V2

### Routes สรุป
- 25 endpoints, ลบ 7 ตัวเก่า, เพิ่ม 9 ตัวใหม่ (รวม `unpublishResults`, `reorderJudges`)

⏸️ รอ confirm

---

## Phase V3 — Judge UI ⏸️ รอ confirm

- [x] [judge.html](judge.html) ใหม่ทั้งหมด — 6 state UI:
  - [x] `loading` / `error` (มีปุ่ม retry)
  - [x] `pick-name` — grid 11 ชื่อกรรมการ (2 col mobile, 3 col tablet)
    - [x] กรรมการที่ Voted=TRUE → grey + "✅ ส่งแล้ว" + disabled
    - [x] banner "ยังไม่เปิดให้ลงคะแนน" ถ้า votingOpen=FALSE (เลือกชื่อล่วงหน้าได้)
  - [x] `closed` — voting ยังไม่เปิด + auto-poll 10s + ปุ่มเปลี่ยนชื่อ
  - [x] `done` — ✅ ขอบคุณ + เวลาส่ง
  - [x] `vote` มี 2 sub-view:
    - [x] form: การ์ดรางวัล gradient ใหญ่ + 6 ทีม + radio + sticky bottom nav
    - [x] review: list 6 รางวัล + ทีมที่เลือก + คลิกแก้
- [x] [js/judge.js](js/judge.js) ใหม่ — state machine + draft cache
- [x] localStorage:
  - [x] `judge_id` — JudgeID ที่เลือก
  - [x] `judge_draft_<judgeId>` — { votes: {awardId: teamId}, awardIndex }
- [x] ปุ่ม "ไม่ใช่ฉัน?" — top-right ในหน้า vote + ในหน้า closed → กลับ pick-name
- [x] Pre-submit validation: ตรวจครบทุกรางวัล, ถ้าขาด → กระโดดไปแก้
- [x] Edge cases handled:
  - [x] judge ถูกลบจาก admin → `ไม่พบกรรมการ` → clear localStorage → กลับ pick-name
  - [x] voting ปิดกลางคัน → server reject + toast error
  - [x] รีเฟรชระหว่างกรอก → draft restore
  - [x] Pick-name auto-refresh — เห็น real-time ใครส่งแล้ว

⏸️ รอ confirm

---

## Phase V4 — Admin UI ⏸️ รอ confirm

- [x] [admin.html](admin.html) — rewrite ทั้งไฟล์
  - [x] Tabs: Dashboard / ทีม / กรรมการ / ควบคุม / ผลคะแนน / Export (ตัด TV ออก — อยู่ใน results.html)
  - [x] Dashboard: progress bar เดียว (X/N กรรมการ) + state row 4 บรรทัด (votingOpen, voteComputed, resultsPublished, revealIndex)
  - [x] Tab ทีม: เหมือนเดิม (drag reorder + image upload)
  - [x] Tab กรรมการ: shared-link card 📋 บนสุด + list กรรมการ (no QR, no per-judge link)
  - [x] Tab ควบคุม: 2 toggles (`votingOpen`, `resultsPublished`) + คำเตือน
  - [x] Tab ผลคะแนน: เหลือ section เดียว (Hungarian preview + click-to-swap + บันทึก)
  - [x] Tab Export: ปุ่ม disabled พร้อมข้อความ "รอ Phase V6"
  - [x] ลบ tie-modal + link-modal + qrcode CDN
  - [x] Modal กรรมการ: ลบ field "รอบ" — เหลือชื่อเท่านั้น
- [x] [js/admin.js](js/admin.js) — rewrite ทั้งไฟล์
  - [x] ลบ judge token/QR logic, bindLinkModal, showJudgeLink
  - [x] ลบ r1Local + section "Round 1"
  - [x] ลบ progress bar รอบ 1
  - [x] ลบ tie-break logic (ไม่มีรอบ 1 แล้ว)
  - [x] resultLocal เดียว — preview + swap + save
  - [x] Toggle `votingOpen` ปิด → confirm + auto-compute report toast
  - [x] Toggle `votingOpen` เปิดหลังคำนวณ → confirm reset
  - [x] Toggle `resultsPublished` → เรียก `publishResults`/`unpublishResults` (reset revealIndex)
  - [x] Share link: `${origin}${path}judge.html` + copy to clipboard
- [x] ตรวจไม่มี V1 references หลงเหลือ (grep clean)

⏸️ รอ confirm

---

## Phase V5 — Results TV Reveal Mode ⏸️ รอ confirm

- [x] [results.html](results.html) — rewrite, full-screen friendly, ธีม dark + festive gradient
- [x] [js/results.js](js/results.js) — state machine + animations + admin bar + audio
- [x] poll `getResults` ทุก 2 วินาที (รวม revealIndex + revealedTeam ใน response เดียว)
- [x] State view 6 states:
  - [x] `loading` — spinner เริ่มต้น
  - [x] `not-published` — 🤫 + "ยังไม่ประกาศผล"
  - [x] `intro` — 🎉 + ชื่องาน + pulse-glow CTA
  - [x] `award-name` — รางวัลที่ X + 🏆 ใหญ่ + ชื่อรางวัล + drumroll
  - [x] `award-team` — รูป 56×56 (mobile) → 72×72 (desktop) + ชื่อทีม + เสียง + confetti
  - [x] `final` — grid 6 รางวัล + ทีม + confetti + fanfare
- [x] Animations:
  - [x] `reveal-in` (translateY + scale + fade)
  - [x] `scale-in` (bounce cubic-bezier)
  - [x] `pulse-glow` (text-shadow infinite)
  - [x] `text-glow-gold` (อมพลเงาทอง)
- [x] Confetti: 30-60 ชิ้น (ตามขนาดหน้าจอ), CSS-only, auto cleanup 10s
- [x] Audio (best-effort):
  - [x] AudioContext synthesize — drumroll (sawtooth descending) + fanfare (C major triad triangle)
  - [x] resume on first user gesture (Safari/Chrome autoplay policy)
- [x] Admin control bar (gated โดย `admin_token` ใน localStorage):
  - [x] แถบล่างจอ + เครื่องหมาย "🛠 Admin" + state label
  - [x] ปุ่มหลัก: "เริ่มประกาศ" / "เปิดผล" / "รางวัลถัดไป" / "ดูสรุป" / "เริ่มใหม่"
  - [x] ปุ่ม "← ย้อน" — ถอย state (await error scenarios)
  - [x] handle session-expired → reload
- [x] Top badge (sticky) แสดง event name + progress "X / N"
- [x] Smart signature diffing — ไม่ render ซ้ำเมื่อไม่เปลี่ยน state
- [x] อัปเดต admin.html note ในแท็บควบคุม — ชี้ไป results.html พร้อมแถบควบคุม

⏸️ รอ confirm

---

## Phase V6 — Export ⏸️ รอ confirm

- [x] [js/export-pdf.js](js/export-pdf.js) — rewrite ทั้งไฟล์ V2
  - [x] ลบ buildRound1Section + buildRound2Section
  - [x] 3 หน้า: ปก / สรุปรางวัล (6) / Vote Matrix + Assignment
  - [x] ใช้ V2 fields: `data.votes`, `r.VoteCount`, `r.AwardOrder`
- [x] [js/export-xlsx.js](js/export-xlsx.js) — rewrite ทั้งไฟล์ V2
  - [x] 4 sheets (ลบ "คะแนนรอบ 1"):
    - [x] สรุปผลรางวัล
    - [x] Vote Matrix (มี totals row ล่างสุด)
    - [x] กรรมการ (Order + สถิติ "X/Y" ล่างสุด)
    - [x] ทีม (Active/Removed เท่านั้น — ไม่มี Winner-Round1)
  - [x] ใช้ V2 fields เหมือนกัน
- [x] [admin.html](admin.html) — เปิดปุ่ม Export (ลบ disabled)
  - [x] ปุ่ม "📄 Export PDF" + caption บอกหน้า
  - [x] ปุ่ม "📊 Export Excel" + caption บอกชีต
  - [x] เพิ่ม `<script src="js/export-pdf.js">` + `export-xlsx.js`
- [x] [js/admin.js](js/admin.js) — bind ปุ่มใน `boot()`
- [x] ตรวจ collision: `indexBy` ซ้ำใน 2 ไฟล์ (identical — ปลอดภัย)

⏸️ รอ confirm

---

## Phase V7 — Test & Audit ⏸️ รอ confirm

### Static Audit (ฝั่ง Claude — ผ่านทั้งหมด)
- [x] Frontend `api()` calls ↔ Backend ROUTES — 21 calls ตรงทุกตัว
- [x] DOM IDs: judge.html ↔ judge.js — match
- [x] DOM IDs: admin.html ↔ admin.js — match (`tab-` + `result-save-btn` dynamic)
- [x] DOM IDs: results.html ↔ results.js — perfect match
- [x] Apps Script cross-file helpers — 19 ตัวมี definition ครบ
- [x] CDN libraries: admin.html มี Sortable/jsPDF/html2canvas/SheetJS, judge.html มีเฉพาะ Tailwind (ลบ Sortable แล้ว — V2 ไม่ใช้)
- [x] grep V1 leftover — โค้ดสะอาด (เหลือ refs ใน todo.md เป็น changelog เท่านั้น)
- [x] [README.md](README.md) — อัปเดต flow V2 (โหวตรอบเดียว, 11 กรรมการ, TV reveal)

### Test Checklist for User
- [x] [TEST-CHECKLIST.md](TEST-CHECKLIST.md) — 10 sections, 100+ checkpoints
  - [x] 0. Pre-deploy setup (Spreadsheet, Drive, Apps Script, init, deploy)
  - [x] 1. Backend smoke test (doGet, adminLogin, getJudgesList curl)
  - [x] 2. Admin UI (login, dashboard, teams CRUD, judges, controls)
  - [x] 3. Judge flow (pick-name, vote, draft restore, lock guard, change name)
  - [x] 4. Auto-compute (close vote → Hungarian → Results sheet)
  - [x] 5. Admin override swap
  - [x] 6. Publish + TV reveal (intro → award-name → award-team → final)
  - [x] 7. Reopen voting (reset)
  - [x] 8. Export PDF + Excel
  - [x] 9. Mobile + cross-device
  - [x] 10. Edge cases (race, session expire, network drop)

### Limitations
- ⚠️ Static audit only — ระบบ live ยังไม่ได้ deploy บน Apps Script + GitHub Pages
- ⚠️ User ต้องรัน TEST-CHECKLIST.md หลัง deploy เพื่อ confirm runtime behavior

⏸️ รอ confirm
