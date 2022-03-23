import express from 'express';
const router = express.Router();
import auth from '../middleware/auth.js';
import log from '../middleware/log.js';
import { ObjectId } from 'mongodb';
import dayjs from 'dayjs';
import axios from 'axios';
import qs from 'qs';
import mime from 'mime-types';
import fs from 'fs-extra';

/* GET users listing. */
export default function (app, passport, models) {
  router.post('/login', auth(models), (req, res, next) => {
    req.app.locals.username = req.body.user.trim();
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
        message: '您好，歡迎使用' + settingModel.systemName + '的LINE notify通知服務！'
      }), {
        headers: {
          Authorization: 'Bearer ' + result.data.access_token
        },
        withCredentials: true
      });
      let user = await models.userModel.findOne({
        _id: ObjectId(req.session.passport.user)
      }).exec();
      let tick = dayjs().unix();
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
          status : 1,
          type: 0
        }]
      });
      res.send("[" + dayjs.unix(user.lineDate).format("YYYY-MM-DD HH:mm:ss") + "] LINE Notify綁定完成，您的帳號是：" + user.name + "，請關閉本視窗");
    } catch(e) {
      let tick = dayjs().unix();
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

  router.get('/fetchStorage', auth(models), log({
    models: models,
    user: true,
    action: 'fetchStorage',
    comment: 'iOS裝置下載'
  }), async (req, res) => {
    let file = await models.fileModel.findOne({
      _id: new ObjectId(req.query.id)
    }).exec();
    if(file === null) {
      res.send("指定的檔案不存在！");
    } else {
      if(file.status === 0) {
        res.send("指定的檔案無法讀取！");
      } else {
        let globalSetting = await models.settingModel.findOne({}).exec();
        let robotSetting = await models.robotModel.findOne({}).exec();
        let filePath = file.status === 3 ? robotSetting.originalVideos + "/" + file._id + ".mp4" : globalSetting.storageLocation + "/" + file._id;
        let mimeType = file.status === 3 ? mime.lookup(filePath) : file.type;
    // Listing 3.
        const options = {};

        let start;
        let end;

        const range = req.headers.range;
        if (range) {
            const bytesPrefix = "bytes=";
            if (range.startsWith(bytesPrefix)) {
                const bytesRange = range.substring(bytesPrefix.length);
                const parts = bytesRange.split("-");
                if (parts.length === 2) {
                    const rangeStart = parts[0] && parts[0].trim();
                    if (rangeStart && rangeStart.length > 0) {
                        options.start = start = parseInt(rangeStart);
                    }
                    const rangeEnd = parts[1] && parts[1].trim();
                    if (rangeEnd && rangeEnd.length > 0) {
                        options.end = end = parseInt(rangeEnd);
                    }
                }
            }
        }

        res.setHeader("content-type", mimeType);

        fs.stat(filePath, (err, stat) => {
            if (err) {
                console.error(`找不到檔案 ${filePath}.`);
                console.error(err);
                res.sendStatus(500);
                return;
            }

            let contentLength = stat.size;

            // Listing 4.
            if (req.method === "HEAD") {
                res.statusCode = 200;
                res.setHeader("accept-ranges", "bytes");
                res.setHeader("content-length", contentLength);
                res.end();
            }
            else {       
                // Listing 5.
                let retrievedLength;
                if (start !== undefined && end !== undefined) {
                    retrievedLength = (end+1) - start;
                }
                else if (start !== undefined) {
                    retrievedLength = contentLength - start;
                }
                else if (end !== undefined) {
                    retrievedLength = (end+1);
                }
                else {
                    retrievedLength = contentLength;
                }

                // Listing 6.
                res.statusCode = start !== undefined || end !== undefined ? 206 : 200;

                res.setHeader("content-length", retrievedLength);

                if (range !== undefined) {  
                    res.setHeader("content-range", `bytes ${start || 0}-${end || (contentLength-1)}/${contentLength}`);
                    res.setHeader("accept-ranges", "bytes");
                }

                // Listing 7.
                const fileStream = fs.createReadStream(filePath, options);
                fileStream.on("error", error => {
                    console.log(`讀取檔案失敗 ${filePath}.`);
                    console.log(error);
                    res.sendStatus(500);
                });


                fileStream.pipe(res);
            }
        });
      }
    }
    return;
  });

  return router;
}
