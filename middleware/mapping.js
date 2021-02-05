module.exports = async (models) => {
    let robotSettings = await models.robotModel.findOne({}).sort({_id: 1}).exec();
    return  {
        nobodyAccount: robotSettings.nobodyAccount,
        dbStatus: {
            action: '資料庫檢查',
            where: '同步檢查模組',
            authRange: [],
            loginRequire: false
        },
        login: {
            action: '登入',
            where: '登入模組',
            authRange: [],
            loginRequire: false
        },
        loginSuccess: {
            action: '登入成功',
            where: '登入模組',
            authRange: [],
            loginRequire: true
        },
        loginFail: {
            action: '登入失敗',
            where: '登入模組',
            authRange: [],
            loginRequire: true
        },
        logout: {
            action: '登出成功',
            where: '登入模組',
            authRange: [],
            loginRequire: true
        },
        authGranted: {
            action: '',
            where: '驗證模組',
            authRange: [],
            loginRequire: true
        },
        authNotGranted: {
            action: '需要權限：',
            where: '驗證模組',
            authRange: [],
            loginRequire: true
        },
        authNotAccess: {
            action: '尚未登入',
            where: '驗證模組',
            authRange: [],
            loginRequire: true
        },
        authPublicAccess: { //無登入需求就會得到這個
            action: '公開權限',
            where: '驗證模組',
            authRange: [],
            loginRequire: true
        },
        getGlobalSettings: {
            action: '取得全域設定',
            where: '設定模組',
            authRange: [],
            loginRequire: true
        },
        getRobotSetting: {
            action: '取得機器人巡查設定',
            where: '設定模組',
            authRange: [],
            loginRequire: true
        },
        getProjectSetting: {
            action: '取得專案設定',
            where: '設定模組',
            authRange: [],
            loginRequire: true
        },
        getTags: {
            action: '取得標籤名單',
            where: '標籤模組',
            authRange: [],
            loginRequire: false
        },
        createUser: {
            action: '建立帳號',
            where: '帳號模組',
            authRange: [],
            loginRequire: true
        },
        getCurrentUser: {
            action: '查詢當前使用者',
            where: '帳號模組',
            authRange: [],
            loginRequire: false
        },
        setCurrentUser: {
            action: '設定當前使用者',
            where: '帳號模組',
            authRange: [],
            loginRequire: true
        },
        lineNotify: {
            action: 'LINE Notify綁定',
            where: '帳號模組',
            authRange: [],
            loginRequire: false
        },
    }
}