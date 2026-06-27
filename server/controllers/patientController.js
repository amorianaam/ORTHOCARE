const db = require('../database/db');

// GET /api/patients
exports.getAllPatients = async (req, res) => {
  try {
    const { q } = req.query;
    let sql = 'SELECT * FROM patients';
    let params = [];
    if (q) {
      sql += ' WHERE full_name LIKE ? OR phone LIKE ?';
      params = [`%${q}%`, `%${q}%`];
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await db.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// POST /api/patients
exports.createPatient = async (req, res) => {
  try {
    const { fullName, age, gender, phone, chronicDiseases, allergies, currentMedications, entity } = req.body;
    if (!fullName) return res.status(400).json({ message: 'الاسم مطلوب' });

    const [result] = await db.execute(
      `INSERT INTO patients (full_name, age, gender, phone, chronic_diseases, allergies, current_medications, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [fullName.trim(), age || null, gender || 'male', phone || null,
       chronicDiseases || null, allergies || null, currentMedications || null, req.user.id]
    );

    const patientId = result.insertId;
    const visitNumber = `V${Date.now()}`;

    await db.execute(
      `INSERT INTO visits (patient_id, visit_number, entity, status, created_by)
       VALUES (?, ?, ?, 'registered', ?)`,
      [patientId, visitNumber, entity || 'clinic', req.user.id]
    );

    const visitId = (await db.execute(`SELECT id FROM visits WHERE visit_number=?`, [visitNumber]))[0][0]?.id;

    // 🔔 Notify cashier: new patient registered
    const io = req.app.get('io');
    if (io) {
      io.to('cashier').emit('patient:registered', {
        visitNumber, patientName: fullName.trim(), message: `مريض جديد: ${fullName.trim()}`
      });
      io.to('cashier').emit('cashier:update');
    }

    res.status(201).json({ message: 'تم تسجيل المريض بنجاح', patientId, visitNumber });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// GET /api/patients/:id
exports.getPatientById = async (req, res) => {
  try {
    const { id } = req.params;
    const [[patient]] = await db.execute('SELECT * FROM patients WHERE id = ?', [id]);
    if (!patient) return res.status(404).json({ message: 'المريض غير موجود' });
    const [visits] = await db.execute(
      'SELECT * FROM visits WHERE patient_id = ? ORDER BY created_at DESC', [id]
    );
    res.json({ ...patient, visits });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// PUT /api/patients/:id
exports.updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, age, gender, phone, chronicDiseases, allergies, currentMedications } = req.body;
    if (!fullName) return res.status(400).json({ message: 'الاسم مطلوب' });

    await db.execute(
      `UPDATE patients SET full_name=?, age=?, gender=?, phone=?,
       chronic_diseases=?, allergies=?, current_medications=? WHERE id=?`,
      [fullName.trim(), age || null, gender, phone || null,
       chronicDiseases || null, allergies || null, currentMedications || null, id]
    );
    res.json({ message: 'تم تحديث بيانات المريض' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// POST /api/patients/follow-up — Send returning patient directly to waiting queue
exports.createFollowUp = async (req, res) => {
  try {
    const { patientId } = req.body;
    if (!patientId) return res.status(400).json({ message: 'معرّف المريض مطلوب' });

    const [[patient]] = await db.execute('SELECT * FROM patients WHERE id = ?', [patientId]);
    if (!patient) return res.status(404).json({ message: 'المريض غير موجود' });

    const visitNumber = `FU${Date.now()}`;
    await db.execute(
      `INSERT INTO visits (patient_id, visit_number, entity, status, is_follow_up, entry_fee, created_by)
       VALUES (?, ?, 'clinic', 'waiting', true, 0, ?)`,
      [patientId, visitNumber, req.user.id]
    );

    const io = req.app.get('io');
    if (io) {
       io.to('doctor').emit('patient:waiting', { message: 'متابعة جديدة في الانتظار' });
       io.to('cashier').emit('cashier:update');
    }

    res.status(201).json({ message: 'تم إرسال المريض إلى قائمة الانتظار', visitNumber });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// GET /api/patients/visits/today — All visits created today with their status
exports.getTodayVisits = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT v.*, p.full_name, p.age, p.gender, p.phone
       FROM visits v
       JOIN patients p ON p.id = v.patient_id
       WHERE DATE(v.created_at) = CURDATE() OR v.status NOT IN ('completed', 'cancelled')
       ORDER BY v.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'حدث خطأ في الخادم' });
  }
};
