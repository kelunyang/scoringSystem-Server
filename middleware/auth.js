const moment = require('moment');
const { ObjectId } = require('mongodb');
const authMapping = require('./mapping')();

module.exports = (role, models) => {
    let action = undefined;
    return async (req, res, next) => {
        if(req.session.hasOwnProperty('passport')) {
            if(req.session.passport.hasOwnProperty('user')) {
                let user = await models.userModel.findOne({
                    _id: ObjectId(req.session.passport.user)
                }).sort({_id: 1}).exec();
                if(role.length !== 0) {
                    let found = false;
                    role.forEach((tag) => {
                        found = user.tags.find(tag);
                    });
                    if(found) {
                        action = authMapping['authGranted'];
                        res.locals.status = {
                            title: '確認權限完成',
                            type: 3,
                            tick: moment().unix()
                        };
                        await models.logModel.create({ 
                            tick: moment().unix(),
                            name: ObjectId(user._id),
                            where: action.where,
                            action: action.action + '需要權限：' + JSON.stringify(role) + '，確認權限完成'
                        });
                        next();
                    } else {
                        action = authMapping['authNotGranted'];
                        res.locals.status = {
                            title: '無權限操作',
                            type: 1,
                            tick: moment().unix()
                        };
                        await models.logModel.create({ 
                            tick: moment().unix(),
                            name: ObjectId(user._id),
                            where: action.where,
                            action: action.action + '需要權限：' + JSON.stringify(role) + '，無權限操作'
                        });
                        next();
                    }
                } else {
                    action = authMapping['authGranted'];
                    res.locals.status = {
                        title: '無權限驗證完成',
                        type: 3,
                        tick: moment().unix()
                    };
                    await models.logModel.create({ 
                        tick: moment().unix(),
                        name: ObjectId(user._id),
                        where: action.where,
                        action: action.action + '無權限驗證完成'
                    });
                    next();
                }
            }
            action = authMapping['authNotAccess'];
            res.locals.status = {
                title: '尚未登入',
                type: 0,
                tick: moment().unix()
            };
            await models.logModel.create({ 
                tick: moment().unix(),
                name: ObjectId("60122c1fd1308739d0991523"),
                where: action.where,
                action: action.action
            });
            next();
        } else {
            action = authMapping['authNotAccess'];
            res.locals.status = {
                title: '尚未登入',
                type: 0,
                tick: moment().unix()
            };
            await models.logModel.create({ 
                tick: moment().unix(),
                name: ObjectId("60122c1fd1308739d0991523"),
                where: action.where,
                action: action.action
            });
            next();
        }
    }
}