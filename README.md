# Bottleapp Store

แอปร้านขายสินค้าพร้อมใช้งาน มีทั้ง

- หน้าร้านสำหรับลูกค้า
- หน้าเข้าสู่ระบบผู้ใช้
- หน้าเข้าสู่ระบบแอดมิน
- หน้าประวัติคำสั่งซื้อของลูกค้า
- หลังบ้านสำหรับเพิ่ม แก้ไข ลบสินค้า และอัปเดตสถานะออเดอร์

## วิธีเปิดแบบกดได้เลย

บน Windows ให้ดับเบิลคลิกไฟล์ `Bottleapp Store.cmd`

สิ่งที่จะเกิดขึ้น:

1. ระบบจะเปิดเซิร์ฟเวอร์ให้อัตโนมัติ
2. เบราว์เซอร์จะเปิดที่ `http://localhost:3000`
3. ถ้าปิดหน้าต่างเซิร์ฟเวอร์ แอปจะหยุดทำงาน

ถ้าต้องการเปิดจาก PowerShell ก็ใช้:

```powershell
.\Bottleapp Store.cmd
```

## วิธีรันแบบคำสั่ง

```powershell
node server.js
```

หรือ:

```powershell
node --run start
```

หรือ:

```powershell
.\start.ps1
```

## ใช้งานบน Vercel

โปรเจกต์นี้ถูกปรับให้ deploy บน Vercel ได้แล้ว โดยใช้ไฟล์ [api/[...route].js](</C:/bottleapp/api/[...route].js>) เป็น serverless API handler และไฟล์ static ใน `public/`

สิ่งที่ควรรู้:

- บน Vercel ข้อมูลตัวอย่างจะถูกเขียนไว้ในพื้นที่ชั่วคราวของ runtime เพื่อให้แอปเปิดได้
- บน Vercel ตัวอย่างนี้จะใช้ store แบบ memory ต่อ instance เพื่อให้ฟังก์ชันเสถียรกว่าเดิม
- ถ้า instance ถูกรีสตาร์ต ข้อมูลที่เพิ่มหรือออเดอร์ที่สร้างอาจหายได้
- ถ้าจะใช้จริง ควรเปลี่ยนจากไฟล์ JSON ไปใช้ฐานข้อมูลจริง
- แนะนำให้ตั้ง Environment Variable ชื่อ `TOKEN_SECRET` สำหรับ token ของระบบล็อกอิน

## บัญชีทดสอบ

- ผู้ใช้: `demo` / `demo123`
- ผู้ใช้สำรอง: `member` / `member123`
- แอดมิน: `admin` / `admin123`

## คำสั่งทดสอบ

```powershell
node scripts\smoke-test.js
```

## โครงสร้างหลัก

- `server.js` backend และ static file server
- `public/index.html` หน้าแอป
- `public/app.js` frontend logic
- `public/styles.css` UI
- `api/[...route].js` serverless endpoint สำหรับ Vercel
- `launch-app.ps1` ตัวเปิดแอปและเปิดเบราว์เซอร์อัตโนมัติ
- `run-server.ps1` ตัวรันเซิร์ฟเวอร์
- `data/store.json` ถูกสร้างอัตโนมัติเมื่อรันครั้งแรก
