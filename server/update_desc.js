const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({host:'localhost', user:'root', database:'orthocare_db'});
  
  const [labs] = await conn.execute("SELECT ft.id, ft.amount, ft.visit_id, vlr.price, lt.name FROM financial_transactions ft JOIN visit_lab_requests vlr ON ft.visit_id = vlr.visit_id AND ft.amount = vlr.price JOIN lab_tests lt ON vlr.lab_test_id = lt.id WHERE ft.category='lab' AND ft.description='تحليل مخبري'");
  for (const lab of labs) {
    await conn.execute('UPDATE financial_transactions SET description=? WHERE id=?', [lab.name, lab.id]);
  }

  const [rads] = await conn.execute("SELECT ft.id, ft.amount, ft.visit_id, vrr.price, vrr.with_film, rt.name FROM financial_transactions ft JOIN visit_radiology_requests vrr ON ft.visit_id = vrr.visit_id AND ft.amount = vrr.price JOIN radiology_tests rt ON vrr.radiology_test_id = rt.id WHERE ft.category='radiology' AND ft.description LIKE 'تصوير شعاعي%'");
  for (const rad of rads) {
    const suffix = rad.with_film ? 'مع فيلم' : 'بدون فيلم';
    await conn.execute('UPDATE financial_transactions SET description=? WHERE id=?', [`${rad.name} ${suffix}`, rad.id]);
  }

  console.log('Updated', labs.length, 'labs and', rads.length, 'radiology records.');
  await conn.end();
}

run();
