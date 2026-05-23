"use strict";

angular.module('bahmni.common.displaycontrol.visitAttributes')
    .directive('visitAttributes', ['encounterService', 'appService', '$rootScope', 'sessionService', 'spinner', '$q', 'configurations', function (encounterService, appService, $rootScope, sessionService, spinner, $q, configurations) {
        var controller = function ($scope) {
            var init = function () {
                var getPreviousVisitData = appService.getAppDescriptor().getConfigValue("getPreviousVisitData");
                getPreviousVisitData = getPreviousVisitData || false;
                var conceptsToGetFromPrevVisit = appService.getAppDescriptor().getConfigValue("previousVisitConceptNamesToPull");
                conceptsToGetFromPrevVisit = conceptsToGetFromPrevVisit || [];
                var getPreviousObs = conceptsToGetFromPrevVisit.join(',');
                var encounterTypeUuid = configurations.encounterConfig().getRegistrationEncounterTypeUuid();
                console.log($scope.visitSummary);
                return encounterService.find({
                    "patientUuid": $scope.patientUuid,
                    "providerUuids": !_.isEmpty($rootScope.currentProvider.uuid) ? [$rootScope.currentProvider.uuid] : null,
                    "includeAll": false,
                    locationUuid: sessionService.getLoginLocationUuid(),
                    encounterTypeUuids: [encounterTypeUuid]
                }, getPreviousVisitData, getPreviousObs).then(function (response) {
                    if (response.data && response.data.context && response.data.context.visitAttributesTypes) {
                        var attrTypes = [];
                        for (var i = 2; i < response.data.context.visitAttributesTypes.length; i++) {
                            var attrTypeObject = response.data.context.visitAttributesTypes[i];
                            if (attrTypeObject) {
                                var dataClassName = attrTypeObject.DatatypeClassname;
                                var preferredHandlerClassname = attrTypeObject.PreferredHandlerClassname;
                                var attrName = attrTypeObject.Name;
                                var attrValue = attrTypeObject.Value;
                                var attrDescription = attrTypeObject.Description;
                                var handlerConfig = [];
                                if (attrTypeObject.HandlerConfig && attrTypeObject.HandlerConfig.length > 0) {
                                    handlerConfig = attrTypeObject.HandlerConfig.split(',');
                                }
                                if (preferredHandlerClassname && preferredHandlerClassname.length > 0) {
                                    preferredHandlerClassname = preferredHandlerClassname.substr(preferredHandlerClassname.lastIndexOf(".") + 1);
                                } else {
                                    preferredHandlerClassname = "textHandler";
                                    if (attrName === 'Token#') {
                                        attrValue = Number(attrValue);
                                    }
                                }
                                var initialValue = handlerConfig && handlerConfig.length > 0 ? handlerConfig[0] : "";
                                if (attrName === 'Follow-up Date') {
                                    attrValue = attrValue ? moment(attrValue).toDate() : "";
                                }
                                var attrType = {
                                    "preferredHandlerClassname": preferredHandlerClassname,
                                    "name": attrName,
                                    "attrDescription": attrDescription,
                                    "handlerConfig": handlerConfig,
                                    "value": attrValue || initialValue
                                };
                                attrTypes.push(attrType);
                            }
                        }
                        if (attrTypes.length > 0) {
                            $scope.attrTypes = attrTypes;
                        }
                    }
                });
            };
            $scope.initialization = init();
        };

        var link = function ($scope, element) {
            spinner.forPromise($scope.initialization, element);
        };
        return {
            restrict: 'E',
            link: link,
            controller: controller,
            templateUrl: "../common/displaycontrols/visitAttributes/views/visitAttributes.html",
            scope: {
                patientUuid: "=",
                visitSummary: "="
            }
        };
    }]);
