/*
 * https://github.com/legalthings/signature-pad-angular
 * Copyright (c) 2015 ; Licensed MIT
 */

angular.module('signature', []);

angular.module('signature').directive('signaturePad', ['$interval', '$timeout', '$window', 'appService', 'visitDocumentService', 'messagingService','ngDialog','encounterService','sessionService','spinner','observationsService', 'conceptSetService','conceptSetUiConfigService','$rootScope',
  function ($interval, $timeout, $window, appService, visitDocumentService, messagingService,ngDialog,encounterService,sessionService,spinner,observationsService,conceptSetService,conceptSetUiConfigService,$rootScope) {
    'use strict';

    var signaturePad, element, EMPTY_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAjgAAADcCAQAAADXNhPAAAACIklEQVR42u3UIQEAAAzDsM+/6UsYG0okFDQHMBIJAMMBDAfAcADDATAcwHAAwwEwHMBwAAwHMBzAcAAMBzAcAMMBDAcwHADDAQwHwHAAwwEMB8BwAMMBMBzAcADDATAcwHAADAcwHADDAQwHMBwAwwEMB8BwAMMBDAfAcADDATAcwHAAwwEwHMBwAAwHMBzAcAAMBzAcAMMBDAcwHADDAQwHwHAAwwEwHMBwAMMBMBzAcAAMBzAcwHAADAcwHADDAQwHMBwAwwEMB8BwAMMBDAfAcADDATAcwHAAwwEwHMBwAAwHMBzAcCQADAcwHADDAQwHwHAAwwEMB8BwAMMBMBzAcADDATAcwHAADAcwHMBwAAwHMBwAwwEMBzAcAMMBDAfAcADDAQwHwHAAwwEwHMBwAAwHMBzAcAAMBzAcAMMBDAcwHADDAQwHwHAAwwEMB8BwAMMBMBzAcADDATAcwHAADAcwHMBwAAwHMBwAwwEMB8BwAMMBDAfAcADDATAcwHAAwwEwHMBwAAwHMBzAcAAMBzAcAMMBDAcwHADDAQwHwHAAwwEMB8BwAMMBMBzAcADDkQAwHMBwAAwHMBwAwwEMBzAcAMMBDAfAcADDAQwHwHAAwwEwHMBwAMMBMBzAcAAMBzAcwHAADAcwHADDAQwHMBwAwwEMB8BwAMMBMBzAcADDATAcwHAADAcwHMBwAAwHMBwAwwEMBzAcAMMBDAegeayZAN3dLgwnAAAAAElFTkSuQmCC';   
    return {
      restrict: 'E',
      replace: true,
      template: '<div class="signature" style="width: 100%; max-width:{{width}}px; height: 100%; max-height:{{height}}px;"><canvas style="display: block; margin: 0 auto;" ng-mouseup="onMouseup()" ng-mousedown="notifyDrawing({ drawing: true })"></canvas></div>',
      scope: {
        accept: '=?',
        clear: '=?',
        disabled: '=?',
        dataurl: '=?',
        height: '@',
        width: '@',
        notifyDrawing: '&onDrawing'
        },
      controller: [  '$scope',     
        function ($scope) {
          $scope.accept = function () {
            $scope.handNoteConceptName = "Hand Note";            
            var visit = $scope.$parent.ngDialogData.visit;
            if ($scope.dataurl !== undefined || $scope.dataurl !== EMPTY_IMAGE) {              
              var observationMapper = new Bahmni.ConceptSet.ObservationMapper();
              var conceptsConfig = conceptSetUiConfigService.getConfig();
              var providerUuid = $rootScope.currentProvider.uuid;
              var handnotes= null;
              var patientUuid = $scope.$parent.ngDialogData.patientUuid;
              var locationUuid = visit.location.uuid;
              var template = null;
              var isAiProcessingEnabled = appService.getAppDescriptor().getConfigValue('enableAiProcessing');
              if (isAiProcessingEnabled) {
                visitDocumentService.processNotes($scope.dataurl, patientUuid, locationUuid, $scope.$parent.ngDialogData.encounterTypeUuid, providerUuid)
                  .then(function (response) {
                });
              }
              visitDocumentService.saveFile($scope.dataurl, patientUuid, "Consultation", "notes_" + Date.now() , "image").then(function (response) {
                // var fileUrl = Bahmni.Common.Constants.documentsPath + '/' + response.data.url;
                //var savedFile = visit.addFile(fileUrl); 
                var imagename = response.data.url;
                spinner.forPromise(observationsService.fetch(patientUuid, $scope.handNoteConceptName,
                  'latest', 1, visit["uuid"],
                  null, null))
                  .then(function (result) {
                      var obsArray = [];
                      if(result.data.length > 0) {
                          _.each(result.data, function (obs) {
                              var matched = _.find(obs.providers, {uuid: providerUuid});
                              if (matched) {
                                  obsArray.push(obs);
                              }
                          });
                          $scope.openmrsOpdSummaryObs = new Bahmni.Common.Obs.ObservationMapper().map(obsArray, conceptsConfig);
                      }
                      spinner.forPromise(conceptSetService.getConcept({
                          name: $scope.handNoteConceptName,
                          v: "bahmni"
                      }).then(function (cResponse) {
                          template = cResponse.data.results[0];
                          $scope.conceptSet = template;
                          $scope.conceptSet.conceptName = $scope.handNoteConceptName;
                          handnotes = observationMapper.map(response.data, template, conceptsConfig);
                          var groupmember={} ;
                          spinner.forPromise(conceptSetService.getConcept({
                            name: "Image Note",
                            v: "bahmni"
                        }).then(function (iResponse) {
                          var imgConcept = null;
                          imgConcept = iResponse.data.results[0];
                          var name = imgConcept.name.name;
                          var uuid = imgConcept.name.uuid;
                          var conscept = {"uuid":uuid,"name":name};
                          groupmember.conscept = conscept;
                          groupmember = handnotes.groupMembers[0];
                          groupmember.value = imagename;
                          groupmember.valueAsString=imagename;
                          handnotes.groupMembers[0]=groupmember;
                          handnotes.value = imagename;
                          $rootScope.$emit('pushObservation',handnotes);
                        }));
                  }));
              });                          
                ngDialog.close();
              });
            }
            else {
              messagingService.showMessage('error', "Can't save empty image");
            }
          };

          $scope.onMouseup = function () {
            $scope.updateModel();

            // notify that drawing has ended
            $scope.notifyDrawing({ drawing: false });
          };

          $scope.checkStatus = function () {
            return $scope.dataurl === EMPTY_IMAGE;
          };

          $scope.updateModel = function () {
            $timeout().then(function () {
              if ($scope.signaturePad.isEmpty()) {
                $scope.dataurl = EMPTY_IMAGE;
              } else {
                var originalCanvas = $scope.element.find('canvas')[0];
                var exportCanvas = document.createElement('canvas');
                exportCanvas.width = originalCanvas.width;
                exportCanvas.height = originalCanvas.height;
                var exportCtx = exportCanvas.getContext('2d');

                // White background for OCR visibility
                exportCtx.fillStyle = '#ffffff';
                exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
                exportCtx.drawImage(originalCanvas, 0, 0);

                $scope.dataurl = exportCanvas.toDataURL('image/png');
              }
            });
          };

          $scope.clear = function () {
            $scope.signaturePad.clear();
            $scope.dataurl = EMPTY_IMAGE;
          };

          $scope.$watch("dataurl", function (dataUrl) {
            if (!dataUrl || $scope.signaturePad.toDataURL() === dataUrl) {
              return;
            }

           /* $scope.setDataUrl(dataUrl);*/
          });
        }
      ],
      link: function (scope, element, attrs) {
        var canvas = element.find('canvas')[0];
        var parent = canvas.parentElement;
        var scale = 0;
        var ctx = canvas.getContext('2d');

        var width = parseInt(scope.width, 10);
        var height = parseInt(scope.height, 10);

        canvas.width = width;
        canvas.height = height;

        scope.signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });
        scope.element = element;
        scope.setDataUrl = function (dataUrl) {
          var ratio = Math.max(window.devicePixelRatio || 1, 1);

          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(ratio, ratio);

          scope.signaturePad.clear();
          scope.signaturePad.fromDataURL(dataUrl);

          $timeout().then(function () {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(1 / scale, 1 / scale);
          });
        };

        scope.$watch('disabled', function (val) {
          val ? scope.signaturePad.off() : scope.signaturePad.on();
        });

        var calculateScale = function () {
          var scaleWidth = Math.min(parent.clientWidth / width, 1);
          var scaleHeight = Math.min(parent.clientHeight / height, 1);
          var newScale = Math.min(scaleWidth, scaleHeight);

          if (newScale === scale) {
            return;
          }

          var newWidth = Math.round(width * newScale);
          var newHeight = Math.round(height * newScale);

          // Resize the pixel buffer to match display size
          // This keeps getBoundingClientRect() in sync with actual drawing coords
          canvas.width = newWidth;
          canvas.height = newHeight;
          canvas.style.width = newWidth + "px";
          canvas.style.height = newHeight + "px";
          canvas.style.transform = '';

          // Reset context — no scaling transform needed since buffer == display
          ctx.setTransform(1, 0, 0, 1, 0, 0);

          // Re-init SignaturePad so it picks up new canvas dimensions
          scope.signaturePad.clear();

          scale = newScale;
        };
        var resizeIH = $interval(calculateScale, 200);
        scope.$on('$destroy', function () {
          $interval.cancel(resizeIH);
          resizeIH = null;
        });

        angular.element($window).bind('resize', calculateScale);
        scope.$on('$destroy', function () {
          angular.element($window).unbind('resize', calculateScale);
        });

        calculateScale();

        element.on('touchstart', onTouchstart);
        element.on('touchend', onTouchend);

        function onTouchstart(event) {
          scope.$apply(function () {
            // notify that drawing has started
            scope.notifyDrawing({ drawing: true });
          });
          event.preventDefault();
        }

        function onTouchend(event) {
          scope.$apply(function () {
            // updateModel
            scope.updateModel();

            // notify that drawing has ended
            scope.notifyDrawing({ drawing: false });
          });
          event.preventDefault();
        }       
      }
    };
  }
]);

// Backward compatibility
angular.module('ngSignaturePad', ['signature']);
