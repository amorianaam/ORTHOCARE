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
    const [[totalItems]] = await db.execute(`SELECT COUNT(*) AS total FROM general_inventory_items WHERE is_active=1`);
    const [[lowStock]] = await db.execute(`SELECT COUNT(*) AS total FROM general_inventory_items WHERE is_active=1 AND quantity <= min_quantity`);
    const [[totalValue]] = await db.execute(`SELECT SUM(quantity * cost_price) AS total FROM general_inventory_items WHERE is_active=1`);
    
    // Recent transactions
    const [recentTransactions] = await db.execute(`
      SELECT it.*, i.name AS item_name, u.full_name AS user_name 
      FROM inventory_transactions it
      JOIN general_inventory_items i ON i.id = it.item_id
      LEFT JOIN users u ON u.id = it.performed_by
      WHERE it.item_type = 'general'
      ORDER BY it.created_at DESC LIMIT 5
    `);

    res.json({
      totalItems: totalItems.total,
      lowStock: lowStock.total,
      totalValue: totalValue.total || 0,
      recentTransactions
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
    const [rows] = await db.execute(`SELECT * FROM general_inventory_items WHERE is_active=1 ORDER BY name ASC`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

exports.createItem = async (req, res) => {
  try {
    const { name, description, unit, min_quantity, cost_price, expiry_date } = req.body;
    const [result] = await db.execute(
      `INSERT INTO general_inventory_items (name, description, unit, min_quantity, cost_price, expiry_date) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, description, unit, min_quantity || 0, cost_price || 0, expiry_date || null]
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
    const { name, description, unit, min_quantity, cost_price, expiry_date } = req.body;
    await db.execute(
      `UPDATE general_inventory_items SET name=?, description=?, unit=?, min_quantity=?, cost_price=?, expiry_date=? WHERE id=?`,
      [name, description, unit, min_quantity || 0, cost_price || 0, expiry_date || null, id]
    );
    res.json({ message: 'تم تحديث الصنف بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    await db.execute(`UPDATE general_inventory_items SET is_active=0 WHERE id=?`, [req.params.id]);
    res.json({ message: 'تم إخفاء الصنف بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// ═══════════════════════════════════════════════════════════════════
// RECEIVE STOCK
// ═══════════════════════════════════════════════════════════════════
exports.receiveStock = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { supplier, invoice_date, items } = req.body; // items: [{item_id, quantity, unit_price}]
    
    for (let it of items) {
      if (!it.item_id || it.quantity <= 0) continue;
      
      // Update quantity & moving average cost (or just latest cost for simplicity)
      await conn.execute(
        `UPDATE general_inventory_items SET quantity = quantity + ?, cost_price = ? WHERE id=?`,
        [it.quantity, it.unit_price, it.item_id]
      );

      await recordTransaction(conn, {
        item_id: it.item_id,
        item_type: 'general',
        transaction_type: 'in',
        quantity: it.quantity,
        unit_price: it.unit_price,
        source_entity: supplier || 'مورد خارجي',
        destination_entity: 'المخزن العام',
        notes: `استلام فاتورة ${invoice_date || ''}`,
        performed_by: req.user.id
      });
    }

    await conn.commit();
    res.json({ message: 'تم استلام وتحديث المخزون بنجاح' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};

// ═══════════════════════════════════════════════════════════════════
// ISSUE STOCK
// ═══════════════════════════════════════════════════════════════════
exports.issueStock = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { destination, items, notes } = req.body; // destination: 'or_store', 'radiology', 'lab', etc.
    // items: [{item_id, quantity}]

    for (let it of items) {
      if (!it.item_id || it.quantity <= 0) continue;

      // Check stock
      const [[itemData]] = await conn.execute(`SELECT quantity, cost_price, name FROM general_inventory_items WHERE id=?`, [it.item_id]);
      if (itemData.quantity < it.quantity) {
        throw new Error(`الكمية غير كافية للصنف: ${itemData.name}`);
      }

      // Deduct from general store
      await conn.execute(`UPDATE general_inventory_items SET quantity = quantity - ? WHERE id=?`, [it.quantity, it.item_id]);

      await recordTransaction(conn, {
        item_id: it.item_id,
        item_type: 'general',
        transaction_type: 'out',
        quantity: it.quantity,
        unit_price: itemData.cost_price,
        source_entity: 'المخزن العام',
        destination_entity: destination,
        notes: notes || 'صرف للأقسام',
        performed_by: req.user.id
      });

      // If destination is OR store, create pending transfer
      if (destination === 'مخزن العمليات') {
        await conn.execute(
          `INSERT INTO inventory_transfers (from_store, to_store, status, sent_by, sent_quantity, general_item_id)
           VALUES ('general', 'or', 'pending', ?, ?, ?)`,
          [req.user.id, it.quantity, it.item_id]
        );
      }
    }

    await conn.commit();

    // Emit socket
    if (destination === 'مخزن العمليات') {
      const io = req.app.get('io');
      if (io) io.to('or_store_manager').emit('transfer:sent', { message: 'لديك إشعارات توريد جديدة من المخزن العام' });
    }

    res.json({ message: 'تم صرف المواد بنجاح' });
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
      WHERE st.store_type = 'general'
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
    const { items } = req.body; // [{item_id, expected_quantity, actual_quantity, notes}]

    const [stResult] = await conn.execute(
      `INSERT INTO inventory_stocktaking (store_type, status, created_by, completed_at) VALUES ('general', 'completed', ?, NOW())`,
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

      // Adjust inventory
      if (diff !== 0) {
        await conn.execute(`UPDATE general_inventory_items SET quantity = ? WHERE id = ?`, [it.actual_quantity, it.item_id]);
        
        await recordTransaction(conn, {
          item_id: it.item_id,
          item_type: 'general',
          transaction_type: diff > 0 ? 'in' : 'out',
          quantity: Math.abs(diff),
          source_entity: 'تسوية جرد',
          destination_entity: 'تسوية جرد',
          notes: `تسوية جرد رقم ${stocktakingId}`,
          performed_by: req.user.id
        });
      }
    }

    await conn.commit();
    res.json({ message: 'تم اعتماد الجرد وتحديث الأرصدة بنجاح' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  } finally {
    conn.release();
  }
};
