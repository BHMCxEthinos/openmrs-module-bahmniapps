'use strict';

angular.module('bahmni.admin').service('storageService', ['$rootScope', '$http', '$q', 'appService', function ($rootScope, $http, $q, appService) {
    this.getUsedSpace = function () {
        $rootScope.totalSpace = $rootScope.maxStorageSpace || Bahmni.Common.Constants.maxStorageLimit;
//        $rootScope.containerNameOrId = Bahmni.Common.Constants.containerName;
        var containerNameOrId = appService.getAppDescriptor().getConfigValue("patientDocumentContainerName");
        var url = Bahmni.Common.Constants.storageUrl + containerNameOrId;
        $rootScope.contactURL = Bahmni.Common.Constants.contactURL;
        $rootScope.salesURL = Bahmni.Common.Constants.salesURL;

        $http.get(url)
            .then(function (response) {
                var dockerData = response.data;
                var containerName = dockerData.Name;
                var consumedSpaceStr = dockerData.StorageStats.Size;
                var consumedSpace = parseFloat(consumedSpaceStr);
                $rootScope.consumedSpaceText = consumedSpaceStr;
                $rootScope.totalSpaceText = $rootScope.totalSpace + ' GB';
                $rootScope.consumedPercentage = parseFloat((consumedSpace / $rootScope.totalSpace) * 100).toFixed(2);
            })
            .catch(function (error) {
                console.error('Error fetching data from Docker API:', error);
            });
    };
}]);
