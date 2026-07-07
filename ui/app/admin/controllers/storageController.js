'use strict';

angular.module('bahmni.admin')
    .controller('StorageController', ['$scope', 'spinner', 'storageService',
        function ($scope, spinner, storageService) {
            var init = function () {
                storageService.getUsedSpace();
            };
            init();
        }]);
