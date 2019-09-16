attribute float scale;
uniform float particleScale;
void main(){
    vec4 mvPosition=modelViewMatrix*vec4(position,1.);
    gl_PointSize=scale*(particleScale/-mvPosition.z);
    gl_Position=projectionMatrix*mvPosition;
}