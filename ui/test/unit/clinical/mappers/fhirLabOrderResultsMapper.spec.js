'use strict';

describe("Bahmni.Clinical.FhirLabOrderResultsMapper", function () {
    var mapper = Bahmni.Clinical.FhirLabOrderResultsMapper;

    it("should extract processed diagnostic report ids", function () {
        var bundle = {
            entry: [
                {resource: {resourceType: "DiagnosticReport", id: "r1", status: "final"}},
                {resource: {resourceType: "DiagnosticReport", id: "r2", status: "registered"}},
                {resource: {resourceType: "Observation", id: "o1"}}
            ]
        };

        expect(mapper.extractProcessedReportIds(bundle)).toEqual(["r1"]);
    });

    it("should map diagnostic report bundles to bahmni lab order results", function () {
        var bundles = [{
            entry: [
                {
                    resource: {
                        resourceType: "DiagnosticReport",
                        id: "report-1",
                        status: "final",
                        issued: "2024-05-30T10:00:00+00:00",
                        performer: [{display: "Lab Tech"}]
                    }
                },
                {
                    resource: {
                        resourceType: "Observation",
                        id: "obs-1",
                        code: {text: "Haemoglobin"},
                        issued: "2024-05-30T10:00:00+00:00",
                        valueQuantity: {value: 12.5, unit: "g/dL"},
                        interpretation: [{coding: [{code: "N"}]}],
                        referenceRange: [{
                            type: {coding: [{code: "normal"}]},
                            low: {value: 12},
                            high: {value: 15}
                        }]
                    }
                }
            ]
        }];

        var mapped = mapper.mapBundlesToLabOrderResults(bundles);

        expect(mapped.results.length).toBe(1);
        expect(mapped.results[0].testName).toBe("Haemoglobin");
        expect(mapped.results[0].result).toBe("12.5");
        expect(mapped.results[0].testUnitOfMeasurement).toBe("g/dL");
        expect(mapped.results[0].abnormal).toBe(false);
        expect(mapped.results[0].minNormal).toBe(12);
        expect(mapped.results[0].maxNormal).toBe(15);
        expect(mapped.tabularResult.orders.length).toBe(1);
        expect(mapped.tabularResult.values[0].result).toBe("12.5");
    });
});
