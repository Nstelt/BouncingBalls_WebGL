/**
 * @author nstelt3@illinois.edu (Nolan Stelter)
 */


var gl;
var canvas;
var shaderProgram;
var vertexPositionBuffer;

var days=0;
var array = [];
array[1] = {};
array[1].position = vec3.fromValues(0.0, 0.0, 0.0);
array[1].velocity = vec3.fromValues(0.5, 0.5, 0.5);
array[1].acceleration = vec3.fromValues(0.5, 0.5, 0.5);
array[1].color = vec3.fromValues(0.5, 0.5, 0.5);

var drag = 0.5;	
var sphere_array = [];

var spawn_spheres = 0;
var reset_spheres = 0;

var time = 0;
var prev_time = 0;
// Create a place to store sphere geometry
var sphereVertexPositionBuffer;

//Create a place to store normals for shading
var sphereVertexNormalBuffer;

// View parameters
var eyePt = vec3.fromValues(0.0,0.0,6.0);
var viewDir = vec3.fromValues(0.0,0.0,-1.0);
var up = vec3.fromValues(0.0,1.0,0.0);
var viewPt = vec3.fromValues(0.0,0.0,0.0);

// Create the normal
var nMatrix = mat3.create();

// Create ModelView matrix
var mvMatrix = mat4.create();

//Create Projection matrix
var pMatrix = mat4.create();

var mvMatrixStack = [];

//Code to handle user interaction
var currentlyPressedKeys = {};

/** update the currently pressed keys array with true to represent that a key is currently being pressed
 *  @param {event} even of key being pressed down
 */
function handleKeyDown(event) {
        currentlyPressedKeys[event.keyCode] = true;
}

/** update the currently pressed keys array with false to represent that a key has stopped being pressed
 *  @param {event} even of key being let up
 */
function handleKeyUp(event) {
        currentlyPressedKeys[event.keyCode] = false;
}

/** Handle the input of keys and update the corresponding yaw, pitch, and roll variables, as well as movement speed increase and decrease. 
 */
function handleKeys() {
 
        if (currentlyPressedKeys[37] || currentlyPressedKeys[65]) {  //make camera roll to left
        	spawn_spheres = 1;
        }
	else if(currentlyPressedKeys[39])
	{
		reset_spheres = 1;
	}
	else 
	{
		reset_spheres = 0;
		spawn_spheres = 0;
	}
	 
	
}
//-------------------------------------------------------------------------
function setupSphereBuffers() {
    
    var sphereSoup=[];
    var sphereNormals=[];
    var numT=sphereFromSubdivision(6,sphereSoup,sphereNormals);
    console.log("Generated ", numT, " triangles"); 
    sphereVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);      
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereSoup), gl.STATIC_DRAW);
    sphereVertexPositionBuffer.itemSize = 3;
    sphereVertexPositionBuffer.numItems = numT*3;
    console.log(sphereSoup.length/9);
    
    // Specify normals to be able to do lighting calculations
    sphereVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereNormals),
                  gl.STATIC_DRAW);
    sphereVertexNormalBuffer.itemSize = 3;
    sphereVertexNormalBuffer.numItems = numT*3;
    
    console.log("Normals ", sphereNormals.length/3);     
}

//-------------------------------------------------------------------------
function drawSphere(){
 gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);
 gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, sphereVertexPositionBuffer.itemSize, 
                         gl.FLOAT, false, 0, 0);

 // Bind normal buffer
 gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
 gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 
                           sphereVertexNormalBuffer.itemSize,
                           gl.FLOAT, false, 0, 0);
 gl.drawArrays(gl.TRIANGLES, 0, sphereVertexPositionBuffer.numItems);      
}

//-------------------------------------------------------------------------
function uploadModelViewMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

//-------------------------------------------------------------------------
function uploadProjectionMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, 
                      false, pMatrix);
}

//-------------------------------------------------------------------------
function uploadNormalMatrixToShader() {
  mat3.fromMat4(nMatrix,mvMatrix);
  mat3.transpose(nMatrix,nMatrix);
  mat3.invert(nMatrix,nMatrix);
  gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, nMatrix);
}

