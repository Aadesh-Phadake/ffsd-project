const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/user');
const wrapAsync = require('../utils/wrapAsync');
const {saveRedirectUrl} = require('../middleware');

const userController = require('../controllers/user');

router.route('/signup')
    .get(userController.renderSignup)
    .post(wrapAsync(userController.signup));

router.route('/login')
    .get(userController.renderLogin)
    .post(saveRedirectUrl, passport.authenticate('local', {failureFlash: true, failureRedirect: '/login'}),userController.login);
 
router.get('/logout', userController.logout);

module.exports = router;