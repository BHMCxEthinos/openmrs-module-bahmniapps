'use strict';

var Bahmni = Bahmni || {};
Bahmni.Claims = Bahmni.Claims || {};

angular.module('bahmni.claims', ['bahmni.common.uiHelper', 'bahmni.common.domain', 'bahmni.common.util', 'bahmni.common.config',
    'bahmni.common.orders', 'bahmni.common.appFramework', 'bahmni.common.logging', 'ui.router', 'angularFileUpload', 'bahmni.common.patient']);
