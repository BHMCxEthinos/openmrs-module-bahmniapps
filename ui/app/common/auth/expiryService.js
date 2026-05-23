'use strict';

angular.module('authentication')
    .service('expiryService', ['$bahmniCookieStore', '$http', '$q', function ($bahmniCookieStore, $http, $q) {
        const COOKIE_KEY = 'expiryDate';

        this.fetchLicenseCheckType = function () {
            return $http.get(Bahmni.Common.Constants.globalPropertyUrl, {
                params: {
                    property: 'admin.licExpType'
                },
                withCredentials: true,
                headers: {
                    Accept: 'text/plain'
                }
            });
        };

        this.fetchImplementationDetails = function () {
            return $http.get(Bahmni.Common.Constants.implementationId).then(function (response) {
                return response.data;
            });
        };

        this.fetchAndStoreExpiry = function (name, implementationId) {
            return $http.get(Bahmni.Common.Constants.fetchExpiryDate,
                { params: {
                    hospitalName: name,
                    implementationId: implementationId
                }}).then(function (response) {
                    const expiryDate = new Date(response.data.validityEndDate);
                    $bahmniCookieStore.put(COOKIE_KEY, expiryDate.toISOString());
                    return expiryDate;
                });
        };

        this.getStoredExpiry = function () {
            const stored = $bahmniCookieStore.get(COOKIE_KEY);
            return stored ? new Date(stored) : null;
        };

        this.isExpired = function (expiry) {
            return !expiry || new Date() > expiry;
        };
    }]);
