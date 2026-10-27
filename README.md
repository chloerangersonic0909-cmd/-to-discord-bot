# discord-โปรโมท

แพลตฟอร์มสำหรับค้นหาและโปรโมท Discord Bot, บ้าน Discord และวิดีโอครีเอเตอร์ มีเว็บไซต์ responsive และแอป Android ที่สร้างจากโปรเจกต์เดียวกันด้วย React, Vite และ Capacitor

## ส่วนประกอบ
- `src/`: เว็บไซต์และ UI ของแอป Android
- `server/`: Express API สำหรับสมัครสมาชิก/เข้าสู่ระบบ, โปรไฟล์, โพสต์, ไลก์, ความคิดเห็น และติดตาม
- `.github/workflows/build.yml`: ตรวจ build เว็บไซต์
- `.github/workflows/build-apk.yml`: สร้าง Android debug APK ผ่าน GitHub Actions

## สถานะการเชื่อมต่อจริง

Frontend ถูกปรับให้ **ไม่แสดงโพสต์ตัวอย่าง** และไม่บันทึกการโต้ตอบแบบจำลองอีกต่อไป ระบบโซเชียลจะใช้ API และฐานข้อมูลจริงเมื่อกำหนด `VITE_API_URL` เป็น URL HTTPS ของ Backend ที่ deploy แล้ว

Backend ใช้ SQLite โดยค่าเริ่มต้น จึงต้อง deploy บนโฮสต์ที่มี persistent volume หรือเปลี่ยนเป็นฐานข้อมูล managed ที่เก็บข้อมูลถาวร ก่อนเปิดให้ใช้งานจริงระหว่างหลายบัญชี ห้ามใช้พื้นที่ไฟล์ชั่วคราวของ serverless สำหรับ SQLite

## Deploy Backend

1. Deploy โฟลเดอร์ `server/` เป็น Node.js service (Node 20+).
2. กำหนด Environment Variables:
   - `PORT`: ผู้ให้บริการมักกำหนดให้อัตโนมัติ
   - `JWT_SECRET`: สุ่ม secret อย่างน้อย 32 ตัวอักษร
   - `DATABASE_PATH`: ตำแหน่งไฟล์ SQLite บน persistent volume เช่น `/data/data.sqlite`
   - `CLIENT_ORIGIN`: `https://to-discord-bot.vercel.app,capacitor://localhost,https://localhost`
3. ตรวจสอบ `https://<backend-domain>/api/health` ต้องตอบ JSON ที่มี `"status":"ok"`.
4. ใน GitHub → Settings → Secrets and variables → Actions → Variables เพิ่ม `VITE_API_URL` เป็น URL HTTPS ของ Backend แล้ว redeploy เว็บไซต์ Vercel และสร้าง APK ใหม่

ห้าม commit `.env`, JWT secret หรือฐานข้อมูลขึ้น GitHub

## สร้าง Android APK

เปิด [GitHub Actions](https://github.com/chloerangersonic0909-cmd/-to-discord-bot/actions) → workflow **Build Android APK** → Run workflow หรือรอ workflow จากการ push สำเร็จ จากนั้นดาวน์โหลด artifact `TO-Discord-BOT-debug-APK` และแตก ZIP เพื่อรับ `app-debug.apk`. Debug APK เหมาะกับการทดสอบ ไม่ใช่ไฟล์เซ็นสำหรับ Play Store

## ลิงก์
- เว็บไซต์: https://to-discord-bot.vercel.app
- Repository: https://github.com/chloerangersonic0909-cmd/-to-discord-bot
- ผู้พัฒนา: chloerangersonic0909@gmail.com
