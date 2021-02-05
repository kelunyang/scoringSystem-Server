const moment = require('moment');

module.exports = (data) => {
    return async (req, res, next) => {
        let authMapping = await require('./mapping')(data.models);
        let action = authMapping[data.action];
        await data.models.logModel.create({ 
            tick: moment().unix(),
            name: data.user ? req.session.passport.user : authMapping.nobodyAccount,
            where: action.where,
            action: action.action + "[" + data.comment + "]"
        });
        next();
    }
}