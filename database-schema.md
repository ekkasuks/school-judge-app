# Database Schema — Google Sheets (V2)

> **V2 — โหวตรอบเดียว** | 6 ทีม × 6 รางวัล × 11 กรรมการ
> ใช้ Google Spreadsheet 1 ไฟล์ ประกอบด้วย **7 sheet** ทุก sheet มี header ที่บรรทัด 1, column A เป็น primary key

## กฎทั่วไป

- ทุก ID ใช้ prefix สั้น อ่านง่าย (`T1`-`T6`, `J01`-`J11`, `A1`-`A6`)
- วันที่/เวลา = ISO 8601 + timezone `+07:00`
- Boolean = `TRUE` / `FALSE`
- **ห้ามลบแถวที่มี ID แล้ว** ใช้ `Active` หรือ `Status` แทน
- ทุก write ผ่าน Apps Script ใช้ `LockService.getScriptLock()`

---

## Sheet 1: `Teams` (ทีมที่เข้าประกวด)

ทีมที่เข้าแข่ง 6 ทีม

| col | field | type | required | ตัวอย่าง | หมายเหตุ |
|-----|-------|------|----------|---------|-----------|
| A | `TeamID` | string | ✓ | `T1` | PK |
| B | `TeamNumber` | int | ✓ | `1` | หมายเลขทีมบนเวที |
| C | `TeamName` | string | ✓ | `เด็กดีสีขาว` | |
| D | `School` | string | ✓ | `โรงเรียนบ้านใหม่` | |
| E | `ImageURL` | string |  | `https://drive.google.com/uc?id=...` | URL จาก Drive |
| F | `ImageFileID` | string |  | `1aBcDeFg...` | Drive file ID |
| G | `Order` | int | ✓ | `1` | ลำดับแสดง |
| H | `Status` | enum | ✓ | `Active` | `Active` / `Removed` |
| I | `CreatedAt` | datetime | ✓ | | |
| J | `UpdatedAt` | datetime | ✓ | | |

---

## Sheet 2: `Judges` (กรรมการ 11 คน)

ใช้ **ลิงก์เดียวกัน** ทุกคน → กรรมการเลือกชื่อตนเองในแอป

| col | field | type | required | ตัวอย่าง | หมายเหตุ |
|-----|-------|------|----------|---------|-----------|
| A | `JudgeID` | string | ✓ | `J01` | PK |
| B | `JudgeName` | string | ✓ | `ครูชมพู่` | ชื่อแสดงในรายการ |
| C | `Order` | int | ✓ | `1` | ลำดับแสดงในรายการเลือกชื่อ |
| D | `Voted` | bool | ✓ | `FALSE` | TRUE = ส่งคะแนนแล้ว (lock) |
| E | `VotedAt` | datetime |  | | timestamp ตอนกดส่ง |
| F | `Active` | bool | ✓ | `TRUE` | |

**Seed (ตามที่ผู้ใช้ระบุ):**

| JudgeID | JudgeName | Order |
|---------|-----------|-------|
| J01 | ครูชมพู่  | 1 |
| J02 | ครูอ้อม   | 2 |
| J03 | ครูอ้อน   | 3 |
| J04 | ครูดาว   | 4 |
| J05 | ครูแนน   | 5 |
| J06 | ครูน๊อต  | 6 |
| J07 | ครูดิว    | 7 |
| J08 | ครูเอก    | 8 |
| J09 | ครูเบียร์  | 9 |
| J10 | ครูสา      | 10 |
| J11 | ผอ.       | 11 |

> 🔑 **ลิงก์โหวต:** `https://<pages>/judge.html` (ไม่มี token) → กรรมการเลือก JudgeID เอง
> ป้องกันโหวตซ้ำด้วย `Voted=TRUE` + เก็บ JudgeID ใน `localStorage` ของเครื่องนั้น

---

## Sheet 3: `Awards` (รางวัล 6 ประเภท)

| col | field | type | required | ตัวอย่าง | หมายเหตุ |
|-----|-------|------|----------|---------|-----------|
| A | `AwardID` | string | ✓ | `A1` | PK |
| B | `AwardName` | string | ✓ | `หลอนชุด ไม่หลอนยา` | |
| C | `Order` | int | ✓ | `1` | ลำดับแสดง (= ลำดับ reveal) |

**Seed (รายชื่อเดิม):**

| AwardID | AwardName | Order |
|---------|-----------|-------|
| A1 | หลอนชุด ไม่หลอนยา      | 1 |
| A2 | พลังจิ๋วแต่แจ๋ว         | 2 |
| A3 | เด็กทรงดี ไม่มีทรงยา    | 3 |
| A4 | โอ้โห ! ทำไปได้          | 4 |
| A5 | เจ้าหนูพลังบวก          | 5 |
| A6 | ตัวตึงไม่พึ่งผง           | 6 |

---

## Sheet 4: `Votes` (คะแนนโหวต)

แต่ละแถว = 1 กรรมการ เลือก 1 ทีม ให้ 1 รางวัล → กรรมการ 1 คน สร้าง 6 แถว

| col | field | type | required | ตัวอย่าง | หมายเหตุ |
|-----|-------|------|----------|---------|-----------|
| A | `VoteID` | string | ✓ | `V0001` | PK, auto-increment |
| B | `JudgeID` | string | ✓ | `J01` | FK → Judges |
| C | `AwardID` | string | ✓ | `A3` | FK → Awards |
| D | `TeamID` | string | ✓ | `T02` | FK → Teams |
| E | `SubmittedAt` | datetime | ✓ | | |

