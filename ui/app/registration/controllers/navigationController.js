'use strict';

angular.module('bahmni.registration')
    .controller('NavigationController', ['$scope', '$rootScope', '$location', 'sessionService', 'locationService', '$window', 'appService', '$sce', '$bahmniCookieStore',
        function ($scope, $rootScope, $location, sessionService, locationService, $window, appService, $sce, $bahmniCookieStore) {
            $scope.extensions = appService.getAppDescriptor().getExtensions("org.bahmni.registration.navigation", "link");
            var checkCurrentPath = function () {
                var path = $location.path();
                $scope.hasPrint = !(path === "/search" || path === "/patient/new");
                $scope.isSearchPage = (path === "/search" || path === "" || path === "/");
            };
            checkCurrentPath();
            $scope.$on('$locationChangeSuccess', function () {
                checkCurrentPath();
            });
            $scope.goTo = function (url) {
                $location.url(url);
            };
            var getActiveCookieLocation = function () {
                var cookieName = Bahmni.Common.Constants.locationCookieName || 'bahmni.user.location';
                var cookie = $bahmniCookieStore.get(cookieName);

                if (!cookie) {
                    cookie = $bahmniCookieStore.get('BAHMNI_USER_LOCATION');
                }

                if (angular.isString(cookie)) {
                    try {
                        return JSON.parse(cookie);
                    } catch (e) {
                        return { name: cookie, display: cookie };
                    }
                }
                return cookie;
            };
            // Fetch locations and match selected location
            locationService.getAllByTag('Login Location').then(function (response) {
                $scope.locations = response.data.results || response.data || [];
                var activeCookie = getActiveCookieLocation();
                if (activeCookie) {
                    $scope.selectedLocation = $scope.locations.find(function (loc) {
                        return (activeCookie.uuid && loc.uuid === activeCookie.uuid) || (activeCookie.name && (loc.name === activeCookie.name || loc.display === activeCookie.name));
                    });
                }
                if (!$scope.selectedLocation) {
                    sessionService.get().then(function (currentUser) {
                        $scope.currentUser = currentUser;
                        if (currentUser.currentLocation) {
                            $scope.selectedLocation = $scope.locations.find(function (loc) {
                                return loc.uuid === currentUser.currentLocation.uuid;
                            });
                        }
                        if (!$scope.selectedLocation && $scope.locations.length > 0) {
                            $scope.selectedLocation = $scope.locations[0];
                        }
                        if ($scope.selectedLocation) {
                            $rootScope.loggedInLocation = $scope.selectedLocation;
                        }
                    });
                } else {
                    $rootScope.loggedInLocation = $scope.selectedLocation;
                    sessionService.get().then(function (currentUser) {
                        $scope.currentUser = currentUser;
                    });
                }
            });
            // Handle location change explicitly across app and home dashboard
            $scope.onLocationChange = function (newLocation) {
                var targetLocation = newLocation || $scope.selectedLocation;
                if (!targetLocation) return;

                var locationToSave = {
                    uuid: targetLocation.uuid,
                    display: targetLocation.display || targetLocation.name,
                    name: targetLocation.name || targetLocation.display
                };
                var cookieName = Bahmni.Common.Constants.locationCookieName || 'bahmni.user.location';
                // Write updated location to cookie storage at root path '/'
                $bahmniCookieStore.put(cookieName, locationToSave, { path: '/', expires: 7 });
                $bahmniCookieStore.put('BAHMNI_USER_LOCATION', locationToSave, { path: '/', expires: 7 });
                // Sync rootScope session locations
                $rootScope.loggedInLocation = locationToSave;
                if ($rootScope.currentUser) {
                    $rootScope.currentUser.currentLocation = locationToSave;
                }
                // Call sessionService location change if supported, then refresh page context
                if (typeof sessionService.changeLocation === 'function') {
                    sessionService.changeLocation(locationToSave).finally(function () {
                        $window.location.reload();
                    });
                } else {
                    $window.location.reload();
                }
            };

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

            $scope.sync = function () {
            };
        }]);
