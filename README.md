# TO Discord BOT

แอป Dashboard สำหรับจัดการรายการ Discord Bot ออกแบบแบบ Mobile-first ด้วย React + Vite และ Android wrapper ผ่าน Capacitor พร้อม Backend API ด้วย Express และ SQLite

## ฟีเจอร์ที่มีในโปรเจกต์

- Dashboard แบบ Responsive สำหรับมือถือและเดสก์ท็อป
- สมัครสมาชิก / เข้าสู่ระบบ ด้วย bcrypt และ JWT
- เรียกคืนเซสชันขณะเปิดแท็บเดิม และออกจากระบบ
- จัดเก็บรายการบอตแยกตามบัญชีผ่าน Backend API
- เพิ่มและลบบอตจากบัญชีที่เข้าสู่ระบบ
- แก้ไขชื่อและอีเมลโปรไฟล์ผ่าน Backend API
- ธีมมืด/สว่าง สีหลัก และโหมดกระชับ
- Android APK build ผ่าน GitHub Actions

## ข้อจำกัดที่ต้องทราบ

แอปนี้จัดการ **รายการและข้อมูลของบอต** แต่ยังไม่ได้รัน Discord bot process, อ่านสถานะออนไลน์แบบสด, จัดเก็บ/ใช้ Discord Bot Token, เชิญบอตเข้า Discord, push notifications, ยืนยันอีเมล, รีเซ็ตรหัสผ่าน หรือระบบชำระเงินและบังคับแพ็กเกจ Free/Premium

ข้อมูลบอตตัวอย่างที่แสดงก่อนเข้าสู่ระบบเป็นข้อมูลจำลองเท่านั้น เมื่อเข้าสู่ระบบ รายการจะโหลดจาก Backend

## สร้าง APK

1. เปิดแท็บ [GitHub Actions](https://github.com/chloerangersonic0909-cmd/-to-discord-bot/actions)
2. เลือก workflow **Build Android APK**
3. กด **Run workflow** และรอให้ Job สำเร็จ
4. เปิดรายการ run ที่สำเร็จ แล้วดาวน์โหลด Artifact ชื่อ **TO-Discord-BOT-debug-APK**
5. แตกไฟล์ ZIP เพื่อรับไฟล์ `app-debug.apk`

Artifact จาก GitHub Actions เก็บไว้ 14 วัน และเป็น **debug APK** ไม่ใช่ APK ที่เซ็นสำหรับเผยแพร่บน Play Store

## ตั้งค่า Backend

ต้องใช้ Node.js 20 ขึ้นไป และฐานข้อมูล SQLite แบบ persistent บนโฮสต์ที่รองรับแอป Node.js

```bash
cd server
npm install
cp .env.example .env
```

ตั้งค่า `JWT_SECRET` ให้เป็นค่าสุ่มลับยาวอย่างน้อย 32 ตัวอักษร, ตั้ง `CLIENT_ORIGIN` เป็น URL frontend ที่ใช้งานจริง (คั่นหลาย origin ด้วย comma ได้) และตั้ง `DATABASE_PATH` ไปยังพื้นที่จัดเก็บที่ไม่ถูกลบเมื่อรีสตาร์ต จากนั้นรัน:

```bash
npm start
```

ตรวจสุขภาพ API ได้ที่ `/api/health` ต้องเปิด HTTPS เมื่อใช้งานจริง และห้าม commit ไฟล์ `.env` หรือฐานข้อมูลขึ้น repository

## เชื่อม APK กับ Backend

ใน GitHub repository ไปที่ **Settings → Secrets and variables → Actions → Variables** แล้วเพิ่ม Repository variable ชื่อ `VITE_API_URL` เป็น URL HTTPS ของ Backend เช่น `https://api.example.com` จากนั้นเรียก workflow สร้าง APK ใหม่

ถ้าไม่กำหนด `VITE_API_URL` แอปจะใช้ `http://localhost:3001` ซึ่งเหมาะกับการพัฒนาในเครื่องเท่านั้น และจะไม่ชี้ไปยัง Backend ที่ deploy อยู่เมื่อใช้ APK บนมือถือ

## รัน Frontend ในเครื่อง

```bash
npm install
npm run dev
```

## Repository

https://github.com/chloerangersonic0909-cmd/-to-discord-bot
