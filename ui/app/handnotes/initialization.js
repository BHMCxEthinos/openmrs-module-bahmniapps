'use strict';

angular.module('bahmni.handnotes').factory('initialization',
    ['$rootScope', '$q', '$window', '$location', 'configurationService', 'configurations', 'authenticator', 'appService', 'spinner',
        function ($rootScope, $q, $window, $location, configurationService, configurations, authenticator, appService, spinner) {
            var initializationPromise = $q.defer();
            var url = purl(decodeURIComponent($window.location));
            $rootScope.appConfig = url.param();

            var getConfigs = function () {
                var configNames = ['genderMap'];
                return configurations.load(configNames).then(function () {
                    $rootScope.genderMap = configurations.genderMap();
                });
            };

            var getConsultationConfigs = function () {
                var configNames = ['encounterConfig'];
                return configurationService.getConfigurations(configNames).then(function (configurations) {
                    $rootScope.encounterConfig = angular.extend(new EncounterConfig(), configurations.encounterConfig);
                });
            };

            var checkPrivilege = function () {
                return appService.checkPrivilege("app:document-upload").catch(function () {
                    return initializationPromise.reject();
                });
            };

            var initApp = function () {
                return appService.initApp('handnotes', {'app': true, 'extension': true}, $rootScope.appConfig.encounterType);
            };

            $rootScope.$on("$stateChangeError", function () {
                $location.path("/error");
            });

            authenticator.authenticateUser().then(initApp).then(checkPrivilege).then(getConsultationConfigs).then(function () {
                initializationPromise.resolve();
            });

            return spinner.forPromise(initializationPromise.promise).then(getConfigs);
        }]
);
