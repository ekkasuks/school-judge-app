# Database Schema — Google Sheets

> **Step 1 ของแผนพัฒนา** — ออกแบบโครงสร้างข้อมูลทั้งหมด

ใช้ Google Spreadsheet 1 ไฟล์ (ชื่อ `school-judge-app-db`) ประกอบด้วย **8 sheet** ทุก sheet มี header ที่บรรทัด 1 และ column A เป็น primary key

## กฎทั่วไป

- ทุก ID ใช้ prefix สั้น อ่านง่ายในมือถือ (`T01`, `J01`, …)
- วันที่/เวลา = ISO 8601 + timezone `+07:00`
- Boolean = `TRUE` / `FALSE`
- **ห้ามลบแถวที่มี ID แล้ว** ใช้คอลัมน์ `Active` หรือ `Status` แทน เพื่อรักษา foreign key
- ทุก write ผ่าน Apps Script ใช้ `LockService.getScriptLock()` กันชนกัน

---

## Sheet 1: `Teams` (ทีมที่เข้าประกวด)

| col | field | type | required | ตัวอย่าง | หมายเหตุ |
|-----|-------|------|----------|---------|-----------|
| A | `TeamID` | string | ✓ | `T01` | PK |
| B | `TeamNumber` | int | ✓ | `1` | หมายเลขทีมบนเวที |
| C | `TeamName` | string | ✓ | `เด็กดีสีขาว` | |
| D | `School` | string | ✓ | `โรงเรียนบ้านใหม่` | |
| E | `ImageURL` | string |  | `https://drive.google.com/uc?id=...` | URL จาก Drive (public view) |
| F | `ImageFileID` | string |  | `1aBcDeFg...` | Drive file ID (ไว้ลบ/แทนรูป) |
| G | `Order` | int | ✓ | `1` | ลำดับแสดง (admin ลาก reorder) |
| H | `Status` | enum | ✓ | `Active` | `Active` / `Winner-Round1` / `Removed` |
| I | `CreatedAt` | datetime | ✓ | | |
| J | `UpdatedAt` | datetime | ✓ | | |

**Status flow:**
- `Active` → ทีมพร้อมแข่ง (ทั้ง 7 ทีมเริ่มที่นี่)
- `Winner-Round1` → ชนะรอบ 1 → ถูกตัดออกจาก list ที่กรรมการรอบ 2 เห็นอัตโนมัติ
- `Removed` → admin ลบ (soft delete)

---

## Sheet 2: `Judges` (กรรมการ)

| col | field | type | required | ตัวอย่าง | หมายเหตุ |
|-----|-------|------|----------|---------|-----------|
| A | `JudgeID` | string | ✓ | `J01` | PK |
| B | `JudgeName` | string | ✓ | `อ.สมชาย รักเด็ก` | |
| C | `Round` | int | ✓ | `1` | `1` หรือ `2` |
| D | `Token` | string | ✓ | `judge-r1-a1b2c3` | unique, สร้างอัตโนมัติ |
| E | `Voted` | bool | ✓ | `FALSE` | TRUE = ส่งคะแนนแล้ว (lock) |
| F | `VotedAt` | datetime |  | | timestamp ตอนกดส่ง |
| G | `Active` | bool | ✓ | `TRUE` | FALSE = ถูกลบ |
| H | `CreatedAt` | datetime | ✓ | | |

**Constraint:** `Token` ต้องไม่ซ้ำ — Apps Script gen ด้วย `Utilities.getUuid().slice(0,6)` แล้วเช็คก่อน

**Reset token:** สร้าง token ใหม่ + set `Voted=FALSE` + ลบ vote เก่าของ JudgeID นี้ใน `Round1Votes` หรือ `Round2Votes`

---

## Sheet 3: `Awards` (รางวัล)

| col | field | type | required | ตัวอย่าง | หมายเหตุ |
|-----|-------|------|----------|---------|-----------|
| A | `AwardID` | string | ✓ | `A1` | PK |
| B | `AwardName` | string | ✓ | `น่ารักจนกรรมการใจละลาย` | |
| C | `Round` | int | ✓ | `1` | `1` หรือ `2` |
| D | `Order` | int | ✓ | `1` | ลำดับแสดง |

**Seed data (7 แถว):**

