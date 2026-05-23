'use strict';

angular.module('bahmni.common.domain')
    .factory('dispositionService', ['$http', '$rootScope', '$bahmniCookieStore', 'appService', function ($http, $rootScope, $bahmniCookieStore, appService) {
        var getDispositionActions = function () {
            return $http.get(Bahmni.Common.Constants.conceptSearchByFullNameUrl +
                "&name=" + Bahmni.Common.Constants.dispositionConcept +
                "&v=custom:(uuid,name,answers:(uuid,name,mappings))", {cache: true});
        };

        var getDispositionNoteConcept = function () {
            return $http.get(Bahmni.Common.Constants.conceptSearchByFullNameUrl +
                "&name=" + Bahmni.Common.Constants.dispositionNoteConcept +
                "&v=custom:(uuid,name:(name))", {cache: true});
        };

        var getDispositionByVisit = function (visitUuid) {
            return $http.get(Bahmni.Common.Constants.bahmniDispositionByVisitUrl, {
                params: {visitUuid: visitUuid,
                    locale: window.localStorage["NG_TRANSLATE_LANG_KEY"] || "en"}
            });
        };

        var getDispositionByPatient = function (patientUuid, numberOfVisits) {
            var dispositionUrl = Bahmni.Common.Constants.bahmniDispositionByPatientUrl;
            var userInSession = $bahmniCookieStore.get(Bahmni.Common.Constants.currentUser);
            if (userInSession) {
                var restrictLocationToUser = (appService.getAppDescriptor() && appService.getAppDescriptor().getConfigValue('restrictLocationToUser')) || false;
                if (restrictLocationToUser) {
                    dispositionUrl = Bahmni.Common.Constants.bahmniDistroDispositionByPatientUrl;
                }
            }
            return $http.get(dispositionUrl, {
                params: {
                    patientUuid: patientUuid,
                    numberOfVisits: numberOfVisits,
                    locale: window.localStorage["NG_TRANSLATE_LANG_KEY"] || "en"
                }
            });
        };

        return {
            getDispositionActions: getDispositionActions,
            getDispositionNoteConcept: getDispositionNoteConcept,
            getDispositionByVisit: getDispositionByVisit,
            getDispositionByPatient: getDispositionByPatient
        };
    }]);
