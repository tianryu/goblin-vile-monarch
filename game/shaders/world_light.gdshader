shader_type canvas_item;
uniform vec3 ambient_color=vec3(0.72,0.75,0.72);
varying vec4 original_color;
varying vec4 vertex_color;
void vertex(){vertex_color=COLOR;}
void fragment(){
 original_color=texture(TEXTURE,UV)*vertex_color;
 COLOR=vec4(original_color.rgb*ambient_color,original_color.a);
}
void light(){
 float relief=max(dot(NORMAL,LIGHT_DIRECTION),0.0);
 LIGHT=vec4(original_color.rgb*LIGHT_COLOR.rgb*LIGHT_ENERGY*relief,LIGHT_COLOR.a*original_color.a);
}