| AwardID | AwardName | Round | Order |
|---------|-----------|-------|-------|
| A1 | น่ารักจนกรรมการใจละลาย | 1 | 1 |
| A2 | หลอนชุด ไม่หลอนยา | 2 | 1 |
| A3 | พลังจิ๋วแต่แจ๋ว | 2 | 2 |
| A4 | เด็กทรงดี ไม่มีทรงยา | 2 | 3 |
| A5 | โอ้โห ! ทำไปได้ | 2 | 4 |
| A6 | เจ้าหนูพลังบวก | 2 | 5 |
| A7 | ตัวตึงไม่พึ่งผง | 2 | 6 |

---

## Sheet 4: `Round1Votes` (คะแนนรอบที่ 1)

แต่ละแถว = 1 กรรมการ จัดอันดับให้ 1 ทีม → กรรมการ 1 คน สร้าง 7 แถว

| col | field | type | required | ตัวอย่าง | หมายเหตุ |
|-----|-------|------|----------|---------|-----------|
| A | `VoteID` | string | ✓ | `R1V0001` | PK, auto-increment |
| B | `JudgeID` | string | ✓ | `J01` | FK → Judges (Round=1) |
| C | `TeamID` | string | ✓ | `T03` | FK → Teams |
| D | `Rank` | int | ✓ | `1` | 1–7 |
| E | `Points` | int | ✓ | `7` | `8 - Rank` (1→7, 2→6, …, 7→1) |
| F | `SubmittedAt` | datetime | ✓ | | |

**Unique constraint:** `(JudgeID, TeamID)` และ `(JudgeID, Rank)` — Apps Script เช็ค

**Insert logic:** เป็น atomic batch — Apps Script ลบของเก่า (ถ้ามี) แล้ว insert 7 แถวใหม่ใน transaction เดียวกัน (LockService)

---

## Sheet 5: `Round2Votes` (คะแนนรอบที่ 2)

แต่ละแถว = 1 กรรมการ เลือกรางวัลให้ 1 ทีม → กรรมการ 1 คน สร้าง 6 แถว

| col | field | type | required | ตัวอย่าง | หมายเหตุ |
|-----|-------|------|----------|---------|-----------|
| A | `VoteID` | string | ✓ | `R2V0001` | PK |
| B | `JudgeID` | string | ✓ | `J04` | FK → Judges (Round=2) |
| C | `TeamID` | string | ✓ | `T02` | FK → Teams |
| D | `AwardID` | string | ✓ | `A3` | FK → Awards (Round=2) |
| E | `SubmittedAt` | datetime | ✓ | | |

**Unique constraint:** `(JudgeID, TeamID)` — กรรมการเลือก 1 รางวัล ต่อ 1 ทีม

หมายเหตุ: 1 กรรมการสามารถเลือก `AwardID` เดียวกันให้หลายทีมได้ — เป็นการ "โหวต" ไม่ใช่ "assign"

---

## Sheet 6: `Results` (ผลสรุปหลังคำนวณ)

cache ผลลัพธ์หลังคำนวณเสร็จ ใช้แสดงในหน้า public results

| col | field | type | required | ตัวอย่าง | หมายเหตุ |
|-----|-------|------|----------|---------|-----------|
| A | `ResultID` | string | ✓ | `RES1` | PK |
| B | `Round` | int | ✓ | `1` | |
| C | `AwardID` | string | ✓ | `A1` | |
| D | `AwardName` | string | ✓ | `น่ารักจนกรรมการใจละลาย` | denorm เพื่อแสดงง่าย |
| E | `TeamID` | string | ✓ | `T05` | ทีมผู้ชนะ |
| F | `TeamName` | string | ✓ | `เด็กดีสีขาว` | denorm |
| G | `School` | string | ✓ | `โรงเรียนบ้านใหม่` | denorm |
| H | `ImageURL` | string |  | | denorm |
| I | `Score` | float | ✓ | `18` | คะแนนรวม (รอบ 1) หรือ vote count (รอบ 2) |
| J | `ComputedAt` | datetime | ✓ | | |
| K | `Note` | string |  | `admin override` | บันทึกถ้า admin แก้ผล |

**เขียนเมื่อใด:** ทุกครั้งที่ admin กด "คำนวณผล" — clear แถวเก่าของ round นั้น แล้ว insert ใหม่

---

## Sheet 7: `Config` (การตั้งค่าระบบ)

key-value store

| col | field | type | ตัวอย่าง |
|-----|-------|------|---------|
| A | `Key` | string | `round1Open` |
| B | `Value` | string | `TRUE` |
| C | `Description` | string | `เปิดให้กรรมการรอบ 1 ลงคะแนน` |
| D | `UpdatedAt` | datetime | |

