'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { query } = require('../db/pool');
const ApiError = require('../utils/ApiError');
const requirementsRepo = require('../repositories/sessionRequirementsRepo');
const sectionsRepo = require('../repositories/sectionsRepo');
const accountsRepo = require('../repositories/accountsRepo');
const auditRepo = require('../repositories/auditRepo');
const rolesRepo = require('../repositories/rolesRepo');

const masterData = asyncHandler(async (req, res) => {
  const termId = req.query.termId ? Number(req.query.termId) : null;
  const [terms, slots, courses, sections] = await Promise.all([
    query('SELECT id, name, starts_on, ends_on, state FROM academic_terms ORDER BY starts_on DESC'),
    query(`SELECT id, term_id, weekday, starts_at, ends_at, label FROM time_slots ${termId ? 'WHERE term_id=$1' : ''} ORDER BY weekday, starts_at`, termId ? [termId] : []),
    query('SELECT id, department_id, code, title FROM courses ORDER BY code'),
    query(`SELECT s.id, s.term_id, s.course_id, c.code AS course_code, c.title AS course_title, s.code, s.status FROM sections s JOIN courses c ON c.id=s.course_id ${termId ? 'WHERE s.term_id=$1' : ''} ORDER BY c.code,s.code`, termId ? [termId] : []),
  ]);
  const key = req.path.split('/').pop();
  const payload = key === 'terms' ? terms.rows : key === 'slots' ? slots.rows : key === 'courses' ? courses.rows : sections.rows;
  return ok(res, payload);
});

const draftAllocations = asyncHandler(async (req, res) => {
  const allocationsRepo = require('../repositories/allocationsRepo');
  const version = await query("SELECT id FROM schedule_versions WHERE name=$1 OR id::text=$1 ORDER BY id DESC LIMIT 1", [req.params.draftId]);
  if (!version.rowCount) throw ApiError.notFound('Schedule draft not found.');
  return ok(res, await allocationsRepo.listByVersion(version.rows[0].id));
});

const listRequirements = asyncHandler(async (req, res) => {
  const termId = req.query.termId ? Number(req.query.termId) : null;
  const result = await query(`SELECT sr.*, c.code AS course_code, c.title AS course_title FROM session_requirements sr JOIN courses c ON c.id=sr.course_id ${termId ? 'WHERE sr.term_id=$1' : ''} ORDER BY sr.id`, termId ? [termId] : []);
  return ok(res, result.rows);
});

const createRequirement = asyncHandler(async (req, res) => {
  const b = req.body;
  if (!b.courseId || !b.termId || !b.kind || !b.sessionsPerWeek || !b.durationMinutes) throw ApiError.badRequest('courseId, termId, kind, sessionsPerWeek and durationMinutes are required.');
  const row = await requirementsRepo.createRequirement({ courseId: b.courseId, termId: b.termId, kind: b.kind, sessionsPerWeek: b.sessionsPerWeek, durationMinutes: b.durationMinutes, requiredRoomKind: b.requiredRoomKind || null, preferredWindowNote: b.preferredWindowNote, createdBy: req.user.id });
  return created(res, row);
});

const updateRequirement = asyncHandler(async (req, res) => {
  const b = req.body;
  const result = await query(`UPDATE session_requirements SET kind=COALESCE($2,kind), sessions_per_week=COALESCE($3,sessions_per_week), duration_minutes=COALESCE($4,duration_minutes), required_room_kind=COALESCE($5,required_room_kind), preferred_window_note=COALESCE($6,preferred_window_note), updated_by=$7, updated_at=now() WHERE id=$1 RETURNING *`, [req.params.id, b.kind, b.sessionsPerWeek, b.durationMinutes, b.requiredRoomKind, b.preferredWindowNote, req.user.id]);
  if (!result.rowCount) throw ApiError.notFound('Requirement not found.');
  return ok(res, result.rows[0]);
});

