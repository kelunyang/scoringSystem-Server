const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { ObjectId } = require('mongodb');
const moment = require('moment');
const authMapping = require('../middleware/mapping')();

/* GET users listing. */
module.exports = (app, passport, models) => {
  router.post('/login', auth([], models), (req, res, next) => {
    console.log(JSON.stringify(res.locals.status));
    if(res.locals.status.type === 0) {
      passport.authenticate('local', {
        successRedirect: '/backend/loginSuccess',
        failureRedirect: '/backend/loginFail'
      })(req,res,next);
    } else {
      next();
    }
  }, (req, res) => {
    res.json({
      loginStatus: 2
    });
  });
  router.post('/logout', auth([], models), async (req, res) => {
    let action = authMapping['logout'];
    await models.logModel.create({ 
      tick: moment().unix(),
      name: req.session.passport.user,
      where: action.where,
      action: action.action
    });
    req.logout();
    res.json({
      loginStatus: 1,
    });
  });
  router.get('/loginSuccess', auth([], models), async (req, res, next) => {
    let action = authMapping['loginSuccess'];
    await models.logModel.create({ 
      tick: moment().unix(),
      name: req.session.passport.user,
      where: action.where,
      action: action.action
    });
    req.session.save();
    res.json({
      loginStatus: 1,
    });
  });
  router.get('/loginFail', auth([], models), async (req, res, next) => {
    let action = authMapping['loginFail'];
    await models.logModel.create({ 
      tick: moment().unix(),
      name: ObjectId("60122c1fd1308739d0991523"),
      where: action.where,
      action: action.action
    });
    res.json({
      loginStatus: 0
    });
  });
  return router;
}
