'use strict';

angular.module('bahmni.registration')
    .factory('patientService', ['$http', '$rootScope', '$bahmniCookieStore', '$q', 'patientServiceStrategy', 'sessionService', '$translate', 'appService', function ($http, $rootScope, $bahmniCookieStore, $q, patientServiceStrategy, sessionService, $translate, appService) {
        var openmrsUrl = Bahmni.Registration.Constants.openmrsUrl;
        var baseOpenMRSRESTURL = Bahmni.Registration.Constants.baseOpenMRSRESTURL;

        var search = function (query, identifier, addressFieldName, addressFieldValue, customAttributeValue,
                               offset, customAttributeFields, programAttributeFieldName, programAttributeFieldValue, addressSearchResultsConfig,
                               patientSearchResultsConfig, filterOnAllIdentifiers) {
            var config = {
                params: {
                    q: query,
                    identifier: identifier,
                    s: "byIdOrNameOrVillage",
                    addressFieldName: addressFieldName,
                    addressFieldValue: addressFieldValue,
                    customAttribute: customAttributeValue,
                    startIndex: offset || 0,
                    patientAttributes: customAttributeFields,
                    programAttributeFieldName: programAttributeFieldName,
                    programAttributeFieldValue: programAttributeFieldValue,
                    addressSearchResultsConfig: addressSearchResultsConfig,
                    patientSearchResultsConfig: patientSearchResultsConfig,
                    loginLocationUuid: sessionService.getLoginLocationUuid(),
                    filterOnAllIdentifiers: filterOnAllIdentifiers
                },
                withCredentials: true
            };
            return patientServiceStrategy.search(config);
        };

        var searchByIdentifier = function (identifier) {
            var patientSearchUrl = Bahmni.Common.Constants.bahmniDistroPatientSearchWithCustomerUrl;
            return $http.get(patientSearchUrl, {
                method: "GET",
                params: {
                    patientAttributes: "phoneNumber",
                    identifier: identifier,
                    loginLocationUuid: sessionService.getLoginLocationUuid()
                },
                withCredentials: true
            });
        };

        var searchByNameOrIdentifier = function (query, limit) {
            return $http.get(Bahmni.Common.Constants.bahmniCommonsSearchUrl + "/patient/lucene", {
                method: "GET",
                params: {
                    identifier: query,
                    filterOnAllIdentifiers: true,
                    q: query,
                    s: "byIdOrName",
                    limit: limit,
                    loginLocationUuid: sessionService.getLoginLocationUuid()
                },
                withCredentials: true
            }).then(function (response) {
                var patients = response.data.pageOfResults || [];

                var requests = patients.map(function (patient) {
                    return $http.get(
                        Bahmni.Registration.Constants.basePatientUrl + patient.uuid,
                        {
                            method: "GET",
                            params: {
                                v: "full"
                            },
                            withCredentials: true
                        }
                    ).then(function (patientResponse) {
                        var fullPatient = patientResponse.data;

                        var attributes = [];

                        if (fullPatient.person && fullPatient.person.attributes) {
                            attributes = fullPatient.person.attributes;
                        }

                        var employeeIdAttribute = _.find(attributes, function (attribute) {
                            return attribute.attributeType &&
                                attribute.attributeType.display === "Employee ID";
                        });

                        var patientTypeAttribute = _.find(attributes, function (attribute) {
                            return attribute.attributeType &&
                                attribute.attributeType.display === "Patient Type";
                        });

                        patient.employeeId = employeeIdAttribute ?
                            employeeIdAttribute.value : null;

                        patient.patientType = patientTypeAttribute ?
                            patientTypeAttribute.value : null;

                        return patient;
                    }, function () {
                        patient.employeeId = null;
                        return patient;
                    }); });

                return $q.all(requests).then(function (updatedPatients) {
                    var selfPatients = updatedPatients.filter(function (patient) {
                        return patient.patientType &&
                            (
                                patient.patientType.display === "Self" || patient.patientType === "Self"
                            );
                    });

                    response.data.pageOfResults = selfPatients;
                    response.data.totalCount = selfPatients.length;

                    return response;
                });
            });
        };

        var get = function (uuid) {
            return patientServiceStrategy.get(uuid);
        };

        var create = function (patient, jumpAccepted) {
            return patientServiceStrategy.create(patient, jumpAccepted);
        };

        var update = function (patient, openMRSPatient) {
            return patientServiceStrategy.update(patient, openMRSPatient, $rootScope.patientConfiguration.attributeTypes);
        };

        var getAllPatientIdentifiers = function (uuid) {
            var url = Bahmni.Registration.Constants.basePatientUrl + uuid + "/identifier";
            return $http.get(url, {
                method: "GET",
                params: {
                    includeAll: true
                },
                withCredentials: true
            });
        };

        var updateImage = function (uuid, image) {
            var url = baseOpenMRSRESTURL + "/personimage/";
            var data = {
                "person": {"uuid": uuid},
                "base64EncodedImage": image
            };
            var config = {
                withCredentials: true,
                headers: {"Accept": "application/json", "Content-Type": "application/json"}
            };
            return $http.post(url, data, config);
        };

        var getRegistrationMessage = function (patientId, name, age, gender) {
            var locationName = $rootScope.facilityVisitLocation && $rootScope.facilityVisitLocation.name ? $rootScope.facilityVisitLocation.name : $rootScope.loggedInLocation.name;
            var message = $translate.instant(appService.getAppDescriptor().getConfigValue("registrationMessage") || Bahmni.Registration.Constants.registrationMessage);
            message = message.replace("#clinicName", locationName);
            message = message.replace("#patientId", patientId);
            message = message.replace("#name", name);
            message = message.replace("#age", age);
            message = message.replace("#gender", gender);
            message = message.replace("#helpDeskNumber", $rootScope.helpDeskNumber);
            return message;
        };

        var searchDuplicatePersonAttributePatients = function (pa) {
            var loginLocation = '&loginLocationUuid=' + loginLocationUuid;
            var finalPatientSearchUrl = patientSearchByPersonAttributeUrl + pa + loginLocation;
            return $http.get(finalPatientSearchUrl, {
                method: "GET",
                withCredentials: true
            });
        };

        return {
            search: search,
            searchByIdentifier: searchByIdentifier,
            create: create,
            update: update,
            get: get,
            updateImage: updateImage,
            searchByNameOrIdentifier: searchByNameOrIdentifier,
            getAllPatientIdentifiers: getAllPatientIdentifiers,
            getRegistrationMessage: getRegistrationMessage,
            searchDuplicatePersonAttributePatients: searchDuplicatePersonAttributePatients
        };
    }]);
