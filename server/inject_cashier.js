const fs = require('fs');
const path = require('path');

const targetFile = 'c:\\Users\\Elite\\Desktop\\ORTHOCARE - SYSTEM\\server\\controllers\\cashierController.js';
let content = fs.readFileSync(targetFile, 'utf8');

// The line we want to insert
const emitLine = `\n    const io = req.app.get('io');\n    if (io) io.to('cashier').emit('cashier:update');`;

// Let's find specific success messages and inject before them
const patches = [
  { search: "res.json({ message: 'تم سداد الكشفية بنجاح' });", replace: emitLine + "\n    res.json({ message: 'تم سداد الكشفية بنجاح' });" },
  { search: "res.json({ message: 'تم إلغاء الزيارة بنجاح' });", replace: emitLine + "\n    res.json({ message: 'تم إلغاء الزيارة بنجاح' });" },
  { search: "res.json({ message: 'تم سداد الخدمات بنجاح' });", replace: emitLine + "\n    res.json({ message: 'تم سداد الخدمات بنجاح' });" },
  { search: "res.json({ message: 'تم سداد العملية بنجاح' });", replace: emitLine + "\n    res.json({ message: 'تم سداد العملية بنجاح' });" },
  { search: "res.json({ message: 'تم تأجيل الدفع بنجاح' });", replace: emitLine + "\n    res.json({ message: 'تم تأجيل الدفع بنجاح' });" },
  { search: "res.json({ message: 'تم استرجاع الكشفية بنجاح' });", replace: emitLine + "\n    res.json({ message: 'تم استرجاع الكشفية بنجاح' });" },
  { search: "res.json({ message: 'تم استرجاع التحليل بنجاح' });", replace: emitLine + "\n    res.json({ message: 'تم استرجاع التحليل بنجاح' });" },
  { search: "res.json({ message: 'تم استرجاع الأشعة بنجاح' });", replace: emitLine + "\n    res.json({ message: 'تم استرجاع الأشعة بنجاح' });" },
  { search: "res.status(201).json({ message: 'تم تسجيل الحركة بنجاح', transactionId: result.insertId });", replace: emitLine + "\n    res.status(201).json({ message: 'تم تسجيل الحركة بنجاح', transactionId: result.insertId });" }
];

let modified = content;
patches.forEach(p => {
  if(modified.includes(p.search)) {
    modified = modified.replace(p.search, p.replace);
    console.log("Patched: " + p.search.substring(0, 30) + "...");
  } else {
    console.log("Not found: " + p.search);
  }
});

fs.writeFileSync(targetFile, modified, 'utf8');
console.log("Done updating cashierController.js");
