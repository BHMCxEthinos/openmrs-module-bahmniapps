'use strict';

angular.module('handnotes', ['ui.router', 'bahmni.common.config', 'bahmni.common.patient',
    'authentication', 'bahmni.common.appFramework', 'ngDialog', 'httpErrorInterceptor', 'bahmni.common.domain', 'bahmni.common.i18n',
    'ngClipboard', 'ngSanitize', 'bahmni.common.uiHelper', 'bahmni.common.patientSearch', 'bahmni.common.util', 'bahmni.common.gallery',
    'bahmni.common.routeErrorHandler', 'pascalprecht.translate', 'ngCookies', 'bahmni.handnotes']);
angular.module('handnotes').config(['$stateProvider', '$httpProvider', '$urlRouterProvider', '$bahmniTranslateProvider', '$compileProvider',
    function ($stateProvider, $httpProvider, $urlRouterProvider, $bahmniTranslateProvider, $compileProvider) {
        $urlRouterProvider.otherwise('/search');
        var patientSearchBackLink = {label: "", state: "search", accessKey: "p", id: "patients-link", icon: "fa-users"};
        var homeBackLink = {label: "", url: "../home/", accessKey: "h", icon: "fa-home"};

        // @if DEBUG='production'
        $compileProvider.debugInfoEnabled(false);
        // @endif

        // @if DEBUG='development'
        $compileProvider.debugInfoEnabled(true);
        // @endif
        $stateProvider.state('search', {
            url: '/search',
            data: {
                backLinks: [homeBackLink]
            },
            views: {
                'content': {
                    templateUrl: '../common/patient-search/views/patientsList.html',
                    controller: 'PatientsListController'
                },
                'additional-header': {
                    templateUrl: '../common/ui-helper/header.html'
                }
            },
            resolve: {
                initialization: 'initialization'
            }
        })
            .state('notes', {
                url: '/patient/:patientUuid/notes',
                data: {
                    backLinks: [homeBackLink, patientSearchBackLink]
                },
                views: {
                    'header': {
                        templateUrl: 'views/patientHeader.html'
                    },
                    'content': {
                        templateUrl: 'views/handNotes.html',
                        controller: 'HandNotesController'
                    }
                },
                resolve: {
                    patientResolution: function ($stateParams, patientInitialization) {
                        return patientInitialization($stateParams.patientUuid);
                    }
                }
            })
            .state('error', {
                url: '/error',
                views: {
                    'content': {
                        templateUrl: '../common/ui-helper/error.html'
                    }
                }
            });

        $httpProvider.defaults.headers.common['Disable-WWW-Authenticate'] = true;
        $bahmniTranslateProvider.init({app: 'handnotes', shouldMerge: true});
    }]).run(['backlinkService', '$window', function (backlinkService, $window) {
        FastClick.attach(document.body);
        moment.locale($window.localStorage["NG_TRANSLATE_LANG_KEY"] || "en");
        backlinkService.addBackUrl();
    }]);
