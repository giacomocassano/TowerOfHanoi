#version 300 es

precision mediump float;

in vec3 fsNormal; //normals to pass to the fs, from object space to world
in vec3 fsPosition; //vertex positions to pass to the fs, from object space to world space
in vec2 uvFS; //UV coordinates

out vec4 outColor; //final output color

uniform vec3 mDiffColor; //material diffuse color 
uniform vec3 lightDirection; // directional light direction vec
uniform vec3 lightColor; //directional light color

uniform vec3 ambientLightUpColor;		  // For hemispheric ambient, this is the color on the top
uniform vec3 ambientLightLowColor;	  // For hemispheric ambient, this is the bottom color

//Parameters for the spot light
uniform vec3 spotLightPosition;
uniform vec3 spotLightDirection; 
uniform vec3 spotLightColor;
uniform float spotConeOut;
uniform float spotConeIn; //% wrt spotConeOut
uniform float target;
uniform float decay;

uniform vec3 eyePos;          //Eye position = camera position

uniform sampler2D u_texture;  //Texture slot that we are using (it is always 0 because we have only one texture)

//Compute lambert diffuse BRDF component
vec3 diffuseBRDF(vec3 matDiffuseColor, vec3 lColor, vec3 lDir, vec3 normalVec) {
  vec4 texColor = texture(u_texture, uvFS);
  return texColor.rgb * matDiffuseColor * lColor * clamp(dot(-lDir, normalVec), 0.0, 1.0);
}

//Computer Phong specular BRDF component
vec3 specularBRDF(vec3 lightDir, vec3 lightColor, vec3 normalVec, vec3 eyeDirVec) {
  vec3 refVec = -reflect(lightDir, normalVec);
  vec3 specular = pow(clamp(dot(eyeDirVec, refVec), 0.0, 1.0), 128.0) * lightColor;
  return specular;
}

vec3 createSpotLight(vec3 lightColor, vec3 lightPos, vec3 lightDir, float target, float decay, float ConeIn, float ConeOut) {
  vec3 spotLight = lightColor * pow((target / length(lightPos - fsPosition)), decay) * 
		clamp((dot(normalize(lightPos - fsPosition), lightDir) - cos(radians(ConeOut/2.0)))/(cos(radians(ConeOut*ConeIn/2.0))-cos(radians(ConeOut/2.0))), 0.0, 1.0);
  return spotLight;
} 

vec3 hemisphericAmbient(vec3 upColor,vec3 downColor,vec3 upDir,vec3 normal){
  vec3 hemispheric = ((dot(normal,upDir)+1.0)/2.0*upColor +(1.0-dot(normal,upDir))/2.0*downColor);
  return hemispheric;
}

void main() {

  vec3 nNormal = normalize(fsNormal);
  //Compute the spot light
  vec3 spotLight = createSpotLight(spotLightColor, spotLightPosition, spotLightDirection, target, decay, spotConeIn, spotConeOut);  
  
  //Compute BRDF function = diffuse + specular component
  vec3 diffuse = diffuseBRDF(mDiffColor, lightColor, lightDirection, nNormal);
  vec3 eyeDir = -normalize(eyePos - fsPosition);
  vec3 specular = specularBRDF(lightDirection, vec3(1.0,1.0,1.0), nNormal, eyeDir); // 1.0,1.0,1.0 is the color of the reflection
  
  //Compute hemispheric lighting  
  vec3 hemisphericAmbient = hemisphericAmbient(ambientLightUpColor,ambientLightLowColor,vec3(0.0,1.0,0.0),nNormal);

  //Sum and clamp all the components: diffuse, specular, spot, hemisferic
  outColor = vec4(clamp(diffuse + specular + spotLight + hemisphericAmbient, 0.0, 1.0), texture(u_texture, uvFS).a);
}
