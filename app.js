'use strict';

const express = require('express');
const { createApp } = require('./src/app');
const { assertProductionSafety, assertJwtConfigured } = require('./src/config/env');

assertProductionSafety();
assertJwtConfigured();

// Vercel owns the HTTP listener. Database setup runs separately from requests.
const app = express();
app.use(createApp());
module.exports = app;
