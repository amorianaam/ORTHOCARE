const db = require('../database/db');

// ─── HELPERS ──────────────────────────────────────────────────────
async function recordTransaction(conn, { type, category, amount, visitId = null, surgeryId = null, description, userId }) {
  await conn.execute(
    `INSERT INTO financial_transactions (type, category, amount, visit_id, surgery_id, description, performed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [type, category, amount, visitId, surgeryId, description, userId]
  );
}

// ═══════════════════════════════════════════════════════════════════
// GET /api/cashier/pending  — زيارات بانتظار دفع رسم الكشف
// ═══════════════════════════════════════════════════════════════════
exports.getPending = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT v.id AS visit_id, v.visit_number, v.entity, v.created_at,
             v.discount_amount, v.discount_reason,
             p.id AS patient_id, p.full_name, p.age, p.gender, p.phone
      FROM visits v
      JOIN patients p ON p.id = v.patient_id
      WHERE v.status = 'registered'
      ORDER BY v.created_at ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ═══════════════════════════════════════════════════════════════════
// POST /api/cashier/visit/:id/pay-entry  — تأكيد دفع رسم الدخول
// ═══════════════════════════════════════════════════════════════════
exports.payEntryFee = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { id: visitId } = req.params;
    const { amount, discountAmount = 0, discountReason = '' } = req.body;

    if (!amount || isNaN(amount) || amount <= 0)
      return res.status(400).json({ message: 'مبلغ الرسم غير صحيح' });

    // Update visit
    await conn.execute(
      `UPDATE visits SET status='waiting', entry_fee=?, discount_amount=?, discount_reason=? WHERE id=?`,
      [amount, discountAmount, discountReason, visitId]
    );

    // Record financial transaction
    await recordTransaction(conn, {
      type: 'income', category: 'entry_fee',
      amount: parseFloat(amount) - parseFloat(discountAmount),
      visitId, description: 'رسم كشف', userId: req.user.id
    });

    await conn.commit();

    // 🔔 Notify doctor: new patient in waiting queue
    const io = req.app.get('io');
    if (io) io.to('doctor').emit('patient:waiting', {
      visitId, message: 'مريض جديد في قائمة الانتظار'
    });

    if (io) io.to('cashier').emit('cashier:update');
    res.json({ message: 'تم تأكيد الدفع وإرسال المريض إلى الانتظار' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};

// ═══════════════════════════════════════════════════════════════════
// PUT /api/cashier/visit/:id/cancel  — إلغاء زيارة
// ═══════════════════════════════════════════════════════════════════
exports.cancelVisit = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { id: visitId } = req.params;
    const { refundAmount = 0, reason = '' } = req.body;

    await conn.execute(`UPDATE visits SET status='cancelled' WHERE id=?`, [visitId]);

    if (parseFloat(refundAmount) > 0) {
      await recordTransaction(conn, {
        type: 'expense', category: 'refund',
        amount: refundAmount, visitId,
        description: `استرداد: ${reason}`, userId: req.user.id
      });
    }

    await conn.commit();
    const io = req.app.get('io');
    if (io) io.to('cashier').emit('cashier:update');
    res.json({ message: 'تم إلغاء الزيارة بنجاح' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};

// ═══════════════════════════════════════════════════════════════════
// GET /api/cashier/waiting  — مرضى لديهم طلبات خدمات (awaiting_service_payment)
// ═══════════════════════════════════════════════════════════════════
exports.getWaiting = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT v.id AS visit_id, v.visit_number, v.entity, v.status,
             v.entry_fee, v.discount_amount, v.created_at,
             p.id AS patient_id, p.full_name, p.age, p.gender
      FROM visits v
      JOIN patients p ON p.id = v.patient_id
      WHERE v.status IN ('awaiting_service_payment','completed_admin_pending_services')
      ORDER BY v.created_at ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ═══════════════════════════════════════════════════════════════════
// GET /api/cashier/visit/:id/invoice  — فاتورة زيارة مع كل الخدمات
// ═══════════════════════════════════════════════════════════════════
exports.getInvoice = async (req, res) => {
  try {
    const { id: visitId } = req.params;

    const [[visit]] = await db.execute(`
      SELECT v.*, p.full_name, p.age, p.gender, p.phone
      FROM visits v JOIN patients p ON p.id = v.patient_id
      WHERE v.id = ?
    `, [visitId]);

    if (!visit) return res.status(404).json({ message: 'الزيارة غير موجودة' });

    const [labRequests] = await db.execute(`
      SELECT vlr.id, vlr.status, vlr.price, lt.name, lt.category_id,
             lc.name AS category_name
      FROM visit_lab_requests vlr
      JOIN lab_tests lt ON lt.id = vlr.lab_test_id
      LEFT JOIN lab_categories lc ON lc.id = lt.category_id
      WHERE vlr.visit_id = ? AND vlr.status != 'cancelled'
    `, [visitId]);

    const [radiologyRequests] = await db.execute(`
      SELECT vrr.id, vrr.status, vrr.price, vrr.with_film,
             rt.name, rt.price_with_film, rt.price_without_film
      FROM visit_radiology_requests vrr
      JOIN radiology_tests rt ON rt.id = vrr.radiology_test_id
      WHERE vrr.visit_id = ? AND vrr.status != 'cancelled'
    `, [visitId]);

    res.json({ visit, labRequests, radiologyRequests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ═══════════════════════════════════════════════════════════════════
// POST /api/cashier/visit/:id/pay-services  — دفع خدمات محددة
// Body: { labIds: [1,2], radiologyIds: [{id:3, withFilm:true}], discount:{amount,reason} }
// ═══════════════════════════════════════════════════════════════════
exports.payServices = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { id: visitId } = req.params;
    const { labIds = [], radiologyItems = [], discount = {} } = req.body;
    const userId = req.user.id;
    let totalPaid = 0;

    // ── Pay lab tests ──
    for (const labId of labIds) {
      const [[req_]] = await conn.execute(
        'SELECT vlr.*, lt.name FROM visit_lab_requests vlr JOIN lab_tests lt ON vlr.lab_test_id = lt.id WHERE vlr.id=? AND vlr.visit_id=?', [labId, visitId]
      );
      if (!req_ || req_.status !== 'pending_payment') continue;

      await conn.execute(
        `UPDATE visit_lab_requests SET status='paid' WHERE id=?`, [labId]
      );
      await recordTransaction(conn, {
        type: 'income', category: 'lab',
        amount: req_.price, visitId,
        description: req_.name, userId
      });
      totalPaid += parseFloat(req_.price);
    }

    // ── Pay radiology tests ──
    for (const item of radiologyItems) {
      const [[req_]] = await conn.execute(
        'SELECT vrr.*, rt.name, rt.price_with_film, rt.price_without_film FROM visit_radiology_requests vrr JOIN radiology_tests rt ON vrr.radiology_test_id = rt.id WHERE vrr.id=? AND vrr.visit_id=?', [item.id, visitId]
      );
      if (!req_ || req_.status !== 'pending_payment') continue;

      const price = item.withFilm ? req_.price_with_film || req_.price : req_.price_without_film || req_.price;
      await conn.execute(
        `UPDATE visit_radiology_requests SET status='paid', with_film=?, price=? WHERE id=?`,
        [item.withFilm ? 1 : 0, price, item.id]
      );
      await recordTransaction(conn, {
        type: 'income', category: 'radiology',
        amount: price, visitId,
        description: `${req_.name} ${item.withFilm ? 'مع فيلم' : 'بدون فيلم'}`, userId
      });
      totalPaid += parseFloat(price);
    }

    // ── Apply discount ──
    if (discount.amount && parseFloat(discount.amount) > 0) {
      await conn.execute(
        `UPDATE visits SET discount_amount=discount_amount+?, discount_reason=? WHERE id=?`,
        [discount.amount, discount.reason || '', visitId]
      );
    }

    // ── Determine new visit status ──
    const [allLab] = await conn.execute(
      `SELECT status FROM visit_lab_requests WHERE visit_id=? AND status != 'cancelled'`, [visitId]
    );
    const [allRad] = await conn.execute(
      `SELECT status FROM visit_radiology_requests WHERE visit_id=? AND status != 'cancelled'`, [visitId]
    );

    const allServices = [...allLab, ...allRad];
    const unpaidCount = allServices.filter(s => s.status === 'pending_payment').length;
    const paidLabCount = allLab.filter(s => s.status === 'paid').length;
    const paidRadCount = allRad.filter(s => s.status === 'paid').length;

    let newStatus = 'completed_admin_pending_services';
    if (unpaidCount === 0) {
      // All paid — determine destination
      if (paidLabCount > 0 && paidRadCount > 0) newStatus = 'awaiting_lab';
      else if (paidLabCount > 0) newStatus = 'awaiting_lab';
      else if (paidRadCount > 0) newStatus = 'awaiting_radiology';
    } else if (unpaidCount < allServices.length) {
      // Partial payment — send paid ones, keep visit status as pending for rest
      newStatus = 'completed_admin_pending_services';
      if (paidLabCount > 0) {
        await conn.execute(
          `UPDATE visits SET status='awaiting_lab' WHERE id=? AND status='awaiting_service_payment'`, [visitId]
        );
      }
    }

    await conn.execute(`UPDATE visits SET status=? WHERE id=?`, [newStatus, visitId]);
    await conn.commit();

    // 🔔 Notify lab / radiology
    const io = req.app.get('io');
    if (io) {
      if (labIds.length > 0)        io.to('lab').emit('request:new', { visitId, message: 'طلب تحاليل جديد مدفوع' });
      if (radiologyItems.length > 0) io.to('radiology').emit('request:new', { visitId, message: 'طلب أشعة جديد مدفوع' });
    }

    if (io) io.to('cashier').emit('cashier:update');
    res.json({ message: 'تم سداد المدفوعات بنجاح', totalPaid });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};

// ═══════════════════════════════════════════════════════════════════
// GET /api/cashier/surgeries  — عمليات المركز الجراحي
// ═══════════════════════════════════════════════════════════════════
exports.getSurgeries = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT s.id AS surgery_id, s.surgery_type, s.full_price, s.status,
             s.scheduled_date, s.notes, s.discount_amount,
             p.id AS patient_id, p.full_name, p.age, p.gender, p.phone,
             v.id AS visit_id, v.visit_number, v.entity,
             COALESCE((SELECT SUM(sp.amount) FROM surgery_payments sp WHERE sp.surgery_id = s.id), 0) AS paid_amount,
             (s.full_price - s.discount_amount - COALESCE((SELECT SUM(sp.amount) FROM surgery_payments sp WHERE sp.surgery_id = s.id), 0)) AS remaining_amount
      FROM surgeries s
      JOIN visits v ON v.id = s.visit_id
      JOIN patients p ON p.id = s.patient_id
      WHERE s.status IN ('planned', 'scheduled')
      ORDER BY s.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ═══════════════════════════════════════════════════════════════════
// GET /api/cashier/surgery/:id/payments  — سجل دفعات عملية
// ═══════════════════════════════════════════════════════════════════
exports.getSurgeryPayments = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      `SELECT sp.*, u.full_name AS received_by_name
       FROM surgery_payments sp
       LEFT JOIN users u ON u.id = sp.received_by
       WHERE sp.surgery_id = ? ORDER BY sp.payment_date DESC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ═══════════════════════════════════════════════════════════════════
// POST /api/cashier/surgery/:id/pay  — إضافة دفعة عملية
// ═══════════════════════════════════════════════════════════════════
exports.paySurgery = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { id: surgeryId } = req.params;
    const { amount } = req.body;

    if (!amount || isNaN(amount) || amount <= 0)
      return res.status(400).json({ message: 'المبلغ غير صحيح' });

    const [[surgery]] = await conn.execute(
      `SELECT s.*, 
       COALESCE((SELECT SUM(sp.amount) FROM surgery_payments sp WHERE sp.surgery_id = s.id), 0) AS paid_amount
       FROM surgeries s
       WHERE s.id = ?`, [surgeryId]
    );
    if (!surgery) return res.status(404).json({ message: 'العملية غير موجودة' });

    let equivalentAmount = parseFloat(amount);

    const remaining = parseFloat(surgery.full_price) - parseFloat(surgery.discount_amount) - parseFloat(surgery.paid_amount);
    
    // Allow slight float tolerance
    if (equivalentAmount > remaining + 1)
      return res.status(400).json({ message: `المبلغ يعادل (${equivalentAmount.toFixed(2)}) وهو يتجاوز المتبقي (${remaining.toFixed(2)} YER)` });

    // Record payment
    await conn.execute(
      `INSERT INTO surgery_payments (surgery_id, amount, received_by) VALUES (?,?,?)`,
      [surgeryId, amount, req.user.id]
    );

    await recordTransaction(conn, {
      type: 'income', category: 'surgery_payment',
      amount: amount, surgeryId: surgeryId,
      description: `دفعة عملية جراحية (${amount} YER)`, userId: req.user.id
    });

    // Check if fully paid → update surgery status to 'ready'
    const newPaid = parseFloat(surgery.paid_amount) + equivalentAmount;
    const netPrice = parseFloat(surgery.full_price) - parseFloat(surgery.discount_amount);
    
    if (newPaid >= netPrice - 1) { // 1 unit tolerance
      await conn.execute(
        `UPDATE surgeries SET status='ready' WHERE id=?`, [surgeryId]
      );
      await conn.execute(
        `UPDATE visits SET status='awaiting_surgery' WHERE id=?`, [surgery.visit_id]
      );
    }

    await conn.commit();
    
    // Notify Surgery Coordinator
    const io = req.app.get('io');
    if (io) io.to('surgery_coordinator').emit('surgery:payment_received', { message: `تم استلام دفعة لعملية: ${surgery.surgery_type}` });

    if (io) io.to('cashier').emit('cashier:update');
    res.json({ message: 'تم سداد الدفعة بنجاح', newPaid, remaining: Math.max(0, netPrice - newPaid) });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};

// ═══════════════════════════════════════════════════════════════════
// GET /api/cashier/stats/summary  — الأرقام السريعة
// ═══════════════════════════════════════════════════════════════════
exports.getStatsSummary = async (req, res) => {
  try {
    const [[income]] = await db.execute(
      `SELECT COALESCE(SUM(amount),0) AS total FROM financial_transactions WHERE type='income' AND is_refund=0`
    );
    const [[expense]] = await db.execute(
      `SELECT COALESCE(SUM(amount),0) AS total FROM financial_transactions WHERE type='expense' AND is_refund=0`
    );
    const [[refunds]] = await db.execute(
      `SELECT COALESCE(SUM(amount),0) AS total FROM financial_transactions WHERE is_refund=1`
    );
    
    // Today's metrics
    const [[todayIncome]] = await db.execute(
      `SELECT COALESCE(SUM(amount),0) AS total FROM financial_transactions WHERE type='income' AND is_refund=0 AND DATE(created_at)=CURDATE()`
    );
    const [[todayExpense]] = await db.execute(
      `SELECT COALESCE(SUM(amount),0) AS total FROM financial_transactions WHERE type='expense' AND is_refund=0 AND DATE(created_at)=CURDATE()`
    );
    const [[todayRefunds]] = await db.execute(
      `SELECT COALESCE(SUM(amount),0) AS total FROM financial_transactions WHERE is_refund=1 AND DATE(created_at)=CURDATE()`
    );
    const [[todayVisits]] = await db.execute(
      `SELECT COUNT(*) AS total FROM visits WHERE DATE(created_at)=CURDATE() AND status != 'cancelled'`
    );

    // Notification counts
    const [[pendingEntryFees]] = await db.execute(`SELECT COUNT(*) AS total FROM visits WHERE status='registered'`);
    const [[waitingServices]] = await db.execute(`SELECT COUNT(*) AS total FROM visits WHERE status IN ('awaiting_service_payment', 'completed_admin_pending_services')`);
    const [[pendingSurgeries]] = await db.execute(`SELECT COUNT(*) AS total FROM surgeries WHERE status IN ('planned', 'scheduled')`);
    const [[activePatients]] = await db.execute(`SELECT COUNT(*) AS total FROM visits WHERE DATE(created_at)=CURDATE() OR status NOT IN ('completed', 'cancelled')`);

    res.json({
      totalBox: income.total,
      availableCash: parseFloat(income.total) - parseFloat(expense.total) - parseFloat(refunds.total),
      todayIncome: parseFloat(todayIncome.total),
      todayExpenses: parseFloat(todayExpense.total),
      todayRefunds: parseFloat(todayRefunds.total),
      todayAvailable: parseFloat(todayIncome.total) - parseFloat(todayExpense.total) - parseFloat(todayRefunds.total),
      todayVisits: todayVisits.total,
      pendingEntryFeesCount: pendingEntryFees.total,
      waitingServicesCount: waitingServices.total,
      pendingSurgeriesCount: pendingSurgeries.total,
      activePatientsCount: activePatients.total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ═══════════════════════════════════════════════════════════════════
// GET /api/cashier/stats/transactions?period=today|week|month|year|custom&from=&to=
// ═══════════════════════════════════════════════════════════════════
exports.getTransactions = async (req, res) => {
  try {
    const { period = 'today', from, to } = req.query;
    let since, until = 'NOW()';

    if (period === 'custom' && from) {
      since = `'${from}'`;
      if (to) until = `'${to} 23:59:59'`;
    } else {
      const intervals = {
        today: 'CURDATE()',
        week:  'DATE_SUB(CURDATE(), INTERVAL 7 DAY)',
        month: 'DATE_SUB(CURDATE(), INTERVAL 30 DAY)',
        year:  'DATE_SUB(CURDATE(), INTERVAL 365 DAY)',
        all:   "'1970-01-01'"
      };
      since = intervals[period] || intervals.today;
    }

    const [rows] = await db.execute(`
      SELECT ft.*, u.full_name AS cashier_name, 
             COALESCE(p1.full_name, p2.full_name, p3.full_name) AS patient_name, 
             COALESCE(p1.id, p2.id, p3.id) AS patient_id
      FROM financial_transactions ft
      LEFT JOIN users u ON u.id = ft.performed_by
      LEFT JOIN visits v ON v.id = ft.visit_id
      LEFT JOIN patients p1 ON p1.id = v.patient_id
      LEFT JOIN surgeries s ON s.id = ft.surgery_id
      LEFT JOIN patients p2 ON p2.id = s.patient_id
      LEFT JOIN patients p3 ON p3.id = ft.patient_id
      WHERE ft.created_at >= ${since} AND ft.created_at <= ${until} AND ft.amount > 0
      ORDER BY ft.created_at DESC LIMIT 500
    `);

    const [chartData] = await db.execute(`
      SELECT DATE(created_at) AS day,
        SUM(CASE WHEN type='income' AND is_refund=0 THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN type='expense' OR is_refund=1 THEN amount ELSE 0 END) AS expense
      FROM financial_transactions
      WHERE created_at >= ${since} AND created_at <= ${until}
      GROUP BY DATE(created_at) ORDER BY day ASC
    `);

    const [breakdown] = await db.execute(`
      SELECT category, SUM(amount) AS total, COUNT(*) AS count
      FROM financial_transactions
      WHERE type='income' AND is_refund=0 AND created_at >= ${since} AND created_at <= ${until}
      GROUP BY category
    `);

    res.json({ transactions: rows, chartData, breakdown });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ═══════════════════════════════════════════════════════════════════
// PUT /api/cashier/visit/:id/postpone  — تأجيل الخدمات (رفض المريض الدفع)
// ═══════════════════════════════════════════════════════════════════
exports.postponeServices = async (req, res) => {
  try {
    const { id: visitId } = req.params;
    await db.execute(
      `UPDATE visits SET status='completed_admin_pending_services' WHERE id=?`, [visitId]
    );
    const io = req.app.get('io');
    if (io) io.to('cashier').emit('cashier:update');
    res.json({ message: 'تم تأجيل الخدمات — الزيارة محفوظة' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ═══════════════════════════════════════════════════════════════════
// PUT /api/cashier/visit/:id/refund-all  — استرداد كامل المدفوعات + إلغاء
// ═══════════════════════════════════════════════════════════════════
exports.deleteSuspendedService = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { type, id } = req.params;
    if (type === 'lab') {
      const [[reqRow]] = await conn.execute(`SELECT status FROM visit_lab_requests WHERE id=?`, [id]);
      if (!reqRow) throw new Error('Service not found');
      if (reqRow.status !== 'suspended') throw new Error('Service is not suspended');
      await conn.execute(`DELETE FROM visit_lab_requests WHERE id=?`, [id]);
    } else if (type === 'radiology') {
      const [[reqRow]] = await conn.execute(`SELECT status FROM visit_radiology_requests WHERE id=?`, [id]);
      if (!reqRow) throw new Error('Service not found');
      if (reqRow.status !== 'suspended') throw new Error('Service is not suspended');
      await conn.execute(`DELETE FROM visit_radiology_requests WHERE id=?`, [id]);
    } else {
      throw new Error('Invalid type');
    }

    const io = req.app.get('io');
    if (io) {
      io.to('cashier').emit('cashier_update');
    }
    res.json({ message: 'تم حذف الخدمة المعلقة نهائياً بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};

exports.refundVisit = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { id: visitId } = req.params;
    const { reason = 'إلغاء وإسترداد كامل' } = req.body;

    // Sum all income transactions for this visit
    const [[paidRow]] = await conn.execute(
      `SELECT COALESCE(SUM(amount),0) AS total FROM financial_transactions
       WHERE visit_id=? AND type='income' AND is_refund=0`, [visitId]
    );
    const refundAmt = parseFloat(paidRow.total);

    await conn.execute(`UPDATE visits SET status='cancelled' WHERE id=?`, [visitId]);

    if (refundAmt > 0) {
      await conn.execute(
        `INSERT INTO financial_transactions (type,category,amount,is_refund,refund_reason,visit_id,description,performed_by)
         VALUES ('expense','refund',?,1,?,?,?,?)`,
        [refundAmt, reason, visitId, `استرداد كامل: ${reason}`, req.user.id]
      );
    }

    await conn.commit();
    const io = req.app.get('io');
    if (io) io.to('cashier').emit('cashier:update');
    res.json({ message: `تم إلغاء الزيارة واسترداد ${refundAmt} د.ل` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};

// ═══════════════════════════════════════════════════════════════════
// PUT /api/cashier/service-lab/:id/refund  — استرداد خدمة تحليل واحدة
// ═══════════════════════════════════════════════════════════════════
exports.refundLabService = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { reason = 'استرداد جزئي' } = req.body;

    const [[row]] = await conn.execute(
      `SELECT vlr.*, v.id AS visit_id FROM visit_lab_requests vlr
       JOIN visits v ON v.id = vlr.visit_id WHERE vlr.id=?`, [id]
    );
    if (!row || row.status !== 'paid')
      return res.status(400).json({ message: 'لا يمكن استرداد هذا البند' });

    await conn.execute(`UPDATE visit_lab_requests SET status='refunded' WHERE id=?`, [id]);
    await conn.execute(
      `INSERT INTO financial_transactions (type,category,amount,is_refund,refund_reason,visit_id,description,performed_by)
       VALUES ('expense','refund',?,1,?,?,?,?)`,
      [row.price, reason, row.visit_id, `استرداد تحليل: ${reason}`, req.user.id]
    );

    await conn.commit();
    const io = req.app.get('io');
    if (io) io.to('cashier').emit('cashier:update');
    res.json({ message: `تم استرداد ${row.price} د.ل` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};

// ═══════════════════════════════════════════════════════════════════
// PUT /api/cashier/service-radiology/:id/refund — استرداد خدمة أشعة واحدة
// ═══════════════════════════════════════════════════════════════════
exports.refundRadiologyService = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { reason = 'استرداد جزئي' } = req.body;

    const [[row]] = await conn.execute(
      `SELECT vrr.*, v.id AS visit_id FROM visit_radiology_requests vrr
       JOIN visits v ON v.id = vrr.visit_id WHERE vrr.id=?`, [id]
    );
    if (!row || row.status !== 'paid')
      return res.status(400).json({ message: 'لا يمكن استرداد هذا البند' });

    await conn.execute(`UPDATE visit_radiology_requests SET status='refunded' WHERE id=?`, [id]);
    await conn.execute(
      `INSERT INTO financial_transactions (type,category,amount,is_refund,refund_reason,visit_id,description,performed_by)
       VALUES ('expense','refund',?,1,?,?,?,?)`,
      [row.price, reason, row.visit_id, `استرداد أشعة: ${reason}`, req.user.id]
    );

    await conn.commit();
    const io = req.app.get('io');
    if (io) io.to('cashier').emit('cashier:update');
    res.json({ message: `تم استرداد ${row.price} د.ل` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};

// ═══════════════════════════════════════════════════════════════════
// GENERAL TRANSACTIONS  GET/POST /api/cashier/general-transactions
// ═══════════════════════════════════════════════════════════════════
const GENERAL_INCOME_CATS  = ['external_lab','external_radiology','treasury_deposit','external_surgery','general_income'];
const GENERAL_EXPENSE_CATS = ['emergency_expense','emergency_purchase','general_expense'];

exports.getGeneralTransactions = async (req, res) => {
  try {
    const { period = 'today', from, to } = req.query;
    let since, until = 'NOW()';
    if (period === 'custom' && from) {
      since = `'${from}'`;
      if (to) until = `'${to} 23:59:59'`;
    } else {
      const m = { today:'CURDATE()', week:'DATE_SUB(CURDATE(),INTERVAL 7 DAY)', month:'DATE_SUB(CURDATE(),INTERVAL 30 DAY)', year:'DATE_SUB(CURDATE(),INTERVAL 365 DAY)', all: "'1970-01-01'" };
      since = m[period] || m.today;
    }
    const allCats = [...GENERAL_INCOME_CATS, ...GENERAL_EXPENSE_CATS, 'refund'].map(c => `'${c}'`).join(',');
    const [rows] = await db.execute(`
      SELECT ft.*, u.full_name AS cashier_name
      FROM financial_transactions ft
      LEFT JOIN users u ON u.id = ft.performed_by
      WHERE ft.category IN (${allCats}) AND ft.visit_id IS NULL
        AND ft.created_at >= ${since} AND ft.created_at <= ${until}
      ORDER BY ft.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

exports.addGeneralTransaction = async (req, res) => {
  try {
    const { type, category, amount, description, visit_id, patient_id } = req.body;
    if (!type || !category || !amount)
      return res.status(400).json({ message: 'النوع والفئة والمبلغ مطلوبة' });
    const validCats = [...GENERAL_INCOME_CATS, ...GENERAL_EXPENSE_CATS, 'refund'];
    if (!validCats.includes(category))
      return res.status(400).json({ message: 'فئة غير صحيحة' });
      
    const isRefund = category === 'refund' ? 1 : 0;
    const refundReason = category === 'refund' ? description : null;

    await db.execute(
      `INSERT INTO financial_transactions (type,category,amount,description,is_refund,refund_reason,visit_id,patient_id,performed_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [type, category, amount, description || '', isRefund, refundReason, visit_id || null, patient_id || null, req.user.id]
    );
    const io = req.app.get('io');
    if (io) io.to('cashier').emit('cashier:update');
    res.status(201).json({ message: 'تم تسجيل الإجراء' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ═══════════════════════════════════════════════════════════════════
// GET /api/cashier/archive/patients — جلب أو البحث عن المرضى للأرشيف المالي
// ═══════════════════════════════════════════════════════════════════
exports.getArchivePatients = async (req, res) => {
  try {
    const { q = '' } = req.query;
    let query = `
      SELECT p.id, p.full_name, p.phone, p.gender, p.age,
             MAX(v.created_at) AS last_visit_date,
             COUNT(v.id) AS total_visits,
             COALESCE((SELECT SUM(amount) FROM financial_transactions ft WHERE ft.visit_id IN (SELECT id FROM visits WHERE patient_id = p.id) AND ft.type = 'income' AND ft.is_refund = 0), 0) AS total_amount,
             CASE WHEN EXISTS (
               SELECT 1 FROM visits v2 
               LEFT JOIN visit_lab_requests lr ON lr.visit_id = v2.id AND lr.status = 'suspended'
               LEFT JOIN visit_radiology_requests rr ON rr.visit_id = v2.id AND rr.status = 'suspended'
               WHERE v2.patient_id = p.id AND (lr.id IS NOT NULL OR rr.id IS NOT NULL)
             ) THEN 1 ELSE 0 END AS has_suspended_services,
             CASE WHEN EXISTS (
               SELECT 1 FROM surgeries s WHERE s.patient_id = p.id
             ) THEN 1 ELSE 0 END AS has_surgeries
      FROM patients p
      LEFT JOIN visits v ON v.patient_id = p.id
    `;
    const params = [];
    if (q) {
      query += ` WHERE p.full_name LIKE ? OR p.phone LIKE ? OR p.id LIKE ?`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    query += ` GROUP BY p.id ORDER BY last_visit_date DESC LIMIT 50`;

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في جلب الأرشيف' });
  }
};

// ═══════════════════════════════════════════════════════════════════
// GET /api/cashier/archive/patient/:id — جلب الملف المالي الكامل لمريض
// ═══════════════════════════════════════════════════════════════════
exports.getPatientFinancialRecord = async (req, res) => {
  try {
    const { id } = req.params;

    const [[patient]] = await db.execute(`SELECT * FROM patients WHERE id=?`, [id]);
    if (!patient) return res.status(404).json({ message: 'المريض غير موجود' });

    // We will get all financial transactions linked to this patient (via visits or surgeries)
    // To be precise, we fetch from `financial_transactions` where visit_id IN (patient visits) or surgery_id IN (patient surgeries)
    const [transactions] = await db.execute(`
      SELECT ft.id, ft.type, ft.category, ft.amount, ft.is_refund, ft.refund_reason, 
             ft.description, ft.created_at, u.full_name AS cashier_name
      FROM financial_transactions ft
      LEFT JOIN visits v ON v.id = ft.visit_id
      LEFT JOIN surgeries s ON s.id = ft.surgery_id
      LEFT JOIN users u ON u.id = ft.performed_by
      WHERE (v.patient_id = ? OR s.patient_id = ? OR ft.patient_id = ?)
      ORDER BY ft.created_at DESC
    `, [id, id, id]);

    // Also get all visits details for summary
    const [visits] = await db.execute(`
      SELECT id, visit_number, status, entry_fee, created_at 
      FROM visits WHERE patient_id = ? ORDER BY created_at DESC
    `, [id]);

    const [suspendedLab] = await db.execute(`
      SELECT lr.id, lr.visit_id, lr.lab_test_id, lr.price, v.created_at AS created_at, v.visit_number, t.name, 'lab' AS type
      FROM visit_lab_requests lr
      JOIN visits v ON v.id = lr.visit_id
      JOIN lab_tests t ON t.id = lr.lab_test_id
      WHERE v.patient_id = ? AND lr.status = 'cancelled'
    `, [id]);

    const [suspendedRad] = await db.execute(`
      SELECT rr.id, rr.visit_id, rr.radiology_test_id, rr.price, v.created_at AS created_at, rr.with_film, v.visit_number, rt.name, 'radiology' AS type
      FROM visit_radiology_requests rr
      JOIN visits v ON v.id = rr.visit_id
      JOIN radiology_tests rt ON rt.id = rr.radiology_test_id
      WHERE v.patient_id = ? AND rr.status = 'cancelled'
    `, [id]);
    
    const suspendedServices = [...suspendedLab, ...suspendedRad].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ patient, transactions, visits, suspendedServices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في جلب الملف المالي' });
  }
};

// ═══════════════════════════════════════════════════════════════════
// GET /api/cashier/board/today — جلب لوحة العمليات المالية لليوم
// ═══════════════════════════════════════════════════════════════════
exports.getDailyBoard = async (req, res) => {
  try {
    // 1. Lab Services today
    const [lab] = await db.execute(`
      SELECT vlr.id, vlr.status, vlr.price, vlr.requested_at AS created_at,
             lt.name AS service_name, p.full_name AS patient_name, p.id AS patient_id, 'lab' AS department
      FROM visit_lab_requests vlr
      JOIN lab_tests lt ON lt.id = vlr.lab_test_id
      JOIN visits v ON v.id = vlr.visit_id
      JOIN patients p ON p.id = v.patient_id
      WHERE DATE(vlr.requested_at) = CURDATE() AND vlr.status != 'cancelled'
      ORDER BY vlr.requested_at DESC
    `);

    // 2. Radiology Services today
    const [rad] = await db.execute(`
      SELECT vrr.id, vrr.status, vrr.price, vrr.requested_at AS created_at,
             rt.name AS service_name, p.full_name AS patient_name, p.id AS patient_id, 'radiology' AS department
      FROM visit_radiology_requests vrr
      JOIN radiology_tests rt ON rt.id = vrr.radiology_test_id
      JOIN visits v ON v.id = vrr.visit_id
      JOIN patients p ON p.id = v.patient_id
      WHERE DATE(vrr.requested_at) = CURDATE() AND vrr.status != 'cancelled'
      ORDER BY vrr.requested_at DESC
    `);

    // 3. Surgeries today
    const [surg] = await db.execute(`
      SELECT s.id, s.status, s.full_price AS price, s.created_at,
             s.surgery_type AS service_name, p.full_name AS patient_name, p.id AS patient_id, 'surgery' AS department
      FROM surgeries s
      JOIN patients p ON p.id = s.patient_id
      WHERE DATE(s.created_at) = CURDATE() OR DATE(s.scheduled_date) = CURDATE()
      ORDER BY s.created_at DESC
    `);

    const services = [...lab, ...rad, ...surg].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في جلب بيانات اللوحة' });
  }
};




// ═══════════════════════════════════════════════════════════════════
// PUT /api/cashier/visit/:id/suspend-services  — إلغاء/تعليق الخدمات غير المدفوعة ونقل للأرشيف
// ═══════════════════════════════════════════════════════════════════
exports.suspendServices = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { id: visitId } = req.params;
    
    // Cancel unpaid lab requests
    await conn.execute(`UPDATE visit_lab_requests SET status='cancelled' WHERE visit_id=? AND status='pending_payment'`, [visitId]);
    
    // Cancel unpaid radiology requests
    await conn.execute(`UPDATE visit_radiology_requests SET status='cancelled' WHERE visit_id=? AND status='pending_payment'`, [visitId]);
    
    // Update visit status to completed so it goes to archive
    await conn.execute(`UPDATE visits SET status='completed' WHERE id=? AND status IN ('awaiting_service_payment', 'completed_admin_pending_services')`, [visitId]);
    
    await conn.commit();
    
    const io = req.app.get('io');
    if (io) io.to('cashier').emit('cashier_update');
    
    res.json({ message: 'تم تعليق/إلغاء الطلبات وانتقل الملف للأرشيف' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};


// ═══════════════════════════════════════════════════════════════════
// PUT /api/cashier/service/:type/:id/reactivate-and-pay
// ═══════════════════════════════════════════════════════════════════
exports.reactivateAndPayService = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { type, id } = req.params;
    let price = 0;
    let visitId = null;
    let desc = '';

    if (type === 'lab') {
      const [[reqRow]] = await conn.execute(`SELECT lr.price, lr.visit_id, t.name FROM visit_lab_requests lr JOIN lab_tests t ON t.id=lr.lab_test_id WHERE lr.id=?`, [id]);
      if (!reqRow) throw new Error('Service not found');
      price = reqRow.price;
      visitId = reqRow.visit_id;
      desc = `سداد وتفعيل تحليل (سابق): ${reqRow.name}`;
      await conn.execute(`UPDATE visit_lab_requests SET status='paid' WHERE id=?`, [id]);
    } else if (type === 'radiology') {
      const [[reqRow]] = await conn.execute(`SELECT rr.price, rr.with_film, rr.visit_id, t.name FROM visit_radiology_requests rr JOIN radiology_tests t ON t.id=rr.radiology_test_id WHERE rr.id=?`, [id]);
      if (!reqRow) throw new Error('Service not found');
      price = reqRow.price;
      visitId = reqRow.visit_id;
      desc = `سداد وتفعيل أشعة (سابق): ${reqRow.name}`;
      await conn.execute(`UPDATE visit_radiology_requests SET status='paid' WHERE id=?`, [id]);
    } else {
      throw new Error('Invalid type');
    }

    await recordTransaction(conn, {
      type: 'income', category: 'services',
      amount: price, visitId: visitId,
      description: desc, userId: req.user.id
    });

    await conn.commit();
    const io = req.app.get('io');
    if (io) {
      io.to('cashier').emit('cashier_update');
      if (type === 'lab') io.to('lab').emit('lab_update');
      if (type === 'radiology') io.to('radiology').emit('radiology_update');
    }
    res.json({ message: 'تم السداد وإعادة تفعيل الخدمة بنجاح' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: err.message || 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};
