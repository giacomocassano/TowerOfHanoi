"use strict";

var program;    // Program composed by the two shaders
var gl;         // The WebGL rendering context associated to the canvas
var shaderDir;  // directory of the shaders
var baseDir;    // base directory of the project
var assetDir;   // directory of the shaders

//Global variables for the ambient lighting
var ambientLightLowColor = [0.0, 0.0, 0.0];     //Lower color of the Ambient
var ambientLightUpColor = [0.2, 0.2, 0.2];      //Upper color of the Ambient

//Global variables for the spot lights
var spotLightDirection = [0.0, 1.0, 0.0];  // remember that the direction of a light is from the object to the light source
var spotLightColor = [0.0, 0.0, 0.0];      // It will become green only on victory
var spotLightPosition = [4.53, 10.0, 0.0]; //Over the third rod, this position is in world coordinates
var targetSpot = 7; 
var decay = 2;
var coneInSpot = 0.5; //% wrt cone out
var coneOutSpot = 30; //this is in degree

//Parameters for Camera
var cx = 4.5; //Pos x of the camera
var cy = 0.0; //Pos y of the camera
var cz = 10.0; //Pos z of the camera
var elevation = -20.0; //0.0 to see perpendicular
var angle = 0.0; //Angle of the camera
var lookRadius = 10.0; //Zoom factor

//Scaling parameters
var scaling = 0.3;     //Scaling of the models
var deltaFactor = 375; //Factor to manage the shift of the discs with the mouse

//Transformation matrices
var projectionMatrix, perspectiveMatrix, viewMatrix, worldMatrix, WVPmatrix;

//The objects collections
var nodes = [];

//Texture
var texture;

//Game model and init difficulty
var game;
var initNumberOfDiscs = 4;
var maxNumberOfDiscs = 7;

/* Init function: get canvas, compile and link shaders */
async function init(){
    //Find the location of the directories
    var path = window.location.pathname;
    var page = path.split("/").pop();
    baseDir = window.location.href.replace(page, '');
    shaderDir = baseDir + "shaders/";
    assetDir = baseDir + "assets/";

    //Init canvas and context gl
    var canvas = document.getElementById("gameCanvas");
    gl = canvas.getContext("webgl2"); //the context [03-5]
    if (!gl) { //If cannot load GL, write error
        document.write("GL context not opened");
        return;
    }

    // Set the listners of the buttons and the mouse
    setEventListners();

    //Clear the canvas and enable depth testing
    utils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);  // Sets the viewport
    gl.clearColor(0.85, 0.85, 0.85, 1.0);                  // Gives the color to the canvas
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);   // Clears the buffers of the canvas
    gl.enable(gl.DEPTH_TEST);                              // Enables depth testing

    /* await wait since the asynchronous funtion loadFiles is completed and when 
     * it is completed use the callback function passed as second argument.
     * Function createShader and createProgram do what we have seen in 03*/
    await utils.loadFiles([shaderDir + 'vs.glsl', shaderDir + 'fs.glsl'], function (shaderText) {
      var vertexShader = utils.createShader(gl, gl.VERTEX_SHADER, shaderText[0]);     //create vertex shader
      var fragmentShader = utils.createShader(gl, gl.FRAGMENT_SHADER, shaderText[1]); //create fragment shader
      program = utils.createProgram(gl, vertexShader, fragmentShader); //create program global var
    });
    gl.useProgram(program);

     /* INIT OBJECTS */ 
        //The next line must be done in init, since it is an async function, load mesh using OBJ loader library
        var objStr = await utils.get_objstr(assetDir + "uploads_files_821916_Table.obj");
        var tmpMesh = new OBJ.Mesh(objStr);
        OBJ.initMeshBuffers(gl, tmpMesh);
    
        var tableNode = new Node();
        tableNode.worldMatrix = utils.multiplyMatrices(utils.MakeTranslateMatrix(0.0, -12.3274, 0.0), utils.MakeScaleMatrix(0.15));
        tableNode.initMatrix = utils.multiplyMatrices(utils.MakeTranslateMatrix(0.0, -12.3274, 0.0), utils.MakeScaleMatrix(0.15));
        tableNode.drawInfo = {
            materialColor: [0.6, 0.6, 0.6],
            mesh: tmpMesh,
        }
        nodes[0] = tableNode;
    
        var objStr = await utils.get_objstr(assetDir + "base.obj");
        var tmpMesh = new OBJ.Mesh(objStr);
        OBJ.initMeshBuffers(gl, tmpMesh);
    
        var baseNode = new Node();
        baseNode.worldMatrix = utils.MakeScaleMatrix(scaling);
        baseNode.initMatrix = utils.MakeScaleMatrix(scaling);
        baseNode.drawInfo = {
            materialColor: [1.0, 1.0, 1.0],
            mesh: tmpMesh,
        }
        nodes[1] = baseNode;
    
        //Creates the discs
        for(let i = 2; i < maxNumberOfDiscs + 2; i++) {
            //The next line must be done in init, since it is an async function, load mesh using OBJ loader library
            objStr = await utils.get_objstr(assetDir + "disc" + (i - 1) + ".obj");
            tmpMesh = new OBJ.Mesh(objStr);
            OBJ.initMeshBuffers(gl, tmpMesh);
    
            nodes[i] = new Node();
            nodes[i].worldMatrix = utils.MakeScaleMatrix(scaling);
            nodes[i].initMatrix = utils.MakeScaleMatrix(scaling);
            nodes[i].drawInfo = {
                materialColor: [1.0, 1.0, 1.0],
                mesh: tmpMesh,
            }
            nodes[i].setParent(nodes[1]);
        }

    //Create the game
    var discNodes = nodes.slice(2);
    game = new Game(discNodes.slice(0, initNumberOfDiscs));
    game.scaleMesurements(scaling);

    main();
}



