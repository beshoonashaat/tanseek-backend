'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok } = require('../utils/apiResponse');
const termsRepo = require('../repositories/termsRepo');
const timeSlotsRepo = require('../repositories/timeSlotsRepo');
const departmentsRepo = require('../repositories/departmentsRepo');
const coursesRepo = require('../repositories/coursesRepo');
const sectionsRepo = require('../repositories/sectionsRepo');
const studentGroupsRepo = require('../repositories/studentGroupsRepo');
const roomsRepo = require('../repositories/roomsRepo');

const planning = asyncHandler(async (req, res) => {
  const term = await termsRepo.findActiveOrLatest();
  if (!term) return ok(res, { term: null, days: [], slots: [], departments: [], courses: [], sections: [], studentGroups: [], rooms: [] });
  const [slots, departments, courses, sections, studentGroups, rooms] = await Promise.all([
    timeSlotsRepo.listByTerm(term.id), departmentsRepo.listAll(), coursesRepo.listAll(),
    sectionsRepo.listByTerm(term.id), studentGroupsRepo.listByTerm(term.id), roomsRepo.listAll({ active: true })
  ]);
  const groupsBySection = await sectionsRepo.getGroupsForSections(sections.map((s) => s.id));
  const withGroups = sections.map((s) => ({ ...s, groups: groupsBySection.get(s.id) || [] }));
  const days = [...new Set(slots.map((s) => s.weekday))];
  return ok(res, { term, days, slots, departments, courses, sections: withGroups, studentGroups, rooms });
});

module.exports = { planning };
