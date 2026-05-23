'use strict';

angular.module('bahmni.claims')
.factory('nhcxService', ['$http', '$q', function ($http, $q) {
    var BASE_URL = '/nhcx-provider/nhcx';

    function post (path, params) {
        return $http.post(BASE_URL + path, params)
            .then(function (response) { return response; },
                  function (error) {
                      console.error('NHCX error [' + path + ']:', error.data);
                      return $q.reject(error);
                  });
    }

    return {
        submitPreauth: function (params) {
            return post('/preauth', params);
        },

        submitPredetermination: function (params) {
            return post('/predetermination', params);
        },
        submitClaim: function (params) {
            return post('/claim', params);
        },

        getStatus: function (correlationId) {
            return $http.get(BASE_URL + '/status', {
                params: { correlationId: correlationId }
            });
        },

        previewBundle: function (params) {
            return post('/preview', params);
        }
    };
}]);
