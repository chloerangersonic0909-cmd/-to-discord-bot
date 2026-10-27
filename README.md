# TO Discord BOT

แอป Dashboard สำหรับจัดการโปรเจกต์ Discord Bot ออกแบบแบบ Mobile-first ด้วย React + Vite พร้อม Backend starter ด้วย Express และ SQLite

## มีอะไรในโปรเจกต์นี้
- หน้า Dashboard ภาพรวมและรายการบอตตัวอย่าง
- หน้า บอตของฉัน, คำสั่งและโค้ด, กิจกรรม, การแจ้งเตือน, โปรไฟล์, การตั้งค่า และผู้ดูแลระบบ
- ธีมมืด/สว่าง และเลือกสีหลัก
- Responsive UI สำหรับมือถือและเดสก์ท็อป
- Backend API starter: สมัครสมาชิก/เข้าสู่ระบบ, password hashing, JWT, รายการบอตแยกตามบัญชี และ endpoint ผู้ดูแลระบบ
- Capacitor configuration สำหรับเตรียมทำ Android wrapper

## สถานะปัจจุบัน
**Frontend ยังเป็น UI prototype** รายการบอตและโปรไฟล์ในหน้าจอใช้ข้อมูลตัวอย่างและยังไม่ได้เชื่อมกับ API จริง ส่วน Backend เป็นโครงเริ่มต้นที่ต้อง deploy และตั้งค่า environment ก่อนใช้งานจริง

ยังไม่ได้ทำ APK และยังไม่มีการควบคุมบอตจริง, สถานะ Discord แบบสด, token vault, push notifications, ยืนยันอีเมล, รีเซ็ตรหัสผ่าน หรือระบบกำหนด role admin แบบปลอดภัย

> **ความปลอดภัย:** ห้ามใส่ Discord Bot Token ใน frontend, Git commit หรือ repository สาธารณะ ฟอร์มเพิ่มบอตปัจจุบันรับเฉพาะชื่อบอตและไม่ส่ง Token ไปที่ใด

## รัน Frontend
ต้องใช้ Node.js 20 ขึ้นไป

```bash
npm install
npm run dev
```

## รัน Backend API
จากโฟลเดอร์โปรเจกต์:

```bash
cd server
npm install
cp .env.example .env
```

แก้ `JWT_SECRET` ให้เป็น secret แบบสุ่มที่ยาวอย่างน้อย 32 ตัวอักษร และตั้ง `CLIENT_ORIGIN` เป็น URL ของ frontend จากนั้นรัน:

```bash
npm start
```

Health endpoint คือ `/api/health` และ API สมัคร/เข้าสู่ระบบจะส่ง JWT กลับมา ควรใช้ HTTPS และเก็บไฟล์ `.env` กับฐานข้อมูลให้ปลอดภัย

## เตรียม Android APK
ต้องมี Android SDK / Android Studio และ build tools ในสภาพแวดล้อมที่รองรับ การสร้าง APK ยังไม่ได้ทำจากการเชื่อมต่อ GitHub นี้

## Repository
https://github.com/chloerangersonic0909-cmd/-to-discord-bot
