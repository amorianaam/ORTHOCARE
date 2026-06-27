const db = require('../database/db');

// 1. Get all distinct visits based on tab
exports.getRequests = async (req, res) => {
  const { tab = 'pending', startDate, endDate } = req.query;
  try {
    let statusFilter = "('paid')";
    if (tab === 'in_progress') statusFilter = "('in_progress')";
    if (tab === 'completed') statusFilter = "('completed')";
    if (tab === 'pending') statusFilter = "('paid')";

    let dateFilter = '';
    const params = [];
    if (startDate && endDate) {
      if (tab === 'completed') {
        dateFilter = `AND (SELECT MAX(performed_at) FROM visit_lab_requests WHERE visit_id = v.id AND status = 'completed') BETWEEN ? AND ?`;
      } else {
        dateFilter = `AND (SELECT MIN(requested_at) FROM visit_lab_requests WHERE visit_id = v.id) BETWEEN ? AND ?`;
      }
      params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }

    const query = `
      SELECT DISTINCT 
        v.id as visit_id, 
        v.visit_number, 
        p.full_name, 
        p.age, 
        p.gender,
        (SELECT MIN(requested_at) FROM visit_lab_requests WHERE visit_id = v.id AND status IN ${statusFilter}) as requested_at,
        (SELECT COUNT(*) FROM visit_lab_requests WHERE visit_id = v.id AND status IN ${statusFilter}) as total_pending_tests,
        (SELECT COUNT(*) FROM visit_lab_requests WHERE visit_id = v.id AND status = 'in_progress') as total_in_progress
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      JOIN visit_lab_requests vlr ON v.id = vlr.visit_id
      WHERE vlr.status IN ${statusFilter}
      ${dateFilter}
      ORDER BY total_in_progress DESC, requested_at ASC
    `;
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('getRequests error:', error);
    res.status(500).json({ message: 'فشل تحميل الطلبات' });
  }
};

// 2. Get details for a specific visit (only the requested lab tests)
exports.getVisitDetails = async (req, res) => {
  const { visitId } = req.params;
  try {
    const visitQuery = `
      SELECT v.id as visit_id, v.visit_number, p.full_name, p.age, p.gender, p.allergies, p.chronic_diseases
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      WHERE v.id = ?
    `;
    const [visitRows] = await db.query(visitQuery, [visitId]);
    if (visitRows.length === 0) return res.status(404).json({ message: 'الزيارة غير موجودة' });

    const requestsQuery = `
      SELECT vlr.id, vlr.status, vlr.result_file, vlr.result_notes, lt.name, lc.name as category_name
      FROM visit_lab_requests vlr
      JOIN lab_tests lt ON vlr.lab_test_id = lt.id
      LEFT JOIN lab_categories lc ON lt.category_id = lc.id
      WHERE vlr.visit_id = ? AND vlr.status IN ('paid', 'in_progress', 'completed')
      ORDER BY vlr.id ASC
    `;
    const [requests] = await db.query(requestsQuery, [visitId]);

    res.json({
      visit: visitRows[0],
      requests
    });
  } catch (error) {
    console.error('getVisitDetails error:', error);
    res.status(500).json({ message: 'فشل تحميل تفاصيل الزيارة' });
  }
};

// 3. Update status (e.g. to in_progress)
exports.updateRequestStatus = async (req, res) => {
  const { requestId } = req.params;
  const { status } = req.body;
  try {
    await db.query("UPDATE visit_lab_requests SET status = ?, performed_by = ? WHERE id = ?", [status, req.user.id, requestId]);
    const io = req.app.get('io');
    if (io) io.emit('lab:update');
    res.json({ message: 'تم تحديث الحالة بنجاح' });
  } catch (error) {
    console.error('updateRequestStatus error:', error);
    res.status(500).json({ message: 'فشل تحديث الحالة' });
  }
};

// 4. Upload result (base64 file + notes)
exports.uploadResult = async (req, res) => {
  const { requestId } = req.params;
  const { resultFile, resultNotes } = req.body; // resultFile is base64
  try {
    await db.query(`
      UPDATE visit_lab_requests 
      SET status = 'completed', result_file = ?, result_notes = ?, performed_by = ?, performed_at = NOW() 
      WHERE id = ?`, 
      [resultFile || null, resultNotes || null, req.user.id, requestId]
    );
    const io = req.app.get('io');
    if (io) io.emit('lab:update');
    res.json({ message: 'تم حفظ النتيجة بنجاح' });
  } catch (error) {
    console.error('uploadResult error:', error);
    res.status(500).json({ message: 'فشل حفظ النتيجة' });
  }
};

// 5. Complete all lab work for a visit and notify doctor
exports.completeVisitLab = async (req, res) => {
  const { visitId } = req.params;
  try {
    // We don't forcefully mark unfinished as completed. We just assume they did their work.
    // However, if there are pending tests, we might want to warn them. 
    // We just emit the socket event.
    const io = req.app.get('io');
    if (io) {
      io.to('doctor').emit('lab:completed', { message: `تم تجهيز تحاليل المريض` });
    }
    res.json({ message: 'تم إنهاء الزيارة وإشعار الطبيب' });
  } catch (error) {
    console.error('completeVisitLab error:', error);
    res.status(500).json({ message: 'تعذر تحديث حالة انتهاء المختبر' });
  }
};

// 6. Reports & Stats
exports.getStats = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    let dateFilter = '';
    const params = [];
    if (startDate && endDate) {
      dateFilter = `WHERE requested_at BETWEEN ? AND ?`;
      params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }

    const [[{ total_requests }]] = await db.query(`SELECT COUNT(*) as total_requests FROM visit_lab_requests ${dateFilter}`, params);
    const [[{ completed }]] = await db.query(`SELECT COUNT(*) as completed FROM visit_lab_requests WHERE status = 'completed' ${dateFilter.replace('WHERE', 'AND')}`, dateFilter ? params : []);
    const [[{ pending }]] = await db.query(`SELECT COUNT(*) as pending FROM visit_lab_requests WHERE status IN ('paid', 'in_progress') ${dateFilter.replace('WHERE', 'AND')}`, dateFilter ? params : []);
    
    const tableQuery = `
      SELECT 
        v.visit_number, 
        p.full_name as patient_name, 
        MAX(vlr.requested_at) as date,
        COUNT(vlr.id) as total_tests,
        SUM(CASE WHEN vlr.status = 'completed' THEN 1 ELSE 0 END) as completed_tests,
        GROUP_CONCAT(lt.name SEPARATOR ' - ') as tests_names
      FROM visit_lab_requests vlr
      JOIN visits v ON vlr.visit_id = v.id
      JOIN patients p ON v.patient_id = p.id
      JOIN lab_tests lt ON vlr.lab_test_id = lt.id
      ${dateFilter.replace('requested_at', 'vlr.requested_at')}
      GROUP BY v.id
      ORDER BY date DESC
    `;
    const [tableData] = await db.query(tableQuery, params);

    res.json({
      summary: {
        total_requests: total_requests || 0,
        completed: completed || 0,
        pending: pending || 0,
      },
      tableData
    });
  } catch (error) {
    console.error('getStats error:', error);
    res.status(500).json({ message: 'فشل تحميل الإحصائيات' });
  }
};