**Keys ที่ใช้ (seed):**

| Key | Default | ความหมาย |
|-----|---------|----------|
| `eventName` | `การประกวดชุดต่อต้านยาเสพติด - โรงเรียนบ้านใหม่` | ชื่องาน |
| `eventDate` | `2026-06-26` | วันจัด |
| `round1Open` | `FALSE` | เปิดให้รอบ 1 ลงคะแนน |
| `round2Open` | `FALSE` | เปิดให้รอบ 2 ลงคะแนน |
| `round1Computed` | `FALSE` | คำนวณรอบ 1 แล้ว |
| `round2Computed` | `FALSE` | คำนวณรอบ 2 แล้ว |
| `resultsPublished` | `FALSE` | เผยแพร่ผลสาธารณะ |
| `currentRound` | `1` | รอบปัจจุบัน (1 หรือ 2) |

---

## Sheet 8: `Sessions` (admin tokens)

| col | field | type | ตัวอย่าง | หมายเหตุ |
|-----|-------|------|---------|-----------|
| A | `Token` | string | UUID | PK |
| B | `Role` | string | `admin` | |
| C | `CreatedAt` | datetime | | |
| D | `ExpiresAt` | datetime | | createdAt + 8h |

> Judge ไม่ใช้ Sheet นี้ — token ของ judge คือ token ถาวรใน `Judges.Token`
> Apps Script เคลียร์ session หมดอายุแบบ lazy ทุกครั้งที่ admin login

---

## ความสัมพันธ์ (ER Diagram)

```
       Config        Awards                 Sessions
                       │
                       │ Round=1 │ Round=2
                       │         │
   ┌─── Teams ◄───── R1Votes ───► Judges (Round=1)
   │                  ▲
   │                  └── R2Votes ──► Judges (Round=2)
   │                                    ▲
   └────── Results ◄────────────────────┘
           (cache)
```

---

## สูตรการคำนวณ

### รอบที่ 1
```
สำหรับแต่ละทีม T (Status=Active):
  totalScore[T] = SUM(Points where TeamID=T)
  rank1Count[T] = COUNT(* where TeamID=T AND Rank=1)
  rank2Count[T] = COUNT(* where TeamID=T AND Rank=2)
  rank3Count[T] = COUNT(* where TeamID=T AND Rank=3)

ผู้ชนะ = argmax โดย sort key (totalScore desc, rank1Count desc, rank2Count desc, rank3Count desc)

ถ้ายังเสมอ → admin เลือก (set ใน Results.TeamID + Note='admin tiebreak')
```

### รอบที่ 2 — Assignment Matching
```
ทีม T (6 ทีม จาก Status=Active หลังตัด Winner-Round1) × รางวัล A (6 รางวัล Round=2)

build matrix votes[t][a] = COUNT(R2Votes where TeamID=t AND AwardID=a)

เป้าหมาย: หา assignment σ: teams → awards (bijection)
          ที่ MAX Σ votes[t][σ(t)]

ใช้ Hungarian Algorithm (O(n³), n=6 → เร็วมาก) — implement ใน Apps Script
```

---

## ตัวอย่างข้อมูล seed (สำหรับทดสอบ)

- **Teams:** 7 แถว (T01–T07), Status=`Active`, Order 1–7
- **Awards:** 7 แถว ตามตารางด้านบน
- **Judges:**
  - รอบ 1: J01, J02, J03
  - รอบ 2: J04, J05, J06, J07, J08, J09, J10
- **Config:** 8 keys
- **R1Votes / R2Votes / Results / Sessions:** ว่าง

---

## หมายเหตุการ implement

1. **Auto-increment ID:** ใช้ `Utilities.formatString('R1V%04d', lastId+1)`
2. **Atomic batch insert:** `sheet.getRange(row, 1, n, cols).setValues(matrix)` ใน 1 call
3. **Query แบบรวดเร็ว:** อ่าน `sheet.getDataRange().getValues()` ครั้งเดียวมา filter ใน memory ดีกว่าเรียก getRange หลายครั้ง
4. **Image hosting บน Drive:** เก็บไฟล์ใน folder เดียว (`teams-images/`), set sharing = "Anyone with link can view", ใช้ URL `https://drive.google.com/uc?export=view&id={fileId}`
