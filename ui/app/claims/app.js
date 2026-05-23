'use strict';

angular.module('claims', ['httpErrorInterceptor', 'bahmni.claims', 'bahmni.common.routeErrorHandler', 'ngSanitize',
    'bahmni.common.uiHelper', 'bahmni.common.config', 'bahmni.common.orders', 'bahmni.common.i18n', 'pascalprecht.translate',
    'ngCookies', 'angularFileUpload', 'bahmni.common.services', 'ngDialog']);
angular.module('claims')
    .config(['$stateProvider', '$httpProvider', '$urlRouterProvider', '$compileProvider', '$bahmniTranslateProvider',
        function ($stateProvider, $httpProvider, $urlRouterProvider, $compileProvider, $bahmniTranslateProvider) {
            $urlRouterProvider.otherwise('/search');
            var patientSearchBackLink = {label: "", state: "search", accessKey: "p", id: "patients-link", icon: "fa-users"};
            var homeBackLink = {label: "", url: "../home/", accessKey: "h", icon: "fa-home"};

            $urlRouterProvider.otherwise('/dashboard');

            $stateProvider.state('claims', {
                abstract: true,
                template: '<ui-view/>',
                resolve: {
                    initialize: 'initialization'
                }
            }).state('claims.dashboard', {
                url: '/dashboard',
                templateUrl: 'views/claimsDashboard.html',
                controller: 'ClaimsDashboardController',
                data: {
                    backLinks: [{label: "Home", accessKey: "h", url: "../home/", icon: "fa-home"}],
                    extensionPointId: 'org.bahmni.claims.dashboard'
                }
            }).state('claims.preauth', {
                url: '/preauth?patientUuid',
                templateUrl: 'views/preAuth.html',
                controller: 'NhcxController',
                data: {
                    backLinks: [{label: "Home", state: "claims.dashboard", icon: "fa-home"}]
                },
                params: {
                    patient: null
                }
            }).state('claims.coverageEligibility', {
                url: '/coverage?patientUuid',
                templateUrl: 'views/coverageEligibility.html',
                controller: 'NhcxController',
                data: {
                    backLinks: [{label: "Home", state: "claims.dashboard", icon: "fa-home"}]
                },
                params: {
                    patient: null
                }
            }).state('claims.submit', {
                url: '/submit?patientUuid',
                templateUrl: 'views/submit.html',
                controller: 'NhcxController',
                data: {
                    backLinks: [{label: "Home", state: "claims.dashboard", icon: "fa-home"}]
                },
                params: {
                    patient: null
                }
            });
            $httpProvider.defaults.headers.common['Disable-WWW-Authenticate'] = true;
            $bahmniTranslateProvider.init({app: 'claims', shouldMerge: true});
        }
    ]).run(['$rootScope', '$templateCache', '$window', function ($rootScope, $templateCache, $window) {
        moment.locale($window.localStorage["NG_TRANSLATE_LANG_KEY"] || "en");
        // Disable caching view template partials
        $rootScope.$on('$viewContentLoaded', $templateCache.removeAll);
    }]);
