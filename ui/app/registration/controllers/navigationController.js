'use strict';

angular.module('bahmni.registration')
    .controller('NavigationController', ['$scope', '$rootScope', '$location', 'sessionService', 'locationService', '$window', 'appService', '$sce', '$bahmniCookieStore',
        function ($scope, $rootScope, $location, sessionService, locationService, $window, appService, $sce, $bahmniCookieStore) {
            $scope.extensions = appService.getAppDescriptor().getExtensions("org.bahmni.registration.navigation", "link");

            var checkCurrentPath = function () {
                var currentPath = $location.path();
                $scope.hasPrint = !(currentPath === "/search" || currentPath === "/patient/new");
                $scope.isSearchPage = (currentPath === "/search" || currentPath === "" || currentPath === "/");
            };

            checkCurrentPath();

            $scope.$on('$locationChangeSuccess', function () {
                checkCurrentPath();
            });

            $scope.goTo = function (url) {
                $location.url(url);
            };

            var cookieName = Bahmni.Common.Constants.locationCookieName || 'bahmni.user.location';

            var getActiveCookieLocation = function () {
                var cookie = $bahmniCookieStore.get(cookieName) || $bahmniCookieStore.get('BAHMNI_USER_LOCATION');
                if (typeof cookie === 'string') {
                    try {
                        return JSON.parse(cookie);
                    } catch (e) {
                        return { name: cookie, display: cookie };
                    }
                }
                return cookie;
            };

            // SAFE LOCATION CHANGE (Triggers instant reload like Home Dashboard)
            $scope.onLocationChange = function (newLocation) {
                if (!newLocation) return;

                var locationData = {
                    uuid: newLocation.uuid,
                    name: newLocation.name,
                    display: newLocation.display || newLocation.name
                };

                // 1. Update Bahmni Cookies
                $bahmniCookieStore.put(cookieName, locationData, { path: '/' });
                $bahmniCookieStore.put('BAHMNI_USER_LOCATION', locationData, { path: '/' });

                // 2. Update memory references across Bahmni services
                $rootScope.location = locationData;

                if ($scope.currentUser) {
                    $scope.currentUser.currentLocation = locationData;
                }

                // 3. Clear sessionService cache safely without API calls
                if (sessionService.get && sessionService.get.promise) {
                    delete sessionService.get.promise;
                }

                // 4. Use Bahmni's built-in session update if available
                if (typeof sessionService.setSearchLocation === 'function') {
                    sessionService.setSearchLocation(locationData);
                }

                // 5. Broadcast events
                $rootScope.$broadcast('event:location-changed', locationData);
                $rootScope.$broadcast('$bahmni:locationChange', locationData);

                // 6. Force page reload to refresh search results instantly
                $window.location.reload();
            };

            var initLocation = function () {
                var activeCookie = getActiveCookieLocation();

                locationService.getAllByTag('Login Location').then(function (response) {
                    $scope.locations = response.data.results || response.data || [];

                    if (activeCookie) {
                        $scope.selectedLocation = $scope.locations.find(function (loc) {
                            return (activeCookie.uuid && loc.uuid === activeCookie.uuid) || 
                                   (activeCookie.name && (loc.name === activeCookie.name || loc.display === activeCookie.name));
                        });
                    }

                    sessionService.get().then(function (currentUser) {
                        $scope.currentUser = currentUser;

                        if (!$scope.selectedLocation && currentUser.currentLocation) {
                            $scope.selectedLocation = $scope.locations.find(function (loc) {
                                return loc.uuid === currentUser.currentLocation.uuid;
                            });
                        }

                        if (!$scope.selectedLocation && $scope.locations.length > 0) {
                            $scope.selectedLocation = $scope.locations[0];
                        }
                    });
                });
            };

            initLocation();

            $scope.htmlLabel = function (label) {
                return $sce.trustAsHtml(label);
            };

            $scope.logout = function () {
                $rootScope.errorMessage = null;
                sessionService.destroy().then(
                    function () {
                        $window.location = "../home/";
                    }
                );
            };

            $scope.sync = function () {};
        }]);
        