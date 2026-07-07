'use strict';

angular.module('bahmni.admin')
    .service('customerOnboardingService', ['$http', '$q', function ($http, $q) {
        var customerTagName = "Customer";
        var loginLocationTagName = "Login Location";
        var loginLocationProviderAttributeName = "Login Locations";
        var locationRepresentation = "custom:(uuid,name,display,description,parentLocation:(uuid,name),tags:(uuid,name),address1,address2,cityVillage,stateProvince,country,postalCode,attributes:(uuid,attributeType:(uuid,display),value,voided))";
        var userRepresentation = "custom:(uuid,username,display,person:(uuid,display),userProperties,roles:(uuid,name,display))";
        var userDetailsRepresentation = "custom:(uuid,username,display,person:(uuid,gender,preferredName:(givenName,familyName)),roles:(uuid,name,display),userProperties)";
        var providerRepresentation = "custom:(uuid,person:(uuid),attributes:(uuid,attributeType:(uuid,display),value:(uuid,name),voided))";
        var locationPhoneAttributeTypeName = "Phone Number";
        var locationEmailAttributeTypeName = "Email";
        var locationWebsiteAttributeTypeName = "Website";
        var locationAbdmHfrIdAttributeTypeName = "ABDM HFR ID";
        var locationAbdmHfrNameAttributeTypeName = "ABDM HFR Name";

        var getTagsByName = function (name) {
            return $http.get(Bahmni.Common.Constants.openmrsUrl + "/ws/rest/v1/locationtag", {
                params: {
                    q: name,
                    v: "default"
                    // limit: 20
                }
            }).then(function (response) {
                return response.data.results || [];
            });
        };

        var findByName = function (list, name) {
            var expected = (name || "").toLowerCase();
            return _.find(list, function (item) {
                return (item.display || "").toLowerCase() === expected || (item.name || "").toLowerCase() === expected;
            });
        };

        var getProviderAttributeTypesByName = function (name) {
            return $http.get(Bahmni.Common.Constants.openmrsUrl + "/ws/rest/v1/providerattributetype", {
                params: {
                    q: name,
                    v: "custom:(uuid,display)"
                    // limit: 20
                }
            }).then(function (response) {
                return response.data.results || [];
            });
        };

        var getLocationAttributeTypesByName = function (name) {
            return $http.get(Bahmni.Common.Constants.openmrsUrl + "/ws/rest/v1/locationattributetype", {
                params: {
                    q: name,
                    v: "custom:(uuid,name,display)"
                    // limit: 20
                }
            }).then(function (response) {
                return response.data.results || [];
            });
        };

        var getAllLocations = function () {
            return $http.get(Bahmni.Common.Constants.locationUrl, {
                params: {
                    v: locationRepresentation
                    // limit: 1000
                }
            }).then(function (response) {
                return response.data.results || [];
            });
        };

        this.loadReferenceData = function () {
            return $q.all([
                getTagsByName(customerTagName),
                getTagsByName(loginLocationTagName),
                getProviderAttributeTypesByName(loginLocationProviderAttributeName),
                getLocationAttributeTypesByName(locationPhoneAttributeTypeName),
                getLocationAttributeTypesByName(locationEmailAttributeTypeName),
                getLocationAttributeTypesByName(locationWebsiteAttributeTypeName),
                getLocationAttributeTypesByName(locationAbdmHfrIdAttributeTypeName),
                getLocationAttributeTypesByName(locationAbdmHfrNameAttributeTypeName)
            ]).then(function (response) {
                return {
                    customerTag: findByName(response[0], customerTagName),
                    loginLocationTag: findByName(response[1], loginLocationTagName),
                    loginLocationProviderAttributeType: findByName(response[2], loginLocationProviderAttributeName),
                    locationPhoneAttributeType: findByName(response[3], locationPhoneAttributeTypeName),
                    locationEmailAttributeType: findByName(response[4], locationEmailAttributeTypeName),
                    locationWebsiteAttributeType: findByName(response[5], locationWebsiteAttributeTypeName),
                    locationAbdmHfrIdAttributeType: findByName(response[6], locationAbdmHfrIdAttributeTypeName),
                    locationAbdmHfrNameAttributeType: findByName(response[7], locationAbdmHfrNameAttributeTypeName)
                };
            });
        };

        var buildLocationAttributesPayload = function (location, locationAttributeTypeMap) {
            var attributes = [];
            var existingAttributes = (location.existingAttributes || []).filter(function (attribute) {
                return !attribute.voided && attribute.attributeType && attribute.attributeType.uuid;
            });
            var findExisting = function (attributeTypeUuid) {
                return _.find(existingAttributes, function (attribute) {
                    return attribute.attributeType.uuid === attributeTypeUuid;
                });
            };
            var addOrUpdate = function (attributeTypeUuid, value) {
                if (!attributeTypeUuid || _.isUndefined(value) || value === null || value === "") {
                    return;
                }
                var existing = findExisting(attributeTypeUuid);
                var payload = {
                    attributeType: attributeTypeUuid,
                    value: value
                };
                if (existing && existing.uuid) {
                    payload.uuid = existing.uuid;
                }
                attributes.push(payload);
            };

            addOrUpdate(locationAttributeTypeMap.phoneAttributeTypeUuid, location.phoneNumber);
            addOrUpdate(locationAttributeTypeMap.emailAttributeTypeUuid, location.email);
            addOrUpdate(locationAttributeTypeMap.websiteAttributeTypeUuid, location.website);
            addOrUpdate(locationAttributeTypeMap.abdmHfrIdAttributeTypeUuid, location.abdmHfrId);
            addOrUpdate(locationAttributeTypeMap.abdmHfrNameAttributeTypeUuid, location.abdmHfrName);
            return attributes;
        };

        this.getCustomers = function (customerTagNameToFilter) {
            return getAllLocations().then(function (locations) {
                return _.filter(locations, function (location) {
                    var hasCustomerTag = _.some(location.tags || [], function (tag) {
                        return tag.name === customerTagNameToFilter;
                    });
                    // Customer must be a base/root location (no parent).
                    return hasCustomerTag && !location.parentLocation;
                });
            });
        };

        this.saveCustomer = function (customer, customerTagUuid, locationAttributeTypeMap) {
            var payload = {
                name: customer.name,
                description: customer.description || "",
                tags: [{uuid: customerTagUuid}],
                address1: customer.address1,
                address2: customer.address2,
                cityVillage: customer.cityVillage,
                stateProvince: customer.stateProvince,
                country: customer.country,
                postalCode: customer.postalCode,
                attributes: buildLocationAttributesPayload(customer, locationAttributeTypeMap || {})
            };
            // Persist customer strictly as a base/root location.
            payload.parentLocation = null;
            if (customer.uuid) {
                payload.uuid = customer.uuid;
            }
            var url = customer.uuid ? Bahmni.Common.Constants.locationUrl + "/" + customer.uuid : Bahmni.Common.Constants.locationUrl;
            return $http.post(url, payload, {withCredentials: true});
        };

        var belongsToCustomer = function (location, customerUuid, locationsByUuid) {
            if (!location || !customerUuid || location.uuid === customerUuid) {
                return false;
            }
            var current = location;
            var depth = 0;
            while (current && current.parentLocation && depth < 100) {
                if (current.parentLocation.uuid === customerUuid) {
                    return true;
                }
                current = locationsByUuid[current.parentLocation.uuid];
                depth++;
            }
            return false;
        };

        this.getCustomerLocations = function (customerUuid) {
            return getAllLocations().then(function (locations) {
                var locationsByUuid = _.keyBy(locations, "uuid");
                return _.filter(locations, function (location) {
                    return belongsToCustomer(location, customerUuid, locationsByUuid);
                });
            });
        };

        this.saveCustomerLocation = function (customerUuid, location, loginLocationTagUuid, locationAttributeTypeMap) {
            var tags = (location.tags || []).slice(0);
            var hasLoginLocation = !!_.find(tags, function (tag) {
                return tag.name === loginLocationTagName || tag.uuid === loginLocationTagUuid;
            });
            if (location.isLoginLocation && !hasLoginLocation && loginLocationTagUuid) {
                tags.push({uuid: loginLocationTagUuid});
            }
            if (!location.isLoginLocation) {
                tags = _.filter(tags, function (tag) {
                    return tag.name !== loginLocationTagName && tag.uuid !== loginLocationTagUuid;
                });
            }
            var payload = {
                name: location.name,
                description: location.description || "",
                parentLocation: {uuid: customerUuid},
                tags: _.map(tags, function (tag) {
                    return {uuid: tag.uuid};
                }),
                address1: location.address1,
                address2: location.address2,
                cityVillage: location.cityVillage,
                stateProvince: location.stateProvince,
                country: location.country,
                postalCode: location.postalCode,
                attributes: buildLocationAttributesPayload(location, locationAttributeTypeMap || {})
            };
            if (location.uuid) {
                payload.uuid = location.uuid;
            }
            var url = location.uuid ? Bahmni.Common.Constants.locationUrl + "/" + location.uuid : Bahmni.Common.Constants.locationUrl;
            return $http.post(url, payload, {withCredentials: true});
        };

        this.searchUsers = function (query) {
            return $http.get(Bahmni.Common.Constants.userUrl, {
                params: {
                    q: query || "",
                    // limit: 25,
                    v: userRepresentation
                }
            }).then(function (response) {
                return response.data.results || [];
            });
        };

        this.getUserByUuid = function (userUuid) {
            return $http.get(Bahmni.Common.Constants.userUrl + "/" + userUuid, {
                params: {
                    v: userDetailsRepresentation
                }
            }).then(function (response) {
                return response.data;
            });
        };

        this.getRoles = function () {
            return $http.get(Bahmni.Common.Constants.openmrsUrl + "/ws/rest/v1/role", {
                params: {
                    v: "custom:(uuid,display,name)"
                    // limit: 200
                }
            }).then(function (response) {
                return response.data.results || [];
            });
        };

        this.saveUser = function (userPayload) {
            return $http.post(Bahmni.Common.Constants.bahmniDistroUserProviderSaveUrl, userPayload, {withCredentials: true}).then(function (response) {
                return response.data;
            });
        };

        this.getProviderByUser = function (userUuid) {
            return $http.get(Bahmni.Common.Constants.providerUrl, {
                params: {
                    user: userUuid,
                    v: providerRepresentation
                }
            }).then(function (response) {
                return (response.data.results || [])[0];
            });
        };

        // this.saveUserProperties = function (userUuid, userProperties) {
        //     return $http.post(Bahmni.Common.Constants.userUrl + "/" + userUuid, {
        //         uuid: userUuid,
        //         userProperties: userProperties
        //     }, {withCredentials: true});
        // };

        // this.addProviderLoginLocation = function (providerUuid, attributeTypeUuid, locationUuid) {
        //     return $http.post(Bahmni.Common.Constants.providerAttributeUrl.replace("{{providerUuid}}", providerUuid), {
        //         attributeType: attributeTypeUuid,
        //         value: locationUuid
        //     }, {withCredentials: true});
        // };

        // this.voidProviderAttribute = function (providerUuid, attributeUuid) {
        //     return $http.delete(Bahmni.Common.Constants.providerUrl + "/" + providerUuid + "/attribute/" + attributeUuid, {
        //         withCredentials: true
        //     });
        // };

        this.constants = {
            customerTagName: customerTagName,
            loginLocationTagName: loginLocationTagName,
            loginLocationProviderAttributeName: loginLocationProviderAttributeName,
            locationPhoneAttributeTypeName: locationPhoneAttributeTypeName,
            locationEmailAttributeTypeName: locationEmailAttributeTypeName,
            locationWebsiteAttributeTypeName: locationWebsiteAttributeTypeName,
            locationAbdmHfrIdAttributeTypeName: locationAbdmHfrIdAttributeTypeName,
            locationAbdmHfrNameAttributeTypeName: locationAbdmHfrNameAttributeTypeName
        };
    }]);
