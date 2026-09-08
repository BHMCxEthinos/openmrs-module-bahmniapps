'use strict';

angular.module('bahmni.registration')
    .controller('EditPatientController', ['$scope', 'patientService', 'encounterService', '$stateParams', 'openmrsPatientMapper',
        '$window', '$q', 'spinner', 'appService', 'messagingService', '$rootScope', 'auditLogService',
        function ($scope, patientService, encounterService, $stateParams, openmrsPatientMapper, $window, $q, spinner,
                  appService, messagingService, $rootScope, auditLogService) {
            var dateUtil = Bahmni.Common.Util.DateUtil;
            var uuid = $stateParams.patientUuid;
            $scope.patient = {};
            $scope.actions = {};
            $scope.addressHierarchyConfigs = appService.getAppDescriptor().getConfigValue("addressHierarchy");
            $scope.disablePhotoCapture = appService.getAppDescriptor().getConfigValue("disablePhotoCapture");
            $scope.today = dateUtil.getDateWithoutTime(dateUtil.now());

            var setReadOnlyFields = function () {
                $scope.readOnlyFields = {};
                var readOnlyFields = appService.getAppDescriptor().getConfigValue("readOnlyFields");
                angular.forEach(readOnlyFields, function (readOnlyField) {
                    if ($scope.patient[readOnlyField]) {
                        $scope.readOnlyFields[readOnlyField] = true;
                    }
                });
            };

            var successCallBack = function (openmrsPatient) {
                $scope.openMRSPatient = openmrsPatient["patient"];
                $scope.patient = openmrsPatientMapper.map(openmrsPatient);
                setReadOnlyFields();
                expandDataFilledSections();
                $scope.patientLoaded = true;
                $scope.enableWhatsAppButton = (appService.getAppDescriptor().getConfigValue("enableWhatsAppButton") || Bahmni.Registration.Constants.enableWhatsAppButton) && ($scope.patient.phoneNumber != undefined);
                $scope.relatedIdentifierAttribute = appService.getAppDescriptor().getConfigValue('relatedIdentifierAttribute');
                if ($scope.relatedIdentifierAttribute && $scope.relatedIdentifierAttribute.name) {
                    const hideOrDisableAttr = $scope.relatedIdentifierAttribute.hideOrDisable;
                    const hideAttrOnValue = $scope.relatedIdentifierAttribute.hideOnValue;
                    $scope.showRelatedIdentifierOption = !(hideOrDisableAttr === "hide" && $scope.patient[$scope.relatedIdentifierAttribute.name] &&
                                                            $scope.patient[$scope.relatedIdentifierAttribute.name].toString() === hideAttrOnValue);
                    $scope.showDisabledAttrOption = hideOrDisableAttr === "disable" ? true : false;
                }
            };

            var expandDataFilledSections = function () {
                angular.forEach($rootScope.patientConfiguration && $rootScope.patientConfiguration.getPatientAttributesSections(), function (section) {
                    var notNullAttribute = _.find(section && section.attributes, function (attribute) {
                        return $scope.patient[attribute.name] !== undefined;
                    });
                    section.expand = section.expanded || (notNullAttribute ? true : false);
                });
            };

            (function () {
                var getPatientPromise = patientService.get(uuid).then(successCallBack);

                var isDigitized = encounterService.getDigitized(uuid);

                var identifiers = patientService.getAllPatientIdentifiers(uuid);

                identifiers.then(function (response) {
                    $rootScope.patientIdentifiers = response.data.results;
                });

                isDigitized.then(function (data) {
                    var encountersWithObservations = data.data.results.filter(function (encounter) {
                        return encounter.obs.length > 0;
                    });
                    $scope.isDigitized = encountersWithObservations.length > 0;
                });

                spinner.forPromise($q.all([getPatientPromise, isDigitized, identifiers]));
            })();

            var validateDependentRelationship = function () {
                var patientTypeAttr = $scope.patient["patientType"] || $scope.patient["Patient Type"];
                var patientTypeValue = "";

                if (patientTypeAttr) {
                    if (typeof patientTypeAttr === 'object') {
                        patientTypeValue = patientTypeAttr.value || patientTypeAttr.display || patientTypeAttr.fullySpecifiedName || "";
                    } else {
                        patientTypeValue = patientTypeAttr.toString();
                    }
                }

                var isDependant = patientTypeValue.toLowerCase().trim() === "dependant" || patientTypeValue.toLowerCase().trim() === "dependent";

                if (isDependant) {
                    // Check existing active saved relationships mapped on patient object
                    var existingRelationships = _.filter($scope.patient.relationships || [], function (rel) {
                        return !rel.voided;
                    });

                    // Check newly added relationships in UI form rows
                    var newlyAdded = _.filter($scope.patient.newlyAddedRelationships || [], function (rel) {
                        return rel.relationshipType && (rel.relationshipType.uuid || rel.relationshipType.aIsToB) && (rel.personB || rel.targetPatient || rel.patientIdentifier || rel.providerName || rel.aIsToB);
                    });

                    // Check relationship attribute field if used
                    var relationshipAttr = $scope.patient["Relationship"] || $scope.patient["relationship"];
                    var hasRelationshipAttr = relationshipAttr && (
                        typeof relationshipAttr === 'object' ? (relationshipAttr.value || relationshipAttr.display) : relationshipAttr.trim().length > 0
                    );

                    if (existingRelationships.length === 0 && newlyAdded.length === 0 && !hasRelationshipAttr) {
                        return "Relationship is mandatory when Patient Type is set to Dependant.";
                    }
                }

                return "";
            };

            var addNewRelationships = function () {
                var newRelationships = _.filter($scope.patient.newlyAddedRelationships, function (relationship) {
                    return relationship.relationshipType && (relationship.relationshipType.uuid || relationship.relationshipType.aIsToB);
                });

                newRelationships = _.map(newRelationships, function (relationship) {
                    var cleanRel = angular.copy(relationship);
                    delete cleanRel.patientIdentifier;
                    delete cleanRel.content;
                    delete cleanRel.providerName;
                    return cleanRel;
                });

                // Preserve existing saved relationships and merge newly added/deleted ones
                var existing = _.filter($scope.patient.relationships || [], function (rel) {
                    return rel.uuid; // Keep already persisted OpenMRS relationships
                });

                var deleted = $scope.patient.deletedRelationships || [];
                $scope.patient.relationships = _.concat(existing, newRelationships, deleted);
            };

            $scope.update = function () {
                var errorMessages = Bahmni.Common.Util.ValidationUtil.validate(
                    $scope.patient,
                    $scope.patientConfiguration ? $scope.patientConfiguration.attributeTypes : []
                ) || [];

                var patientType = $scope.patient["Patient Type"];
                var joiningDate = $scope.patient["Joining Date"];

                if (patientType && patientType.value) {
                    patientType = patientType.value;
                }

                if (patientType && patientType.display) {
                    patientType = patientType.display;
                }

                if (patientType === "Self" && !joiningDate) {
                    errorMessages.push("Joining Date is mandatory for Self patient type.");
                }

                var relationshipError = validateDependentRelationship();
                if (relationshipError) {
                    errorMessages.push(relationshipError);
                }

                if (errorMessages.length > 0) {
                    errorMessages.forEach(function (errorMessage) {
                        messagingService.showMessage('error', errorMessage);
                    });
                    return $q.when({}); // Unlocks UI spinner safely
                }

                addNewRelationships();

                return spinner.forPromise(
                    patientService.update($scope.patient, $scope.openMRSPatient).then(function (result) {
                        var patientProfileData = result.data;
                        if (!patientProfileData.error) {
                            successCallBack(patientProfileData);
                            $scope.actions.followUpAction(patientProfileData);
                        }
                    })
                );
            };

            $scope.isReadOnly = function (field) {
                return $scope.readOnlyFields ? ($scope.readOnlyFields[field] ? true : false) : undefined;
            };

            $scope.notifyOnWhatsAapp = function () {
                var name = $scope.patient.givenName + " " + $scope.patient.familyName;
                var whatsAppMessage = patientService.getRegistrationMessage($scope.patient.primaryIdentifier.identifier, name, $scope.patient.age.years, $scope.patient.gender);
                var phoneNumber = $scope.patient.phoneNumber.replace("+", "");
                var url = "https://api.whatsapp.com/send?phone=" + phoneNumber + "&text=" + encodeURIComponent(whatsAppMessage);
                window.open(url);
            };

            $scope.afterSave = function () {
                auditLogService.log($scope.patient.uuid, Bahmni.Registration.StateNameEvenTypeMap['patient.edit'], undefined, "MODULE_LABEL_REGISTRATION_KEY");
                messagingService.showMessage("info", "REGISTRATION_LABEL_SAVED");
            };
        }]);
