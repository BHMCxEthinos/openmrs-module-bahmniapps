'use strict';

angular.module('opd.documentupload')
    .directive('fileUpload', [function () {
        var link = function (scope, element) {

            element.bind("change", function () {
                var files = element[0].files;
                angular.forEach(files, function (file) {
                    // Check file size BEFORE converting to base64
                    var MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
                    if (file.size > MAX_FILE_SIZE) {
                        scope.$apply(function () {
                            scope.onSelect()(
                                null,
                                scope.visit,
                                file.name,
                                file.type,
                                file
                            );
                        });
                        return;
                    }

                    var reader = new FileReader();

                    reader.onload = function (event) {
                        scope.$apply(function () {
                            scope.onSelect()(
                                event.target.result,
                                scope.visit,
                                file.name,
                                file.type,
                                file
                            );
                        });
                    };
                    reader.readAsDataURL(file);
                });

                // Allow selecting the same file again
                element.val('');
            });
        };
        return {
            restrict: 'A',
            scope: {
                'visit': '=',
                'onSelect': '&'
            },
            link: link
        };
    }]);