//----------------------------------------------------------------------------------
function mvPushMatrix() {
    var copy = mat4.clone(mvMatrix);
    mvMatrixStack.push(copy);
}


//----------------------------------------------------------------------------------
function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
      throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

//----------------------------------------------------------------------------------
function setMatrixUniforms() {
    uploadModelViewMatrixToShader();
    uploadNormalMatrixToShader();
    uploadProjectionMatrixToShader();
}

//----------------------------------------------------------------------------------
function degToRad(degrees) {
        return degrees * Math.PI / 180;
}

//----------------------------------------------------------------------------------
function createGLContext(canvas) {
  var names = ["webgl", "experimental-webgl"];
  var context = null;
  for (var i=0; i < names.length; i++) {
    try {
      context = canvas.getContext(names[i]);
    } catch(e) {}
    if (context) {
      break;
    }
  }
  if (context) {
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    alert("Failed to create WebGL context!");
  }
  return context;
}

//----------------------------------------------------------------------------------
function loadShaderFromDOM(id) {
  var shaderScript = document.getElementById(id);
  
  // If we don't find an element with the specified id
  // we do an early exit 
  if (!shaderScript) {
    return null;
  }
  
  // Loop through the children for the found DOM element and
  // build up the shader source code as a string
  var shaderSource = "";
  var currentChild = shaderScript.firstChild;
  while (currentChild) {
    if (currentChild.nodeType == 3) { // 3 corresponds to TEXT_NODE
      shaderSource += currentChild.textContent;
    }
    currentChild = currentChild.nextSibling;
  }
 
  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;
  }
 
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
 
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  } 
  return shader;
}

//----------------------------------------------------------------------------------
function setupShaders() {
  vertexShader = loadShaderFromDOM("shader-phong-phong-vs");//("shader-vs");
  fragmentShader = loadShaderFromDOM("shader-phong-phong-fs");//("shader-fs");
  
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
  }

  gl.useProgram(shaderProgram);

  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
  gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

  shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
  shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
    
  shaderProgram.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");    
  shaderProgram.uniformAmbientLightColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");  
  shaderProgram.uniformDiffuseLightColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
  shaderProgram.uniformSpecularLightColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");
    
  shaderProgram.uniformAmbientMatColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientMatColor");  
  shaderProgram.uniformDiffuseMatColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseMatColor");
  shaderProgram.uniformSpecularMatColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularMatColor");   

  shaderProgram.uniformShininess = gl.getUniformLocation(shaderProgram, "uShininess");       
    
}


//-------------------------------------------------------------------------
function uploadLightsToShader(loc,a,d,s) {
  gl.uniform3fv(shaderProgram.uniformLightPositionLoc, loc);
  gl.uniform3fv(shaderProgram.uniformAmbientLightColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseLightColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularLightColorLoc, s);
}

//-------------------------------------------------------------------------
function uploadMaterialToShader(a,d,s, shiny) {
  gl.uniform3fv(shaderProgram.uniformAmbientMatColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseMatColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularMatColorLoc, s);

  gl.uniform1f(shaderProgram.uniformShininess, shiny);

}


//----------------------------------------------------------------------------------
function setupBuffers() {
    setupSphereBuffers();     
}

 
var first_run = 0;
var counter = 0;

/** Handles the physics calculation, creation or sphere objects, and setting up lights and materials and drawing of spheres 
 */
