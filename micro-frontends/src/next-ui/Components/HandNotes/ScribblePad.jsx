import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { pdfjs } from 'react-pdf';
import PropTypes from "prop-types";
import { Modal } from "carbon-components-react";

import { saveDocument, saveEncounter } from "./HandNotesUtils";

import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import './HandNotes.scss';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export function ScribblePad(props) {
  const modalRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lineWidth, setLineWidth] = useState(2);
  const [lineColor, setLineColor] = useState('#000000');
  const [backgroundImages, setBackgroundImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [pdfPages, setPdfPages] = useState({});
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const {patient, imageNoteConceptName, handnoteConceptName, locationUuid, encounterTypeUuid, observationMapper, closeScribblePad, onSaveSuccess} = props;
//   useEffect(() => {
//     const handleResize = () => {
//       setCanvasWidth(window.innerWidth - 40); // Adjusted for some padding
//       setCanvasHeight(window.innerHeight - 250); // Adjusted for the top and bottom controls
//     };
//
//     handleResize();
//
//     window.addEventListener('resize', handleResize);
//
//     return () => window.removeEventListener('resize', handleResize);
//   }, []);

  const startDrawing = (event) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    ctxRef.current = ctx;

    const x = event.type === 'mousedown' ? event.nativeEvent.offsetX : event.touches[0].clientX - canvas.getBoundingClientRect().left;
    const y = event.type === 'mousedown' ? event.nativeEvent.offsetY : event.touches[0].clientY - canvas.getBoundingClientRect().top;
    ctx.beginPath();
    ctx.arc(x, y, lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
    setIsDrawing(true);
  };

  const draw = (event) => {
    if (!isDrawing) return;
    const ctx = ctxRef.current;
    const x = event.type === 'mousemove' ? event.nativeEvent.offsetX : event.touches[0].clientX - canvasRef.current.getBoundingClientRect().left;
    const y = event.type === 'mousemove' ? event.nativeEvent.offsetY : event.touches[0].clientY - canvasRef.current.getBoundingClientRect().top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearDrawing = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Clear background images and reset state
    setBackgroundImages([]);
    setCurrentImageIndex(null);
  };


  const handleLineWidthChange = (event) => {
    setLineWidth(parseInt(event.target.value));
  };

  const handleColorChange = (event) => {
    setLineColor(event.target.value);
  };

  const handleImageUpload = (event) => {
    const files = event.target.files;
    const images = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type === 'application/pdf') {
        renderPdf(file);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          images.push(reader.result);
          if (images.length === files.length) {
            setBackgroundImages((prevImages) => [...prevImages, ...images]);
            if (currentImageIndex === null) {
              setCurrentImageIndex(0);
              drawImageOnCanvas(images[0]);
            }
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const renderPdf = (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const pdf = await pdfjs.getDocument({ data: reader.result }).promise;
      const pages = [];
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        await page.render(renderContext).promise;
        pages.push(canvas.toDataURL());
      }
      setPdfPages((prevPages) => ({ ...prevPages, [file.name]: pages }));
      setBackgroundImages((prevImages) => [...prevImages, ...pages]);
      if (currentImageIndex === null) {
        setCurrentImageIndex(0);
        drawImageOnCanvas(pages[0]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const switchImage = (index) => {
    setCurrentImageIndex(index);
    // No need to clear the canvas here, just draw the new image on top
    drawImageOnCanvas(backgroundImages[index]);
  };


  const removeImage = (index) => {
    setBackgroundImages((prevImages) => {
      const updatedImages = prevImages.filter((_, i) => i !== index);
      if (index === currentImageIndex) {
        setCurrentImageIndex(updatedImages.length > 0 ? 0 : null);
        if (updatedImages.length > 0) {
          drawImageOnCanvas(updatedImages[0]);
        } else {
          clearDrawing();
        }
      } else if (index < currentImageIndex) {
        setCurrentImageIndex((prevIndex) => prevIndex - 1);
      }
      return updatedImages;
    });
  };

  const drawImageOnCanvas = (imageSrc) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const image = new Image();
    image.src = imageSrc;

    image.onload = () => {
      // Clear previous drawings
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Calculate scaling factors to maintain aspect ratio
      const canvasAspectRatio = canvas.width / canvas.height;
      const imageAspectRatio = image.width / image.height;

      let drawWidth, drawHeight, offsetX, offsetY;

      if (imageAspectRatio > canvasAspectRatio) {
        // Image is wider than the canvas, scale by width
        drawWidth = canvas.width;
        drawHeight = canvas.width / imageAspectRatio;
        offsetX = 0;
        offsetY = (canvas.height - drawHeight) / 2; // Center vertically
      } else {
        // Image is taller than the canvas, scale by height
        drawHeight = canvas.height;
        drawWidth = canvas.height * imageAspectRatio;
        offsetX = (canvas.width - drawWidth) / 2; // Center horizontally
        offsetY = 0;
      }

      // Draw the image with calculated dimensions and position
      ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    };
  };

  const saveCanvas = async () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const mergedCanvas = document.createElement('canvas');
    const mergedCtx = mergedCanvas.getContext('2d');
    let dataURL;
    mergedCanvas.width = canvas.width;
    mergedCanvas.height = canvas.height;

    if (backgroundImages[currentImageIndex]) {
      const image = new Image();
      image.src = backgroundImages[currentImageIndex];
      image.onload = () => {
//         mergedCtx.drawImage(image, 0, 0);
        mergedCtx.drawImage(canvas, 0, 0);
        dataURL =  mergedCanvas.toDataURL();
        save(dataURL);
      };
    } else {
      // No background image case
      mergedCtx.drawImage(canvas, 0, 0);
      dataURL = mergedCanvas.toDataURL();
      save(dataURL);
    }
  };

  const save = async (dataURL) => {
    const searchStr = ";base64";
    const format = dataURL.split(searchStr)[0].split("/")[1];
    let file = dataURL.substring(dataURL.indexOf(searchStr) + searchStr.length, dataURL.length);
    const response = await saveDocument({content: file, fileType: "image", format: format, encounterTypeName: "Consultation", patientUuid: patient.uuid});
    const imageName = response.data.url;
    const saveResponse = await saveEncounter(imageName,
                            handnoteConceptName,
                            imageNoteConceptName,
                            observationMapper,
                            {patientUuid: patient.uuid, locationUuid: locationUuid, encounterTypeUuid: encounterTypeUuid, visitType: "OPD"});
    if (saveResponse.status === 200) {
      onSaveSuccess();
      closeScribblePad();
    }
  };

  const nextPage = () => {
    if (pdfPages[currentImageIndex] && currentPdfPage < pdfPages[currentImageIndex].length) {
      setCurrentPdfPage(currentPdfPage + 1);
      drawImageOnCanvas(pdfPages[currentImageIndex][currentPdfPage]);
    }
  };

  const prevPage = () => {
    if (pdfPages[currentImageIndex] && currentPdfPage > 1) {
      setCurrentPdfPage(currentPdfPage - 1);
      drawImageOnCanvas(pdfPages[currentImageIndex][currentPdfPage - 2]);
    }
  };

  const handleClose = (event) => {
    if (event.which !== 27) {
        closeScribblePad();
    }
  };

  useLayoutEffect(() => {
    if (modalRef.current) {
      const { width, height } = document.getElementsByClassName("bx--modal-container")[0].getBoundingClientRect();
      setCanvasWidth(width * 0.88);
      setCanvasHeight(height * 0.65);
    }
  }, []);

  useEffect(() => {
    if (currentImageIndex !== null && backgroundImages[currentImageIndex]) {
      drawImageOnCanvas(backgroundImages[currentImageIndex]);
    }
  }, [currentImageIndex, backgroundImages]);

  return (
    <Modal
        id="scribble-pad"
        ref={modalRef}
        open
        passiveModal
        className={`ngdialog ng-dialog-theme-default scribble-modal ${isFullScreen ? "modal-fullscreen" : "modal-normal" }`}
        onRequestClose={handleClose}
        preventCloseOnClickOutside
        modalHeading={patient.name}
    >
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'start', flexGrow: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: '20px', maxHeight: '400px', overflowY: 'auto' }}>
          <input type="file" id="imageUpload" onChange={handleImageUpload} accept="image/*,application/pdf" multiple style={{ display: 'none' }} />
          <label htmlFor="imageUpload" style={{ marginBottom: '20px', padding: '8px 16px', backgroundColor: '#008CBA', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', zIndex: 1000 }}><i class="fa fa-upload"></i></label>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {backgroundImages.map((image, index) => (
              <div key={index} style={{ position: 'relative', marginBottom: '10px' }}>
                <button onClick={() => switchImage(index)} style={{ position: 'relative', padding: '8px 16px', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', zIndex: 1000 }}>
                  Pg {index + 1}
                </button>
                <button onClick={() => removeImage(index)} style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  backgroundColor: 'red',
                  color: 'black',
                  border: 'none',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}>x</button>
                <img src={image} alt={`Background ${index + 1}`} style={{ display: 'block', marginTop: '10px', maxWidth: '150px', border: '1px solid #000' }} />
              </div>
            ))}
          </div>
          {pdfPages[currentImageIndex] && (
            <div style={{ marginTop: '10px' }}>
              <button onClick={prevPage} style={{ padding: '8px 16px', backgroundColor: '#008CBA', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px' }}>Previous Page</button>
              <button onClick={nextPage} style={{ padding: '8px 16px', backgroundColor: '#008CBA', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Next Page</button>
            </div>
          )}
        </div>
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ border: '1px solid #000', backgroundColor: 'white', cursor: 'crosshair' }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px', width: '100%', bottom: 0 }}>
        <label htmlFor="lineWidth" style={{ marginRight: '10px' }}>Line Width: </label>
        <input id="lineWidth" type="range" min="1" max="10" value={lineWidth} onChange={handleLineWidthChange} style={{ marginRight: '20px' }} />
        <label htmlFor="lineColor" style={{ marginRight: '10px' }}>Line Color: </label>
        <input id="lineColor" type="color" value={lineColor} onChange={handleColorChange} style={{ marginRight: '20px' }} />
        <button onClick={clearDrawing} style={{ marginRight: '10px', padding: '8px 16px', color: 'black', border: '#DDD 1px solid', borderRadius: '4px', cursor: 'pointer' }}>Clear</button>
        <button onClick={saveCanvas} style={{ marginRight: '10px', padding: '8px 16px', color: 'black', border: '#DDD 1px solid', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
      </div>
    </div>
    </Modal>
  );
}

ScribblePad.propTypes = {
    closeScribblePad: PropTypes.func.isRequired,
    onSaveSuccess: PropTypes.object.isRequired,
    patient: PropTypes.object.isRequired,
    handnoteConceptName: PropTypes.string.isRequired,
    imageNoteConceptName: PropTypes.string.isRequired,
    locationUuid: PropTypes.string.isRequired,
    encounterTypeUuid: PropTypes.string.isRequired,
    observationMapper: PropTypes.object.isRequired
}

