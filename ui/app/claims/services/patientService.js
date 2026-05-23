'use strict';

angular.module('bahmni.claims')
    .factory('patientService', ['$http', '$rootScope', '$bahmniCookieStore', '$q', 'sessionService', '$translate', 'appService', function ($http, $rootScope, $bahmniCookieStore, $q, sessionService, $translate, appService) {
        var openmrsUrl = Bahmni.Common.Constants.openmrsUrl;

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
            var defer = $q.defer();
            var patientSearchUrl = Bahmni.Common.Constants.bahmniCommonsSearchUrl + "/patient";
            if (config && config.params.identifier) {
                patientSearchUrl = Bahmni.Common.Constants.bahmniCommonsSearchUrl + "/patient/lucene";
            }
            var onResults = function (result) {
                defer.resolve(result);
            };
            $http.get(patientSearchUrl, config).success(onResults)
                .error(function (error) {
                    defer.reject(error);
                });
            return defer.promise;
        };

        var searchByIdentifier = function (identifier) {
            return $http.get(Bahmni.Common.Constants.bahmniCommonsSearchUrl + "/patient", {
                method: "GET",
                params: {
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
            });
        };

        var get = function (uuid) {
            var url = openmrsUrl + "/ws/rest/v1/patientprofile/" + uuid;
            var config = {
                method: "GET",
                params: {v: "full"},
                withCredentials: true
            };

            var defer = $q.defer();
            $http.get(url, config).success(function (result) {
                defer.resolve(result);
            });
            return defer.promise;
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
            searchByNameOrIdentifier: searchByNameOrIdentifier,
            getAllPatientIdentifiers: getAllPatientIdentifiers,
            getRegistrationMessage: getRegistrationMessage,
            searchDuplicatePersonAttributePatients: searchDuplicatePersonAttributePatients
        };
    }]);