//----------------------------------------------------------------------------------
function draw() { 
    
	counter++;
	time = Date.now()/1000 - prev_time;
	prev_time = Date.now()/1000;
	var transformVec = vec3.create();
  
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // We'll use perspective 
    mat4.perspective(pMatrix,degToRad(45), gl.viewportWidth / gl.viewportHeight, 0.1, 200.0);
    // We want to look down -z, so create a lookat point in that direction    
    vec3.add(viewPt, eyePt, viewDir);
    // Then generate the lookat matrix and initialize the MV matrix to that view
    mat4.lookAt(mvMatrix,eyePt,viewPt,up);    

 

    // Set up light parameters
    var Ia = vec3.fromValues(1.0,1.0,1.0);
    var Id = vec3.fromValues(1.0,1.0,1.0);
    var Is = vec3.fromValues(1.0,1.0,1.0);

    var lightPosEye4 = vec4.fromValues(0.0,0.0,20.0,1.0);
    lightPosEye4 = vec4.transformMat4(lightPosEye4,lightPosEye4,mvMatrix);

	var lightPosEye = vec3.fromValues(lightPosEye4[0],lightPosEye4[1],lightPosEye4[2]);

    // Set up material parameters    
    var ka = vec3.fromValues(0.0,0.0,0.0);
    var kd = vec3.fromValues(0.6,0.6,0.0);
    var ks = vec3.fromValues(0.4,0.4,0.0);

	
    if(spawn_spheres) 
	{
		for(var i = 0; i < 1; i++)
		{
			var rand_x = Math.random() - Math.random();  
			var rand_y = Math.random() - Math.random();   
			var rand_z = Math.random() - Math.random();    //all of these rand value between -1 and 1
			var rand_x_vel = (Math.random()-Math.random());
			var rand_y_vel = (Math.random()-Math.random());
			var rand_z_vel = (Math.random()-Math.random());
	
			sphere_array.push({ position:vec3.fromValues(rand_x, rand_y, rand_z), velocity:vec3.fromValues(rand_x_vel, rand_y_vel, rand_z_vel), acceleration:vec3.fromValues(0.0, -6.5, 0.0), color:vec3.fromValues(Math.random(), Math.random(), Math.random()) });
		}
		
	}
	var curr_vec = vec3.create();
	if(reset_spheres)
	{
		sphere_array = [];

	}
	else
	{

		var temp_vel = vec3.create();
		var temp_vel_pow = vec3.create();
		var temp_accel = vec3.create();
		
		//calculate physics and draw all spheres
		for(var i = 0; i < sphere_array.length; i++)
		{
			mvPushMatrix();
			

			vec3.set(curr_vec, sphere_array[i].position[0], sphere_array[i].position[1], sphere_array[i].position[2]);

	
			var plane_norm = vec3.create();
			var dot_vector = vec3.create();

			//if(sphere_array[i].velocity[0] < 0.00001 && sphere_array[i].velocity[1] < 0.00001 && sphere_array[i].velocity[2] < 0.00001)
				//		sphere_array[i].velocity = vec3.fromValues(0.0, 0.0, 0.0)
					
			if((curr_vec[1] - 0.05) < -1)
			{
				//calcuate reflection velocity for hitting bottom wall 
				plane_norm = vec3.fromValues(0.0, 1.0, 0.0); 
				var dot_product = vec3.dot(sphere_array[i].velocity, plane_norm);
				dot_vector[0] =	plane_norm[0] * (2 * dot_product);
				dot_vector[1] = plane_norm[1] * (2 * dot_product); 
				dot_vector[2] = plane_norm[2] * (2 * dot_product); 
				
				vec3.sub(sphere_array[i].velocity, sphere_array[i].velocity, dot_vector); 
				
			}
			if((curr_vec[1]+0.05) > 1)
			{
				//calcuate reflection velocity for hitting top wall
				plane_norm = vec3.fromValues(0.0, -1.0, 0.0);
				var dot_product = vec3.dot(sphere_array[i].velocity, plane_norm);
				dot_vector[0] =	plane_norm[0] * (2 * dot_product);
				dot_vector[1] = plane_norm[1] * (2 * dot_product); 
				dot_vector[2] = plane_norm[2] * (2 * dot_product); 
				
				vec3.sub(sphere_array[i].velocity, sphere_array[i].velocity, dot_vector); 		
			}
			if((curr_vec[0]-0.05) < -1)
			{
				//calcuate reflection velocity for hitting left wall
				plane_norm = vec3.fromValues(1.0, 0.0, 0.0);
				var dot_product = vec3.dot(sphere_array[i].velocity, plane_norm);
				dot_vector[0] =	plane_norm[0] * (2 * dot_product);
				dot_vector[1] = plane_norm[1] * (2 * dot_product); 
				dot_vector[2] = plane_norm[2] * (2 * dot_product); 
				
				vec3.sub(sphere_array[i].velocity, sphere_array[i].velocity, dot_vector); 
			}
			if((curr_vec[0]+0.05) > 1)
			{
				//calcuate reflection velocity for hitting right wall
				plane_norm = vec3.fromValues(-1.0, 0.0, 0.0);
				var dot_product = vec3.dot(sphere_array[i].velocity, plane_norm);
				dot_vector[0] =	plane_norm[0] * (2 * dot_product);
				dot_vector[1] = plane_norm[1] * (2 * dot_product); 
				dot_vector[2] = plane_norm[2] * (2 * dot_product); 
				
				vec3.sub(sphere_array[i].velocity, sphere_array[i].velocity, dot_vector); 
			}
			if((curr_vec[2]+0.05) > 1)
			{
				//calcuate reflection velocity for hitting back wall
				plane_norm = vec3.fromValues(0.0, 0.0, -1.0);
				var dot_product = vec3.dot(sphere_array[i].velocity, plane_norm);
				dot_vector[0] =	plane_norm[0] * (2 * dot_product);
				dot_vector[1] = plane_norm[1] * (2 * dot_product); 
				dot_vector[2] = plane_norm[2] * (2 * dot_product); 
				
				vec3.sub(sphere_array[i].velocity, sphere_array[i].velocity, dot_vector); 
			}
			if((curr_vec[2]-0.05) < -1)
			{
				//calcuate reflection velocity for hitting front wall
				plane_norm = vec3.fromValues(0.0, 0.0, 1.0);
				var dot_product = vec3.dot(sphere_array[i].velocity, plane_norm);
				dot_vector[0] =	plane_norm[0] * (2 * dot_product);
				dot_vector[1] = plane_norm[1] * (2 * dot_product); 
				dot_vector[2] = plane_norm[2] * (2 * dot_product); 
				
				vec3.sub(sphere_array[i].velocity, sphere_array[i].velocity, dot_vector); 
				
			}
				

			vec3.set(transformVec, curr_vec[0], curr_vec[1], curr_vec[2]);

			temp_vel[0] = sphere_array[i].velocity[0] * time;
			temp_vel[1] = sphere_array[i].velocity[1] * time; 
			temp_vel[2] = sphere_array[i].velocity[2] * time;
			
			vec3.add(curr_vec, curr_vec, temp_vel);

			
			
				
			var drag_pow_time = Math.pow(drag, time);

			temp_vel_pow[0] = sphere_array[i].velocity[0] * drag_pow_time;
			temp_vel_pow[1] = sphere_array[i].velocity[1] * drag_pow_time; 
			temp_vel_pow[2] = sphere_array[i].velocity[2] * drag_pow_time;
			
			temp_accel[0] = sphere_array[i].acceleration[0] * time;
			temp_accel[1] = sphere_array[i].acceleration[1] * time;
			temp_accel[2] = sphere_array[i].acceleration[2] * time;			
			
			
			
			vec3.add(sphere_array[i].velocity, temp_vel_pow, temp_accel);
		
			sphere_array[i].position[0] = curr_vec[0];
			sphere_array[i].position[1] = curr_vec[1];
			sphere_array[i].position[2] = curr_vec[2];
			
			mat4.translate(mvMatrix, mvMatrix,transformVec);
			vec3.set(transformVec,0.1,0.1,0.1); 
			
    		mat4.scale(mvMatrix, mvMatrix,transformVec);
   			uploadLightsToShader(lightPosEye,Ia,Id,Is);
    		uploadMaterialToShader(ka, sphere_array[i].color,ks, 20.0);
    		setMatrixUniforms();
    		drawSphere();
    		mvPopMatrix();
		}
	}
}

//----------------------------------------------------------------------------------
function animate() {
    days=days+0.5;
}

//----------------------------------------------------------------------------------
function startup() {
  canvas = document.getElementById("myGLCanvas");
  gl = createGLContext(canvas);
  setupShaders();
  setupBuffers();
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  document.onkeydown = handleKeyDown;
  document.onkeyup = handleKeyUp;
  time = Date.now()/1000;
  tick();
}

//----------------------------------------------------------------------------------
function tick() {
    requestAnimFrame(tick);
	handleKeys();
    draw();
    animate();
}