const deleteRequirement = asyncHandler(async (req, res) => { const r = await query('DELETE FROM session_requirements WHERE id=$1 RETURNING id',[req.params.id]); if (!r.rowCount) throw ApiError.notFound('Requirement not found.'); return res.status(204).send(); });

const assignments = asyncHandler(async (req, res) => {
  const result = await query(`SELECT si.section_id, si.requirement_id, si.instructor_id, a.full_name, a.email, a.role FROM section_instructors si JOIN accounts a ON a.id=si.instructor_id ${req.query.sectionId ? 'WHERE si.section_id=$1' : ''} ORDER BY si.section_id,si.requirement_id`, req.query.sectionId ? [req.query.sectionId] : []);
  return ok(res, result.rows);
});
const createAssignment = asyncHandler(async (req, res) => { const b=req.body; if(!b.sectionId||!b.requirementId||!b.instructorId) throw ApiError.badRequest('sectionId, requirementId and instructorId are required.'); const r=await query('INSERT INTO section_instructors(section_id,requirement_id,instructor_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING *',[b.sectionId,b.requirementId,b.instructorId]); if(!r.rowCount) throw ApiError.badRequest('Assignment already exists.'); return created(res,r.rows[0]); });
const deleteAssignment = asyncHandler(async (req,res)=>{const r=await query('DELETE FROM section_instructors WHERE section_id=$1 AND requirement_id=$2 AND instructor_id=$3 RETURNING *',[req.params.sectionId,req.params.requirementId,req.params.instructorId]);if(!r.rowCount)throw ApiError.notFound('Assignment not found.');return res.status(204).send();});

const accounts = asyncHandler(async (req,res)=>ok(res,await accountsRepo.listAll({role:req.query.role,state:req.query.state,departmentId:req.query.departmentId})));
const roles = asyncHandler(async (req,res)=>ok(res,await rolesRepo.list()));
const auditLog = asyncHandler(async (req,res)=>ok(res,await auditRepo.listRecent(Math.min(Number(req.query.limit)||100,500))));
const labChecks = asyncHandler(async (req,res)=>{const r=await query('SELECT * FROM lab_checks ORDER BY checked_at DESC');return ok(res,r.rows);});
const createLabCheck = asyncHandler(async(req,res)=>{const b=req.body;if(!b.roomId||!b.status)throw ApiError.badRequest('roomId and status are required.');const r=await query('INSERT INTO lab_checks(room_id,checked_by,status,notes) VALUES($1,$2,$3,$4) RETURNING *',[b.roomId,req.user.id,b.status,b.notes||null]);return created(res,r.rows[0]);});
const updateLabCheck = asyncHandler(async(req,res)=>{const r=await query('UPDATE lab_checks SET status=$2,notes=$3,checked_by=$4,checked_at=now() WHERE id=$1 RETURNING *',[req.params.id,req.body.status,req.body.notes||null,req.user.id]);if(!r.rowCount)throw ApiError.notFound('Lab check not found.');return ok(res,r.rows[0]);});
const courseRegistrations = asyncHandler(async (req,res) => {
  const repo = require('../repositories/studentCourseRegistrationsRepo');
  if (!req.query.studentId) throw ApiError.badRequest('studentId query parameter is required.');
  return ok(res, await repo.listByStudent(req.query.studentId));
});
const sectionAssignments = asyncHandler(async (req,res) => {
  const repo = require('../repositories/studentSectionEnrollmentsRepo');
  if (!req.query.studentId && !req.query.sectionId) throw ApiError.badRequest('studentId or sectionId query parameter is required.');
  return ok(res, req.query.studentId ? await repo.listByStudent(req.query.studentId) : await repo.listBySection(req.query.sectionId));
});

module.exports={masterData,draftAllocations,listRequirements,createRequirement,updateRequirement,deleteRequirement,assignments,createAssignment,deleteAssignment,accounts,roles,auditLog,labChecks,createLabCheck,updateLabCheck,courseRegistrations,sectionAssignments};
