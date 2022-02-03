import _ from 'lodash';

export default async function (models) {
    let setting = await models.settingModel.findOne({}).sort({_id: 1}).exec();
    let authTable = {
        '/userDashBoard': [],
        '/createKB': _.flatten([setting.projectTags, setting.settingTags]),
        '/setting': setting.settingTags,
        '/tagMgnt': setting.settingTags,
        '/messageMgnt': setting.settingTags,
        '/Chart': _.flatten([setting.statisticsTags, setting.settingTags]),
        '/userMgnt': _.flatten([setting.userTags, setting.settingTags]),
        '/Info': []
    }
    return authTable;
}