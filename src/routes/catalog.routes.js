'use strict';
const { Router } = require('express');
const { authenticate } = require('../middleware/authenticate');
const catalogController = require('../controllers/catalogController');
const router = Router();
router.get('/planning', authenticate, catalogController.planning);
module.exports = router;
