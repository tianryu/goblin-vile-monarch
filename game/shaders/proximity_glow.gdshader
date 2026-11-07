shader_type canvas_item;
render_mode unshaded,blend_add;
uniform vec4 region=vec4(0.0,0.0,1.0,1.0);
uniform float glow_time=0.0;
uniform vec2 source_pixel=vec2(0.001);
uniform float outline_width=6.0;
uniform vec4 glow_color:source_color=vec4(0.91,0.85,0.48,1.0);
void vertex(){
 float margin=outline_width+2.0;
 VERTEX+=sign(VERTEX)*margin;
 UV=region.xy+region.zw*0.5+(UV-region.xy-region.zw*0.5)*(1.0+margin*2.0/(region.zw/source_pixel));
}
void fragment(){
 vec2 p=source_pixel*outline_width;
 float a=0.0;
 if(all(greaterThanEqual(UV,region.xy))&&all(lessThanEqual(UV,region.xy+region.zw)))a=texture(TEXTURE,UV).a;
 float near_a=0.0;
 for(int x=-1;x<=1;x++){for(int y=-1;y<=1;y++){
  vec2 q=UV+vec2(float(x),float(y))*p;
  if(all(greaterThanEqual(q,region.xy))&&all(lessThanEqual(q,region.xy+region.zw)))near_a=max(near_a,texture(TEXTURE,q).a);
 }}
 float breathe=0.75+0.15*sin(glow_time*3.0);
 float edge=max(0.0,near_a-a);
 COLOR=vec4(glow_color.rgb,(edge*0.88+a*0.018)*breathe*glow_color.a);
}
