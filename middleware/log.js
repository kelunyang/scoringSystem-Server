const dayjs = require('dayjs');

module.exports = (data) => {
  return async (req, res, next) => {
    let authMapping = await require('./mapping')(data.models);
    let action = authMapping[data.action];
    let comment = data.action === 'loginFail' ? '使用帳號密碼組合為' + req.app.locals.username + '/' + req.app.locals.password : data.comment;
    await data.models.logModel.create({ 
      tick: dayjs().unix(),
      name: data.user ? req.session.passport.user : authMapping.nobodyAccount,
      where: action.where,
      action: action.action + "[" + comment + "]"
    });
    next();
  }
}