module.exports = () => {
    return  {
        dbStatus: {
            action: '資料庫檢查',
            where: '同步檢查模組',
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
        }
    }
}