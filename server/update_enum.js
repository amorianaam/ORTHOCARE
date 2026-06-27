const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({host:'localhost', user:'root', database:'orthocare_db'});
  await conn.execute("ALTER TABLE financial_transactions MODIFY category ENUM('entry_fee','lab','radiology','surgery_payment','general_income','general_expense','refund','external_lab','external_radiology','treasury_deposit','external_surgery','emergency_expense','emergency_purchase') NOT NULL");
  console.log('Enum updated');
  await conn.end();
}
run();
