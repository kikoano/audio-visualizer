uniform vec3 color;
void main(){
    if(length(gl_PointCoord-vec2(.5,.5))>.520)discard;
    gl_FragColor=vec4(color,1.);
}