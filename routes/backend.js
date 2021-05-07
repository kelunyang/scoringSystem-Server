const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const log = require('../middleware/log');
const { ObjectId } = require('mongodb');
const moment = require('moment');
const axios = require('axios');
const qs = require('qs');

/* GET users listing. */
module.exports = (app, passport, models) => {
  router.post('/login', auth(models), (req, res, next) => {
    req.app.locals.username = req.body.user;
    req.app.locals.password = req.body.pass;
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
    delete req.app.locals.username;
    delete req.app.locals.password;
    return;
  });

  router.post('/logout', auth(models), log({
    models: models,
    user: true,
    action: 'logout',
    comment: '用戶登出'
  }), (req, res) => {
    req.logout();
    delete req.session.passport;
    req.session.save();
    res.json({
      loginStatus: 1,
    });
    return;
  });

  router.get('/loginSuccess', auth(models), log({
    models: models,
    user: true,
    action: 'loginSuccess',
    comment: '用戶登入成功'
  }), (req, res) => {
    req.session.save();
    res.json({
      loginStatus: 1,
    });
    delete req.app.locals.username;
    delete req.app.locals.password;
    return;
  });
  
  router.get('/loginFail', auth(models), log({
    models: models,
    user: false,
    action: 'loginFail',
    comment: ''
  }), (req, res) => {
    res.json({
      loginStatus: 0
    });
    delete req.app.locals.username;
    delete req.app.locals.password;
    return;
  });
  
  router.get('/lineNotify', auth(models), log({
    models: models,
    user: false,
    action: 'lineNotify',
    comment: '發送LINE訊息'
  }), async (req, res) => {
    let robotSetting = await models.robotModel.findOne({}).exec();
    let settingModel = await models.settingModel.findOne({}).exec();
    try {
      let result = await axios.post('https://notify-bot.line.me/oauth/token', qs.stringify({
        grant_type: 'authorization_code',
        redirect_uri: settingModel.siteLocation + '/backend/lineNotify',
        client_id: robotSetting.LINENotifyKey,
        client_secret: robotSetting.LINESecretKey,
        code: req.query.code
      }), {
        withCredentials: true
      });
      let sendmsg = await axios.post('https://notify-api.line.me/api/notify', qs.stringify({
        message: '您好，歡迎使用臺北市學科影片審查系統的LINE notify通知服務！'
      }), {
        headers: {
          Authorization: 'Bearer ' + result.data.access_token
        },
        withCredentials: true
      });
      let user = await models.userModel.findOne({
        _id: ObjectId(req.session.passport.user)
      }).exec();
      let tick = moment().unix();
      user.lineCode = req.query.code;
      user.lineToken = result.data.access_token;
      user.lineDate = tick;
      user.modDate = tick;
      await user.save();
      await models.lineModel.create({ 
        tick: tick,
        body: '歡迎訊息',
        log: [{
          uid: user._id,
          tick: tick,
          status : 1
        }]
      });
      res.send("[" + moment.unix(user.lineDate).format("YYYY-MM-DD HH:mm:ss") + "] LINE Notify綁定完成，您的帳號是：" + user.name + "，請關閉本視窗");
    } catch(e) {
      let tick = moment().unix();
      await models.logModel.create({ 
        tick: tick,
        name: ObjectId(user._id),
        where: 'LINE 綁定程序',
        action: '發生錯誤' + JSON.stringify(e)
      });
      res.send("LINE綁定程序發生錯誤，請將下面代碼回報：" + tick);
    }
    return;
  });

  return router;
}
