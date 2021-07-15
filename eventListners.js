 function setEventListners() {
    //Set the listener to the move button
    var move = document.getElementById("confirm_Move");
    move.addEventListener("click", (e) => {
        var moveFrom = document.getElementById("drop-down-from");
        var moveTo = document.getElementById("drop-down-to");
        displayAlert(false,"","");
        game.initMove(moveFrom.value,moveTo.value);
    }, false);

    //Set the listener to the reset btn
    var resetBtn = document.getElementById("reset_btn");
    resetBtn.addEventListener("click", (e) => {
        var numOfDiscs = parseInt(document.getElementById("drop-down-difficulty").value);
        //Reset init matrix
        nodes.forEach(node => {
            // Copy the initial world matrix into the actual world matrix
            node.worldMatrix = node.initMatrix.slice();
        });
        game = new Game(nodes.slice(2, numOfDiscs + 2));
        game.scaleMesurements(scaling);

        // Shut down the spot light of the victory
        spotLightColor = [0.0, 0.0, 0.0];
        enableMoveElements();

    }, false);
    
    setCameraListeners();
    setAmbientColorsListeners();
    setMouseListeners();

    var moveFrom = document.getElementById("drop-down-from");
    moveFrom.addEventListener("change", onFromChange, false);

    var textureSelected = document.getElementById("drop-down-texture");
    textureSelected.addEventListener("change", (e) => {
         loadTexture(textureSelected.value);
    });

};

function displayAlert(display,type,text) {
    var alert = document.getElementById("alert");
    if(display){
        alert.style.display = "block";
        alert.className = "alert alert-"+ type +" fade show mt-4";
        alert.textContent = text;
        //Close after a delta time
        setTimeout(() => {
            alert.style.display = "none";
        }, 2500);
    }
    else
        alert.style.display = "none";
}

function setCameraListeners(){
    var angleSlider = document.getElementById("angleSlider");
    var elevationSlider = document.getElementById("elevationSlider");
    var divElevationSlider = document.getElementById("slider1");
    var divAngleSlider = document.getElementById("slider2");
    var canvas = document.getElementById("gameCanvas");
    
    function changeLookRadius(event) {
        var nLookRadius = lookRadius + event.wheelDelta/1000.0;
        if((nLookRadius > 2.0) && (nLookRadius < 20.0)) {
            lookRadius = nLookRadius;
        }
    }

    function changeAngle(event) {    
        angle = angleSlider.value;
        divAngleSlider.innerText = " Angle:" + angleSlider.value +"°";
    }    
    
    function changeElevation(event) {
        elevation = elevationSlider.value;
        divElevationSlider.innerText = " Elev:" + elevationSlider.value +"°";
    }

    angleSlider.addEventListener("input", changeAngle);
    elevationSlider.addEventListener("input", changeElevation);
    canvas.addEventListener("mousewheel", changeLookRadius, false);
}


