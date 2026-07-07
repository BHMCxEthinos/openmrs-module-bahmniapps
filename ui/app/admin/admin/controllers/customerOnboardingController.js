'use strict';

angular.module('bahmni.admin')
    .controller('CustomerOnboardingController', ['$scope', 'spinner', 'messagingService', '$q', '$timeout', 'customerOnboardingService',
        function ($scope, spinner, messagingService, $q, $timeout, customerOnboardingService) {
            var customerMetadataPrefix = "[CustomerMeta]";
            var locationMetadataPrefix = "[LocationMeta]";
            $scope.state = {
                loading: false,
                activePanel: "customer",
                searchText: "",
                locationSearchText: "",
                userSearchText: "",
                selectedCustomer: null,
                selectedUser: null,
                showCustomerEditDetails: false,
                showCreateCustomerForm: false,
                showLocationEditDetails: false,
                showNewUserForm: false
            };
            $scope.customers = [];
            $scope.customerForm = {};
            $scope.locationForm = {};
            $scope.customerLocations = [];
            $scope.locationRows = [];
            $scope.users = [];
            $scope.roles = [];
            $scope.newUserForm = {};
            $scope.selectedUserRoleUuids = [];
            var referenceData = {};

            var notifySuccess = function (message) {
                messagingService.showMessage('info', message);
            };

            var notifyError = function (message) {
                messagingService.showMessage('error', message);
            };

            var passwordPolicyErrorMessage = "Password should be 8 characters long and should have both upper and lower case characters , at least one digit , at least one non digit";

            $scope.fieldValidation = {
                email: {
                    pattern: "^(?=.{1,40}$)(([^<>()\\[\\]\\\\.,;:\\s@\"]+(\\.[^<>()\\[\\]\\\\.,;:\\s@\"]+)*)|(\".+\"))@(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,4})$",
                    errorMessage: "Should be a valid email address"
                },
                familyName: {
                    pattern: "^[a-zA-Z]+$",
                    errorMessage: "The last name should contain only alphabets without space."
                },
                givenName: {
                    pattern: "^[a-zA-Z]+$",
                    errorMessage: "The first name should contain only alphabets without space."
                },
                phoneNumber: {
                    pattern: "^([+]91[1-9]{1}[0-9]{9})$",
                    errorMessage: "Phone Number should be 10 digits with prefix +91 eg:+91xxxxxxxxxx"
                },
                address1: {
                    pattern: "^[a-zA-Z0-9\\s,'\\-.\\/]+$",
                    errorMessage: "Only Alphanumerics and following special characters are allowed. Special characters - [ ,'-./]"
                },
                address2: {
                    pattern: "^[a-zA-Z0-9\\s,'\\-.\\/]+$",
                    errorMessage: "Only Alphanumerics and following special characters are allowed. Special characters - [ ,'-./]"
                },
                cityVillage: {
                    pattern: "^[a-zA-Z0-9\\s,'\\-.\\/]{2,}$",
                    errorMessage: "Only Alphanumerics and following special characters are allowed. Special characters - [ ,'-./]"
                },
                name: {
                    pattern: "^[a-zA-Z0-9\\s,'\\-.\\/]+$",
                    errorMessage: "Only Alphanumerics and following special characters are allowed. Special characters - [ ,'-./]"
                },
                website: {
                    pattern: "^(https?:\\/\\/)?([\\w\\-]+\\.)+[\\w\\-]+(\\/[\\w\\-./?%&=]*)?$",
                    errorMessage: "Should be a valid website URL (e.g. https://example.com)"
                }
            };

            $scope.validationRegex = {};
            angular.forEach($scope.fieldValidation, function (rule, fieldName) {
                $scope.validationRegex[fieldName] = new RegExp(rule.pattern);
            });

            var validateFieldValue = function (fieldName, value) {
                var rule = $scope.fieldValidation[fieldName];
                var trimmedValue = (value || "").trim();
                if (!rule || !trimmedValue) {
                    return null;
                }
                if (!$scope.validationRegex[fieldName].test(trimmedValue)) {
                    return rule.errorMessage;
                }
                return null;
            };

            var isValidPassword = function (password, username) {
                if (!password || password.length < 8) {
                    return false;
                }
                if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
                    return false;
                }
                if (!/\d/.test(password)) {
                    return false;
                }
                if (!/[^0-9]/.test(password)) {
                    return false;
                }
                if (username && password === username) {
                    return false;
                }
                return true;
            };

            var validateCustomerLocationForm = function (form, entityLabel) {
                if (!form || !(form.name || "").trim()) {
                    return entityLabel + " name is required.";
                }
                var nameError = validateFieldValue("name", form.name);
                if (nameError) {
                    return nameError;
                }
                var optionalFieldNames = ["email", "phoneNumber", "address1", "address2", "cityVillage", "website"];
                for (var i = 0; i < optionalFieldNames.length; i++) {
                    var fieldError = validateFieldValue(optionalFieldNames[i], form[optionalFieldNames[i]]);
                    if (fieldError) {
                        return fieldError;
                    }
                }
                return null;
            };

            var validateUserForm = function (isUpdate) {
                var form = $scope.newUserForm || {};
                if (!form.username || !form.givenName || !form.familyName) {
                    return isUpdate ? "Username, First Name and Last Name are required." : "Username, First Name, Last Name and Password are required.";
                }
                var givenNameError = validateFieldValue("givenName", form.givenName);
                if (givenNameError) {
                    return givenNameError;
                }
                var familyNameError = validateFieldValue("familyName", form.familyName);
                if (familyNameError) {
                    return familyNameError;
                }
                if (!isUpdate && !form.password) {
                    return "Username, First Name, Last Name and Password are required.";
                }
                if (form.password) {
                    if (!isValidPassword(form.password, form.username)) {
                        return passwordPolicyErrorMessage;
                    }
                    if (form.password !== form.confirmPassword) {
                        return "Password and Confirm Password should match.";
                    }
                } else if (!isUpdate) {
                    return "Username, First Name, Last Name and Password are required.";
                }
                return null;
            };

            var parseLegacyMetadata = function (description, metadataPrefix) {
                var text = description || "";
                var start = text.indexOf(metadataPrefix);
                if (start === -1) {
                    return {
                        notes: text,
                        website: ""
                    };
                }
                var notes = text.substring(0, start).trim();
                var metadataText = text.substring(start + metadataPrefix.length).trim();
                try {
                    var metadata = JSON.parse(metadataText);
                    return {
                        notes: notes,
                        website: metadata.website || ""
                    };
                } catch (e) {
                    return {
                        notes: text,
                        website: ""
                    };
                }
            };

            var buildCustomerForm = function (customer) {
                var parsedDescription = parseLegacyMetadata(customer.description, customerMetadataPrefix);
                return {
                    uuid: customer.uuid || null,
                    name: customer.name,
                    website: getAttributeValue(customer, referenceData.locationWebsiteAttributeType && referenceData.locationWebsiteAttributeType.uuid) || parsedDescription.website,
                    phoneNumber: getAttributeValue(customer, referenceData.locationPhoneAttributeType && referenceData.locationPhoneAttributeType.uuid),
                    email: getAttributeValue(customer, referenceData.locationEmailAttributeType && referenceData.locationEmailAttributeType.uuid),
                    description: parsedDescription.notes,
                    address1: customer.address1,
                    address2: customer.address2,
                    cityVillage: customer.cityVillage,
                    stateProvince: customer.stateProvince,
                    country: customer.country,
                    postalCode: customer.postalCode,
                    existingAttributes: customer.attributes || []
                };
            };

            var parseLocationDescription = function (description) {
                return parseLegacyMetadata(description, locationMetadataPrefix);
            };

            var getAttributeValue = function (location, attributeTypeUuid) {
                if (!location || !attributeTypeUuid) {
                    return "";
                }
                var attribute = _.find(location.attributes || [], function (item) {
                    return !item.voided && item.attributeType && item.attributeType.uuid === attributeTypeUuid;
                });
                return attribute && attribute.value ? attribute.value : "";
            };

            var isLoginLocation = function (location) {
                return _.some(location.tags || [], function (tag) {
                    return tag.name === customerOnboardingService.constants.loginLocationTagName;
                });
            };

            $scope.hasLoginLocationTag = function (tags) {
                return _.some(tags || [], function (tag) {
                    return tag.name === customerOnboardingService.constants.loginLocationTagName;
                });
            };

            var refreshCustomers = function () {
                return customerOnboardingService.getCustomers(customerOnboardingService.constants.customerTagName).then(function (customers) {
                    $scope.customers = _.map(_.sortBy(customers, function (item) {
                        return (item.name || "").toLowerCase();
                    }), function (customer) {
                        customer._phoneNumber = getAttributeValue(customer, referenceData.locationPhoneAttributeType && referenceData.locationPhoneAttributeType.uuid);
                        customer._email = getAttributeValue(customer, referenceData.locationEmailAttributeType && referenceData.locationEmailAttributeType.uuid);
                        return customer;
                    });
                });
            };

            var rebuildLocationRows = function () {
                var searchText = ($scope.state.locationSearchText || "").toLowerCase();
                var rows = [];
                _.each($scope.customers, function (customer) {
                    _.each(customer._locations || [], function (location) {
                        var customerName = (customer.name || "").toLowerCase();
                        var locationName = (location.name || "").toLowerCase();
                        var city = (location.cityVillage || "").toLowerCase();
                        if (searchText && customerName.indexOf(searchText) === -1 &&
                            locationName.indexOf(searchText) === -1 && city.indexOf(searchText) === -1) {
                            return;
                        }
                        rows.push({
                            _rowId: customer.uuid + "-" + location.uuid,
                            customer: customer,
                            location: location
                        });
                    });
                });
                $scope.locationRows = _.sortBy(rows, function (row) {
                    return ((row.customer.name || "") + " " + (row.location.name || "")).toLowerCase();
                });
            };

            var refreshCustomerLocationSummaries = function () {
                if (!$scope.customers.length) {
                    $scope.locationRows = [];
                    return $q.when([]);
                }
                var requests = _.map($scope.customers, function (customer) {
                    return customerOnboardingService.getCustomerLocations(customer.uuid).then(function (locations) {
                        customer._locations = _.sortBy(_.map(locations, function (location) {
                            location.isLoginLocation = isLoginLocation(location);
                            return location;
                        }), function (location) {
                            return (location.name || "").toLowerCase();
                        });
                    }, function () {
                        customer._locations = [];
                    });
                });
                return $q.all(requests).then(function () {
                    rebuildLocationRows();
                });
            };

            var refreshLocations = function () {
                if (!$scope.state.selectedCustomer) {
                    $scope.customerLocations = [];
                    return $q.when([]);
                }
                return customerOnboardingService.getCustomerLocations($scope.state.selectedCustomer.uuid).then(function (locations) {
                    $scope.customerLocations = _.map(locations, function (location) {
                        location.isLoginLocation = isLoginLocation(location);
                        return location;
                    });
                });
            };

            $scope.filterCustomers = function (customer) {
                var text = ($scope.state.searchText || "").toLowerCase();
                if (!text) {
                    return true;
                }
                return (customer.name || "").toLowerCase().indexOf(text) !== -1;
            };

            var resetPanelState = function () {
                $scope.state.searchText = "";
                $scope.state.locationSearchText = "";
                $scope.state.userSearchText = "";
                $scope.state.selectedCustomer = null;
                $scope.state.selectedUser = null;
                $scope.state.showCustomerEditDetails = false;
                $scope.state.showCreateCustomerForm = false;
                $scope.state.showLocationEditDetails = false;
                $scope.state.showNewUserForm = false;
                $scope.customerForm = {};
                $scope.locationForm = {};
                $scope.newUserForm = {};
                $scope.selectedUserRoleUuids = [];
                $scope.customerLocations = [];
                $scope.users = [];
            };

            $scope.setActivePanel = function (panel) {
                resetPanelState();
                $scope.state.activePanel = panel;
                if (panel === "location") {
                    rebuildLocationRows();
                }
            };

            $scope.$watch("state.locationSearchText", function () {
                rebuildLocationRows();
            });

            $scope.$watch("state.selectedCustomer", function () {
                rebuildLocationRows();
            }, true);

            $scope.cancelCustomerEdit = function () {
                $scope.state.showCustomerEditDetails = false;
                $scope.state.showCreateCustomerForm = false;
                if (!$scope.state.selectedCustomer || !$scope.state.selectedCustomer.uuid) {
                    $scope.customerForm = {};
                }
            };

            $scope.cancelLocationEdit = function () {
                $scope.state.showLocationEditDetails = false;
                $scope.locationForm = {};
            };

            $scope.startNewCustomer = function () {
                $scope.state.activePanel = "customer";
                $scope.state.selectedCustomer = null;
                $scope.state.showCustomerEditDetails = true;
                $scope.state.showCreateCustomerForm = true;
                $scope.state.showLocationEditDetails = false;
                $scope.customerForm = {};
                $scope.locationForm = {};
                $scope.customerLocations = [];
            };

            var initNewUserForm = function () {
                $scope.newUserForm = {
                    roles: [],
                    loginLocationUuids: []
                };
            };

            $scope.startNewUser = function () {
                $scope.state.activePanel = "user";
                $scope.state.selectedCustomer = null;
                $scope.state.showNewUserForm = true;
                $scope.state.selectedUser = null;
                $scope.customerLocations = [];
                initNewUserForm();
            };

            $scope.startNewUserForCustomer = function () {
                if (!$scope.state.selectedCustomer || !$scope.state.selectedCustomer.uuid) {
                    notifyError("Select a customer first.");
                    return;
                }
                $scope.state.showNewUserForm = true;
                $scope.state.selectedUser = null;
                initNewUserForm();
                spinner.forPromise(refreshLocations());
            };

            $scope.onNewUserCustomerSelected = function () {
                var isEditingUser = $scope.state.selectedUser && $scope.state.selectedUser.uuid;
                if (!isEditingUser) {
                    $scope.newUserForm.loginLocationUuids = [];
                }
                if ($scope.state.selectedCustomer && $scope.state.selectedCustomer.uuid) {
                    spinner.forPromise(refreshLocations());
                } else {
                    $scope.customerLocations = [];
                }
            };

            $scope.getCustomerLoginLocations = function () {
                var fromCustomerLocations = _.filter($scope.customerLocations || [], function (location) {
                    return location.isLoginLocation;
                });
                if (!fromCustomerLocations.length) {
                    fromCustomerLocations = _.filter(($scope.state.selectedCustomer && $scope.state.selectedCustomer._locations) || [], function (location) {
                        return location.isLoginLocation;
                    });
                }
                var assigned = ($scope.newUserForm && $scope.newUserForm.assignedLoginLocations) || [];
                return _.uniqBy(fromCustomerLocations.concat(assigned), function (location) {
                    return location.uuid;
                });
            };

            var extractSystemId = function (userDetails) {
                var identifiers = (userDetails.person && userDetails.person.identifiers) || [];
                var preferred = _.find(identifiers, function (identifier) {
                    return identifier.preferred;
                }) || identifiers[0];
                return preferred ? preferred.identifier : userDetails.username;
            };

            var extractLoginLocationsFromProvider = function (provider) {
                var loginLocationUuids = [];
                var assignedLoginLocations = [];
                if (!provider || !referenceData.loginLocationProviderAttributeType) {
                    return {loginLocationUuids: loginLocationUuids, assignedLoginLocations: assignedLoginLocations};
                }
                _.each(provider.attributes || [], function (attribute) {
                    if (attribute.voided || !attribute.attributeType ||
                        attribute.attributeType.uuid !== referenceData.loginLocationProviderAttributeType.uuid) {
                        return;
                    }
                    var locationUuid = attribute.value && attribute.value.uuid ? attribute.value.uuid : attribute.value;
                    if (!locationUuid) {
                        return;
                    }
                    loginLocationUuids.push(locationUuid);
                    assignedLoginLocations.push({
                        uuid: locationUuid,
                        name: (attribute.value && attribute.value.name) || locationUuid
                    });
                });
                return {loginLocationUuids: loginLocationUuids, assignedLoginLocations: assignedLoginLocations};
            };

            var populateUserForm = function (userDetails, provider) {
                var preferredName = userDetails.person && userDetails.person.preferredName;
                var loginLocationData = extractLoginLocationsFromProvider(provider);
                $scope.newUserForm = {
                    username: userDetails.username,
                    systemId: userDetails.systemId,
                    email: userDetails.systemId,
                    givenName: (preferredName && preferredName.givenName) || "",
                    familyName: (preferredName && preferredName.familyName) || "",
                    gender: (userDetails.person && userDetails.person.gender) || "M",
                    roles: _.map(userDetails.roles || [], function (role) {
                        return role.uuid;
                    }),
                    loginLocationUuids: loginLocationData.loginLocationUuids,
                    assignedLoginLocations: loginLocationData.assignedLoginLocations,
                    password: "",
                    confirmPassword: ""
                };
            };

            $scope.toggleLoginLocation = function (locationUuid) {
                $scope.newUserForm.loginLocationUuids = $scope.newUserForm.loginLocationUuids || [];
                if (_.includes($scope.newUserForm.loginLocationUuids, locationUuid)) {
                    $scope.newUserForm.loginLocationUuids = _.without($scope.newUserForm.loginLocationUuids, locationUuid);
                } else {
                    $scope.newUserForm.loginLocationUuids.push(locationUuid);
                }
            };

            $scope.isLoginLocationSelected = function (locationUuid) {
                return _.includes($scope.newUserForm.loginLocationUuids || [], locationUuid);
            };

            $scope.cancelNewUser = function () {
                $scope.state.showNewUserForm = false;
                $scope.state.selectedUser = null;
                $scope.newUserForm = {};
                $scope.selectedUserRoleUuids = [];
            };

            $scope.selectCustomer = function (customer, $event) {
                if ($event) {
                    $event.preventDefault();
                    $event.stopPropagation();
                }
                $scope.state.activePanel = "customer";
                $scope.state.selectedCustomer = customer;
                $scope.state.showCustomerEditDetails = true;
                $scope.state.showCreateCustomerForm = false;
                $scope.state.showLocationEditDetails = false;
                $scope.customerForm = buildCustomerForm(customer);
                $scope.locationForm = {};
                $scope.state.selectedUser = null;
                spinner.forPromise(refreshLocations());
            };

            $scope.openCustomerLocationEditor = function (customer, location, $event) {
                if ($event) {
                    $event.preventDefault();
                    $event.stopPropagation();
                }
                $scope.state.activePanel = "location";
                $scope.state.selectedCustomer = customer;
                $scope.state.showCustomerEditDetails = false;
                $scope.state.showCreateCustomerForm = false;
                $scope.state.showLocationEditDetails = true;
                $scope.customerForm = buildCustomerForm(customer);
                $scope.state.selectedUser = null;
                spinner.forPromise(refreshLocations().then(function () {
                    if (location) {
                        $scope.editLocation(location);
                    } else {
                        $scope.newLocation();
                    }
                }));
            };

            $scope.editLocationRow = function (row, $event) {
                if ($event) {
                    $event.preventDefault();
                    $event.stopPropagation();
                }
                $scope.state.activePanel = "location";
                $scope.state.selectedCustomer = row.customer;
                $scope.state.showCustomerEditDetails = false;
                $scope.state.showCreateCustomerForm = false;
                spinner.forPromise(refreshLocations().then(function () {
                    $scope.editLocation(row.location);
                }));
            };

            $scope.startNewLocationFromPanel = function () {
                $scope.newLocation();
            };

            $scope.onLocationFormCustomerSelected = function () {
                if ($scope.state.selectedCustomer && $scope.state.selectedCustomer.uuid) {
                    spinner.forPromise(refreshLocations());
                } else {
                    $scope.customerLocations = [];
                }
            };

            $scope.openManageUsers = function (customer, $event) {
                if ($event) {
                    $event.preventDefault();
                    $event.stopPropagation();
                }
                $scope.state.activePanel = "user";
                $scope.state.selectedCustomer = customer;
                $scope.state.selectedUser = null;
                $scope.state.showNewUserForm = false;
                $scope.customerForm = buildCustomerForm(customer);
                spinner.forPromise(refreshLocations());
            };

            $scope.saveCustomer = function () {
                var customerValidationError = validateCustomerLocationForm($scope.customerForm, "Customer");
                if (customerValidationError) {
                    notifyError(customerValidationError);
                    return;
                }
                var payload = {
                    uuid: $scope.customerForm.uuid,
                    name: $scope.customerForm.name,
                    description: ($scope.customerForm.description || "").trim(),
                    address1: $scope.customerForm.address1,
                    address2: $scope.customerForm.address2,
                    cityVillage: $scope.customerForm.cityVillage,
                    stateProvince: $scope.customerForm.stateProvince,
                    country: $scope.customerForm.country,
                    postalCode: $scope.customerForm.postalCode,
                    phoneNumber: $scope.customerForm.phoneNumber,
                    email: $scope.customerForm.email,
                    website: $scope.customerForm.website,
                    existingAttributes: $scope.customerForm.existingAttributes || []
                };
                var promise = customerOnboardingService.saveCustomer(payload, referenceData.customerTag.uuid, {
                    phoneAttributeTypeUuid: referenceData.locationPhoneAttributeType && referenceData.locationPhoneAttributeType.uuid,
                    emailAttributeTypeUuid: referenceData.locationEmailAttributeType && referenceData.locationEmailAttributeType.uuid,
                    websiteAttributeTypeUuid: referenceData.locationWebsiteAttributeType && referenceData.locationWebsiteAttributeType.uuid
                }).then(function () {
                    return refreshCustomers().then(function () {
                        return refreshCustomerLocationSummaries();
                    }).then(function () {
                        notifySuccess("Customer saved successfully.");
                    });
                }, function () {
                    notifyError("Unable to save customer.");
                });
                spinner.forPromise(promise);
            };

            $scope.editLocation = function (location) {
                var parsedLocationDescription = parseLocationDescription(location.description);
                $scope.state.showLocationEditDetails = true;
                $scope.locationForm = {
                    uuid: location.uuid,
                    name: location.name,
                    description: parsedLocationDescription.notes,
                    website: getAttributeValue(location, referenceData.locationWebsiteAttributeType && referenceData.locationWebsiteAttributeType.uuid) || parsedLocationDescription.website,
                    phoneNumber: getAttributeValue(location, referenceData.locationPhoneAttributeType && referenceData.locationPhoneAttributeType.uuid),
                    email: getAttributeValue(location, referenceData.locationEmailAttributeType && referenceData.locationEmailAttributeType.uuid),
                    abdmHfrId: getAttributeValue(location, referenceData.locationAbdmHfrIdAttributeType && referenceData.locationAbdmHfrIdAttributeType.uuid),
                    abdmHfrName: getAttributeValue(location, referenceData.locationAbdmHfrNameAttributeType && referenceData.locationAbdmHfrNameAttributeType.uuid),
                    address1: location.address1,
                    address2: location.address2,
                    cityVillage: location.cityVillage,
                    stateProvince: location.stateProvince,
                    country: location.country,
                    postalCode: location.postalCode,
                    tags: location.tags || [],
                    isLoginLocation: location.isLoginLocation,
                    existingAttributes: location.attributes || []
                };
            };

            $scope.newLocation = function () {
                $scope.state.showLocationEditDetails = true;
                $scope.locationForm = {};
            };

            $scope.saveLocation = function () {
                if (!$scope.state.selectedCustomer) {
                    notifyError("Select a customer first.");
                    return;
                }
                var locationValidationError = validateCustomerLocationForm($scope.locationForm, "Location");
                if (locationValidationError) {
                    notifyError(locationValidationError);
                    return;
                }
                var promise = customerOnboardingService.saveCustomerLocation(
                    $scope.state.selectedCustomer.uuid,
                    angular.extend({}, $scope.locationForm, {
                        description: ($scope.locationForm.description || "").trim()
                    }),
                    referenceData.loginLocationTag && referenceData.loginLocationTag.uuid,
                    {
                        phoneAttributeTypeUuid: referenceData.locationPhoneAttributeType && referenceData.locationPhoneAttributeType.uuid,
                        emailAttributeTypeUuid: referenceData.locationEmailAttributeType && referenceData.locationEmailAttributeType.uuid,
                        websiteAttributeTypeUuid: referenceData.locationWebsiteAttributeType && referenceData.locationWebsiteAttributeType.uuid,
                        abdmHfrIdAttributeTypeUuid: referenceData.locationAbdmHfrIdAttributeType && referenceData.locationAbdmHfrIdAttributeType.uuid,
                        abdmHfrNameAttributeTypeUuid: referenceData.locationAbdmHfrNameAttributeType && referenceData.locationAbdmHfrNameAttributeType.uuid
                    }
                ).then(function () {
                    $scope.locationForm = {};
                    $scope.state.showLocationEditDetails = false;
                    notifySuccess("Location saved successfully.");
                    return refreshLocations().then(function () {
                        return refreshCustomerLocationSummaries();
                    }).then(function () {
                        return $q.when();
                    });
                }, function () {
                    notifyError("Unable to save location.");
                });
                spinner.forPromise(promise);
            };

            $scope.searchUsers = function () {
                var promise = customerOnboardingService.searchUsers($scope.state.userSearchText).then(function (users) {
                    $scope.users = users;
                }, function () {
                    notifyError("Unable to search users.");
                });
                spinner.forPromise(promise);
            };

            $scope.toggleRole = function (roleUuid) {
                $scope.newUserForm.roles = $scope.newUserForm.roles || [];
                if (_.includes($scope.newUserForm.roles, roleUuid)) {
                    $scope.newUserForm.roles = _.without($scope.newUserForm.roles, roleUuid);
                } else {
                    $scope.newUserForm.roles.push(roleUuid);
                }
            };

            $scope.isRoleSelected = function (roleUuid) {
                return _.includes($scope.newUserForm.roles || [], roleUuid);
            };

            var assignLoginLocationsToUser = function (userUuid, locationUuids) {
                if (!locationUuids || !locationUuids.length) {
                    return $q.when();
                }
                if (!referenceData.loginLocationProviderAttributeType) {
                    notifyError("Login Locations provider attribute type was not found.");
                    return $q.reject();
                }
                return customerOnboardingService.getProviderByUser(userUuid).then(function (provider) {
                    if (!provider || !provider.uuid) {
                        notifyError("Provider not found for user. Login locations were not assigned.");
                        return $q.when();
                    }
                    return $q.all(_.map(locationUuids, function (locationUuid) {
                        return customerOnboardingService.addProviderLoginLocation(
                            provider.uuid,
                            referenceData.loginLocationProviderAttributeType.uuid,
                            locationUuid
                        );
                    }));
                });
            };

            var createUser = function () {
                var userValidationError = validateUserForm(false);
                if (userValidationError) {
                    notifyError(userValidationError);
                    return;
                }
                var payload = {
                    username: $scope.newUserForm.username,
                    password: $scope.newUserForm.password,
                    systemId: $scope.newUserForm.email,
                    person: {
                        givenName: $scope.newUserForm.givenName,
                        familyName: $scope.newUserForm.familyName
                    },
                    gender: $scope.newUserForm.gender || "M",
                    roles: $scope.newUserForm.roles ? $scope.newUserForm.roles.join(",") : null,
                    locations: $scope.newUserForm.loginLocationUuids ? $scope.newUserForm.loginLocationUuids.join(",") : null
                };
                var promise = customerOnboardingService.saveUser(payload).then(function () {
                    notifySuccess("User created successfully.");
                    $scope.state.showNewUserForm = false;
                    $scope.newUserForm = {};
                    $scope.state.userSearchText = payload.username;
                    return customerOnboardingService.searchUsers(payload.username).then(function (users) {
                        $scope.users = users;
                    });
                }, function () {
                    notifyError("Unable to create user.");
                });
                spinner.forPromise(promise);
            };

            $scope.selectUser = function (user) {
                $scope.state.showNewUserForm = false;
                $scope.state.selectedUser = user;
                $scope.selectedUserRoleUuids = [];
                var loadPromise = $q.all([
                    customerOnboardingService.getUserByUuid(user.uuid),
                    customerOnboardingService.getProviderByUser(user.uuid)
                ]).then(function (results) {
                    populateUserForm(results[0], results[1]);
                    if ($scope.state.selectedCustomer && $scope.state.selectedCustomer.uuid) {
                        return refreshLocations();
                    }
                }, function () {
                    notifyError("Unable to load user details.");
                    populateUserForm(user, null);
                });
                spinner.forPromise(loadPromise);
            };

            var updateUser = function () {
                var userValidationError = validateUserForm(true);
                if (userValidationError) {
                    notifyError(userValidationError);
                    return;
                }
                var payload = {
                    username: $scope.newUserForm.username,
                    userUuid: $scope.state.selectedUser.uuid,
                    systemId: $scope.newUserForm.email,
                    person: {
                        givenName: $scope.newUserForm.givenName,
                        familyName: $scope.newUserForm.familyName
                    },
                    gender: $scope.newUserForm.gender || "M",
                    roles: $scope.newUserForm.roles ? $scope.newUserForm.roles.join(",") : null,
                    locations: $scope.newUserForm.loginLocationUuids ? $scope.newUserForm.loginLocationUuids.join(",") : null
                };
                if ($scope.newUserForm.password) {
                    payload.password = $scope.newUserForm.password;
                }
                var promise = customerOnboardingService.saveUser(payload).then(function () {
                    notifySuccess("User updated successfully.");
                    $scope.state.showNewUserForm = false;
                    $scope.state.selectedUser = null;
                    $scope.newUserForm = {};
                    $scope.state.userSearchText = payload.username;
                    return customerOnboardingService.searchUsers(payload.username).then(function (users) {
                        $scope.users = users;
                    });
                }, function () {
                    notifyError("Unable to update user.");
                });
                spinner.forPromise(promise);
            };

            $scope.saveUser = function () {
                if ($scope.state.selectedUser && $scope.state.selectedUser.uuid) {
                    updateUser();
                } else {
                    createUser();
                }
            };

            var initialize = function () {
                var promise = customerOnboardingService.loadReferenceData().then(function (data) {
                    referenceData = data || {};
                    if (!referenceData.customerTag) {
                        notifyError("Location tag 'Customer' was not found. Please create it in OpenMRS first.");
                        return;
                    }
                    if (!referenceData.locationPhoneAttributeType || !referenceData.locationEmailAttributeType || !referenceData.locationWebsiteAttributeType) {
                        notifyError("Location attribute types 'Phone Number', 'Email', and 'Website' should exist in OpenMRS.");
                    }
                    if (!referenceData.locationAbdmHfrIdAttributeType || !referenceData.locationAbdmHfrNameAttributeType) {
                        notifyError("Location attribute types 'ABDM HFR ID' and 'ABDM HFR Name' should exist in OpenMRS.");
                    }
                    return $q.all([
                        refreshCustomers().then(function () {
                            return refreshCustomerLocationSummaries();
                        }),
                        customerOnboardingService.getRoles().then(function (roles) {
                            $scope.roles = _.sortBy(roles, function (role) {
                                return (role.display || role.name || "").toLowerCase();
                            });
                        }, function () {
                            notifyError("Unable to load roles.");
                            $scope.roles = [];
                        })
                    ]);
                }, function () {
                    notifyError("Unable to load onboarding reference data.");
                });
                spinner.forPromise(promise);
            };

            initialize();
        }]);
