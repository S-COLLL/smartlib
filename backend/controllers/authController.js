const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Member = require('../models/Member');
const Setting = require('../models/Setting');
const { ApiError, asyncHandler, nextId, addDays } = require('../utils/helpers');
const { notify } = require('../utils/library');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const authResponse = async (user) => {
  const u = await User.findById(user._id).populate('member');
  return { success: true, token: signToken(u), user: u };
};

// POST /api/auth/register — self-registration creates a Student account + library membership
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, department, course, year } = req.body;
  if (await User.findOne({ email: String(email).toLowerCase() })) throw new ApiError(409, 'An account with this email already exists');

  const settings = await Setting.get();
  let member = await Member.findOne({ email: String(email).toLowerCase() });
  if (member && member.user) throw new ApiError(409, 'This membership is already linked to an account');
  if (!member) {
    member = await Member.create({
      memberId: await nextId('member', 'MEM'),
      name,
      email,
      phone: phone || undefined,
      department,
      course,
      year,
      membershipType: 'Student',
      membershipStart: new Date(),
      membershipExpiry: addDays(new Date(), 365),
    });
  }
  const user = await User.create({ name, email, password, role: 'student', member: member._id });
  member.user = user._id;
  await member.save();

  await notify({
    type: 'system',
    title: 'New member registered',
    message: `${name} (${member.memberId}) created an account. Membership fee: ₹${settings.membershipFee}.`,
    link: 'members.html',
  });
  res.status(201).json(await authResponse(user));
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) throw new ApiError(401, 'Invalid email or password');
  if (!user.isActive) throw new ApiError(403, 'This account has been disabled');
  user.lastLogin = new Date();
  await user.save();
  res.json(await authResponse(user));
});

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('member');
  res.json({ success: true, user });
});

// PUT /api/auth/profile
exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, avatar } = req.body;
  if (name !== undefined) req.user.name = name;
  if (avatar !== undefined) req.user.avatar = avatar;
  await req.user.save();
  if (req.user.member) await Member.updateOne({ _id: req.user.member }, { ...(name ? { name } : {}), ...(avatar !== undefined ? { profilePhoto: avatar } : {}) });
  res.json({ success: true, user: await User.findById(req.user._id).populate('member') });
});

// PATCH /api/auth/password
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword || ''))) throw new ApiError(400, 'Current password is incorrect');
  if (!newPassword || newPassword.length < 6) throw new ApiError(400, 'New password must be at least 6 characters');
  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: 'Password updated' });
});

// POST /api/auth/search-history  { term }
exports.addSearchTerm = asyncHandler(async (req, res) => {
  const term = String(req.body.term || '').trim().slice(0, 60);
  if (term.length >= 2) {
    const history = [term, ...req.user.searchHistory.filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, 20);
    req.user.searchHistory = history;
    await req.user.save();
  }
  res.json({ success: true, searchHistory: req.user.searchHistory });
});

// ---- Admin user management ----

// GET /api/auth/users
exports.listUsers = asyncHandler(async (_req, res) => {
  const users = await User.find().populate('member', 'memberId name').sort({ createdAt: -1 });
  res.json({ success: true, data: users });
});

// POST /api/auth/users
exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (await User.findOne({ email: String(email).toLowerCase() })) throw new ApiError(409, 'An account with this email already exists');
  let member;
  if (role === 'student') {
    member = await Member.findOne({ email: String(email).toLowerCase() });
    if (!member) throw new ApiError(400, 'Create the library member first; student accounts must match a member email');
  }
  const user = await User.create({ name, email, password, role, member: member?._id });
  if (member) await Member.updateOne({ _id: member._id }, { user: user._id });
  res.status(201).json({ success: true, data: user });
});

// PATCH /api/auth/users/:id
exports.updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (String(user._id) === String(req.user._id) && (req.body.role || req.body.isActive === false)) {
    throw new ApiError(400, 'You cannot change your own role or disable your own account');
  }
  ['name', 'role', 'isActive'].forEach((k) => {
    if (req.body[k] !== undefined) user[k] = req.body[k];
  });
  if (req.body.password) user.password = req.body.password;
  await user.save();
  res.json({ success: true, data: user });
});
