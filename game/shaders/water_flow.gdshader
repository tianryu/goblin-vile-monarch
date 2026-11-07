shader_type canvas_item;
render_mode unshaded;
uniform float flow_time = 0.0;
varying vec4 water_tint;
void vertex() { water_tint=COLOR; }
// Mirror-repeat of the original painted water avoids a wrapped hard texture edge.
float mirrored(float v) { return 1.0 - abs(mod(v, 2.0) - 1.0); }
void fragment() {
	vec2 uv=UV;
	float depth=smoothstep(0.0,1.0,uv.y);
	float drift=flow_time*0.018;
	float ripple=sin(uv.y*25.0+flow_time*1.65)*0.006*(0.25+depth);
	float swell=sin(uv.x*19.0-flow_time*1.1)*sin(uv.y*8.0+flow_time*0.5)*0.005;
	vec2 sample_uv=vec2(mirrored(uv.x+drift+ripple),clamp(uv.y+swell,0.003,0.997));
	vec4 water=texture(TEXTURE,sample_uv);
	float sheen=sin(uv.y*47.0+flow_time*1.3+sin(uv.x*11.0-flow_time)*1.8);
	water.rgb*=1.0+sheen*0.025;
	COLOR=water*water_tint;
}
