'use strict';

angular.module('bahmni.clinical')
    .controller('VisitController', ['$scope', '$state', '$rootScope', '$q', 'encounterService', '$window', 'clinicalAppConfigService', 'configurations', 'visitSummary', '$timeout', 'printer', 'visitConfig', 'visitHistory', '$stateParams', 'locationService', 'visitService', 'appService', 'diagnosisService', 'observationsService', 'allergyService', 'auditLogService', 'sessionService', '$location', 'orderTypeService',
        function ($scope, $state, $rootScope, $q, encounterService, $window, clinicalAppConfigService, configurations, visitSummary, $timeout, printer, visitConfig, visitHistory, $stateParams, locationService, visitService, appService, diagnosisService, observationsService, allergyService, auditLogService, sessionService, $location, orderTypeService) {
            function handleLogoutShortcut (event) {
                if ((event.metaKey || event.ctrlKey) && event.key === $rootScope.quickLogoutComboKey) {
                    $scope.ipdDashboard.hostApi.onLogOut();
                }
            }
            function cleanup () {
                $window.removeEventListener('keydown', handleLogoutShortcut);
            }
            $window.addEventListener('keydown', handleLogoutShortcut);
            $scope.$on('$destroy', cleanup);
            var encounterTypeUuid = configurations.encounterConfig().getPatientDocumentEncounterTypeUuid();
            $scope.documentsPromise = encounterService.getEncountersForEncounterType($scope.patient.uuid, encounterTypeUuid).then(function (response) {
                return new Bahmni.Clinical.PatientFileObservationsMapper().map(response.data.results);
            });
            $scope.currentVisitUrl = $state.current.views['dashboard-content'].templateUrl ||
                $state.current.views['print-content'].templateUrl;
            var showProviderInfo = appService.getAppDescriptor().getConfigValue('showProviderInfoinVisits');
            $scope.showProviderInfo = showProviderInfo !== false ? true : showProviderInfo;
            $scope.visitHistory = visitHistory; // required as this visit needs to be overridden when viewing past visits
            $scope.visitSummary = visitSummary;
            $scope.visitTabConfig = visitConfig;
            $scope.showTrends = true;
            $scope.patientUuid = $stateParams.patientUuid;
            $scope.visitUuid = $stateParams.visitUuid;
            $scope.isActiveIpdVisit = $scope.visitSummary.visitType === "IPD";
            $scope.isIpdReadMode = true;
            if ($scope.visitSummary.stopDateTime === null) {
                $scope.isIpdReadMode = false;
            }
            $scope.ipdDashboard = {
                hostData: {
                    patient: {uuid: $scope.patientUuid},
                    visitSummary: $scope.visitSummary,
                    forDate: new Date().toUTCString(),
                    provider: $rootScope.currentProvider,
                    currentUser: $rootScope.currentUser,
                    visitUuid: $scope.visitUuid,
                    isReadMode: $scope.isIpdReadMode,
                    source: $location.search().source
                },
                hostApi: {
                    navigation: {
                        visitSummary: function () {
                            const visitSummaryUrl = $state.href('patient.dashboard.visit', {visitUuid: $scope.visitUuid});
                            $window.open(visitSummaryUrl, '_blank');
                        }
                    },
                    onLogOut: function () {
                        auditLogService.log(undefined, 'USER_LOGOUT_SUCCESS', undefined, 'MODULE_LABEL_LOGOUT_KEY').then(function () {
                            sessionService.destroy().then(
                                function () {
                                    $window.location = "../home/index.html#/login";
                                });
                        });
                    },
                    handleAuditEvent: function (patientUuid, eventType, messageParams, module) {
                        return auditLogService.log(patientUuid, eventType, messageParams, module);
                    }
                }
            };
            var tab = $stateParams.tab;
            var encounterTypes = visitConfig.currentTab.encounterContext ? visitConfig.currentTab.encounterContext.filterEncounterTypes : null;
            visitService.getVisit($scope.visitUuid, 'custom:(uuid,visitType,startDatetime,stopDatetime,encounters:(uuid,encounterDatetime,provider:(display),encounterType:(display)))').then(function (response) {
                if (response.data && response.data.encounters) {
                    var encounters = response.data.encounters;
                    if (encounterTypes) {
                        encounters = encounters.filter(function (enc) {
                            return encounterTypes.includes(enc.encounterType.display);
                        });
                    }
                    encounters = encounters.sort(function (a, b) {
                        return a.encounterDatetime.localeCompare(b.encounterDatetime);
                    });
                    if (encounters && encounters.length > 0) {
                        $scope.providerNames = encounters[0].provider && encounters[0].provider.display ? encounters[0].provider.display : null;
                    }
                }
            });

            $scope.isNumeric = function (value) {
                return $.isNumeric(value);
            };

            $scope.toggle = function (item) {
                item.show = !item.show;
            };
            $scope.isEmpty = function (notes) {
                if (notes) {
                    return notes.trim().length < 2;
                }
                return true;
            };
            $scope.testResultClass = function (line) {
                var style = {};
                if ($scope.pendingResults(line)) {
                    style["pending-result"] = true;
                }
                if (line.isSummary) {
                    style["header"] = true;
                }
                return style;
            };

            $scope.pendingResults = function (line) {
                return line.isSummary && !line.hasResults && line.name !== "";
            };

            $scope.displayDate = function (date) {
                return moment(date).format("DD-MMM-YYYY");
            };

            $scope.$on("event:printVisitTab", function () {
                $scope.isBeingPrinted = true;
                var mediaType = 'application/pdf';
                var a = document.createElement("a");
                document.body.appendChild(a);
                a.style = "display: none";
                var orderTypeUuid = orderTypeService.getOrderTypeUuid("Radiology Order");
                var labOrderTypeUuid = orderTypeService.getOrderTypeUuid("Lab Order");
                visitService.print({
                    "visitUuid": $scope.visitUuid,
                    "patientUuid": $scope.patientUuid,
                    "obsConcepts": $scope.visitTabConfig.currentTab.printing.vitals,
                    "obsIgnoreList": $scope.visitTabConfig.currentTab.printing.obsIgnoreList,
                    "orderTypeUuid": orderTypeUuid,
                    "labOrderTypeUuid": labOrderTypeUuid,
                    "formName": $scope.visitTabConfig.currentTab.printing.forms,
                    "headerUri": $location.protocol() + "://" + $location.host() + $scope.visitTabConfig.currentTab.printing.headerUri,
                    "showResults": $scope.visitTabConfig.currentTab.printing.showLabResults,
                    "handNotesConceptName": $scope.visitTabConfig.currentTab.printing.imageNoteName,
                    "showFormName": $scope.visitTabConfig.currentTab.printing.showFormName,
                    "attachDietPlan": $scope.visitTabConfig.currentTab.printing.attachDietPlan,
                    "dietChartConceptName": $scope.visitTabConfig.currentTab.printing.dietChartConceptName
                }).then(function (response) {
                    var blob = new Blob([response.data], { type: mediaType });
                    var fileURL = window.URL.createObjectURL(blob);
                    a.href = fileURL;
                    a.download = "visitReport.pdf";
                    a.click();
                });
            });

            $scope.$on("event:clearVisitBoard", function () {
                $scope.clearBoard = true;
                $scope.isBeingPrinted = false;
                $timeout(function () {
                    $scope.clearBoard = false;
                });
            });

            $scope.loadVisit = function (visitUuid) {
                $state.go('patient.dashboard.visit', {visitUuid: visitUuid});
            };

            var getCertificateHeader = function () {
                $scope.certificateHeader = {};
                return locationService.getAllByTag("Login Location").then(function (response) {
                    var locations = response.data.results;
                    if (locations !== null && locations.length > 0) {
                        $scope.certificateHeader.name = locations[0].name;
                        if (locations[0].attributes && locations[0].attributes.length > 0) {
                            var attributeDisplay = locations[0].attributes[0].display.split(": ");
                            if (attributeDisplay[0] === Bahmni.Clinical.Constants.certificateHeader) {
                                $scope.certificateHeader.address = attributeDisplay[1];
                            }
                        }
                    }
                });
            };

            var printOnPrint = function () {
                if ($stateParams.print) {
                    $scope.isBeingPrinted = true;
                    printer.printFromScope("common/views/visitTabPrint.html", $scope, function () {
                        window.close();
                        $scope.isBeingPrinted = false;
                    });
                }
            };

            var getTab = function () {
                if (tab) {
                    for (var tabIndex in $scope.visitTabConfig.tabs) {
                        if ($scope.visitTabConfig.tabs[tabIndex].title === tab) {
                            return $scope.visitTabConfig.tabs[tabIndex];
                        }
                    }
                }
                return $scope.visitTabConfig.getFirstTab();
            };

            var init = function () {
                $scope.visitTabConfig.setVisitUuidsAndPatientUuidToTheSections([$scope.visitUuid], $scope.patientUuid);
                var tabToOpen = getTab();
                $scope.visitTabConfig.switchTab(tabToOpen);
                printOnPrint();
                $scope.showProviderInfo ? getCertificateHeader() : null;
            };
            init();
        }]);
