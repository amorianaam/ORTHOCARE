const db = require('../database/db');

// ─── HELPERS ──────────────────────────────────────────────────────
async function recordTransaction(conn, { item_id, item_type, transaction_type, quantity, unit_price = 0, source_entity = '', destination_entity = '', reference_id = null, notes = '', performed_by }) {
  await conn.execute(
    `INSERT INTO inventory_transactions 
     (item_id, item_type, transaction_type, quantity, unit_price, source_entity, destination_entity, reference_id, notes, performed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [item_id, item_type, transaction_type, quantity, unit_price, source_entity, destination_entity, reference_id, notes, performed_by]
  );
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════
exports.getDashboardStats = async (req, res) => {
  try {
    const [[totalItems]] = await db.execute(`SELECT COUNT(*) AS total FROM or_inventory_items WHERE is_active=1`);
    const [[lowStock]] = await db.execute(`SELECT COUNT(*) AS total FROM or_inventory_items WHERE is_active=1 AND quantity <= min_quantity`);
    const [[totalValue]] = await db.execute(`SELECT SUM(quantity * cost_price) AS total FROM or_inventory_items WHERE is_active=1`);
    
    const [[pendingTransfers]] = await db.execute(`SELECT COUNT(*) AS total FROM inventory_transfers WHERE to_store='or' AND status='pending'`);

    res.json({
      totalItems: totalItems.total,
      lowStock: lowStock.total,
      totalValue: totalValue.total || 0,
      pendingTransfers: pendingTransfers.total
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ═══════════════════════════════════════════════════════════════════
// ITEMS CRUD
// ═══════════════════════════════════════════════════════════════════
exports.getItems = async (req, res) => {
  try {
    const [rows] = await db.execute(`SELECT * FROM or_inventory_items WHERE is_active=1 ORDER BY name ASC`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

exports.createItem = async (req, res) => {
  try {
    const { name, description, unit, min_quantity, cost_price, issue_price, expiry_date, is_raw_material } = req.body;
    const [result] = await db.execute(
      `INSERT INTO or_inventory_items (name, description, unit, min_quantity, cost_price, issue_price, expiry_date, is_raw_material) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, unit, min_quantity || 0, cost_price || 0, issue_price || 0, expiry_date || null, is_raw_material ? 1 : 0]
    );
    res.json({ message: 'تم إضافة الصنف بنجاح', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, unit, min_quantity, cost_price, issue_price, expiry_date, is_raw_material } = req.body;
    await db.execute(
      `UPDATE or_inventory_items SET name=?, description=?, unit=?, min_quantity=?, cost_price=?, issue_price=?, expiry_date=?, is_raw_material=? WHERE id=?`,
      [name, description, unit, min_quantity || 0, cost_price || 0, issue_price || 0, expiry_date || null, is_raw_material ? 1 : 0, id]
    );
    res.json({ message: 'تم تحديث الصنف بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ═══════════════════════════════════════════════════════════════════
// TRANSFERS (From General Store)
// ═══════════════════════════════════════════════════════════════════
exports.getPendingTransfers = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT it.*, gi.name AS item_name, gi.unit, gi.cost_price, gi.expiry_date, u.full_name AS sender_name
      FROM inventory_transfers it
      JOIN general_inventory_items gi ON gi.id = it.general_item_id
      LEFT JOIN users u ON u.id = it.sent_by
      WHERE it.to_store='or' AND it.status='pending'
      ORDER BY it.sent_at ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

exports.receiveTransfer = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { transfer_id } = req.params;

    // Get transfer details
    const [[transfer]] = await conn.execute(`
      SELECT it.*, gi.name, gi.description, gi.unit, gi.cost_price, gi.expiry_date
      FROM inventory_transfers it
      JOIN general_inventory_items gi ON gi.id = it.general_item_id
      WHERE it.id = ? AND it.status = 'pending'
    `, [transfer_id]);

    if (!transfer) throw new Error('التحويل غير موجود أو تم استلامه مسبقاً');

    // Find or create item in OR store based on name
    let orItemId;
    const [[existingItem]] = await conn.execute(`SELECT id FROM or_inventory_items WHERE name = ?`, [transfer.name]);

    if (existingItem) {
      orItemId = existingItem.id;
      await conn.execute(
        `UPDATE or_inventory_items SET quantity = quantity + ?, cost_price = ? WHERE id = ?`,
        [transfer.sent_quantity, transfer.cost_price, orItemId]
      );
    } else {
      // Create new item
      const [newResult] = await conn.execute(
        `INSERT INTO or_inventory_items (name, description, unit, quantity, cost_price, expiry_date, is_raw_material)
         VALUES (?, ?, ?, ?, ?, ?, 1)`, // Mark as raw material by default when coming from general
        [transfer.name, transfer.description, transfer.unit, transfer.sent_quantity, transfer.cost_price, transfer.expiry_date]
      );
      orItemId = newResult.insertId;
    }

    // Update transfer
    await conn.execute(
      `UPDATE inventory_transfers SET status='received', received_by=?, received_at=NOW(), received_quantity=?, or_item_id=? WHERE id=?`,
      [req.user.id, transfer.sent_quantity, orItemId, transfer_id]
    );

    // Record Transaction for OR Store
    await recordTransaction(conn, {
      item_id: orItemId,
      item_type: 'or',
      transaction_type: 'in',
      quantity: transfer.sent_quantity,
      unit_price: transfer.cost_price,
      source_entity: 'المخزن العام',
      destination_entity: 'مخزن العمليات',
      notes: `استلام تحويل رقم ${transfer_id}`,
      performed_by: req.user.id
    });

    await conn.commit();

    // Emit socket to General Store
    const io = req.app.get('io');
    if (io) io.to('general_store_manager').emit('transfer:received', { message: `تم تأكيد استلام الشحنة من قبل مخزن العمليات` });

    res.json({ message: 'تم استلام الشحنة وتحديث المخزون بنجاح' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(400).json({ message: err.message || 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};

// ═══════════════════════════════════════════════════════════════════
// DIRECT RECEIVE (From External Supplier)
// ═══════════════════════════════════════════════════════════════════
exports.receiveDirectStock = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { items, supplier, notes } = req.body;

    for (let it of items) {
      if (!it.item_id || it.quantity <= 0) continue;
      
      await conn.execute(
        `UPDATE or_inventory_items SET quantity = quantity + ?, cost_price = ? WHERE id=?`,
        [it.quantity, it.unit_price, it.item_id]
      );

      await recordTransaction(conn, {
        item_id: it.item_id,
        item_type: 'or',
        transaction_type: 'in',
        quantity: it.quantity,
        unit_price: it.unit_price,
        source_entity: supplier || 'مورد خارجي',
        destination_entity: 'مخزن العمليات',
        notes: notes || 'استلام مباشر',
        performed_by: req.user.id
      });
    }

    await conn.commit();
    res.json({ message: 'تم استلام الوارد المباشر بنجاح' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};

// ═══════════════════════════════════════════════════════════════════
// MANUFACTURING (التصنيع)
// ═══════════════════════════════════════════════════════════════════
exports.createManufacturing = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { raw_item_id, raw_quantity, produced_item_id, produced_quantity, waste_percentage = 0, issue_price } = req.body;

    if (raw_quantity <= 0 || produced_quantity <= 0) throw new Error('الكميات غير صحيحة');

    const [[rawItem]] = await conn.execute(`SELECT quantity, cost_price, name FROM or_inventory_items WHERE id=?`, [raw_item_id]);
    if (rawItem.quantity < raw_quantity) throw new Error(`الكمية غير كافية للمادة الخام: ${rawItem.name}`);

    // Deduct raw material
    await conn.execute(`UPDATE or_inventory_items SET quantity = quantity - ? WHERE id=?`, [raw_quantity, raw_item_id]);

    // Calculate production
    const costPerUnit = (parseFloat(rawItem.cost_price) * parseFloat(raw_quantity)) / parseFloat(produced_quantity);

    // Add produced material
    await conn.execute(`UPDATE or_inventory_items SET quantity = quantity + ?, cost_price = ?, issue_price = ? WHERE id=?`, 
      [produced_quantity, costPerUnit, issue_price || costPerUnit, produced_item_id]);

    // Record manufacturing order
    await conn.execute(`
      INSERT INTO manufacturing_orders (raw_item_id, raw_quantity, produced_item_id, produced_quantity, waste_percentage, cost_per_unit, performed_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [raw_item_id, raw_quantity, produced_item_id, produced_quantity, waste_percentage, costPerUnit, req.user.id]);

    // Record transactions
    await recordTransaction(conn, {
      item_id: raw_item_id, item_type: 'or', transaction_type: 'out', quantity: raw_quantity,
      unit_price: rawItem.cost_price, source_entity: 'تصنيع', destination_entity: 'تصنيع', notes: `استهلاك لتصنيع صنف ${produced_item_id}`, performed_by: req.user.id
    });
    
    await recordTransaction(conn, {
      item_id: produced_item_id, item_type: 'or', transaction_type: 'in', quantity: produced_quantity,
      unit_price: costPerUnit, source_entity: 'تصنيع', destination_entity: 'تصنيع', notes: `إنتاج من مادة خام ${raw_item_id}`, performed_by: req.user.id
    });

    await conn.commit();
    res.json({ message: 'تمت عملية التصنيع والتحويل بنجاح' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(400).json({ message: err.message || 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};

// ═══════════════════════════════════════════════════════════════════
// STOCKTAKING (الجرد)
// ═══════════════════════════════════════════════════════════════════
exports.getStocktakingSessions = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT st.*, u.full_name as creator_name
      FROM inventory_stocktaking st
      LEFT JOIN users u ON u.id = st.created_by
      WHERE st.store_type = 'or'
      ORDER BY st.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ' });
  }
};

exports.createStocktaking = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { items } = req.body; 

    const [stResult] = await conn.execute(
      `INSERT INTO inventory_stocktaking (store_type, status, created_by, completed_at) VALUES ('or', 'completed', ?, NOW())`,
      [req.user.id]
    );
    const stocktakingId = stResult.insertId;

    for (let it of items) {
      const diff = parseFloat(it.actual_quantity) - parseFloat(it.expected_quantity);
      await conn.execute(
        `INSERT INTO inventory_stocktaking_items (stocktaking_id, item_id, expected_quantity, actual_quantity, difference, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [stocktakingId, it.item_id, it.expected_quantity, it.actual_quantity, diff, it.notes || '']
      );

      if (diff !== 0) {
        await conn.execute(`UPDATE or_inventory_items SET quantity = ? WHERE id = ?`, [it.actual_quantity, it.item_id]);
        
        await recordTransaction(conn, {
          item_id: it.item_id, item_type: 'or', transaction_type: diff > 0 ? 'in' : 'out',
          quantity: Math.abs(diff), source_entity: 'تسوية جرد', destination_entity: 'تسوية جرد',
          notes: `تسوية جرد رقم ${stocktakingId}`, performed_by: req.user.id
        });
      }
    }

    await conn.commit();
    res.json({ message: 'تم اعتماد الجرد بنجاح' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};
