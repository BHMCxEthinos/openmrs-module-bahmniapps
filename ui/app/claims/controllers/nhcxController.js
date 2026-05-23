'use strict';

angular.module('bahmni.claims')
    .controller('NhcxController', ['$scope', '$state', '$stateParams', '$location', 'appService', 'nhcxService', function ($scope, $state, $stateParams, $location, appService, nhcxService) {
        $scope.appExtensions = appService.getAppDescriptor().getExtensions($state.current.data.extensionPointId, "link") || [];

        var init = function () {
            if ($stateParams.patient !== null && $stateParams.patient !== undefined) {
                $scope.patientUuid = $stateParams.patient.uuid;
                $scope.patient = $stateParams.patient;
            }
            var urlParams = $location.$$search;
            if (urlParams !== undefined && urlParams.patientUuid != null) {
                $scope.patientUuid = urlParams.patientUuid;
            }

            $scope.claimRequest = {
                patientUuid: $stateParams.patient.uuid,
                visitUuid: $stateParams.visitUuid,
                items: []
            };
        };
        init();

        $scope.preAuth = function (patient) {
            return nhcxService.submitPreauth({paientUuid: patient.uuid});
        };

        $scope.addBillItem = function () {
            $scope.claimRequest.items.push({
                serviceCode: '',
                serviceDisplay: '',
                unitPrice: 0,
                quantity: 1,
                net: 0
            });
        };

        $scope.removeBillItem = function (index) {
            $scope.claimRequest.items.splice(index, 1);
        };

        $scope.getTotalAmount = function () {
            var total = 0;

            angular.forEach($scope.claimRequest.items, function (item) {
                total += Number(item.net || 0);
            });
            return total.toFixed(2);
        };

        $scope.submitPredetermination = function () {
            nhcxService.submitPredetermination($scope.claimRequest)
                .then(function (response) {
                    Bahmni.Common.UI.Notification.success(
                        'Predetermination submitted successfully'
                    );
                    $scope.response = response.data;
                });
        };

        $scope.submitClaim = function () {
            nhcxService.submitClaim($scope.claimRequest)
                .then(function (response) {
                    Bahmni.Common.UI.Notification.success(
                        'Claim submitted successfully'
                    );
                    $scope.response = response.data;
                });
        };
    }]);
