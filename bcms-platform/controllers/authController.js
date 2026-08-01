const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const jwtConfig = require('../config/jwt');

const SALT_ROUNDS = 10;

/**
 * POST /api/auth/signup-company
 * Public endpoint: onboards a brand-new tenant. Creates the company AND its
 * first user (role = 'admin') in one call, so a new client (school, hospital,
 * clinic, etc.) can self-serve their way onto the platform.
 * Body: { company_name, company_slug, industry, admin_name, admin_email, admin_password }
 */
exports.signupCompany = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { company_name, company_slug, industry, admin_name, admin_email, admin_password } = req.body;

    if (!company_name || !company_slug || !admin_name || !admin_email || !admin_password) {
      return res.status(400).json({
        success: false,
        message: 'company_name, company_slug, admin_name, admin_email and admin_password are required'
      });
    }

    await conn.beginTransaction();

    const [existingSlug] = await conn.query('SELECT id FROM companies WHERE slug = ?', [company_slug]);
    if (existingSlug.length > 0) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'That company slug is already taken' });
    }

    const [existingEmail] = await conn.query('SELECT id FROM users WHERE email = ?', [admin_email]);
    if (existingEmail.length > 0) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const [companyResult] = await conn.query(
      'INSERT INTO companies (name, slug, industry) VALUES (?, ?, ?)',
      [company_name, company_slug, industry || null]
    );
    const companyId = companyResult.insertId;

    const hashedPassword = await bcrypt.hash(admin_password, SALT_ROUNDS);
    // role_id 2 = 'admin' — the first user of a new company is its own admin, not super_admin,
    // reserving super_admin for cases where BCMS itself needs an elevated internal role per company.
    const [userResult] = await conn.query(
      'INSERT INTO users (company_id, name, email, password, role_id) VALUES (?, ?, ?, ?, 2)',
      [companyId, admin_name, admin_email, hashedPassword]
    );

    await conn.commit();

    res.status(201).json({
      success: true,
      message: 'Company and admin account created',
      data: { company_id: companyId, user_id: userResult.insertId }
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error during company signup' });
  } finally {
    conn.release();
  }
};

/**
 * POST /api/auth/register
 * Creates an additional user WITHIN the caller's own company (e.g. an admin
 * adding an HR or sales user). Requires authentication — company_id is taken
 * from the logged-in user's token, never from the request body, so no one
 * can create a user in a company they don't belong to.
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password, role_id } = req.body;

    if (!req.user.company_id) {
      return res.status(403).json({ success: false, message: 'Platform admins cannot create company users this way' });
    }
    if (!name || !email || !password || !role_id) {
      return res.status(400).json({ success: false, message: 'name, email, password and role_id are required' });
    }
    if (Number(role_id) === 6) {
      return res.status(403).json({ success: false, message: 'Cannot create a platform_admin through this endpoint' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await pool.query(
      'INSERT INTO users (company_id, name, email, password, role_id) VALUES (?, ?, ?, ?, ?)',
      [req.user.company_id, name, email, hashedPassword, role_id]
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { id: result.insertId, name, email, role_id, company_id: req.user.company_id }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

/**
 * POST /api/auth/login
 * Verifies credentials and returns a JWT that carries company_id (null for platform_admin).
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.company_id, u.name, u.email, u.password, u.is_active, r.name AS role,
              c.name AS company_name, c.status AS company_status
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact your administrator.' });
    }
    if (user.company_id && user.company_status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Your company account is currently suspended.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company_id: user.company_id || null
      },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
        company_name: user.company_name
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile from the token.
 */
exports.me = async (req, res) => {
  res.json({ success: true, user: req.user });
};
