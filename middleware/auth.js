import dayjs from 'dayjs';
import { ObjectId } from 'mongodb';
import _ from 'lodash';
import mapping from './mapping.js';

export default function (models) {
    return async (req, res, next) => {
        //console.log("http event:" + req.path);
        const reqLocation = req.path.replace('/', '');
        const authMapping = await mapping(models);
        let action = authMapping[reqLocation];
        let ma = undefined;
        if(req.session.hasOwnProperty('passport')) {
            if(req.session.passport.hasOwnProperty('user')) {
                let user = await models.userModel.findOne({
                    _id: ObjectId(req.session.passport.user)
                }).exec();
                if(action.authRange.length !== 0) {
                    let found = (_.intersectionWith(action.authRange, user.tags, (aTag, uTag) => {
                        return aTag.equals(uTag);
                    })).length > 0;
                    if(found) {
                        ma = authMapping['authGranted'];
                        res.locals.status = {
                            title: '確認權限完成',
                            type: 3,
                            tick: dayjs().unix()
                        };
                        await models.logModel.create({ 
                            tick: dayjs().unix(),
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
                            tick: dayjs().unix()
                        };
                        await models.logModel.create({ 
                            tick: dayjs().unix(),
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
                        tick: dayjs().unix()
                    };
                    await models.logModel.create({ 
                        tick: dayjs().unix(),
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
                tick: dayjs().unix()
            };
            await models.logModel.create({ 
                tick: dayjs().unix(),
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
                tick: dayjs().unix()
            };
            await models.logModel.create({ 
                tick: dayjs().unix(),
                name: authMapping.nobodyAccount,
                where: ma.where,
                action: ma.action
            });
            next();
            return;
        }
    }
}