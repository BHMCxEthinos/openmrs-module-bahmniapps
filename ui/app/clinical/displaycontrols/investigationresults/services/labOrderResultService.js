'use strict';

angular.module('bahmni.clinical')
    .factory('labOrderResultService', ['$http', '$q', 'configurationService', 'appService', '$bahmniCookieStore', 'diagnosticReportService', 'orderTypeService',
        function ($http, $q, configurationService, appService, $bahmniCookieStore, diagnosticReportService, orderTypeService) {
            var allTestsAndPanelsConcept = {};
            configurationService.getConfigurations(['allTestsAndPanelsConcept']).then(function (configurations) {
                allTestsAndPanelsConcept = configurations.allTestsAndPanelsConcept.results[0];
            });
            var sanitizeData = function (labOrderResults) {
                labOrderResults.forEach(function (result) {
                    result.accessionDateTime = Bahmni.Common.Util.DateUtil.parse(result.accessionDateTime);
                    result.hasRange = result.minNormal || result.maxNormal;
                });
            };

            var groupLabOrdersByPanel = function (labOrders) {
                var panels = {};
                var accessionGroup = [];
                if (labOrders) {
                    labOrders.forEach(function (labOrder) {
                        if (!labOrder.panelName) {
                            labOrder.isPanel = false;
                            labOrder.orderName = labOrder.testName;
                            accessionGroup.push(labOrder);
                        } else {
                            panels[labOrder.panelName] = panels[labOrder.panelName] || {
                                accessionDateTime: labOrder.accessionDateTime,
                                orderName: labOrder.panelName,
                                tests: [],
                                isPanel: true
                            };
                            panels[labOrder.panelName].tests.push(labOrder);
                        }
                    });
                }
                _.values(panels).forEach(function (value) {
                    accessionGroup.push(value);
                });
                return accessionGroup;
            };

            var groupByPanel = function (accessions) {
                var grouped = [];
                accessions.forEach(function (labOrders) {
                    grouped.push(groupLabOrdersByPanel(labOrders));
                });
                return grouped;
            };

            var flattened = function (accessions) {
                return accessions.map(
                    function (results) {
                        var flattenedResults = _(results).map(
                            function (result) {
                                return result.isPanel === true ? [result, result.tests] : result;
                            }).flattenDeep().value();
                        return flattenedResults;
                    }
                );
            };

            var flattenedTabularData = function (results) {
                var flattenedResults = _(results).map(
                    function (result) {
                        return result.isPanel === true ? [result, result.tests] : result;
                    }
                ).flattenDeep().value();
                return flattenedResults;
            };

            var transformGroupSort = function (results, initialAccessionCount, latestAccessionCount, sortResultColumnsLatestFirst, groupOrdersByPanel) {
                var labOrderResults = results.results;
                sanitizeData(labOrderResults);

                var accessionConfig = {
                    initialAccessionCount: initialAccessionCount,
                    latestAccessionCount: latestAccessionCount
                };

                var tabularResult = new Bahmni.Clinical.TabularLabOrderResults(results.tabularResult, accessionConfig, sortResultColumnsLatestFirst);
                if (groupOrdersByPanel) {
                    tabularResult.tabularResult.orders = groupLabOrdersByPanel(tabularResult.tabularResult.orders);
                }
                var accessions = _.groupBy(labOrderResults, function (labOrderResult) {
                    return labOrderResult.accessionUuid;
                });
                accessions = _.sortBy(accessions, function (accession) {
                    return accession[0].accessionDateTime;
                });

                if (accessionConfig.initialAccessionCount || accessionConfig.latestAccessionCount) {
                    var initial = _.take(accessions, accessionConfig.initialAccessionCount || 0);
                    var latest = _.takeRight(accessions, accessionConfig.latestAccessionCount || 0);

                    accessions = _.union(initial, latest);
                }
                accessions.reverse();
                return {
                    accessions: groupByPanel(accessions),
                    tabularResult: tabularResult
                };
            };

            var isFhirLabResultsEnabled = function () {
                return (appService.getAppDescriptor() &&
                    appService.getAppDescriptor().getConfigValue('enableFhirLabResults')) || false;
            };

            var getLabOrderCategoryUuid = function () {
                var labOrderTypeName = Bahmni.Clinical.Constants.labOrderType;
                var categoryUuid = orderTypeService.getOrderTypeUuid(labOrderTypeName);
                if (categoryUuid) {
                    return categoryUuid;
                }
                var labOrderType = _.find(orderTypeService.orderTypes || [], function (orderType) {
                    return orderType.display &&
                        orderType.display.toLowerCase() === labOrderTypeName.toLowerCase();
                });
                return labOrderType ? labOrderType.uuid : null;
            };

            var fetchReportBundles = function (reportsData) {
                return reportsData.map(function (reportData) {
                    return diagnosticReportService.getDiagnosticReportBundle(reportData.id).then(function (response) {
                        return {bundle: response.data, reportName: reportData.reportName};
                    }, function () {
                        return $q.reject('Failed to fetch diagnostic report bundle');
                    });
                });
            };

            var getAllForPatientFromFhir = function (params) {
                var categoryUuid = getLabOrderCategoryUuid();
                var serviceRequestsPromise = categoryUuid ?
                    diagnosticReportService.getServiceRequests(params.patientUuid, categoryUuid, params.numberOfVisits) :
                    $q.when({data: {entry: []}});

                return serviceRequestsPromise.then(function (serviceRequestResponse) {
                    var basedOnUuids = Bahmni.Clinical.FhirLabOrderResultsMapper.extractServiceRequestIds(serviceRequestResponse.data);
                    return diagnosticReportService.getDiagnosticReports(params.patientUuid, basedOnUuids);
                }).then(function (diagnosticReportsResponse) {
                    var reportsData = Bahmni.Clinical.FhirLabOrderResultsMapper.extractProcessedReportData(diagnosticReportsResponse.data);
                    var bundlesPromises = fetchReportBundles(reportsData);
                    return $q.all(bundlesPromises);
                }).then(function (bundlesData) {
                    return Bahmni.Clinical.FhirLabOrderResultsMapper.mapBundlesToLabOrderResults(bundlesData);
                });
            };

            var getAllForPatientFromBahmniCore = function (params) {
                var deferred = $q.defer();
                var paramsToBeSent = {};
                if (params.visitUuids) {
                    paramsToBeSent.visitUuids = params.visitUuids;
                } else {
                    if (!params.patientUuid) {
                        deferred.reject('patient uuid is mandatory');
                        return deferred.promise;
                    }
                    paramsToBeSent.patientUuid = params.patientUuid;
                    if (params.numberOfVisits !== 0) {
                        paramsToBeSent.numberOfVisits = params.numberOfVisits;
                    }
                }
                var labResultsUrl = Bahmni.Common.Constants.bahmniLabOrderResultsUrl;
                var userInSession = $bahmniCookieStore.get(Bahmni.Common.Constants.currentUser);
                if (userInSession) {
                    var restrictLocationToUser = (appService.getAppDescriptor() && appService.getAppDescriptor().getConfigValue('restrictLocationToUser')) || false;
                    if (restrictLocationToUser) {
                        labResultsUrl = Bahmni.Common.Constants.bahmniDistroLabOrderResultsUrl;
                    }
                }
                $http.get(labResultsUrl, {
                    method: "GET",
                    params: paramsToBeSent,
                    withCredentials: true
                }).then(function (response) {
                    deferred.resolve(response.data);
                }, function (error) {
                    deferred.reject(error);
                });

                return deferred.promise;
            };

            var buildResultObject = function (results, params) {
                var transformed = transformGroupSort(results, params.initialAccessionCount, params.latestAccessionCount, params.sortResultColumnsLatestFirst, params.groupOrdersByPanel);
                var sortedConceptSet = new Bahmni.Clinical.ConceptWeightBasedSorter(allTestsAndPanelsConcept);
                transformed.tabularResult.tabularResult.orders = sortedConceptSet.sortTestResults(transformed.tabularResult.tabularResult.orders);
                var resultObject = {
                    labAccessions: flattened(transformed.accessions.map(sortedConceptSet.sortTestResults)),
                    tabular: transformed.tabularResult
                };
                if (params.groupOrdersByPanel) {
                    resultObject.tabular.tabularResult.orders = flattenedTabularData(resultObject.tabular.tabularResult.orders);
                }
                return resultObject;
            };

            var getAllForPatient = function (params) {
                if (!params.patientUuid) {
                    return $q.reject('patient uuid is mandatory');
                }
                var resultsPromise = params.patientUuid && isFhirLabResultsEnabled() ?
                    getAllForPatientFromFhir(params) :
                    getAllForPatientFromBahmniCore(params);

                return resultsPromise.then(function (results) {
                    return buildResultObject(results, params);
                });
            };

            return {
                getAllForPatient: getAllForPatient
            };
        }]);
