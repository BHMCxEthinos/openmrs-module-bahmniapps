'use strict';

angular.module('bahmni.handnotes')
    .controller('HandNotesController', ['$scope', '$stateParams', 'visitService', 'patientService', 'encounterService',
        'spinner', 'visitDocumentService', '$rootScope', '$http', '$q', '$timeout', 'sessionService',
        '$translate', 'messagingService', 'observationsService', 'ngDialog', '$compile',
        function ($scope, $stateParams, visitService, patientService, encounterService, spinner, visitDocumentService,
                  $rootScope, $http, $q, $timeout, sessionService, $translate, messagingService, observationsService, ngDialog, $compile) {
            var encounterTypeUuid;
            var topLevelConceptUuid;
            var activeEncounter = {};
            var customVisitParams = Bahmni.HandNotes.Constants.visitRepresentation;
            var DateUtil = Bahmni.Common.Util.DateUtil;
            var patientMapper = new Bahmni.PatientMapper($rootScope.patientConfig, $rootScope, $translate);
            var locationUuid = sessionService.getLoginLocationUuid();

            $scope.visits = [];
            $scope.fileTypeConcepts = [];
            $scope.toggleGallery = true;
            $scope.conceptNameInvalid = false;

            var setOrientationWarning = function () {
                $scope.orientation_warning = (window.orientation && (window.orientation < 0 || window.orientation > 90));
            };
            setOrientationWarning();
            var onOrientationChange = function () {
                $scope.$apply(setOrientationWarning);
            };
            window.addEventListener('orientationchange', onOrientationChange);
            $scope.$on('$destroy', function () {
                window.removeEventListener('orientationchange', onOrientationChange);
            });

            var initNewVisit = function () {
                $scope.newVisit = new Bahmni.HandNotes.Visit();
                $scope.currentVisit = $scope.newVisit;
            };

            var createVisit = function (visit) {
                return angular.extend(new Bahmni.HandNotes.Visit(), visit);
            };

            $scope.canEdit = function (observation) {
                var obsToEdit;
                $scope.bahmniObservations.forEach(function (obs) {
                    obs.value.forEach(function (ob) {
                        if (ob.uuid === observation.uuid) {
                            obsToEdit = ob;
                        }
                    });
                });
                var activeEncounter = _.find($scope.activeEncounters, function (encounter) {
                    return encounter.uuid === obsToEdit.encounterUuid;
                });
                return activeEncounter !== undefined;
            };

            $scope.openEditPopUp = function (observation) {
                var obsToEdit;
                $scope.bahmniObservations.forEach(function (obs) {
                    obs.value.forEach(function (ob) {
                        if (ob.uuid === observation.uuid) {
                            obsToEdit = ob;
                        }
                    });
                });
                $scope.editHostData = {
                    patient: $scope.patient,
                    locationUuid: locationUuid,
                    encounterTypeUuid: encounterTypeUuid,
                    observationMapper: new Bahmni.ConceptSet.ObservationMapper(),
                    observationFilter: new Bahmni.Common.Domain.ObservationFilter(),
                    handnoteConceptName: "Hand Note",
                    imageNoteConceptName: "Image Note",
                    onSaveSuccess: function () {
                        ngDialog.close();
                        getHandNotes();
                        $scope.editOpen = false;
                    },
                    observation: obsToEdit
                };

                $scope.editOpen = true;
                ngDialog.open({
                    template: './views/scribblePad.html',
                    className: 'handnotes-dialog ngdialog-theme-default',
                    height: "100%",
                    width: "100%",
                    scope: $scope,
                    data: {
                        hostData: $scope.editHostData
                    },
                    closeByEscape: false,
                    closeByDocument: false
                });
            };

            var getHandNotes = function () {
                return observationsService.fetch($rootScope.patient.uuid, "Hand Note").then(function (response) {
                    var handNotesObs = new Bahmni.Common.Obs.ObservationMapper().map(response.data, []);
                    $scope.bahmniObservations = new Bahmni.Common.DisplayControl.Observation.GroupingFunctions().groupByEncounterDate(handNotesObs);
                });
            };

            var getActiveVisit = function () {
                if ($scope.patient) {
                    return visitService.search({patient: $scope.patient.uuid, v: customVisitParams, includeInactive: false}).then(function (response) {
                        if (response.data.results.length > 0) {
                            $scope.activeVisit = true;
                            $scope.activeEncounters = response.data.results[0].encounters;
                        } else {
                            $scope.activeVisit = false;
                        }
                    });
                }
            };

            $scope.closeDialog = function () {
                ngDialog.close();
            };

            var init = function () {
                encounterTypeUuid = $scope.encounterConfig.getConsultationEncounterTypeUuid();
                var deferrables = $q.defer();
                var promises = [];
                promises.push(getActiveVisit().then(getHandNotes));
                $q.all(promises).then(function () {
                    deferrables.resolve();
                });
                return deferrables.promise;
            };

            if ($scope.patient !== undefined) {
                $scope.hostData = {
                    patient: $scope.patient,
                    locationUuid: locationUuid,
                    encounterTypeUuid: encounterTypeUuid,
                    observationMapper: new Bahmni.ConceptSet.ObservationMapper(),
                    handnoteConceptName: "Hand Note",
                    imageNoteConceptName: "Image Note",
                    onSaveSuccess: function () {
                        getHandNotes();
                        getActiveVisit();
                    }
                };
            }
            spinner.forPromise(init());
        }
    ]);
