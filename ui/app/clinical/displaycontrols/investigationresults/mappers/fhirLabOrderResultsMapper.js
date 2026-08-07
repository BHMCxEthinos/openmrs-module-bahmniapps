'use strict';

Bahmni.Clinical.FhirLabOrderResultsMapper = (function () {
    var PROCESSED_STATUSES = Bahmni.Common.Constants.fhirProcessedDiagnosticReportStatuses;

    var getResourceIdFromReference = function (reference) {
        if (!reference) {
            return null;
        }
        var parts = reference.split('/');
        return parts[parts.length - 1];
    };

    var extractEntriesByType = function (bundle, resourceType) {
        if (!bundle || !bundle.entry) {
            return [];
        }
        return _.chain(bundle.entry)
            .map(function (entry) {
                return entry.resource;
            })
            .filter(function (resource) {
                return resource && resource.resourceType === resourceType;
            })
            .value();
    };

    var isAbnormalInterpretation = function (observation) {
        var code = _.get(observation, 'interpretation[0].coding[0].code');
        if (!code) {
            return false;
        }
        return !_.includes(['N', 'normal'], code);
    };

    var getObservationValue = function (observation) {
        if (observation.valueQuantity && observation.valueQuantity.value !== undefined) {
            return String(observation.valueQuantity.value);
        }
        if (observation.valueBoolean !== undefined) {
            return observation.valueBoolean ? 'Positive' : 'Negative';
        }
        if (observation.valueInteger !== undefined) {
            return String(observation.valueInteger);
        }
        if (observation.valueString) {
            return observation.valueString;
        }
        if (observation.valueDateTime) {
            return observation.valueDateTime;
        }
        if (_.get(observation, 'valueCodeableConcept.text')) {
            return observation.valueCodeableConcept.text;
        }
        if (_.get(observation, 'valueCodeableConcept.coding[0].display')) {
            return observation.valueCodeableConcept.coding[0].display;
        }
        return null;
    };

    var getNormalRange = function (observation) {
        var ranges = observation.referenceRange || [];
        var normalRange = _.find(ranges, function (range) {
            return _.some(range.type && range.type.coding, function (coding) {
                return coding.code === 'normal';
            });
        }) || ranges[0];

        return {
            minNormal: normalRange && normalRange.low ? normalRange.low.value : null,
            maxNormal: normalRange && normalRange.high ? normalRange.high.value : null
        };
    };

    var getTestName = function (resource) {
        return _.get(resource, 'code.text') ||
            _.get(resource, 'code.coding[0].display') ||
            '';
    };

    var getAccessionDateTime = function (report, observation) {
        var dateString = _.get(observation, 'effectiveDateTime') ||
            _.get(observation, 'issued') ||
            _.get(report, 'effectiveDateTime') ||
            _.get(report, 'issued');
        return dateString ? new Date(dateString).getTime() : null;
    };

    var getUploadedFile = function (report) {
        var form = _.find(report.presentedForm || [], function (presentedForm) {
            return presentedForm.url;
        });
        if (!form) {
            return {};
        }
        return {
            uploadedFileName: form.title || form.id || 'report',
            labReportUrl: form.url
        };
    };

    var mapObservationToResult = function (observation, report, panelName) {
        var range = getNormalRange(observation);
        var fileInfo = getUploadedFile(report);
        var resultValue = getObservationValue(observation);

        return {
            accessionUuid: report.id,
            accessionDateTime: getAccessionDateTime(report, observation),
            testName: getTestName(observation),
            panelName: panelName || null,
            result: resultValue,
            abnormal: isAbnormalInterpretation(observation),
            minNormal: range.minNormal,
            maxNormal: range.maxNormal,
            testUnitOfMeasurement: _.get(observation, 'valueQuantity.unit') || null,
            notes: _.get(observation, 'note[0].text') || null,
            provider: _.get(report, 'performer[0].display') || null,
            resultDateTime: observation.issued || report.issued || null,
            uploadedFileName: fileInfo.uploadedFileName,
            labReportUrl: fileInfo.labReportUrl
        };
    };

    var getLeafObservations = function (observations, labPanelName) {
        var memberIds = {};
        observations.forEach(function (observation) {
            (observation.hasMember || []).forEach(function (member) {
                var memberId = getResourceIdFromReference(member.reference);
                if (memberId) {
                    memberIds[memberId] = true;
                }
            });
        });

        var observationById = _.keyBy(observations, 'id');
        var results = [];
        observations.forEach(function (observation) {
            if (observation.hasMember && observation.hasMember.length > 0) {
                var panelName = getTestName(observation);
                observation.hasMember.forEach(function (member) {
                    var memberId = getResourceIdFromReference(member.reference);
                    var child = observationById[memberId];
                    if (child && getObservationValue(child) !== null) {
                        results.push({observation: child, panelName: panelName});
                    }
                });
            } else if (!memberIds[observation.id] && getObservationValue(observation) !== null) {
                results.push({observation: observation, panelName: labPanelName});
            }
        });
        return results;
    };

    var buildTabularResult = function (results) {
        var orderIndexByKey = {};
        var dateIndexByKey = {};
        var orders = [];
        var dates = [];
        var values = [];

        results.forEach(function (result) {
            var orderKey = (result.panelName || '') + '|' + result.testName;
            if (orderIndexByKey[orderKey] === undefined) {
                orderIndexByKey[orderKey] = orders.length;
                orders.push({
                    index: orders.length,
                    testName: result.testName,
                    panelName: result.panelName,
                    minNormal: result.minNormal || 0.0,
                    maxNormal: result.maxNormal || 0.0,
                    testUnitOfMeasurement: result.testUnitOfMeasurement
                });
            }

            var dateKey = moment(result.accessionDateTime).format('DD-MMM-YYYY');
            if (dateIndexByKey[dateKey] === undefined) {
                dateIndexByKey[dateKey] = dates.length;
                dates.push({
                    index: dates.length,
                    date: dateKey
                });
            }

            values.push({
                testOrderIndex: orderIndexByKey[orderKey],
                dateIndex: dateIndexByKey[dateKey],
                abnormal: result.abnormal,
                result: result.result,
                accessionDateTime: result.accessionDateTime,
                uploadedFileName: result.uploadedFileName
            });
        });

        return {
            orders: orders,
            dates: dates,
            values: values
        };
    };

    var mapBundlesToLabOrderResults = function (bundlesData) {
        var results = [];

        (bundlesData || []).forEach(function (bundleData) {
            var reports = extractEntriesByType(bundleData.bundle, 'DiagnosticReport');
            var observations = extractEntriesByType(bundleData.bundle, 'Observation');
            if (reports.length === 0 || observations.length === 0) {
                return;
            }

            var report = reports[0];
            getLeafObservations(observations, bundleData.reportName).forEach(function (item) {
                results.push(mapObservationToResult(item.observation, report, item.panelName));
            });
        });

        return {
            results: results,
            tabularResult: buildTabularResult(results)
        };
    };

    var extractProcessedReportData = function (diagnosticReportBundle) {
        return extractEntriesByType(diagnosticReportBundle, 'DiagnosticReport')
            .filter(function (report) {
                return report.id && _.includes(PROCESSED_STATUSES, report.status);
            })
            .map(function (report) {
                return {id: report.id, reportName: getTestName(report)};
            });
    };

    var extractServiceRequestIds = function (serviceRequestBundle) {
        return extractEntriesByType(serviceRequestBundle, 'ServiceRequest')
            .map(function (serviceRequest) {
                return serviceRequest.id;
            })
            .filter(Boolean);
    };

    return {
        mapBundlesToLabOrderResults: mapBundlesToLabOrderResults,
        extractProcessedReportData: extractProcessedReportData,
        extractServiceRequestIds: extractServiceRequestIds
    };
})();
