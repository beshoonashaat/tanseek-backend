'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize, ROLES } = require('../middleware/authorize');
const dashboardController = require('../controllers/dashboardController');

const router = Router();
const staffOnly = authorize(ROLES.ADMIN, ROLES.SCHEDULER, ROLES.DEPARTMENT_COORDINATOR, ROLES.LAB_MANAGER, ROLES.LECTURER, ROLES.TA);

// Backward-compatible alias used by the current frontend overview screen.
router.get('/', authenticate, staffOnly, dashboardController.getSummary);

module.exports = router;
