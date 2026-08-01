const pool = require('../config/database');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

/**
 * GET /api/reports/attendance/pdf?month=&year=
 */
exports.attendancePdf = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'month and year are required' });
    }

    const [rows] = await pool.query(
      `SELECT e.employee_code, e.full_name,
              SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_days,
              SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent_days,
              SUM(CASE WHEN a.status = 'leave' THEN 1 ELSE 0 END) AS leave_days
       FROM employees e
       LEFT JOIN attendance a ON a.employee_id = e.id AND a.company_id = e.company_id
         AND MONTH(a.date) = ? AND YEAR(a.date) = ?
       WHERE e.company_id = ?
       GROUP BY e.id
       ORDER BY e.full_name`,
      [month, year, req.companyId]
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=attendance-${month}-${year}.pdf`);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    doc.fontSize(16).text(`Attendance Report — ${month}/${year}`, { align: 'center' });
    doc.moveDown();

    const startX = 40;
    let y = doc.y;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Code', startX, y, { width: 70 });
    doc.text('Name', startX + 70, y, { width: 160 });
    doc.text('Present', startX + 230, y, { width: 70 });
    doc.text('Absent', startX + 300, y, { width: 70 });
    doc.text('Leave', startX + 370, y, { width: 70 });
    doc.moveDown();
    doc.font('Helvetica');

    rows.forEach((row) => {
      y = doc.y;
      doc.text(row.employee_code, startX, y, { width: 70 });
      doc.text(row.full_name, startX + 70, y, { width: 160 });
      doc.text(String(row.present_days || 0), startX + 230, y, { width: 70 });
      doc.text(String(row.absent_days || 0), startX + 300, y, { width: 70 });
      doc.text(String(row.leave_days || 0), startX + 370, y, { width: 70 });
      doc.moveDown(0.5);
    });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to generate attendance PDF' });
  }
};

/**
 * GET /api/reports/payroll/excel?month=&year=
 */
exports.payrollExcel = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'month and year are required' });
    }

    const [rows] = await pool.query(
      `SELECT e.employee_code, e.full_name, p.basic_salary, p.working_days,
              p.present_days, p.absent_days, p.net_salary, p.status
       FROM payroll p
       JOIN employees e ON p.employee_id = e.id
       WHERE p.company_id = ? AND p.month = ? AND p.year = ?
       ORDER BY e.full_name`,
      [req.companyId, month, year]
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Payroll ${month}-${year}`);

    sheet.columns = [
      { header: 'Employee Code', key: 'employee_code', width: 16 },
      { header: 'Name', key: 'full_name', width: 25 },
      { header: 'Basic Salary', key: 'basic_salary', width: 15 },
      { header: 'Working Days', key: 'working_days', width: 14 },
      { header: 'Present Days', key: 'present_days', width: 14 },
      { header: 'Absent Days', key: 'absent_days', width: 13 },
      { header: 'Net Salary', key: 'net_salary', width: 15 },
      { header: 'Status', key: 'status', width: 12 }
    ];
    sheet.getRow(1).font = { bold: true };

    rows.forEach((row) => sheet.addRow(row));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=payroll-${month}-${year}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to generate payroll Excel report' });
  }
};

/**
 * GET /api/reports/customers/excel
 */
exports.customersExcel = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.name, c.company_name, c.email, c.phone, c.status, u.name AS assigned_to
       FROM customers c
       LEFT JOIN users u ON c.assigned_to = u.id
       WHERE c.company_id = ?
       ORDER BY c.name`,
      [req.companyId]
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Customers');

    sheet.columns = [
      { header: 'Name', key: 'name', width: 22 },
      { header: 'Company', key: 'company_name', width: 25 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Assigned To', key: 'assigned_to', width: 18 }
    ];
    sheet.getRow(1).font = { bold: true };

    rows.forEach((row) => sheet.addRow(row));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=customers.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to generate customers Excel report' });
  }
};