**Unique constraint:** `(JudgeID, AwardID)` — 1 กรรมการ เลือก 1 ทีม ต่อ 1 รางวัล

> ⚠️ 1 กรรมการ **อาจเลือกทีมเดียวกันให้หลายรางวัลได้** (เป็นการ "โหวต" ไม่ใช่ "assign")

---

## Sheet 5: `Results` (ผลสรุปหลังคำนวณ Hungarian)

cache ผลลัพธ์หลังปิดโหวต — bijection 1 ทีม : 1 รางวัล

| col | field | type | required | ตัวอย่าง | หมายเหตุ |
|-----|-------|------|----------|---------|-----------|
| A | `ResultID` | string | ✓ | `RES1` | PK |
| B | `AwardID` | string | ✓ | `A1` | |
| C | `AwardName` | string | ✓ | `หลอนชุด ไม่หลอนยา` | denorm |
| D | `AwardOrder` | int | ✓ | `1` | ลำดับ reveal |
| E | `TeamID` | string | ✓ | `T03` | ทีมผู้ชนะ |
| F | `TeamName` | string | ✓ | `เด็กดีสีขาว` | denorm |
| G | `School` | string | ✓ | `โรงเรียนบ้านใหม่` | denorm |
| H | `ImageURL` | string |  | | denorm |
| I | `VoteCount` | int | ✓ | `5` | จำนวนเสียงที่ตรงรางวัลนี้ |
| J | `ComputedAt` | datetime | ✓ | | |
| K | `Note` | string |  | `admin override` | บันทึกถ้า admin แก้ |

**เขียนเมื่อใด:** ทันทีที่ admin **ปิดโหวต** (auto-compute Hungarian) — clear แถวเก่า แล้ว insert 6 แถวใหม่

---

## Sheet 6: `Config` (key-value)

| col | field | type | ตัวอย่าง |
|-----|-------|------|---------|
| A | `Key` | string | `votingOpen` |
| B | `Value` | string | `TRUE` |
| C | `Description` | string | `เปิดให้กรรมการลงคะแนน` |
| D | `UpdatedAt` | datetime | |

**Keys ที่ใช้ (seed):**

| Key | Default | ความหมาย |
|-----|---------|----------|
| `eventName` | `การประกวดชุดต่อต้านยาเสพติด - โรงเรียนบ้านใหม่` | ชื่องาน |
| `eventDate` | `2026-06-26` | วันจัด |
| `votingOpen` | `FALSE` | เปิดให้กรรมการลงคะแนน |
| `voteComputed` | `FALSE` | คำนวณ Hungarian แล้ว |
| `resultsPublished` | `FALSE` | เริ่ม TV reveal mode |
| `revealIndex` | `0` | รางวัลที่ reveal แล้ว (0..6) — กดปุ่ม "รางวัลถัดไป" เพิ่มทีละ 1 |
| `revealedTeam` | `FALSE` | ในรางวัลปัจจุบัน reveal ชื่อทีมแล้วหรือยัง |

> `revealIndex` + `revealedTeam` เป็นกลไก state ของ **TV mode** — sync ทุกหน้าจอผ่าน polling

---

## Sheet 7: `Sessions` (admin tokens)

เหมือนเดิม — สำหรับ admin login เท่านั้น (กรรมการไม่ใช้)

| col | field | type | ตัวอย่าง |
|-----|-------|------|---------|
| A | `Token` | string | UUID |
| B | `Role` | string | `admin` |
| C | `CreatedAt` | datetime | |
| D | `ExpiresAt` | datetime | createdAt + 8h |

---

## ความสัมพันธ์

```
       Config       Sessions
                       
   ┌── Teams ◄── Votes ──► Judges
   │              │
   │              ▼
   │           Awards
   │
   └── Results ◄─ (compute Hungarian จาก Votes)
```

---

## สูตรการคำนวณ — Hungarian Assignment

```
สร้าง matrix votes[team][award] = COUNT(Votes where TeamID=team AND AwardID=award)
  shape: 6 × 6

หา assignment σ: awards → teams (bijection)
  ที่ MAX Σ votes[σ(a)][a]

ใช้ Hungarian (Kuhn-Munkres) บน cost = MAX_VAL - votes
```

> เรียกใน Apps Script ทันทีที่ Admin set `votingOpen=FALSE`
> ผลลัพธ์เขียนลง `Results` 6 แถว + set `voteComputed=TRUE`

---

## ตัวอย่าง seed (สำหรับ Init.gs)

- **Teams:** 6 แถว (T1–T6), Status=`Active`, Order 1–6
- **Awards:** 6 แถว ตามตารางด้านบน
- **Judges:** 11 แถว ตาม seed
- **Config:** 7 keys
- **Votes / Results / Sessions:** ว่าง

---

## หมายเหตุการ implement

1. **Auto-increment ID:** `Utilities.formatString('V%04d', lastId+1)`
2. **Atomic batch insert:** กรรมการส่ง 6 votes พร้อมกัน — `sheet.setValues()` 1 call
3. **Auto-compute trigger:** Apps Script ตรวจใน `setConfig` → ถ้า key=`votingOpen` และ value=`FALSE` → เรียก `computeResults()`
4. **ป้องกัน double-submit:** double-check `Voted=TRUE` ภายใน `LockService`
5. **Reveal state sync:** judge/results poll `Config.revealIndex` + `revealedTeam` เป็นหลัก
