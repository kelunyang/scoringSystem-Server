const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const log = require('../middleware/log');
const { ObjectId } = require('mongodb');
const moment = require('moment');

/* GET users listing. */
module.exports = (app, passport, models) => {
  router.post('/login', auth(models), (req, res, next) => {
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
  router.post('/logout', auth(models), log({
    models: models,
    user: true,
    action: 'logout'
  }), (req, res) => {
    req.logout();
    res.json({
      loginStatus: 1,
    });
  });
  router.get('/loginSuccess', auth(models), log({
    models: models,
    user: true,
    action: 'loginSuccess'
  }), (req, res) => {
    req.session.save();
    res.json({
      loginStatus: 1,
    });
  });
  router.get('/loginFail', auth(models), log({
    models: models,
    user: false,
    action: 'loginFail'
  }), (req, res) => {
    res.json({
      loginStatus: 0
    });
  });
  
  router.get('/lineNotify', auth(models), log({
    models: models,
    user: false,
    action: 'lineNotify'
  }), async (req, res) => {
    let user = await models.userModel.findOne({
      _id: ObjectId(req.session.passport.user)
    }).sort({_id: 1}).exec();
    user.lineCode = req.query.code;
    user.lineDate = moment().unix();
    user.modDate = moment().unix();
    await user.save();
    res.send("[" + moment.unix(user.lineDate).format("YYYY-MM-DD HH:mm:ss") + "] LINE Notify綁定完成，您的帳號是：" + user.name + "，請關閉本視窗");
  });

  return router;
}