function setMouseListeners(){
    var fromRod = null;
    var mouseState = false;
    var lastMouseX = -100, lastMouseY = -100;
    var clickedDisc = null;
    var preMovementWorldMatrix = null;
    var preMovementCenter = null;
    var isTopDisc;
    
    function doMouseDown(event) {
        if(!game.discIsMoving){
            clickedDisc = getClickedDisc(event);
            lastMouseX = event.pageX;
            lastMouseY = event.pageY;
            
            if(clickedDisc != null) {
                mouseState = true;
                preMovementWorldMatrix = clickedDisc.node.worldMatrix;
                preMovementCenter = clickedDisc.center;
                game.rods.forEach(rod => {
                rod.discs.forEach(disc => {
                        if(clickedDisc === disc){
                            fromRod = rod;
                            isTopDisc = (fromRod.discs.indexOf(clickedDisc) === fromRod.discs.length - 1);
                        }
                    });
                });
            }
        }
    }

    function doMouseUp(event) {
        lastMouseX = -100
        lastMouseY = -100;
        var offset = 0;
        

        if(clickedDisc!=null) {
            var selectedRod = getSelectedRod(clickedDisc.center);

            if(selectedRod != null  && game.isMoveAllowed(game.rods.indexOf(fromRod)+1,game.rods.indexOf(selectedRod)+1)){
                //Vertical distance the disc have to follow: source rod stack height - disc height - destination rod stack height
                var verticalShift = fromRod.getDiscStackHeight() - clickedDisc.height - selectedRod.getDiscStackHeight();
                var finalPoisition = utils.multiplyMatrices(utils.MakeTranslateMatrix(selectedRod.center[0] - preMovementCenter[0], -verticalShift, 0.0), preMovementWorldMatrix);
                clickedDisc.node.updateWorldMatrix(finalPoisition);
                clickedDisc.center = [selectedRod.center[0], preMovementCenter[1] - verticalShift, 0.0];
                game.initMove(game.rods.indexOf(fromRod)+1,game.rods.indexOf(selectedRod)+1,false);
                enableMoveElements();
                game.checkWin();
            }else{
                //IF WRONG RELEASE POSITION
                clickedDisc.node.updateWorldMatrix(preMovementWorldMatrix);
                clickedDisc.center = preMovementCenter;
                if(selectedRod != fromRod){
                    if(!isTopDisc){
                        displayAlert(true,"danger","Remeber that you can move only the top disc of each rod");
                    }else{
                        displayAlert(true,"danger","Remeber that you can move discs only on bigger ones");
                    }
                }
                
            }
            //Reset
            clickedDisc = null;
            preMovementCenter = null;
            preMovementWorldMatrix = null;
            mouseState = false;
        }
    }

    function getSelectedRod(center){
        for(let i=0; i<3;i++){ 
            if(center[0] < game.rods[i].center[0] + game.rods[i].width && center[0] >  game.rods[i].center[0] - game.rods[i].width 
                && center[1] < game.rods[i].center[1] + game.rods[i].height && center[1] >  game.rods[i].center[1] - game.rods[i].height 
                && center[2] < game.rods[i].center[2] + game.rods[i].width && center[2] >  game.rods[i].center[2] - game.rods[i].width)

                return game.rods[i];
        }
        return null;
    }

    function doMouseMove(event) {
        if(mouseState) {
            var dx = event.pageX - lastMouseX;
            var dy = lastMouseY - event.pageY;
            lastMouseX = event.pageX;
            lastMouseY = event.pageY;
            
            var delta = lookRadius / deltaFactor;

            if(isTopDisc && ((dx != 0) || (dy != 0)) && !game.checkWin() ) {
                var oldWorldMatrix = clickedDisc.node.worldMatrix;
                var translationMatrix = utils.MakeTranslateMatrix(dx * delta, dy * delta, 0.0);
                var newWorldMatrix = utils.multiplyMatrices(translationMatrix, oldWorldMatrix);
                clickedDisc.node.updateWorldMatrix(newWorldMatrix);
                clickedDisc.center = [clickedDisc.center[0] + dx * delta, clickedDisc.center[1] + dy * delta, clickedDisc.center[2] + 0.0];
            }
        }
    }

    //Set mouse event handlers
    window.addEventListener("mousedown", doMouseDown, false);
	window.addEventListener("mouseup", doMouseUp, false);
	window.addEventListener("mousemove", doMouseMove, false);
}

function setAmbientColorsListeners() {
    var loweColorInput = document.getElementById("lowerColor");
    var upperColorInput = document.getElementById("upperColor");
    var resetBtn = document.getElementById("resetColors_btn");
    
    function hexToRGB(c) {
        if(/^#([a-f0-9]{3}){1,2}$/.test(c)){
            if(c.length== 4){
                c= '#'+[c[1], c[1], c[2], c[2], c[3], c[3]].join('');
            }
            c= '0x'+c.substring(1);
            return [ (c>>16)&255, (c>>8)&255, c&255];
        }
        return '';
    }
    loweColorInput.addEventListener("input", e => {
        var rgb = hexToRGB(e.target.value);
        ambientLightLowColor = [rgb[0]/255, rgb[1]/255, rgb[2]/255];
    }, false);

    upperColorInput.addEventListener("input", e => {
        var rgb = hexToRGB(e.target.value);
        ambientLightUpColor = [rgb[0]/255, rgb[1]/255, rgb[2]/255];
    }, false);

    resetBtn.addEventListener("click", e => {
        ambientLightLowColor = [0.0, 0.0, 0.0];
        loweColorInput.value = "#000000";
        ambientLightUpColor = [0.2, 0.2, 0.2];
        upperColorInput.value = "#333333";
    }, false);
    
}

function unableMoveElements() {
    var moveFrom = document.getElementById("drop-down-from");
    var moveTo = document.getElementById("drop-down-to");
    var move = document.getElementById("confirm_Move");

    moveFrom.disabled = true;
    moveTo.disabled = true;
    move.disabled = true;
}

function enableMoveElements() {
    var moveFrom = document.getElementById("drop-down-from");
    var moveTo = document.getElementById("drop-down-to");
    var move = document.getElementById("confirm_Move");

    moveFrom.disabled = false;
    moveTo.disabled = false;
    move.disabled = false;
}

function onFromChange() {
    var moveFrom = document.getElementById("drop-down-from");
    var moveTo = document.getElementById("drop-down-to");

    var selectedValue = moveFrom.value;
    
    for (let  j = 0, firstVisibile = true; j < moveFrom.options.length ; j++) {
        if(moveTo.options[j].value === selectedValue) {
            moveTo.options[j].style.display = "none";
        }else{
            moveTo.options[j].style.display = "block";
            if(firstVisibile) {
                firstVisibile = false;
                moveTo.selectedIndex = j;
            };
        }
    }

}

