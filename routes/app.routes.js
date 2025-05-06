// routes/app.routes.js
const express = require("express");
const router  = express.Router();
const pushCtrl = require("../push-notification-controller");

router.post("/send-notification", pushCtrl.sendPushNotification);

module.exports = router;
