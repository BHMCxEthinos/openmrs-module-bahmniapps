'use strict';

angular.module('bahmni.clinical')
    .factory('diagnosticReportService', ['$http', 'appService', function ($http, appService) {
        var getServiceRequests = function (patientUuid, categoryUuid, numberOfVisits) {
            var params = {
                _count: Bahmni.Common.Constants.fhirServiceRequestCount,
                _sort: '-_lastUpdated',
                patient: patientUuid,
                category: categoryUuid
            };
            if (numberOfVisits) {
                params.numberOfVisits = numberOfVisits;
            }
            return $http.get(Bahmni.Common.Constants.fhirServiceRequestsUrl, {
                method: "GET",
                params: params,
                withCredentials: true,
                cache: false
            });
        };

        var getDiagnosticReports = function (patientUuid, basedOnUuids) {
            var params = {
                patient: patientUuid
            };
            if (basedOnUuids && basedOnUuids.length > 0) {
                params['based-on'] = basedOnUuids.join(',');
            }
            return $http.get(Bahmni.Common.Constants.fhirDiagnosticReportsUrl, {
                method: "GET",
                params: params,
                withCredentials: true,
                cache: false
            });
        };

        var getDiagnosticReportBundle = function (reportUuid) {
            var url = appService.getAppDescriptor().formatUrl(
                Bahmni.Common.Constants.fhirDiagnosticReportBundleUrl,
                {reportUuid: reportUuid}
            );
            return $http.get(url, {
                method: "GET",
                withCredentials: true,
                cache: false
            });
        };

        return {
            getServiceRequests: getServiceRequests,
            getDiagnosticReports: getDiagnosticReports,
            getDiagnosticReportBundle: getDiagnosticReportBundle
        };
    }]);
