document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const tiltAngleInput = document.getElementById('tilt_angle');
    const refIndexInput = document.getElementById('ref_index');
    const wavelengthInput = document.getElementById('wvl');
    const thicknessInput = document.getElementById('thic');
    const outputResultSpan = document.getElementById('outputResult');
    const canvas = document.getElementById('opticalCanvas');
    const ctx = canvas.getContext('2d');

    // --- Calculation Function ---
    function calculateBeamOffset() {
        const tiltAngleDeg = parseFloat(tiltAngleInput.value);
        const n2 = parseFloat(refIndexInput.value);
        const thickness = parseFloat(thicknessInput.value);
        const wavelength = parseFloat(wavelengthInput.value);

        let isValid = true;
        let errorMsg = "--";

        if (isNaN(tiltAngleDeg) || isNaN(n2) || isNaN(thickness) || isNaN(wavelength)) {
            errorMsg = "Invalid Input"; isValid = false;
        } else if (n2 < 1) {
            errorMsg = "n must be >= 1"; isValid = false;
        } else if (thickness < 0) {
             errorMsg = "Thickness must be >= 0"; isValid = false;
        } else if (tiltAngleDeg <= -90 || tiltAngleDeg >= 90) {
             errorMsg = "Angle must be between -90 & 90°"; isValid = false;
        }

        if (!isValid) {
            outputResultSpan.textContent = errorMsg; clearCanvas(); return;
        }
        // Handle zero thickness separately (for calculation and drawing)
        if (thickness === 0) {
             outputResultSpan.textContent = (0.0).toFixed(3);
             // Pass thickness=0 to drawing function for special handling
             drawVisualization(0, 0, n2, 0, wavelength, 0);
             return;
        }

        const n1 = 1.0;
        const tiltAngleRad = tiltAngleDeg * (Math.PI / 180);
        const sinTheta1 = Math.sin(tiltAngleRad);
        let sinTheta2 = (n1 / n2) * sinTheta1;
        sinTheta2 = Math.max(-1.0, Math.min(1.0, sinTheta2));
        const theta2Rad = Math.asin(sinTheta2);

        let translDist = 0;
         if (Math.abs(Math.cos(theta2Rad)) > 1e-9) {
             translDist = thickness * Math.sin(tiltAngleRad - theta2Rad) / Math.cos(theta2Rad);
         }

        outputResultSpan.textContent = translDist.toFixed(3);
        drawVisualization(tiltAngleRad, theta2Rad, n2, thickness, wavelength, translDist);
    }

    // --- Drawing Function ---
    function drawVisualization(theta1, theta2, n_window, thickness_mm, wavelength_nm, displacement_mm) {
        clearCanvas();

        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const windowColor = 'rgba(173, 216, 230, 0.6)';
        const windowBorderColor = '#00008B';
        const beamColor = wavelengthToRgb(wavelength_nm);
        const scaleFactor = 10;

        // Handle zero thickness case for drawing
        if (thickness_mm <= 0) {
             const defaultBeamWidth = 2; // Use a thin default width
             ctx.lineWidth = defaultBeamWidth;
             ctx.strokeStyle = beamColor;
             ctx.beginPath(); ctx.moveTo(0, canvasHeight / 2); ctx.lineTo(canvasWidth, canvasHeight / 2); ctx.stroke();
             return; // Don't draw window etc.
        }

        const windowThicknessPx = Math.max(5, thickness_mm * scaleFactor);
        const halfThick = windowThicknessPx / 2;
        const windowDrawingLengthPx = canvasHeight * 0.9;
        const halfLen = windowDrawingLengthPx / 2;
        const windowCenterX = canvasWidth / 2;
        const beamCenterY = canvasHeight / 2;

        // Draw Tilted Window
        ctx.save(); ctx.translate(windowCenterX, beamCenterY); ctx.rotate(-theta1);
        ctx.fillStyle = windowColor; ctx.strokeStyle = windowBorderColor; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.rect(-halfThick, -halfLen, windowThicknessPx, windowDrawingLengthPx);
        ctx.fill(); ctx.stroke();
        ctx.restore();

        // --- Calculate Dynamic Beam Width ---
        const displacement_px = displacement_mm * scaleFactor;
        const targetWidth = Math.abs(displacement_px * 0.3);
        // Clamp width between 1px and a max (e.g., 20px)
        const dynamicBeamWidth = Math.max(1, Math.min(targetWidth, 20));
        // --- End Dynamic Beam Width ---


        // Calculate Intersection Points
        ctx.lineWidth = dynamicBeamWidth; // Set calculated dynamic width
        ctx.strokeStyle = beamColor;

        let x_b1, y_b1, x_b2, y_b2;
        const cosTheta1 = Math.cos(theta1);
        const tanTheta1 = Math.tan(theta1);
        const epsilon = 1e-9;

        if (Math.abs(cosTheta1) < epsilon) {
            ctx.fillStyle = 'red'; ctx.font = '12px Roboto'; ctx.textAlign = 'center';
            ctx.fillText('Beam visualization inaccurate near ±90° incidence.', canvasWidth / 2, 20);
            return;
        }

        y_b1 = beamCenterY;
        x_b1 = windowCenterX - halfThick / cosTheta1;
        y_b2 = beamCenterY + displacement_px;
        x_b2 = windowCenterX + halfThick / cosTheta1 + displacement_px * tanTheta1;

        // Draw Main Beam Segments (uses dynamicBeamWidth)
        ctx.beginPath(); ctx.moveTo(0, y_b1); ctx.lineTo(x_b1, y_b1); ctx.stroke(); // Incoming
        ctx.beginPath(); ctx.moveTo(x_b1, y_b1); ctx.lineTo(x_b2, y_b2); ctx.stroke(); // Inside
        ctx.beginPath(); ctx.moveTo(x_b2, y_b2); ctx.lineTo(canvasWidth, y_b2); ctx.stroke(); // Outgoing

        // Draw Continuation Line
        // Base continuation width on the dynamic width, ensure minimum of 1px
        const continuationLineWidth = Math.max(1, dynamicBeamWidth * 0.2);
        ctx.lineWidth = continuationLineWidth;
        ctx.setLineDash([5, 3]); // Dashed pattern
        // Stroke color is already beamColor
        ctx.beginPath();
        ctx.moveTo(x_b1, y_b1);
        ctx.lineTo(canvasWidth, y_b1); // Draw straight along original path
        ctx.stroke();
        // Reset line style
        ctx.setLineDash([]);
        // No need to reset lineWidth back unless more drawing follows this function call
    }


    // --- Helper: Clear Canvas ---
    function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

    // --- Helper: Wavelength (nm) to RGB Color ---
    function wavelengthToRgb(lambda) {
        lambda = parseFloat(lambda); let R = 0, G = 0, B = 0;
        if (lambda >= 380 && lambda < 440) { R = -(lambda - 440) / (440 - 380); B = 1.0; }
        else if (lambda >= 440 && lambda < 490) { G = (lambda - 440) / (490 - 440); B = 1.0; }
        else if (lambda >= 490 && lambda < 510) { G = 1.0; B = -(lambda - 510) / (510 - 490); }
        else if (lambda >= 510 && lambda < 580) { R = (lambda - 510) / (580 - 510); G = 1.0; }
        else if (lambda >= 580 && lambda < 645) { R = 1.0; G = -(lambda - 645) / (645 - 580); }
        else if (lambda >= 645 && lambda <= 780) { R = 1.0; }
        let factor = 0.0;
        if (lambda >= 380 && lambda < 420) factor = 0.3 + 0.7 * (lambda - 380) / (420 - 380);
        else if (lambda >= 420 && lambda < 645) factor = 1.0;
        else if (lambda >= 645 && lambda <= 780) factor = 0.3 + 0.7 * (780 - lambda) / (780 - 645);
        R = R < 0 ? 0 : R; G = G < 0 ? 0 : G; B = B < 0 ? 0 : B;
        const rInt = Math.round(255 * R * factor); const gInt = Math.round(255 * G * factor); const bInt = Math.round(255 * B * factor);
        return `rgb(${rInt}, ${gInt}, ${bInt})`;
    }

    // --- Event Listeners ---
    tiltAngleInput.addEventListener('input', calculateBeamOffset);
    refIndexInput.addEventListener('input', calculateBeamOffset);
    wavelengthInput.addEventListener('input', calculateBeamOffset);
    thicknessInput.addEventListener('input', calculateBeamOffset);

    const adjustButtons = document.querySelectorAll('.adjust-btn');
    const precision = { ref_index: 3 };

    adjustButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target;
            const inputElement = document.getElementById(targetId);
            if (!inputElement) return;
            const step = parseFloat(button.dataset.step || 1);
            const isMinus = button.classList.contains('minus-btn');
            const currentValue = parseFloat(inputElement.value);
            let newValue;
            if (isNaN(currentValue)) { newValue = isMinus ? -step : step; }
            else { newValue = isMinus ? currentValue - step : currentValue + step; }
            if (precision[targetId] !== undefined) {
                 const factor = Math.pow(10, precision[targetId]);
                 newValue = Math.round(newValue * factor) / factor;
            }
             const min = parseFloat(inputElement.min);
             if (!isNaN(min) && newValue < min) { newValue = min; }
             const max = parseFloat(inputElement.max);
              if (!isNaN(max) && newValue > max) { newValue = max; }
            let decimalPlaces = 0;
            if (Math.floor(step) !== step) { decimalPlaces = step.toString().split('.')[1]?.length || 0; }
             if (precision[targetId] !== undefined) { decimalPlaces = Math.max(decimalPlaces, precision[targetId]); }
             if (targetId === 'tilt_angle' || targetId === 'thic' || targetId === 'wvl') decimalPlaces = 0;
             if (targetId === 'ref_index') decimalPlaces = 3;
            inputElement.value = newValue.toFixed(decimalPlaces);
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        });
    });

    // --- Initial Calculation on Load ---
    calculateBeamOffset();

    // --- Focus Shift Calculation and Visualization ---
    const focusRefIndexInput = document.getElementById('focus_ref_index');
    const focusThicknessInput = document.getElementById('focus_thickness');
    const focusShiftResultSpan = document.getElementById('focusShiftResult');
    const focusCanvas = document.getElementById('focusCanvas');
    const focusCtx = focusCanvas.getContext('2d');

    function calculateFocusShift() {
        const n = parseFloat(focusRefIndexInput.value);
        const t = parseFloat(focusThicknessInput.value);

        let isValid = true;
        let errorMsg = "--";

        if (isNaN(n) || isNaN(t)) {
            errorMsg = "Invalid Input"; isValid = false;
        } else if (n < 1) {
            errorMsg = "n must be >= 1"; isValid = false;
        } else if (t < 0) {
            errorMsg = "Thickness must be >= 0"; isValid = false;
        }

        if (!isValid) {
            focusShiftResultSpan.textContent = errorMsg;
            clearFocusCanvas();
            return;
        }

        // Calculate focus shift
        const focusShift = t * (1 - 1/n);
        focusShiftResultSpan.textContent = focusShift.toFixed(3);
        drawFocusVisualization(n, t, focusShift);
    }

    function drawFocusVisualization(n, t, focusShift) {
        clearFocusCanvas();

        const canvasWidth = focusCanvas.width;
        const canvasHeight = focusCanvas.height;
        const windowColor = 'rgba(173, 216, 230, 0.6)';
        const windowBorderColor = '#00008B';
        const rayColor = '#FF0000';
        const virtualRayColor = 'rgba(255, 0, 0, 0.5)';
        const scaleFactor = 10;

        // Draw glass window
        const windowThicknessPx = t * scaleFactor;
        const windowCenterX = canvasWidth * 0.5;
        const windowTopY = canvasHeight * 0.2;
        const windowBottomY = windowTopY + canvasHeight * 0.6;

        // Draw window
        focusCtx.fillStyle = windowColor;
        focusCtx.strokeStyle = windowBorderColor;
        focusCtx.lineWidth = 1;
        focusCtx.fillRect(windowCenterX, windowTopY, windowThicknessPx, windowBottomY - windowTopY);
        focusCtx.strokeRect(windowCenterX, windowTopY, windowThicknessPx, windowBottomY - windowTopY);

        // Calculate focus positions
        const opticalAxisY = canvasHeight * 0.5;
        const virtualFocusX = canvasWidth * 0.8;
        // Calculate theoretical real focus position (we'll adjust this later)
        const theoreticalRealFocusX = virtualFocusX - (focusShift * scaleFactor); 

        // Draw optical axis
        focusCtx.strokeStyle = '#888';
        focusCtx.setLineDash([2, 2]);
        focusCtx.beginPath();
        focusCtx.moveTo(0, opticalAxisY);
        focusCtx.lineTo(canvasWidth, opticalAxisY);
        focusCtx.stroke();
        focusCtx.setLineDash([]);

        // Calculate ray starting points
        const rayStartX = 50;
        const raySpacing = 80;
        const rayY1 = opticalAxisY - raySpacing;
        const rayY2 = opticalAxisY;
        const rayY3 = opticalAxisY + raySpacing;
        
        // Store ray exit points and angles to calculate intersection
        const rayExitPoints = [];
        const rayExitAngles = [];

        // Function to draw a ray with refraction
        function drawRay(startX, startY, isVirtual = false) {
            // Calculate angle to aim at virtual focus
            const angle = Math.atan2(opticalAxisY - startY, virtualFocusX - startX);
            
            // Calculate intersection with first glass surface
            const glassEntryX = windowCenterX;
            const glassEntryY = startY + (glassEntryX - startX) * Math.tan(angle);
            
            // Draw first segment (incident ray)
            focusCtx.beginPath();
            focusCtx.moveTo(startX, startY);
            focusCtx.lineTo(glassEntryX, glassEntryY);
            focusCtx.stroke();
            
            if (isVirtual) {
                // Draw virtual ray continuing straight to virtual focus
                focusCtx.beginPath();
                focusCtx.moveTo(glassEntryX, glassEntryY);
                focusCtx.lineTo(virtualFocusX, opticalAxisY);
                focusCtx.stroke();
                return;
            }
            
            // Calculate refraction at first interface (air to glass)
            // Snell's law: n1*sin(theta1) = n2*sin(theta2)
            const incidentAngle = Math.abs(angle);
            const n1 = 1.0; // Air
            const n2 = n;   // Glass
            
            // Calculate refracted angle using Snell's law
            const sinTheta2 = (n1 / n2) * Math.sin(incidentAngle);
            const refractedAngle = Math.asin(Math.min(1.0, sinTheta2));
            
            // Preserve direction (sign) of the original angle
            const signedRefractedAngle = angle >= 0 ? refractedAngle : -refractedAngle;
            
            // Calculate exit point from glass
            const glassExitX = windowCenterX + windowThicknessPx;
            const glassExitY = glassEntryY + windowThicknessPx * Math.tan(signedRefractedAngle);
            
            // Draw ray through glass
            focusCtx.beginPath();
            focusCtx.moveTo(glassEntryX, glassEntryY);
            focusCtx.lineTo(glassExitX, glassExitY);
            focusCtx.stroke();
            
            // Calculate refraction at second interface (glass to air)
            const exitIncidentAngle = Math.abs(signedRefractedAngle);
            const sinExitAngle = (n2 / n1) * Math.sin(exitIncidentAngle);
            const exitAngle = Math.asin(Math.min(1.0, sinExitAngle));
            
            // Preserve direction of the angle
            const signedExitAngle = signedRefractedAngle >= 0 ? exitAngle : -exitAngle;
            
            // Store ray exit point and angle for intersection calculation
            rayExitPoints.push({x: glassExitX, y: glassExitY});
            rayExitAngles.push(signedExitAngle);
            
            // Draw final ray segment to where it naturally goes
            // We'll extend the ray far enough to reach past the real focus
            const rayExtendLength = canvasWidth;
            const finalX = glassExitX + rayExtendLength;
            const finalY = glassExitY + rayExtendLength * Math.tan(signedExitAngle);
            
            focusCtx.beginPath();
            focusCtx.moveTo(glassExitX, glassExitY);
            focusCtx.lineTo(finalX, finalY);
            focusCtx.stroke();
        }

        // Draw solid rays
        focusCtx.strokeStyle = rayColor;
        focusCtx.lineWidth = 2;
        drawRay(rayStartX, rayY1);
        drawRay(rayStartX, rayY2);
        drawRay(rayStartX, rayY3);
        
        // Calculate the real focus position by finding ray intersections
        const realFocusX = calculateRayIntersection(rayExitPoints, rayExitAngles);
        
        // Use theoretical value as fallback if intersection calculation failed
        const finalRealFocusX = isNaN(realFocusX) ? theoreticalRealFocusX : realFocusX;

        // Draw virtual rays (dashed)
        focusCtx.strokeStyle = virtualRayColor;
        focusCtx.setLineDash([5, 3]);
        focusCtx.lineWidth = 1;
        drawRay(rayStartX, rayY1, true);
        drawRay(rayStartX, rayY2, true);
        drawRay(rayStartX, rayY3, true);
        focusCtx.setLineDash([]);

        // Draw focus points
        const focusPointSize = 5;

        // Virtual focus
        focusCtx.fillStyle = virtualRayColor;
        focusCtx.beginPath();
        focusCtx.arc(virtualFocusX, opticalAxisY, focusPointSize, 0, 2 * Math.PI);
        focusCtx.fill();

        // Real focus
        focusCtx.fillStyle = rayColor;
        focusCtx.beginPath();
        focusCtx.arc(finalRealFocusX, opticalAxisY, focusPointSize, 0, 2 * Math.PI);
        focusCtx.fill();

        // Add labels
        focusCtx.fillStyle = '#000';
        focusCtx.font = '12px Roboto';
        focusCtx.textAlign = 'center';
        focusCtx.fillText('Virtual Focus', virtualFocusX, opticalAxisY - 15);
        focusCtx.fillText('Real Focus', finalRealFocusX, opticalAxisY + 20);
    }
    
    // Function to calculate intersection of rays
    function calculateRayIntersection(exitPoints, exitAngles) {
        if (exitPoints.length < 2) return NaN;
        
        // Use the top and bottom rays for intersection calculation
        const p1 = exitPoints[0];  // First ray exit point
        const m1 = Math.tan(exitAngles[0]);  // First ray slope
        const p2 = exitPoints[2];  // Third ray exit point
        const m2 = Math.tan(exitAngles[2]);  // Third ray slope
        
        // Check if slopes are too similar (parallel rays)
        if (Math.abs(m1 - m2) < 1e-6) return NaN;
        
        // Calculate intersection using the line equations y = mx + b
        // Where b = y - mx
        const b1 = p1.y - m1 * p1.x;
        const b2 = p2.y - m2 * p2.x;
        
        // Intersection occurs when m1*x + b1 = m2*x + b2
        // So x = (b2 - b1) / (m1 - m2)
        const intersectX = (b2 - b1) / (m1 - m2);
        
        return intersectX;
    }

    function clearFocusCanvas() {
        focusCtx.clearRect(0, 0, focusCanvas.width, focusCanvas.height);
    }

    // Add event listeners for focus shift calculator
    focusRefIndexInput.addEventListener('input', calculateFocusShift);
    focusThicknessInput.addEventListener('input', calculateFocusShift);

    // Initial calculation for focus shift
    calculateFocusShift();
});