function main() {    
    //Define directional light
    var lightDirection = utils.normalize([0.0, -0.5, -0.5], lightDirection);
    var lightColor = [0.7, 0.7, 0.7];

    //Initilize perspective matrix
    /* Make persperctive takes: 
        - the vertical field of view
        - the aspect ratio
        - the distance of the near plane
        - distance of far plane
    */
    perspectiveMatrix = utils.MakePerspective(90, gl.canvas.width/gl.canvas.height, 0.1, 100.0);

    //Links mesh attributes to shader attributes, we activate them because they are attributes and not uniforms
    var positionAttributeLocation = gl.getAttribLocation(program, "inPosition");  
    gl.enableVertexAttribArray(positionAttributeLocation);
    var normalAttributeLocation = gl.getAttribLocation(program, "inNormal");  
    gl.enableVertexAttribArray(normalAttributeLocation);
    var uvAttributeLocation = gl.getAttribLocation(program, "a_uv");  
    gl.enableVertexAttribArray(uvAttributeLocation);
    var textLocation = gl.getUniformLocation(program, "u_texture");
    
    // sets the uniforms
    gl.uniform1i(textLocation, 0);
    
    //Transformation matrices positions
    var matrixLocation = gl.getUniformLocation(program, "matrix"); //For the WVP matrix
    var vertexMatrixPositionHandle = gl.getUniformLocation(program, "pMatrix"); //For the vertex transformations
    var normalMatrixPositionHandle = gl.getUniformLocation(program, 'nMatrix'); //For the normal transformations
    //For the material and diffuse color
    var materialDiffColorHandle = gl.getUniformLocation(program, 'mDiffColor'); //For the material diffuse color of the object
    var lightDirectionHandle = gl.getUniformLocation(program, 'lightDirection'); //For the light direction
    var lightColorHandle = gl.getUniformLocation(program, 'lightColor'); //For the light color
    //Win spot light
    var spotLightDirectionHandle = gl.getUniformLocation(program, 'spotLightDirection'); //For the spot light direction
    var spotLightColorHandle = gl.getUniformLocation(program, 'spotLightColor'); //For the spot light color
    var targetHandle = gl.getUniformLocation(program, 'target');
    var decayHandle = gl.getUniformLocation(program, 'decay');
    var spotLightPositionHandle = gl.getUniformLocation(program, 'spotLightPosition'); // starting point of the cone
    var coneOutHandle = gl.getUniformLocation(program, 'spotConeOut');
    var coneInHandle = gl.getUniformLocation(program, 'spotConeIn');
    //Ambient lightining
    var ambientLightUpColorHandle = gl.getUniformLocation(program, 'ambientLightUpColor');
    var ambientLightLowColorHandle = gl.getUniformLocation(program, 'ambientLightLowColor');
    //Eye direction
    var eyePosHandle = gl.getUniformLocation(program, 'eyePos');

    //Initially load the wood texture
    loadTexture(2);

    //Call the draw scene function
    drawScene();

    function drawScene() {
        game.move();

        //Update transformation matrices
        cz = lookRadius * Math.cos(utils.degToRad(-angle)) * Math.cos(utils.degToRad(-elevation));
        cx = lookRadius * Math.sin(utils.degToRad(-angle)) * Math.cos(utils.degToRad(-elevation));
        cy = lookRadius * Math.sin(utils.degToRad(-elevation));
        
        viewMatrix = utils.MakeView(cx, cy, cz, elevation, -angle);
        projectionMatrix = utils.multiplyMatrices(perspectiveMatrix, viewMatrix);
    
        //Send uniforms of lights to GPU
        gl.uniform3fv(lightColorHandle,  lightColor); //light color
        gl.uniform3fv(lightDirectionHandle,  lightDirection); //light direction
        /* Spot light uniforms: spot light position is already expressed in world coordinates,
         * no need to transform it. Same for the light direction and the eye position. */
        gl.uniform3fv(spotLightDirectionHandle, spotLightDirection);
        gl.uniform3fv(spotLightColorHandle,spotLightColor);
        gl.uniform3fv(spotLightPositionHandle, spotLightPosition);
        gl.uniform1f(targetHandle,targetSpot);
        gl.uniform1f(coneInHandle,coneInSpot);
        gl.uniform1f(coneOutHandle,coneOutSpot);
        gl.uniform1f(decayHandle,decay);
        //Ambient light
        gl.uniform3fv(ambientLightUpColorHandle,ambientLightUpColor);
        gl.uniform3fv(ambientLightLowColorHandle,ambientLightLowColor);
        //Eye position is equal to camera position
        gl.uniform3fv(eyePosHandle, [cx, cy, cz]);

        drawObjects();

        //This function says: browser, I need to perform an animation so call
        //this function every time you need to refresh a frame
        window.requestAnimationFrame(drawScene);
    }

    /* Draws all the game elements in the scene: nodes[0] is the table, nodes[1] is
     * the base and then there are the discs. */
    function drawObjects() {
        for(let i=0; i < game.numberOfDiscs + 2; i++){
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            
            //Calculate World-View-Projection matrix
            WVPmatrix = utils.multiplyMatrices(projectionMatrix, nodes[i].worldMatrix);

            // we pass the various matrixes to WebGl by transposing them because WebGl handles matrixes by columns
            gl.uniformMatrix4fv(matrixLocation, gl.FALSE, utils.transposeMatrix(WVPmatrix));
            gl.uniformMatrix4fv(vertexMatrixPositionHandle, gl.FALSE, utils.transposeMatrix(nodes[i].worldMatrix));
            gl.uniformMatrix4fv(normalMatrixPositionHandle, gl.FALSE, utils.invertMatrix(utils.transposeMatrix(nodes[i].worldMatrix)));
        
            //This must be done for each object mesh
            gl.bindBuffer(gl.ARRAY_BUFFER, nodes[i].drawInfo.mesh.vertexBuffer); //local coordinates
            gl.vertexAttribPointer(positionAttributeLocation, nodes[i].drawInfo.mesh.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, nodes[i].drawInfo.mesh.normalBuffer);
            gl.vertexAttribPointer(normalAttributeLocation, nodes[i].drawInfo.mesh.normalBuffer.itemSize, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, nodes[i].drawInfo.mesh.textureBuffer); //Send UV coordinates
            gl.vertexAttribPointer(uvAttributeLocation, nodes[i].drawInfo.mesh.textureBuffer.itemSize, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, nodes[i].drawInfo.mesh.indexBuffer);

            //Set object diffuse color
            gl.uniform3fv(materialDiffColorHandle, nodes[i].drawInfo.materialColor);

            //Draw elements
            gl.drawElements(gl.TRIANGLES, nodes[i].drawInfo.mesh.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
        }
    }

}

function loadTexture(textureIndex) {
    // Create a texture.
    texture = gl.createTexture();
    // use texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    // bind to the TEXTURE_2D 
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Asynchronously load an image
    var imgtx = new Image();
    if(textureIndex == 1) imgtx.src = assetDir + "texture" + textureIndex + ".png";
    else imgtx.src = assetDir + "texture" + textureIndex + ".jpg";  

    imgtx.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);		
        //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgtx);	
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true); //WebGL has inverted uv coordinates
        //Define how textures are interpolated whenever their size needs to be incremented or diminished
        
        // linear interpolation applied to the texture
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        //for avoiding MipMap generation of the Texture (not all the textures has dimension PowOf2)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        //gl.generateMipmap(gl.TEXTURE_2D); //smallest copies of the texture
        
        //Load the image data in the texture object (in the GPU)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgtx);	
    }     
}


window.addEventListener("load", e => {
    init();
}, false);