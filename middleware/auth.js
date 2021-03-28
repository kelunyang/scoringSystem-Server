const moment = require('moment');
const { ObjectId } = require('mongodb');
const _ = require('lodash');

module.exports = (models) => {
    return async (req, res, next) => {
        console.log("http event:" + req.path);
        const reqLocation = req.path.replace('/', '');
        const authMapping = await require('./mapping')(models);
        let action = authMapping[reqLocation];
        let ma = undefined;
        if(req.session.hasOwnProperty('passport')) {
            if(req.session.passport.hasOwnProperty('user')) {
                let user = await models.userModel.findOne({
                    _id: ObjectId(req.session.passport.user)
                }).sort({_id: 1}).exec();
                if(action.authRange.length !== 0) {
                    let found = false;
                    action.authRange.forEach((tag) => {
                        found = _.find(user.tags, tag);
                    });
                    if(found) {
                        ma = authMapping['authGranted'];
                        res.locals.status = {
                            title: '確認權限完成',
                            type: 3,
                            tick: moment().unix()
                        };
                        await models.logModel.create({ 
                            tick: moment().unix(),
                            name: ObjectId(user._id),
                            where: ma.where,
                            action: ma.action + '需要權限：' + JSON.stringify(action.authRange) + '，確認權限完成'
                        });
                        next();
                        return;
                    } else {
                        ma = authMapping['authNotGranted'];
                        res.locals.status = {
                            title: '無權限操作',
                            type: 1,
                            tick: moment().unix()
                        };
                        await models.logModel.create({ 
                            tick: moment().unix(),
                            name: ObjectId(user._id),
                            where: ma.where,
                            action: ma.action + '需要權限：' + JSON.stringify(action.authRange) + '，無權限操作'
                        });
                        next();
                        return;
                    }
                } else {
                    ma = authMapping['authGranted'];
                    res.locals.status = {
                        title: '無權限驗證完成',
                        type: 3,
                        tick: moment().unix()
                    };
                    await models.logModel.create({ 
                        tick: moment().unix(),
                        name: ObjectId(user._id),
                        where: ma.where,
                        action: ma.action + '無權限驗證完成'
                    });
                    next();
                    return;
                }
            }
            ma = authMapping['authNotAccess'];
            res.locals.status = {
                title: '尚未登入',
                type: 0,
                tick: moment().unix()
            };
            await models.logModel.create({ 
                tick: moment().unix(),
                name: authMapping.nobodyAccount,
                where: ma.where,
                action: ma.action
            });
            next();
            return;
        } else {
            ma = authMapping['authPublicAccess'];
            res.locals.status = {
                title: '尚未登入',
                type: 0,
                tick: moment().unix()
            };
            await models.logModel.create({ 
                tick: moment().unix(),
                name: authMapping.nobodyAccount,
                where: ma.where,
                action: ma.action
            });
            next();
            return;
        }
    }
}