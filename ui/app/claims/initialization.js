'use strict';

angular.module('bahmni.claims')
.factory('initialization', ['$rootScope', '$q', 'appService', 'spinner', 'configurations',
    function ($rootScope, $q, appService, spinner, configurations) {
        var getConfigs = function () {
        };

        var initApp = function () {
            return appService.initApp('claims');
        };

        var checkPrivilege = function () {
            return appService.checkPrivilege("app:claims");
        };

        return spinner.forPromise(initApp().then(checkPrivilege).then(getConfigs));
    }
]);
